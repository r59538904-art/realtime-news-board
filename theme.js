'use strict';
// このファイルは「ダークモード/ライトモードの切り替え機能」を担当する(状態の保存・復元・トグルボタン表示を含む)。



// ================= ダーク/ライトモード =================
const THEME_KEY = 'news-board-theme-v1';
function systemPrefersLight(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}
function currentTheme(){
  const forced = document.documentElement.getAttribute('data-theme');
  if(forced === 'light' || forced === 'dark') return forced;
  return systemPrefersLight() ? 'light' : 'dark';
}
function updateThemeBtn(){
  const isLight = currentTheme() === 'light';
  document.getElementById('themeBtn').textContent = isLight ? 'ダーク表示' : 'ライト表示';
}
function applyTheme(theme, persist){
  if(theme === 'light' || theme === 'dark'){
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme'); // システム設定に追従
  }
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
  tickerTape(); // TradingViewウィジェットは動的に再設定できないため、テーマ変更時に作り直す(定義はticker.js)
}
