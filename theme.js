'use strict';
// ダーク/ライトモードの切り替え(保存・復元・トグルボタン表示)。
// data-theme属性が明示指定、未指定ならOSの設定に追従する。

const THEME_KEY = 'news-board-theme-v1';

function systemPrefersLight(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}
// いま画面に適用されているテーマを返す(明示指定 > OS設定)
function currentTheme(){
  const forced = document.documentElement.getAttribute('data-theme');
  if(forced === 'light' || forced === 'dark') return forced;
  return systemPrefersLight() ? 'light' : 'dark';
}
function updateThemeBtn(){
  const isLight = currentTheme() === 'light';
  document.getElementById('themeBtn').textContent = isLight ? 'ダーク表示' : 'ライト表示';
  // ブラウザのアドレスバー/タスクバー色(theme-color)も実際の表示テーマに追従させる。
  // <meta name="theme-color">はCSSのprefers-color-scheme条件分岐だけでは「OS設定」までしか
  // 拾えず、ヘッダーのボタンによる手動切り替え(data-theme属性)を反映できないため、
  // このJSで明示的にcontentを書き換える(currentTheme()は手動指定>OS設定の優先順位を持つ)
  const themeColorMeta = document.getElementById('themeColorMeta');
  if(themeColorMeta) themeColorMeta.setAttribute('content', isLight ? '#f6f3ec' : '#0a0d18');
}
// テーマを適用する。themeがnullならOS設定追従に戻す。persist=falseで保存を省略
function applyTheme(theme, persist){
  if(theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
  if(persist !== false){
    try{
      if(theme === 'light' || theme === 'dark') localStorage.setItem(THEME_KEY, theme);
      else localStorage.removeItem(THEME_KEY);
    }catch(e){}
  }
  updateThemeBtn();
}
function loadTheme(){
  let saved = null;
  try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
  applyTheme(saved === 'light' || saved === 'dark' ? saved : null, false);
}
function toggleTheme(){
  applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
  // TradingViewウィジェットは動的に配色を変えられないため、テーマ変更時に作り直す
  tickerTape();
  buildEconCalendar();
}
