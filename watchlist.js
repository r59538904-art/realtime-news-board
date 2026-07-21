'use strict';
// 銘柄検索・現在値カード。記事一覧の左のサイドバー。
// データはYahoo Financeを、自前デプロイのCloudflare Worker(cloudflare-worker/
// yahoo-finance-proxy.js)経由で取得する。TradingViewには一切依存しない。
//
// なぜCloudflare Workerを経由するか:
//   Yahoo Finance(query1.finance.yahoo.com)はAccess-Control-Allow-Originヘッダーを
//   返さないため、ブラウザから直接fetch()できない(実機確認済み)。このサイトは
//   ビルド不要の静的サイトでサーバー側コードを持たないため、CORSを解決できる
//   軽量な中継サーバー(Cloudflare Workers、無料枠で十分)を別途デプロイして間に挟んでいる。
// なぜFinnhub(旧実装)をやめたか:
//   Finnhub・Twelve Data(いずれも実機確認済み)は無料プランが米国上場銘柄限定で、
//   東証等の海外取引所の現在値を返さない仕様だった。Yahoo Financeはこの制限が無く
//   日本株を含め幅広く取得できるため、CORSさえ解決できればこちらの方が適している。
// なお過去の値動き(ローソク足チャート)は実装していない(現在値カードのみ)。
// Yahoo Financeのchart APIは技術的には時系列データを持っているが、まずは
// 現在値表示のみに絞ってシンプルに構成している。

// ---- Cloudflare Workerプロキシの設定 ----
// cloudflare-worker/yahoo-finance-proxy.js をCloudflare Workers(無料)へデプロイし、
// 発行されたURL(例: https://yahoo-finance-proxy.your-name.workers.dev)をここに設定する。
// デプロイ手順はREADME「株価現在値カード(Cloudflare Workerプロキシ)のセットアップ」を参照。
// 未設定のままでも壊れない: カードが「設定が必要です」と案内を出すだけで、他の機能には影響しない。
const WL_PROXY_BASE_URL = '';  // 例: 'https://yahoo-finance-proxy.your-name.workers.dev'
const WL_SEARCH_DEBOUNCE_MS = 350;  // 連続入力のたびのAPI呼び出しを間引く
const WL_SEARCH_MIN_LEN = 2;        // 1文字だけでは結果が多すぎる/意味が薄いため検索しない

const WL_PREF_KEY = 'news-board-wl-pref-v1';
let watchlistOpen = true;
let wlSymbol = 'AAPL';          // 現在値カードに表示中の銘柄(Yahoo Financeのシンボル表記)
let wlSearchTimer = null;
let wlSearchAbort = null;       // 前回の検索が終わる前に次を打ち始めた場合、古い方を中断する
let wlQuoteAbort = null;        // 同上。銘柄選択を連続で切り替えた場合の古いリクエストを中断する

// カレンダーと同じ理由(狭い画面では最初は情報量を絞りたい)で、
// 狭い画面かつ初回訪問時に限り初期状態を折りたたみにする
function loadWatchlistPref(){
  const saved = storageGet(WL_PREF_KEY);
  watchlistOpen = saved ? saved !== 'closed' : window.innerWidth > 1100;
}
function updateWlBtn(){
  const btn = document.getElementById('wlBtn');
  if(!btn) return;
  btn.textContent = watchlistOpen ? '折りたたむ ▲' : '表示する ▼';
  btn.setAttribute('aria-expanded', String(watchlistOpen));
  btn.setAttribute('aria-controls', 'wlWidget');
}
function toggleWatchlist(){
  watchlistOpen = !watchlistOpen;
  storageSet(WL_PREF_KEY, watchlistOpen ? 'open' : 'closed');
  buildWatchlist();
}

// ---- プロキシ呼び出しの共通ヘルパー ----
async function fetchViaProxy(path, params, signal){
  const query = new URLSearchParams(params);
  const response = await fetch(WL_PROXY_BASE_URL + path + '?' + query.toString(), {signal});
  if(!response.ok) throw new Error('proxy ' + path + ' http ' + response.status);
  return response.json();
}

