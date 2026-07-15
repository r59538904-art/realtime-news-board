'use strict';
// このファイルは「RSSフィードの取得・ローカルキャッシュ・ヘッダーの更新ステータス表示」を担当する。



// ================= RSS取得・キャッシュ・更新ステータス表示 =================
const REFRESH_MS = 1*60*1000;      // 自動更新間隔(1分)
const FETCH_CONCURRENCY = 5;       // 同時に取得するソース数の上限(プロキシ側のレート制限対策)
const MAX_DISPLAY = 300;           // 一覧表示件数の上限(allorigins優先化で取得件数が増えたため150→300に引き上げ)
const MAX_AGE_MS = 2*24*60*60*1000; // 表示する記事の鮮度上限(2日以内)。配信日時が不明な記事は除外しない
const STORAGE_KEY = 'news-board-cache-v1';

// ---- 状態 ----
let itemsBySource = {};             // id -> [items]
let failedSources  = new Set();
let nextRefreshAt = Date.now() + REFRESH_MS;

// ---- キャッシュ ----
function loadCache(){
  try{
    const cachedJson = localStorage.getItem(STORAGE_KEY);
    if(cachedJson) itemsBySource = JSON.parse(cachedJson);
  }catch(e){ itemsBySource = {}; }
}
function saveCache(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsBySource)); }catch(e){}
}

// ---- ステータス表示 ----
// ・個別ソースの取得失敗は前回キャッシュ表示で吸収され実害がないため、
//   赤い警告バナーは出さず、常に落ち着いた表示にする(内部のfailedSources自体は保持し続ける)
// ・fetchAll()から呼ばれるため、fetchAllより前(上)にここで定義しておく
let statusKind = 'loading';
let statusTimer = null;
function setStatus(kind){
  statusKind = kind;
  const statusBarEl = document.getElementById('statusbar');
  statusBarEl.className = 'statusbar' + (kind==='loading' ? ' loading' : ' live');
  clearInterval(statusTimer);
  renderStatusText();
  // 取得中(loading)だけ毎秒動かす。完了したらその瞬間の時刻で表示を止める
  if(kind === 'loading') statusTimer = setInterval(renderStatusText, 1000);
}
function renderStatusText(){
  const statusTextEl = document.getElementById('statusText');
  const nowText = new Date().toLocaleTimeString('ja-JP',{hour12:false});
  if(statusKind==='loading') statusTextEl.textContent = `更新中… ${nowText}`;
  else statusTextEl.textContent = `最終更新 ${nowText} ・ リアルタイム更新中`;
}

