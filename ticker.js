'use strict';
// ヘッダー上部のTradingView相場ティッカー(為替・株価指数・商品・BTCの帯)。

// TradingViewウィジェットは設定を後から変えられないため、テーマ切替時も毎回作り直す
function tickerTape(){
  const container = document.getElementById('tape');
  container.classList.add('tape-loading');    // 再構築中は薄く表示して待ち時間の印象を和らげる
  container.textContent = '';

  const widgetWrap = el('div', 'tradingview-widget-container');
  widgetWrap.appendChild(el('div'));

  const widgetScript = document.createElement('script');
  widgetScript.async = true;
  widgetScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
  // TradingViewの仕様: 表示設定はscriptタグの中身にJSONで書く(自前の静的データのみ)
  widgetScript.text = JSON.stringify({
    symbols: [
      {proName: 'FX:USDJPY', title: 'ドル/円'},
      {proName: 'FX:EURJPY', title: 'ユーロ/円'},
      {proName: 'FX:GBPJPY', title: 'ポンド/円'},
      {proName: 'FOREXCOM:CNHJPY', title: '人民元/円'},
      {proName: 'FX:CHFJPY', title: 'スイスフラン/円'},
      {proName: 'FX:AUDJPY', title: '豪ドル/円'},
      {proName: 'FX:CADJPY', title: 'カナダドル/円'},
      {proName: 'OANDA:HKDJPY', title: '香港ドル/円'},
      {proName: 'OSE:DJIA1!', title: 'NYダウ先物'},
      {proName: 'VANTAGE:SP500FT', title: 'S&P500先物'},
      {proName: 'INDEX:NKY', title: '日経平均'},
      {proName: 'TVC:GOLD', title: 'ゴールド'},
      {proName: 'TVC:USOIL', title: 'WTI原油'},
      {proName: 'BINANCE:BTCUSDT', title: 'BTC'},
    ],
    showSymbolLogo: true,
    isTransparent: false,
    displayMode: 'adaptive',
    colorTheme: currentTheme() === 'light' ? 'light' : 'dark',
    locale: 'ja',
  });
  widgetWrap.appendChild(widgetScript);
  container.appendChild(widgetWrap);
  setTimeout(() => container.classList.remove('tape-loading'), 500);
}