// ---- 現在値カードの構築 ----
async function buildWatchlist(){
  const container = document.getElementById('wlWidget');
  if(!container) return;
  container.textContent = '';
  updateWlBtn();
  if(!watchlistOpen) return;             // 折りたたみ中は取得自体を行わない(通信節約)
  if(!WL_PROXY_BASE_URL){
    container.appendChild(el('div', 'wl-result-note', '株価表示にはCloudflare Workerプロキシの設定が必要です(README参照)'));
    return;
  }
  container.appendChild(el('div', 'wl-result-note', '読み込み中…'));

  if(wlQuoteAbort) wlQuoteAbort.abort();
  const controller = new AbortController();
  wlQuoteAbort = controller;
  try{
    const data = await fetchViaProxy('/quote', {symbol: wlSymbol}, controller.signal);
    const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
    if(!meta || meta.regularMarketPrice == null) throw new Error('quote meta missing');
    const openSeries = data.chart.result[0].indicators && data.chart.result[0].indicators.quote
      && data.chart.result[0].indicators.quote[0] && data.chart.result[0].indicators.quote[0].open;
    renderWlQuote(meta, lastValidNumber(openSeries));
  }catch(e){
    if(e.name === 'AbortError') return;  // より新しい選択に追い越された。古い結果は描画しない
    console.error('現在値の取得に失敗:', e);
    container.textContent = '';
    container.appendChild(el('div', 'wl-result-note', '現在値を取得できませんでした'));
  }
}

// 配列の末尾から辿って最初に見つかった有効な数値を返す(当日分がまだnullの場合に備え、
// 直近の取引日の始値を拾うためのフォールバック)
function lastValidNumber(series){
  if(!Array.isArray(series)) return null;
  for(let i = series.length - 1; i >= 0; i--){
    if(typeof series[i] === 'number') return series[i];
  }
  return null;
}

function formatPrice(value, currency){
  if(value == null || Number.isNaN(value)) return '─';
  return value.toLocaleString('ja-JP', {maximumFractionDigits: 2}) + (currency ? ' ' + currency : '');
}
function renderWlQuote(meta, openPrice){
  const container = document.getElementById('wlWidget');
  if(!container) return;
  container.textContent = '';
  const card = el('div', 'wl-quote');

  const header = el('div', 'wl-quote-header');
  const nameWrap = el('div', 'wl-quote-namewrap');
  nameWrap.appendChild(el('div', 'wl-quote-name', meta.longName || meta.shortName || wlSymbol));
  const symLine = wlSymbol + (meta.fullExchangeName ? ' ・ ' + meta.fullExchangeName : '');
  nameWrap.appendChild(el('div', 'wl-quote-sym', symLine));
  header.appendChild(nameWrap);
  card.appendChild(header);

  card.appendChild(el('div', 'wl-quote-price', formatPrice(meta.regularMarketPrice, meta.currency)));

  const prevClose = meta.chartPreviousClose;
  if(typeof prevClose === 'number' && prevClose > 0){
    const diff = meta.regularMarketPrice - prevClose;
    const diffPct = diff / prevClose * 100;
    const isUp = diff >= 0;
    const change = el('div', 'wl-quote-change ' + (isUp ? 'pos' : 'neg'),
      (isUp ? '▲ +' : '▼ ') + Math.abs(diff).toFixed(2) + ' (' + (isUp ? '+' : '−') + Math.abs(diffPct).toFixed(2) + '%)');
    card.appendChild(change);
  }

  // 当日値幅バー: 安値〜高値のレンジの中で現在値がどこに位置するかを視覚化する
  const high = meta.regularMarketDayHigh, low = meta.regularMarketDayLow;
  if(typeof high === 'number' && typeof low === 'number' && high > low){
    const range = el('div', 'wl-quote-range');
    range.appendChild(el('span', 'wl-quote-range-label', formatPrice(low, meta.currency)));
    const track = el('div', 'wl-quote-range-track');
    const pct = Math.min(100, Math.max(0, (meta.regularMarketPrice - low) / (high - low) * 100));
    const marker = el('div', 'wl-quote-range-marker');
    marker.style.left = pct + '%';
    track.appendChild(marker);
    range.appendChild(track);
    range.appendChild(el('span', 'wl-quote-range-label', formatPrice(high, meta.currency)));
    card.appendChild(range);
  }

  const grid = el('div', 'wl-quote-grid');
  [['始値', openPrice], ['前日終値', prevClose], ['高値', high], ['安値', low]].forEach(([label, value]) => {
    const cell = el('div', 'wl-quote-cell');
    cell.appendChild(el('span', 'wl-quote-cell-label', label));
    cell.appendChild(el('span', 'wl-quote-cell-value', formatPrice(value, meta.currency)));
    grid.appendChild(cell);
  });
  card.appendChild(grid);

  if(meta.regularMarketTime){
    const updatedText = '更新: ' + new Date(meta.regularMarketTime * 1000).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'});
    card.appendChild(el('div', 'wl-quote-updated', updatedText));
  }
  container.appendChild(card);
}

