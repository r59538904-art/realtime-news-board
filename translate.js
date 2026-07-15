'use strict';
// このファイルは「英語記事の見出し・要約を日本語へ自動翻訳する機能」を担当する(EN→JA、キャッシュ・キュー管理を含む)。
// ================= 自動翻訳(EN→JA / MyMemory → Google非公式 の多段フォールバック) =================
// ・同じ原文は一度だけ翻訳し localStorage にキャッシュして再利用(どのプロバイダの結果でも共通キャッシュ)
// ・リクエストは直列キューで1件ずつ、350ms間隔(レート制限対策)
// ・MyMemory無料枠を使い切った場合はMyMemoryだけ翌日(UTC)まで自動停止し、Google非公式エンドポイントに自動切替
// ・Lingva Translate(オープンソースのGoogle翻訳フロントエンド)も検証したが、公開インスタンスを7件試して
//   いずれも停止/エラー(500やCloudflareブロック)だったため今回は組み込んでいない。生きているインスタンスが
//   見つかれば TR_PROVIDERS に1段追加するだけで対応できる構成にしてある
const TR_CACHE_KEY   = 'news-board-tr-cache-v1';
const TR_PREF_KEY    = 'news-board-tr-pref-v1';
const TR_INTERVAL_MS = 350;   // リクエスト間隔
const TR_MAX_CACHE   = 600;   // これに達したらトリム発動
const TR_KEEP_CACHE  = 50;    // トリム後に残す件数(新しい順)
const TR_DESC_LIMIT  = 15;    // 要約まで翻訳するのは新しい英語記事この件数まで(文字数節約)
let translateOn = true;
let trCache = {};             // 原文 -> {ja, t}
let trQueue = [];
let trQueued = new Set();
let trRunning = false;
let trQuotaHitUntil = 0;

function loadTranslate(){
  try{ translateOn = localStorage.getItem(TR_PREF_KEY) !== 'off'; }catch(e){}
  try{
    const raw = localStorage.getItem(TR_CACHE_KEY);
    if(raw){ const j = JSON.parse(raw); if(j && j.map) trCache = j.map; }
  }catch(e){ trCache = {}; }
}
function saveTrCache(){
  try{
    let entries = Object.entries(trCache);
    if(entries.length > TR_MAX_CACHE){
      entries.sort((a,b)=>(b[1].t||0)-(a[1].t||0));   // 新しい順に残す
      trCache = Object.fromEntries(entries.slice(0, TR_KEEP_CACHE));
    }
    localStorage.setItem(TR_CACHE_KEY, JSON.stringify({v:1, map:trCache}));
  }catch(e){}
}
let trSaveTimer = null;
function saveTrCacheDebounced(){
  if(trSaveTimer) return;
  trSaveTimer = setTimeout(()=>{ trSaveTimer = null; saveTrCache(); }, 1500);
}
function trGet(text){
  const hit = text && trCache[text];
  return hit ? hit.ja : null;
}
// fetch用のAbortSignalをタイムアウト付きで作る(feed.js の withFetchTimeout とは呼び出し形が異なるため
// 別名にしている: こちらは {signal, done} を返し、呼び出し側が自分でfetchして最後にdone()を呼ぶ形)
function makeTimeoutSignal(ms){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), ms);
  return {signal:controller.signal, done:()=>clearTimeout(timer)};
}
// 第1段: MyMemory。無料枠切れ(MYMEMORY WARNING/403/429)を検知したら
// trQuotaHitUntil を翌日UTC0時に設定して以後はこの段をスキップする
async function trViaMyMemory(text){
  const t = makeTimeoutSignal(10000);
  try{
    const res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|ja', {signal:t.signal});
    const json = await res.json();
    const st = Number(json && json.responseStatus);
    const ja = stripHtml(json && json.responseData && json.responseData.translatedText || '');
    const quotaMsg = /MYMEMORY WARNING/i.test(ja);
    if(quotaMsg || st === 403 || st === 429){
      const d = new Date(); d.setUTCHours(24,0,0,0);  // 無料枠超過 → MyMemoryだけ翌日まで停止
      trQuotaHitUntil = d.getTime();
      throw new Error('mymemory quota');
    }
    if(st !== 200 || !ja) throw new Error('mymemory failed');
    return ja;
  } finally { t.done(); }
}
// 第2段(フォールバック): Google翻訳の非公式エンドポイント。無登録・無料だが非公式のため
// MyMemoryが使えない時だけの最終手段として使う
async function trViaGoogle(text){
  const t = makeTimeoutSignal(10000);
  try{
    const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=' + encodeURIComponent(text), {signal:t.signal});
    if(!res.ok) throw new Error('google http '+res.status);
    const data = await res.json();
    const ja = Array.isArray(data) && Array.isArray(data[0])
      ? data[0].map(seg=>seg && seg[0] || '').join('')
      : '';
    if(!ja) throw new Error('google empty');
    return stripHtml(ja);
  } finally { t.done(); }
}
const TR_PROVIDERS = [
  {name:'mymemory', skip:()=>Date.now() < trQuotaHitUntil, run:trViaMyMemory},
  {name:'google',    skip:()=>false,                        run:trViaGoogle},
];
function trEnqueue(text){
  if(!translateOn || !text || trCache[text] || trQueued.has(text)) return;
  if(text.length > 480) return;                        // 1件あたりの文字数上限(APIへの配慮)
  trQueued.add(text);
  trQueue.push(text);
  trPump();
}
async function trPump(){
  if(trRunning) return;
  trRunning = true;
  while(trQueue.length){
    if(!translateOn){ trQueue = []; trQueued.clear(); break; }
    const text = trQueue.shift();
    let ja = null;
    for(const p of TR_PROVIDERS){
      if(p.skip()) continue;
      try{ ja = await p.run(text); if(ja) break; }
      catch(e){
        // 次のプロバイダへ
      }
    }
    if(ja){
      trCache[text] = {ja, t: Date.now()};
      saveTrCacheDebounced();
      scheduleRender();
    }
    trQueued.delete(text);
    await new Promise(r=>setTimeout(r, TR_INTERVAL_MS));
  }
  trRunning = false;
}
let renderTimer = null;
function scheduleRender(){                              // 翻訳が届くたびの再描画をまとめる
  if(renderTimer) return;
  renderTimer = setTimeout(()=>{ renderTimer = null; render(); }, 400);
}
function updateTrBtn(){
  const b = document.getElementById('trBtn');
  b.textContent = translateOn ? '翻訳 ON' : '翻訳 OFF';
  b.classList.toggle('off', !translateOn);
}
