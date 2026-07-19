'use strict';
// このファイルは「静的news.jsonの取得・ローカルキャッシュ・更新ステータス表示」を担当する。



// ================= news.json取得・キャッシュ・更新ステータス表示 =================
// 実際のRSS取得はGitHub Actions上のPythonスクリプト(scripts/fetch_news.py)が15分おきに行い、
// 結果をこのリポジトリに news.json として静的コミットしている。このファイルはその news.json を
// fetchするだけで、ブラウザから個別RSSやCORSプロキシへは一切アクセスしない(旧実装で頻発していた
// allorigins/rss2jsonの信頼性問題は、取得をサーバー側に移すことで構造的に回避している)。
const REFRESH_MS = 2*60*1000;       // news.json再取得間隔(2分)。実データはActions側で15分おきにしか
                                     // 更新されないが、取得コストが軽い(同一オリジンのJSON1本)ため
                                     // 短めに設定し、更新が反映されるまでの体感待ち時間を減らしている
const MAX_DISPLAY = 300;            // 一覧表示件数の上限
const MAX_AGE_MS = 2*24*60*60*1000; // 表示する記事の鮮度上限(2日以内)。配信日時が不明な記事は除外しない
const STORAGE_KEY = 'news-board-cache-v1';
const NEWS_JSON_PATH = 'news.json';

// ---- 状態 ----
let itemsBySource = {};             // id -> [items]
let failedSources  = new Set();     // news.json取得が失敗した場合のみ 'news.json' を1件持つ(ステータス表示の判定用)
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
// ・news.json取得失敗(file://で直接開いた場合など)は前回キャッシュ表示で吸収され実害がないため、
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

// ---- 取得: 静的news.jsonを1回fetchするだけ ----
let fetchInProgress = false;
async function fetchAll(){
  if(fetchInProgress) return; // 前回の取得がまだ終わっていなければ二重実行しない
  fetchInProgress = true;
  setStatus('loading');
  document.getElementById('refreshBtn').disabled = true;
  try{
    // GitHub PagesのCDNキャッシュ(10分)に古いJSONを掴まされないよう、毎回タイムスタンプでキャッシュを回避する
    const response = await fetch(NEWS_JSON_PATH + '?t=' + Date.now());
    if(!response.ok) throw new Error('news.json http ' + response.status);
    const data = await response.json();
    const nextItemsBySource = {};
    for(const sourceId of Object.keys(data.items || {})){
      // Python側(scripts/fetch_news.py)で既にHTMLタグ除去済みだが、二重に通しても実害はなく、
      // 監査済みのDOMParserベースstripHtml()をXSS対策の最終防衛ラインとして維持する意味がある
      nextItemsBySource[sourceId] = data.items[sourceId].map(item=>({
        title: stripHtml(item.title),
        link: item.link,
        desc: stripHtml(item.desc),
        pubDate: item.pubDate,
      }));
    }
    itemsBySource = nextItemsBySource;
    failedSources.clear();
    saveCache();
  }catch(e){
    // 取得失敗時はloadCache()で読み込んだ前回キャッシュ(itemsBySource)をそのまま表示に使い続ける
    failedSources.add('news.json');
  }
  nextRefreshAt = Date.now() + REFRESH_MS;
  document.getElementById('refreshBtn').disabled = false;
  setStatus(failedSources.size ? 'err' : 'live');
  render();
  fetchInProgress = false;
}
