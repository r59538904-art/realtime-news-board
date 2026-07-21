'use strict';
// 株式相場チャート・銘柄検索。記事一覧の左のサイドバー。
// TradingViewウィジェット内蔵の銘柄検索(allow_symbol_change)はアカウント登録/課金を
// 求めるダイアログが表示されることが確認されたため使わず、Finnhub(finnhub.io)の
// 無料APIで自前の検索欄を実装し、選んだ銘柄をTradingViewのチャートウィジェットへ
// 渡して「表示するだけ」にすることで課金要求を回避している。
// 設計は経済指標カレンダー(calendar.js)と対称・同一パターン
// (折りたたみ・遅延読み込み・テーマ追従はほぼ同じロジックをそのまま踏襲している)。

// ---- Finnhub API設定 ----
// 無料アカウント(https://finnhub.io/register、クレジットカード不要)登録後、
// ダッシュボードで発行されるAPIキーをここに設定する。
// 未設定のままでも壊れない: 検索欄は「設定が必要です」と案内を出すだけで、
// チャート自体(既定銘柄の表示・折りたたみ・テーマ追従)は影響を受けず動作する。
// 注意: 静的サイトのJSにそのまま埋め込むため、このキーは誰でも閲覧できる
// (view-sourceで見える)。Finnhub無料枠のキーはブラウザから直接叩く用途を
// 前提にした設計のため実害は小さいが、心配な場合はFinnhub側にリファラー制限等の
// 設定機能がないか確認すること。
const FINNHUB_API_KEY = '';  // 例: 'cabcde1234567890abcdefg' をここに入力する
const WL_SEARCH_DEBOUNCE_MS = 350;  // 翻訳キュー等と同様、連続入力のたびのAPI呼び出しを間引く
const WL_SEARCH_MIN_LEN = 2;        // 1文字だけでは結果が多すぎる/意味が薄いため検索しない

const WL_PREF_KEY = 'news-board-wl-pref-v1';
let watchlistOpen = true;
let wlSymbol = 'NASDAQ:AAPL';   // 現在チャートに表示中の銘柄。検索で選択すると更新される
let wlSearchTimer = null;
let wlSearchAbort = null;       // 前回の検索が終わる前に次を打ち始めた場合、古い方を中断する

// カレンダーと同じ理由(TradingViewのiframe内スクロールがモバイルでページスクロールを
// 奪ってしまう対策)で、狭い画面かつ初回訪問時に限り初期状態を折りたたみにする
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
// TradingViewウィジェットは設定を後から変えられないため、テーマ切替・銘柄選択のたびに作り直す
function buildWatchlist(){
  const container = document.getElementById('wlWidget');
  if(!container) return;
  container.textContent = '';
  updateWlBtn();
  if(!watchlistOpen) return;             // 折りたたみ中はウィジェット自体を作らない(通信節約)

  const widgetWrap = el('div', 'tradingview-widget-container');
  widgetWrap.appendChild(el('div'));
  const widgetScript = document.createElement('script');
  widgetScript.async = true;
  widgetScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  widgetScript.text = JSON.stringify({
    // colorThemeではなくtheme(このウィジェット固有のキー名。他のTradingViewウィジェットと異なるため注意)
    theme: currentTheme() === 'light' ? 'light' : 'dark',
    autosize: true,               // 親要素(.wl-widget)の高さいっぱいに追従させる
    symbol: wlSymbol,
    allow_symbol_change: false,   // 自前の検索欄(Finnhub)で切り替えるため、課金誘導のある内蔵検索は使わない
    interval: 'D',
    timezone: 'Asia/Tokyo',
    style: '1',
    locale: 'ja',
    hide_top_toolbar: false,
    hide_legend: false,
    enable_publishing: false,
    save_image: false,
    calendar: false,
    support_host: 'https://www.tradingview.com',
  });
  widgetWrap.appendChild(widgetScript);
  container.appendChild(widgetWrap);
}
// ---- 初回表示の遅延読み込み(初期表示速度・LCP改善。calendar.jsのinitEconCalendarLazyと同じ考え方) ----
function initWatchlistLazy(){
  if(!watchlistOpen){ buildWatchlist(); return; }
  const container = document.querySelector('.watchlist');
  if(!container || typeof IntersectionObserver !== 'function'){
    buildWatchlist();                    // 非対応環境向けのフォールバック(即時構築)
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if(entries.some(entry => entry.isIntersecting)){
      observer.disconnect();
      buildWatchlist();
    }
  }, {rootMargin: '400px 0px'});
  observer.observe(container);
}
function toggleWatchlist(){
  watchlistOpen = !watchlistOpen;
  storageSet(WL_PREF_KEY, watchlistOpen ? 'open' : 'closed');
  buildWatchlist();
}

// ---- 銘柄検索(Finnhub) ----
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
    optionBtn.appendChild(el('span', 'wl-result-name', item.description));
    optionBtn.appendChild(el('span', 'wl-result-sym', item.displaySymbol || item.symbol));
    // mousedownはinputのblurより先に発火するため、blur側のhideWlResultsで
    // クリックが握りつぶされる事故を防げる(clickだと間に合わないことがある)
    optionBtn.addEventListener('mousedown', e => { e.preventDefault(); selectWlSymbol(item.symbol, item.description); });
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
  if(!FINNHUB_API_KEY){
    const listEl = document.getElementById('wlResults');
    if(listEl){
      listEl.textContent = '';
      listEl.appendChild(el('div', 'wl-result-note', '検索機能を使うにはFinnhub APIキーの設定が必要です'));
      listEl.hidden = false;
    }
    return;
  }
  if(wlSearchAbort) wlSearchAbort.abort();
  const controller = new AbortController();
  wlSearchAbort = controller;
  try{
    const response = await fetch('https://finnhub.io/api/v1/search?q=' + encodeURIComponent(query) + '&token=' + FINNHUB_API_KEY, {signal: controller.signal});
    if(!response.ok) throw new Error('finnhub search http ' + response.status);
    const data = await response.json();
    const items = (data && Array.isArray(data.result) ? data.result : [])
      .filter(item => item && item.symbol && item.description);
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
