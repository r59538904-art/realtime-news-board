'use strict';
// news.jsonの取得・localStorageキャッシュ・更新ステータス表示。
// RSSの実取得はGitHub Actions(scripts/fetch_news.py)が5分おきに行うため、
// ブラウザ側は生成済みのnews.jsonを読むだけでよい。

// ---- 設定 ----
const REFRESH_MS = 60 * 1000;                // news.jsonの再取得間隔(1分)
const MAX_DISPLAY = 500;                     // 一覧に表示する記事数の上限
const MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000; // 記事の鮮度上限(4日)。更新頻度の低いソースが消えない値
const STORAGE_KEY = 'news-board-cache-v1';
const NEWS_JSON_PATH = 'news.json';
const CACHE_MAX_PER_SOURCE = 100;            // キャッシュ保存時の1ソースあたり件数上限(サーバー側の上限と同値)
const CACHE_MIN_PER_SOURCE = 30;             // localStorage容量超過時に絞り込む縮小上限
const STALE_AFTER_MS = 15 * 60 * 1000;       // news.jsonの生成時刻がこれ以上古ければ「サーバー側の更新停止」とみなす

// ---- 状態 ----
let itemsBySource = {};                      // ソースid -> 記事配列
let lastFetchFailed = false;
let lastGeneratedAt = null;                  // news.jsonのgeneratedAt(サーバー側でファイルが生成された時刻)
let nextRefreshAt = Date.now() + REFRESH_MS;
let fetchInProgress = false;

// ---- 記事の無害化 ----
// news.jsonもlocalStorageのキャッシュも「信用できない外部データ」として扱い、
// 表示に使う前に必ずここを通す(タグ除去・リンク検証・日時の数値化)。
function sanitizeItems(rawItems){
  if(!Array.isArray(rawItems)) return [];
  return rawItems.map(item => ({
    title: stripHtml(item && item.title),
    desc: stripHtml(item && item.desc),
    link: isSafeUrl(item && item.link) ? item.link : '',
    pubDate: Number(item && item.pubDate) || null,
  }));
}

// ---- キャッシュ ----
// 保存(=整理)のタイミングは取得成功のたび(最短1分間隔)。
// 整理で捨てるのは「画面に表示され得ない記事」だけ:
//   ・鮮度上限を過ぎた記事(render.jsの表示判定と同じ条件。既定4日、sources.jsonのmaxAgeMs優先)
//   ・1ソース100件を超えた分(news.json自体がサーバー側で100件/ソース上限のため実際には発生しない保険)
// つまり通常運転では表示対象がこの整理で減ることはない。
function sourceMaxAge(sourceId){
  const source = SOURCES.find(s => s.id === sourceId);
  return (source && source.maxAgeMs) || MAX_AGE_MS;
}
function trimForCache(maxPerSource){
  const trimmed = {};
  for(const sourceId of Object.keys(itemsBySource)){
    const maxAge = sourceMaxAge(sourceId);
    trimmed[sourceId] = itemsBySource[sourceId]
      .filter(item => !item.pubDate || (Date.now() - item.pubDate) <= maxAge)
      .slice(0, maxPerSource);
  }
  return trimmed;
}
function saveCache(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimForCache(CACHE_MAX_PER_SOURCE)));
  }catch(e){
    // 容量超過時は1ソース30件に絞って1回だけ再試行。それでも失敗したら諦める
    // (メモリ上のitemsBySourceはそのまま生きているため表示には影響しない)
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(trimForCache(CACHE_MIN_PER_SOURCE))); }catch(e2){}
  }
}
function loadCache(){
  try{
    const cachedJson = localStorage.getItem(STORAGE_KEY);
    if(!cachedJson) return;
    const parsed = JSON.parse(cachedJson);
    for(const sourceId of Object.keys(parsed || {})){
      itemsBySource[sourceId] = sanitizeItems(parsed[sourceId]);
    }
  }catch(e){ itemsBySource = {}; }
}

// ---- ステータス表示 ----
// 5状態: loading=取得中 / live=正常 / err=news.json取得失敗(前回キャッシュで表示継続)
//        / stale=取得はできるがサーバー側でファイルが更新されていない(外部cron停止の簡易死活監視)
//        / offline=端末がオフライン(PWAのService Workerがキャッシュで応答している状態)
let statusKind = 'loading';
let statusTimer = null;
// サーバー側の更新が止まっているか(generatedAtが古いままか)を判定する
function isServerStale(){
  return !!lastGeneratedAt && (Date.now() - lastGeneratedAt) > STALE_AFTER_MS;
}
function renderStatusText(){
  const nowText = new Date().toLocaleTimeString('ja-JP', {hour12: false});
  let staleText = '';
  if(statusKind === 'stale'){
    const staleMin = Math.round((Date.now() - lastGeneratedAt) / 60000);
    const genText = new Date(lastGeneratedAt).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'});
    staleText = `サーバー側の更新が約${staleMin}分止まっています(最終生成 ${genText})`;
  }
  const messages = {
    loading: `更新中… ${nowText}`,
    live: `最終更新 ${nowText} ・ リアルタイム更新中`,
    err: `最終更新 ${nowText} ・ 前回取得分を表示中`,
    stale: staleText,
    offline: `オフライン ・ 保存済みのニュースを表示中`,
  };
  document.getElementById('statusText').textContent = messages[statusKind] || messages.live;
}
function setStatus(kind){
  statusKind = kind;
  document.getElementById('statusbar').className = 'statusbar ' + kind;
  clearInterval(statusTimer);
  renderStatusText();
  if(kind === 'loading') statusTimer = setInterval(renderStatusText, 1000);
}

// ---- 取得 ----
async function fetchAll(){
  if(fetchInProgress) return;               // 前回の取得が終わるまで二重実行しない
  fetchInProgress = true;
  setStatus('loading');
  document.getElementById('refreshBtn').disabled = true;
  try{
    // CDNに古いJSONを掴まされないよう、毎回タイムスタンプ付きで取得する
    const response = await fetch(NEWS_JSON_PATH + '?t=' + Date.now());
    if(!response.ok) throw new Error('news.json http ' + response.status);
    const data = await response.json();
    const nextItemsBySource = {};
    for(const sourceId of Object.keys(data.items || {})){
      nextItemsBySource[sourceId] = sanitizeItems(data.items[sourceId]);
    }
    itemsBySource = nextItemsBySource;
    lastGeneratedAt = Date.parse(data.generatedAt) || null;
    lastFetchFailed = false;
    saveCache();
  }catch(e){
    // 失敗時はloadCache()で復元済みの前回分をそのまま表示し続ける
    lastFetchFailed = true;
  }
  nextRefreshAt = Date.now() + REFRESH_MS;
  document.getElementById('refreshBtn').disabled = false;
  fetchInProgress = false;                  // render()で例外が起きてもガードが残らないよう先に解除する
  setStatus(
    lastFetchFailed ? 'err'
    : navigator.onLine === false ? 'offline'
    : isServerStale() ? 'stale'
    : 'live'
  );
  // 自動更新(定期実行・手動更新どちらも)による再描画はrequestRender()経由にし、
  // スマホでスクロール中に割り込んで強制的に位置が戻る事故を防ぐ(render.js側で実装)
  requestRender();
}
