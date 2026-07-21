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
  translateOn = storageGet(TR_PREF_KEY) !== 'off';
  try{
    const cachedJson = localStorage.getItem(TR_CACHE_KEY);
    if(!cachedJson) return;
    const parsed = JSON.parse(cachedJson);
    if(!parsed || !parsed.map) return;
    const now = Date.now();
    for(const [text, entry] of Object.entries(parsed.map)){
      if(entry && typeof entry.ja === 'string' && (now - (entry.savedAt || 0)) <= TR_TTL_MS){
        // 保存前は必ずstripHtml済みだが、localStorage経由の読み込みは信頼しすぎず
        // 多層防御としてここでも通す(feed.jsのsanitizeItemsと同じ考え方)
        trCache[text] = {ja: stripHtml(entry.ja), savedAt: entry.savedAt};
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
// 第1段: MyMemory。無料枠切れ(WARNING/403/429)を検知したら翌日UTC0時までスキップする。
// langpairは呼び出し側が指定する(記事翻訳はen|ja固定、watchlist.jsの銘柄検索はja|enで使う)
async function trViaMyMemory(text, langpair){
  const timeout = makeTimeoutSignal(TR_TIMEOUT_MS);
  try{
    const response = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + langpair, {signal: timeout.signal});
    const json = await response.json();
    const status = Number(json && json.responseStatus);
    const translated = stripHtml(json && json.responseData && json.responseData.translatedText || '');
    if(/MYMEMORY WARNING/i.test(translated) || status === 403 || status === 429){
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      trQuotaHitUntil = tomorrow.getTime();
      throw new Error('mymemory quota');
    }
    if(status !== 200 || !translated) throw new Error('mymemory failed');
    return translated;
  } finally { timeout.done(); }
}
// 第2段: Google翻訳の非公式エンドポイント(MyMemoryが使えない時だけの最終手段)
async function trViaGoogle(text, sourceLang, targetLang){
  const timeout = makeTimeoutSignal(TR_TIMEOUT_MS);
  try{
    const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sourceLang + '&tl=' + targetLang + '&dt=t&q=' + encodeURIComponent(text), {signal: timeout.signal});
    if(!response.ok) throw new Error('google http ' + response.status);
    const data = await response.json();
    const translated = Array.isArray(data) && Array.isArray(data[0])
      ? data[0].map(seg => seg && seg[0] || '').join('')
      : '';
    if(!translated) throw new Error('google empty');
    return stripHtml(translated);
  } finally { timeout.done(); }
}
const TR_PROVIDERS = [
  {name: 'mymemory', skip: () => Date.now() < trQuotaHitUntil, run: text => trViaMyMemory(text, 'en|ja')},
  {name: 'google',   skip: () => false,                        run: text => trViaGoogle(text, 'en', 'ja')},
];

// ---- 検索クエリの日本語→英語翻訳(watchlist.jsの銘柄検索から利用) ----
// Yahoo Financeの検索APIは非ASCII文字を含むクエリを一律拒否する
// ({"finance":{"result":null,"error":{"code":"Bad Request","description":"Invalid Search Query"}}}、
// 実機確認済み)ため、日本語の検索語は英語に変換してから渡す。上のtrViaMyMemory/trViaGoogleを
// langpairだけ逆向き(ja|en)にして再利用する(プロバイダ選定・タイムアウト処理を重複させない)。
// 記事翻訳のキュー(trQueue)は「後で結果が届けばよい」バッチ処理だが、検索は都度1件を
// その場で待つ必要があるため、キューを経由せずここで直接プロバイダを呼ぶ。
// MyMemoryのクォータ(trQuotaHitUntil)は翻訳方向によらず同一アカウント/IPの日次上限のため、
// 記事翻訳(en|ja)と検索(ja|en)で状態を共有してよい
async function translateQueryToEnglish(text){
  const providers = [
    {skip: () => Date.now() < trQuotaHitUntil, run: () => trViaMyMemory(text, 'ja|en')},
    {skip: () => false,                        run: () => trViaGoogle(text, 'ja', 'en')},
  ];
  for(const provider of providers){
    if(provider.skip()) continue;
    try{ const translated = await provider.run(); if(translated) return translated; }
    catch(e){ /* 次のプロバイダへ */ }
  }
  return null;  // 両方失敗した場合はnull(呼び出し側でエラー表示する)
}

// ---- 翻訳キュー ----
// 翻訳が届くたびの再描画を1200msにまとめる(1件ごとの全再描画を防ぎ、スマホでの
// スクロール中断の頻度も下げる)。実際の反映タイミングはrequestRender()(render.js)が
// タッチ・スクロール中かどうかを見てさらに調整する
function scheduleRender(){
  if(trRenderTimer) return;
  trRenderTimer = setTimeout(() => { trRenderTimer = null; requestRender(); }, 1200);
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
  btn.setAttribute('aria-pressed', String(translateOn));
}
