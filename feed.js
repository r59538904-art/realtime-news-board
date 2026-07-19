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

// ---- 状態 ----
let itemsBySource = {};                      // ソースid -> 記事配列
let lastFetchFailed = false;
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
// 保存前に「鮮度上限(4日)を超えた記事を捨てる → 1ソース100件に丸める」の順で整理し、
// localStorage(約5MB)を溜め込みで圧迫しないようにする。
function trimForCache(maxPerSource){
  const trimmed = {};
  for(const sourceId of Object.keys(itemsBySource)){
    trimmed[sourceId] = itemsBySource[sourceId]
      .filter(item => !item.pubDate || (Date.now() - item.pubDate) <= MAX_AGE_MS)
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
// 取得失敗時(file://で直接開いた場合など)も前回キャッシュで表示は継続できるため、
// 警告色は使わず「前回取得分を表示中」と控えめに知らせるだけにする。
let statusKind = 'loading';
let statusTimer = null;
function renderStatusText(){
  const nowText = new Date().toLocaleTimeString('ja-JP', {hour12: false});
  const messages = {
    loading: `更新中… ${nowText}`,
    live: `最終更新 ${nowText} ・ リアルタイム更新中`,
    err: `最終更新 ${nowText} ・ 前回取得分を表示中`,
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
    lastFetchFailed = false;
    saveCache();
  }catch(e){
    // 失敗時はloadCache()で復元済みの前回分をそのまま表示し続ける
    lastFetchFailed = true;
  }
  nextRefreshAt = Date.now() + REFRESH_MS;
  document.getElementById('refreshBtn').disabled = false;
  fetchInProgress = false;                  // render()で例外が起きてもガードが残らないよう先に解除する
  setStatus(lastFetchFailed ? 'err' : 'live');
  render();
}
