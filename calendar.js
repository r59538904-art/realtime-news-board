'use strict';
// 経済指標カレンダー(TradingViewウィジェット)。雇用統計・CPI・政策金利など
// 市場を動かす指標の発表予定を表示する。折りたたみ状態はlocalStorageに保存。

const CAL_PREF_KEY = 'news-board-cal-pref-v1';
let calendarOpen = true;

// 超ワイド画面(2000px以上)ではコンテンツ右外の余白に固定表示するため縦長にする(style.css側と対応)。
// ウィンドウ幅が閾値をまたいだら高さを合わせるために作り直す
const CAL_WIDE_MQ = window.matchMedia('(min-width: 2000px)');
try{ CAL_WIDE_MQ.addEventListener('change', () => buildEconCalendar()); }catch(e){}

function loadCalendarPref(){
  try{ calendarOpen = localStorage.getItem(CAL_PREF_KEY) !== 'closed'; }catch(e){}
}
function updateCalBtn(){
  const btn = document.getElementById('calBtn');
  if(btn) btn.textContent = calendarOpen ? '折りたたむ ▲' : '表示する ▼';
}
// TradingViewウィジェットは設定を後から変えられないため、テーマ切替時も作り直す(ticker.jsと同方式)
function buildEconCalendar(){
  const container = document.getElementById('calWidget');
  if(!container) return;
  container.textContent = '';
  updateCalBtn();
  if(!calendarOpen) return;              // 折りたたみ中はウィジェット自体を作らない(通信節約)

  const widgetWrap = el('div', 'tradingview-widget-container');
  widgetWrap.appendChild(el('div'));
  const widgetScript = document.createElement('script');
  widgetScript.async = true;
  widgetScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
  widgetScript.text = JSON.stringify({
    colorTheme: currentTheme() === 'light' ? 'light' : 'dark',
    isTransparent: false,                // ウィジェット自身のテーマ背景を使う(透過だと文字が沈んで見えるため)
    width: '100%',
    height: CAL_WIDE_MQ.matches ? 620 : 460,
    locale: 'ja',
    importanceFilter: '0,1',             // 中・高重要度の指標のみ(ノイズ削減)
    countryFilter: 'us,jp,eu,cn,gb,de',  // 主要市場: 米・日・欧・中・英・独
  });
  widgetWrap.appendChild(widgetScript);
  container.appendChild(widgetWrap);
}
function toggleCalendar(){
  calendarOpen = !calendarOpen;
  try{ localStorage.setItem(CAL_PREF_KEY, calendarOpen ? 'open' : 'closed'); }catch(e){}
  buildEconCalendar();
}
