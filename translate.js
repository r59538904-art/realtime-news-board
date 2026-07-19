'use strict';
// 英語記事の見出し・要約のEN→JA自動翻訳(MyMemory → Google非公式の2段フォールバック)。
// 同じ原文は一度だけ翻訳し、localStorageにキャッシュして再利用する。

// ---- 設定 ----
const TR_CACHE_KEY = 'news-board-tr-cache-v1';
const TR_PREF_KEY = 'news-board-tr-pref-v1';
const TR_INTERVAL_MS = 350;       // リクエスト間隔(レート制限対策)
const TR_TIMEOUT_MS = 10000;      // 1リクエストのタイムアウト
const TR_MAX_LEN = 480;           // 1件あたりの翻訳文字数上限(APIへの配慮)
const TR_DESC_LIMIT = 15;         // 要約まで翻訳する英語記事の件数(見出しは全件)
const TR_MAX_CACHE = 600;         // キャッシュがこの件数を超えたら整理する
const TR_KEEP_CACHE = 400;        // 整理後に残す件数(新しい順)。大きく残して整理直後の再翻訳を防ぐ
const TR_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 翻訳の保存期限(30日)。期限切れは起動時に削除

// ---- 状態 ----
let translateOn = true;
let trCache = {};                 // 原文 -> {ja, savedAt}
let trQueue = [];
let trQueued = new Set();
let trRunning = false;
let trQuotaHitUntil = 0;
let trSaveTimer = null;
let trRenderTimer = null;

// ---- キャッシュ ----
// 削除のタイミングは2箇所:
//   1. 起動時(loadTranslate) … 保存から30日を過ぎた翻訳を失効させる
//   2. 保存時(saveTrCache)   … 600件超過なら新しい順に400件へ整理する
function loadTranslate(){
  try{ translateOn = localStorage.getItem(TR_PREF_KEY) !== 'off'; }catch(e){}
  try{
    const cachedJson = localStorage.getItem(TR_CACHE_KEY);
    if(!cachedJson) return;
    const parsed = JSON.parse(cachedJson);
    if(!parsed || !parsed.map) return;
    const now = Date.now();
    for(const [text, entry] of Object.entries(parsed.map)){
      if(entry && typeof entry.ja === 'string' && (now - (entry.savedAt || 0)) <= TR_TTL_MS){
        trCache[text] = entry;
      }
    }
  }catch(e){ trCache = {}; }
}
function saveTrCache(){
  try{
    let entries = Object.entries(trCache);
    if(entries.length > TR_MAX_CACHE){
      entries.sort((entryA, entryB) => (entryB[1].savedAt || 0) - (entryA[1].savedAt || 0));
      trCache = Object.fromEntries(entries.slice(0, TR_KEEP_CACHE));
    }
    localStorage.setItem(TR_CACHE_KEY, JSON.stringify({v: 1, map: trCache}));
  }catch(e){}
}
function saveTrCacheDebounced(){
  if(trSaveTimer) return;
  trSaveTimer = setTimeout(() => { trSaveTimer = null; saveTrCache(); }, 1500);
}
function trGet(text){
  const cached = text && trCache[text];
  return cached ? cached.ja : null;
}

// ---- 翻訳プロバイダ ----
// タイムアウト付きAbortSignalを作る(呼び出し側がfetch後にdone()を呼ぶ)
function makeTimeoutSignal(ms){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {signal: controller.signal, done: () => clearTimeout(timer)};
}
// 第1段: MyMemory。無料枠切れ(WARNING/403/429)を検知したら翌日UTC0時までスキップする
async function trViaMyMemory(text){
  const timeout = makeTimeoutSignal(TR_TIMEOUT_MS);
  try{
    const response = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|ja', {signal: timeout.signal});
    const json = await response.json();
    const status = Number(json && json.responseStatus);
    const ja = stripHtml(json && json.responseData && json.responseData.translatedText || '');
    if(/MYMEMORY WARNING/i.test(ja) || status === 403 || status === 429){
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      trQuotaHitUntil = tomorrow.getTime();
      throw new Error('mymemory quota');
    }
    if(status !== 200 || !ja) throw new Error('mymemory failed');
    return ja;
  } finally { timeout.done(); }
}
// 第2段: Google翻訳の非公式エンドポイント(MyMemoryが使えない時だけの最終手段)
async function trViaGoogle(text){
  const timeout = makeTimeoutSignal(TR_TIMEOUT_MS);
  try{
    const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=' + encodeURIComponent(text), {signal: timeout.signal});
    if(!response.ok) throw new Error('google http ' + response.status);
    const data = await response.json();
    const ja = Array.isArray(data) && Array.isArray(data[0])
      ? data[0].map(seg => seg && seg[0] || '').join('')
      : '';
    if(!ja) throw new Error('google empty');
    return stripHtml(ja);
  } finally { timeout.done(); }
}
const TR_PROVIDERS = [
  {name: 'mymemory', skip: () => Date.now() < trQuotaHitUntil, run: trViaMyMemory},
  {name: 'google',   skip: () => false,                        run: trViaGoogle},
];

// ---- 翻訳キュー ----
// 翻訳が届くたびの再描画を400msにまとめる(1件ごとの全再描画を防ぐ)
function scheduleRender(){
  if(trRenderTimer) return;
  trRenderTimer = setTimeout(() => { trRenderTimer = null; render(); }, 400);
}
// キューを1件ずつ直列で処理する(同時実行は常に1つ)
async function trPump(){
  if(trRunning) return;
  trRunning = true;
  while(trQueue.length){
    if(!translateOn){ trQueue = []; trQueued.clear(); break; }
    const text = trQueue.shift();
    let ja = null;
    for(const provider of TR_PROVIDERS){
      if(provider.skip()) continue;
      try{ ja = await provider.run(text); if(ja) break; }
      catch(e){ /* 次のプロバイダへ */ }
    }
    if(ja){
      trCache[text] = {ja, savedAt: Date.now()};
      saveTrCacheDebounced();
      scheduleRender();
    }
    trQueued.delete(text);
    await new Promise(resolve => setTimeout(resolve, TR_INTERVAL_MS));
  }
  trRunning = false;
}
// 翻訳キューへの入口。キャッシュ済み・待機中・長すぎる原文は積まない
function trEnqueue(text){
  if(!translateOn || !text || trCache[text] || trQueued.has(text)) return;
  if(text.length > TR_MAX_LEN) return;
  trQueued.add(text);
  trQueue.push(text);
  trPump();
}

// ---- トグルボタン表示 ----
function updateTrBtn(){
  const btn = document.getElementById('trBtn');
  btn.textContent = translateOn ? '翻訳 ON' : '翻訳 OFF';
  btn.classList.toggle('off', !translateOn);
}