// ---- 銘柄検索(Yahoo Finance search、プロキシ経由) ----
function hideWlResults(){
  const listEl = document.getElementById('wlResults');
  if(!listEl) return;
  listEl.textContent = '';
  listEl.hidden = true;
}
function renderWlResults(items){
  const listEl = document.getElementById('wlResults');
  if(!listEl) return;
  listEl.textContent = '';
  if(!items.length){
    listEl.appendChild(el('div', 'wl-result-note', '該当する銘柄が見つかりませんでした'));
    listEl.hidden = false;
    return;
  }
  items.slice(0, 8).forEach(item => {
    const optionBtn = el('button', 'wl-result');
    optionBtn.type = 'button';
    optionBtn.setAttribute('role', 'option');
    optionBtn.appendChild(el('span', 'wl-result-name', item.longname || item.shortname || item.symbol));
    optionBtn.appendChild(el('span', 'wl-result-sym', item.symbol + (item.exchDisp ? ' ・ ' + item.exchDisp : '')));
    // mousedownはinputのblurより先に発火するため、blur側のhideWlResultsで
    // クリックが握りつぶされる事故を防げる(clickだと間に合わないことがある)
    optionBtn.addEventListener('mousedown', e => { e.preventDefault(); selectWlSymbol(item.symbol, item.longname || item.shortname); });
    listEl.appendChild(optionBtn);
  });
  listEl.hidden = false;
}
function selectWlSymbol(symbol, description){
  wlSymbol = symbol;
  const input = document.getElementById('wlSearch');
  if(input) input.value = description || symbol;
  hideWlResults();
  if(!watchlistOpen) toggleWatchlist();  // 折りたたみ中に選んだ場合は結果が見えるよう自動展開する
  else buildWatchlist();
}
async function searchWlSymbol(query){
  if(!WL_PROXY_BASE_URL){
    const listEl = document.getElementById('wlResults');
    if(listEl){
      listEl.textContent = '';
      listEl.appendChild(el('div', 'wl-result-note', '検索機能を使うにはCloudflare Workerプロキシの設定が必要です(README参照)'));
      listEl.hidden = false;
    }
    return;
  }
  if(wlSearchAbort) wlSearchAbort.abort();
  const controller = new AbortController();
  wlSearchAbort = controller;
  try{
    const data = await fetchViaProxy('/search', {q: query}, controller.signal);
    const items = (data && Array.isArray(data.quotes) ? data.quotes : [])
      .filter(item => item && item.symbol && (item.longname || item.shortname) && item.quoteType === 'EQUITY');
    renderWlResults(items);
  }catch(e){
    if(e.name !== 'AbortError') console.error('銘柄検索に失敗:', e);
  }
}
function handleWlSearchInput(value){
  clearTimeout(wlSearchTimer);
  const query = value.trim();
  if(query.length < WL_SEARCH_MIN_LEN){ hideWlResults(); return; }
  wlSearchTimer = setTimeout(() => searchWlSymbol(query), WL_SEARCH_DEBOUNCE_MS);
}
