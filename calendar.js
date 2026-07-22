'use strict';
// 経済指標カレンダー(TradingViewウィジェット)。雇用統計・CPI・政策金利など
// 市場を動かす指標の発表予定を表示する。折りたたみ状態はlocalStorageに保存。
// 重要度トグル: みんかぶの★表示のように重要な指標をすぐ見分けられるよう、
// 「★★★のみ(高)」⇔「★★以上(中+高)」を切り替えられる(設定はlocalStorageに保存)。

const CAL_PREF_KEY = 'news-board-cal-pref-v1';
const CAL_IMP_KEY = 'news-board-cal-imp-v1';
let calendarOpen = true;
let calHighOnly = false;

// カレンダーはTradingViewのiframeで、内部に独自スクロール領域を持つ。
// スマホでは指がその上に乗った瞬間にページ全体のスクロールでなく内部スクロールを奪ってしまい
// 「スクロールが引っかかる」体感になりやすいため、狭い画面(幅1100px以下)では
// 明示的な設定が保存されていない初回訪問時に限り、初期状態を折りたたみにする
function loadCalendarPref(){
  const saved = storageGet(CAL_PREF_KEY);
  calendarOpen = saved ? saved !== 'closed' : window.innerWidth > 1100;
  calHighOnly = storageGet(CAL_IMP_KEY) === 'high';
}
function updateCalBtn(){
  const btn = document.getElementById('calBtn');
  if(btn){
    btn.textContent = calendarOpen ? '折りたたむ ▲' : '表示する ▼';
    // aria-expanded/aria-controlsで「calWidgetの開閉を制御するボタン」であることを明示する
    btn.setAttribute('aria-expanded', String(calendarOpen));
    btn.setAttribute('aria-controls', 'calWidget');
  }
  const impBtn = document.getElementById('calImpBtn');
  if(impBtn){
    impBtn.textContent = calHighOnly ? '重要度: ★★★のみ' : '重要度: ★★以上';
    impBtn.classList.toggle('on', calHighOnly);
    impBtn.setAttribute('aria-pressed', String(calHighOnly));
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
    height: '100%',  // .cal-widget(flex:1)がパネルの残り高さいっぱいに広がるため、常にそれに追従させる
    locale: 'ja',
    importanceFilter: calHighOnly ? '1' : '0,1', // 高のみ / 中+高
    countryFilter: 'us,jp,eu,cn,gb,de',  // 主要市場: 米・日・欧・中・英・独
  });
  widgetWrap.appendChild(widgetScript);
  container.appendChild(widgetWrap);
}
// ---- 初回表示の遅延読み込み(初期表示速度・LCP改善) ----
// TradingViewウィジェットは外部scriptの読み込み+iframe生成を伴う比較的重い処理。
// カレンダーが画面外(狭い画面では記事一覧の下に全幅表示されるため初回は必ず画面外)にある間は
// 生成を遅らせ、初回描画に割く帯域・CPUを記事一覧側へ優先させる。
// 手動トグル・重要度切替・テーマ切替・幅変化時の再構築(buildEconCalendarの直接呼び出し)は
// ユーザー操作/状態変化への即時反応が必要なため対象外とし、起動時の初回構築だけを遅延する。
function initEconCalendarLazy(){
  if(!calendarOpen){ buildEconCalendar(); return; }  // 折りたたみ中は元々ウィジェットを作らない軽い処理なので即時でよい
  const container = document.querySelector('.calendar');
  if(!container || typeof IntersectionObserver !== 'function'){
    buildEconCalendar();               // 非対応環境向けのフォールバック(即時構築)
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if(entries.some(entry => entry.isIntersecting)){
      observer.disconnect();
      buildEconCalendar();
    }
  }, {rootMargin: '400px 0px'});        // 画面に近づいた時点で先読みし、実際に到達する頃には表示済みにする
  observer.observe(container);
}

function toggleCalendar(){
  calendarOpen = !calendarOpen;
  storageSet(CAL_PREF_KEY, calendarOpen ? 'open' : 'closed');
  buildEconCalendar();
}
function toggleCalImportance(){
  calHighOnly = !calHighOnly;
  storageSet(CAL_IMP_KEY, calHighOnly ? 'high' : 'medium');
  buildEconCalendar();
}
