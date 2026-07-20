'use strict';
// 経済指標カレンダー(TradingViewウィジェット)。雇用統計・CPI・政策金利など
// 市場を動かす指標の発表予定を表示する。折りたたみ状態はlocalStorageに保存。
// 重要度トグル: みんかぶの★表示のように重要な指標をすぐ見分けられるよう、
// 「★★★のみ(高)」⇔「★★以上(中+高)」を切り替えられる(設定はlocalStorageに保存)。

const CAL_PREF_KEY = 'news-board-cal-pref-v1';
const CAL_IMP_KEY = 'news-board-cal-imp-v1';
let calendarOpen = true;
let calHighOnly = false;

// ワイド画面(1840px以上)ではコンテンツ右外の余白に固定表示するため縦長にする(style.css側と対応)。
// ウィンドウ幅が閾値をまたいだら高さを合わせるために作り直す
const CAL_WIDE_MQ = window.matchMedia('(min-width: 1840px)');
try{ CAL_WIDE_MQ.addEventListener('change', () => buildEconCalendar()); }catch(e){}

function loadCalendarPref(){
  try{
    calendarOpen = localStorage.getItem(CAL_PREF_KEY) !== 'closed';
    calHighOnly = localStorage.getItem(CAL_IMP_KEY) === 'high';
  }catch(e){}
}
function updateCalBtn(){
  const btn = document.getElementById('calBtn');
  if(btn) btn.textContent = calendarOpen ? '折りたたむ ▲' : '表示する ▼';
  const impBtn = document.getElementById('calImpBtn');
  if(impBtn){
    impBtn.textContent = calHighOnly ? '重要度: ★★★のみ' : '重要度: ★★以上';
    impBtn.classList.toggle('on', calHighOnly);
  }
}
// TradingViewウィジェットは設定を後から変えられないため、テーマ切替や設定変更のたびに作り直す
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
    height: CAL_WIDE_MQ.matches ? '100%' : 460,  // 右余白固定時はパネルの高さ(画面下端まで)に追従させる
    locale: 'ja',
    importanceFilter: calHighOnly ? '1' : '0,1', // 高のみ / 中+高
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
function toggleCalImportance(){
  calHighOnly = !calHighOnly;
  try{ localStorage.setItem(CAL_IMP_KEY, calHighOnly ? 'high' : 'medium'); }catch(e){}
  buildEconCalendar();
}