// ---- 取得: allorigins+XMLパース → rss2json の順にフォールバック ----
// ・allorigins経由は元RSSの生XMLをそのまま取れるため、rss2json側の件数上限(実測ではソースによらず
//   おおむね10件前後に切り詰められる)を受けず、フィード本来の件数(数十〜100件超のことも)を取得できる。
//   そのため記事数を稼ぐ目的で優先的に使う。
// ・allorigins側が失敗(不調/タイムアウト)した場合のみ rss2json にフォールバックする(件数は少なめだが
//   JSON形式で安定して速いことが多い)。
// ・両方失敗した場合は従来通り前回キャッシュを維持する。
// ・2段の試行それぞれに独立したタイムアウトを持たせている(以前は1つのタイムアウトを2段で共有しており、
//   1段目が遅いと2段目を試す時間がほぼ残らず「一部ソース取得失敗」が増える原因になっていたため)。
async function withFetchTimeout(fn, ms){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), ms);
  try{ return await fn(controller.signal); }
  finally{ clearTimeout(timer); }
}
async function fetchViaRss2Json(source, signal){
  const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(source.rss);
  const response = await fetch(apiUrl, {signal});
  if(!response.ok) throw new Error('rss2json http '+response.status);
  const json = await response.json();
  if(json.status !== 'ok' || !Array.isArray(json.items)) throw new Error('rss2json status: '+json.status);
  return json.items.map(rawItem=>({
    title: stripHtml(rawItem.title),
    link: rawItem.link,
    desc: stripHtml(rawItem.description).slice(0,220),
    pubDate: rawItem.pubDate ? new Date(rawItem.pubDate.replace(' ','T')+'Z').getTime() : null,
  }));
}
async function fetchViaAllOrigins(source, signal){
  const apiUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(source.rss);
  const response = await fetch(apiUrl, {signal});
  if(!response.ok) throw new Error('allorigins http '+response.status);
  const text = await response.text();
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  if(xml.querySelector('parsererror')) throw new Error('xml parse error');
  const itemNodes = [...xml.querySelectorAll('item')];
  if(itemNodes.length){
    return itemNodes.map(node=>{
      const getText = tag => node.querySelector(tag)?.textContent || '';
      const dateStr = getText('pubDate') || getText('date') || getText('dc\\:date');
      return {
        title: stripHtml(getText('title')),
        link: getText('link'),
        desc: stripHtml(getText('description')).slice(0,220),
        pubDate: dateStr ? new Date(dateStr).getTime() : null,
      };
    });
  }
  // <item>が1件もなければAtomフィード(<entry>)として解釈するフォールバック。
  // Business Insider などはRSS 2.0ではなくAtomで配信しており、リンクは<link href="...">属性、
  // 本文は<summary>/<content>、日時は<published>/<updated>に入る。RSSと同じ形に正規化して返す
  const entryNodes = [...xml.querySelectorAll('entry')];
  return entryNodes.map(node=>{
    const getText = tag => node.querySelector(tag)?.textContent || '';
    const links = [...node.querySelectorAll(':scope > link')];
    const altLink = links.find(l=>l.getAttribute('rel')==='alternate') || links.find(l=>!l.getAttribute('rel')) || links[0];
    const dateStr = getText('published') || getText('updated');
    return {
      title: stripHtml(getText('title')),
      link: altLink ? (altLink.getAttribute('href') || '') : '',
      desc: stripHtml(getText('summary') || getText('content')).slice(0,220),
      pubDate: dateStr ? new Date(dateStr).getTime() : null,
    };
  });
}
async function fetchSource(source){
  try{
    try{
      const items = await withFetchTimeout(sig => fetchViaAllOrigins(source, sig), 12000);
      failedSources.delete(source.id);
      return items;
    }catch(e1){
      const items = await withFetchTimeout(sig => fetchViaRss2Json(source, sig), 12000);
      failedSources.delete(source.id);
      return items;
    }
  }catch(e2){
    failedSources.add(source.id);
    return itemsBySource[source.id] || null; // 両方失敗時は前回キャッシュを維持
  }
}

let fetchInProgress = false;
async function fetchAll(){
  if(fetchInProgress) return; // 前回の取得がまだ終わっていなければ二重実行しない
  fetchInProgress = true;
  setStatus('loading');
  document.getElementById('refreshBtn').disabled = true;
  // 30ソースをほぼ同時に叩くとプロキシ側のレート制限にかかりやすいため、
  // 同時実行数をFETCH_CONCURRENCYに制限したワーカープールで順番に処理する
  const queue = [...SOURCES];
  async function worker(){
    let source;
    while((source = queue.shift())){
      const items = await fetchSource(source);
      if(items) itemsBySource[source.id] = items;
    }
  }
  await Promise.all(Array.from({length:FETCH_CONCURRENCY}, worker));
  saveCache();
  nextRefreshAt = Date.now() + REFRESH_MS;
  document.getElementById('refreshBtn').disabled = false;
  setStatus(failedSources.size ? 'err' : 'live');
  render();
  fetchInProgress = false;
  retryEmptySourcesSoon();
}

// 初回訪問などキャッシュが全くない状態だと、1ソースでも取得に失敗するとそのソースの記事が
// ずっと0件のままになり「ニュースが取れていない」ように見えてしまう。まだ1件も取れていない
// ソースだけを対象に、短い間隔で数回だけ追加リトライして早めに埋める(取得済みソースは対象外)。
let coldRetryCount = 0;
function retryEmptySourcesSoon(){
  const emptyIds = SOURCES.filter(source => !(itemsBySource[source.id] && itemsBySource[source.id].length)).map(source=>source.id);
  if(!emptyIds.length || coldRetryCount >= 3){ coldRetryCount = 0; return; }
  coldRetryCount++;
  setTimeout(async ()=>{
    if(fetchInProgress) return;
    fetchInProgress = true;
    await Promise.all(emptyIds.map(async id=>{
      const source = SOURCES.find(s=>s.id===id);
      const items = await fetchSource(source);
      if(items) itemsBySource[source.id] = items;
    }));
    saveCache();
    render();
    fetchInProgress = false;
    retryEmptySourcesSoon();
  }, 6000);
}
