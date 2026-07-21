'use strict';
// 株式相場ウォッチリスト(TradingViewウィジェット)。記事一覧の左のサイドバー。
// Advanced Real-Time Chartウィジェット(allow_symbol_change:true)を使い、
// チャート左上の銘柄名をクリック(またはクリックして開く検索欄)すると、
// 任意の株式・指数・為替をシンボル検索してそのままチャートを差し替えられる。
// 設計はcalendar.js(経済指標カレンダー)と対称・同一パターン
// (折りたたみ・遅延読み込み・テーマ追従はほぼ同じロジックをそのまま踏襲している)。

const WL_PREF_KEY = 'news-board-wl-pref-v1';
let watchlistOpen = true;

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
// TradingViewウィジェットは設定を後から変えられないため、テーマ切替や設定変更のたびに作り直す
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
    symbol: 'NASDAQ:AAPL',        // 初期表示銘柄。左上の銘柄名をクリックすると検索欄が開き差し替えられる
    allow_symbol_change: true,    // これがtrueでないとウィジェット内から銘柄検索・変更ができない
    interval: 'D',
    timezone: 'Asia/Tokyo',
    style: '1',
    locale: 'ja',
    hide_top_toolbar: false,      // 検索の入口になる銘柄名表示を消さないため必須
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
