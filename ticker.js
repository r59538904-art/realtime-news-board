'use strict';
// このファイルは「ヘッダー上部のTradingView相場ティッカー(為替・株価指数などの帯)表示」を担当する。



// ================= TradingView ティッカー =================
function tickerTape(){
  const container = document.getElementById('tape');
  container.classList.add('tape-loading'); // 再取得中は薄く表示し、待たされている印象を和らげる
  container.innerHTML = ''; // テーマ切替のたびに作り直すため既存ウィジェットを除去
  const widgetWrap = document.createElement('div');
  widgetWrap.className = 'tradingview-widget-container';
  const widgetInner = document.createElement('div');
  widgetWrap.appendChild(widgetInner);
  const widgetScript = document.createElement('script');
  widgetScript.type = 'text/javascript'; widgetScript.async = true;
  widgetScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
  widgetScript.innerHTML = JSON.stringify({
    symbols:[
      {proName:'FX:USDJPY', title:'ドル/円'},
      {proName:'OSE:DJIA1!', title:'NYダウ先物'},
      {proName:'VANTAGE:SP500', title:'S&P500'},
      {proName:'FRED:NDQCOM', title:'ナスダック総合'},
      {proName:'INDEX:NKY', title:'日経225'},
      {proName:'TVC:GOLD', title:'ゴールド'},
      {proName:'TVC:USOIL', title:'WTI原油'},
      {proName:'BINANCE:BTCUSDT', title:'BTC'},
    ],
    showSymbolLogo:true, isTransparent:false,
    displayMode:'adaptive', colorTheme: currentTheme() === 'light' ? 'light' : 'dark', locale:'ja'
  });
  widgetWrap.appendChild(widgetScript);
  container.appendChild(widgetWrap);
  setTimeout(()=>container.classList.remove('tape-loading'), 500);
}
