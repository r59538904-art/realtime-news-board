'use strict';
// 株式相場ウォッチリスト(TradingViewウィジェット)。記事一覧の左のサイドバー。
// 主要指数(S&P500・Nasdaq・NYダウ・日経平均等)と主要株式(Apple・NVIDIA・トヨタ等)を
// タブ切り替えで表示する。設計はcalendar.js(経済指標カレンダー)と対称・同一パターン
// (折りたたみ・遅延読み込み・テーマ追従はほぼ同じロジックをそのまま踏襲している)。

const WL_PREF_KEY = 'news-board-wl-pref-v1';
let watchlistOpen = true;

// ワイド画面(1840px以上)ではコンテンツ左外の余白に固定表示するため縦長にする(style.css側と対応)。
// calendar.jsのCAL_WIDE_MQと同じブレークポイントだが、依存関係を増やさないためあえて別インスタンスにしている
const WL_WIDE_MQ = window.matchMedia('(min-width: 1840px)');
try{ WL_WIDE_MQ.addEventListener('change', () => buildWatchlist()); }catch(e){}

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
  widgetScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
  widgetScript.text = JSON.stringify({
    colorTheme: currentTheme() === 'light' ? 'light' : 'dark',
    dateRange: '12M',
    showChart: true,
    locale: 'ja',
    width: '100%',
    height: WL_WIDE_MQ.matches ? '100%' : 460,  // 右余白固定時はパネルの高さ(画面下端まで)に追従させる
    isTransparent: false,
    showSymbolLogo: true,
    showFloatingTooltip: false,
    plotLineColorGrowing: 'rgba(216, 180, 110, 1)',
    plotLineColorFalling: 'rgba(216, 180, 110, 1)',
    belowLineFillColorGrowing: 'rgba(216, 180, 110, 0.12)',
    belowLineFillColorFalling: 'rgba(216, 180, 110, 0.12)',
    tabs: [
      {
        title: '主要指数',
        symbols: [
          {s: 'FOREXCOM:SPXUSD', d: 'S&P 500'},
          {s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100'},
          {s: 'FOREXCOM:DJI', d: 'NYダウ'},
          {s: 'INDEX:NKY', d: '日経平均'},
          {s: 'INDEX:DEU40', d: 'DAX'},
          {s: 'FOREXCOM:UKXGBP', d: 'FTSE 100'},
        ],
      },
      {
        title: '主要株式',
        symbols: [
          {s: 'NASDAQ:AAPL', d: 'Apple'},
          {s: 'NASDAQ:MSFT', d: 'Microsoft'},
          {s: 'NASDAQ:NVDA', d: 'NVIDIA'},
          {s: 'NASDAQ:GOOGL', d: 'Alphabet'},
          {s: 'NASDAQ:AMZN', d: 'Amazon'},
          {s: 'TSE:7203', d: 'トヨタ自動車'},
        ],
      },
    ],
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
