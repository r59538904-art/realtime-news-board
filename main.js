'use strict';
// イベント登録・自動更新・Service Worker登録・起動処理。
// 厳格なContent-Security-Policy(script-src 'self')に対応するため、
// index.html末尾のインラインscriptだったものを外部ファイル化している。

// ---- イベント登録 ----
document.getElementById('refreshBtn').addEventListener('click', () => fetchAll());
document.getElementById('trBtn').addEventListener('click', () => {
  translateOn = !translateOn;
  try{ localStorage.setItem(TR_PREF_KEY, translateOn ? 'on' : 'off'); }catch(e){}
  updateTrBtn();
  render();
});
document.getElementById('topicBtn').addEventListener('click', () => {
  topicFilterOn = !topicFilterOn;
  try{ localStorage.setItem(TOPIC_PREF_KEY, topicFilterOn ? 'on' : 'off'); }catch(e){}
  updateTopicBtn();
  render();
});
let searchDebounceTimer = null;
document.getElementById('search').addEventListener('input', e => {
  const value = e.target.value.trim();
  clearTimeout(searchDebounceTimer);
  // 高速に連続入力された時、1文字ごとの全件再描画(最大500件)を避けるため軽く間引く
  searchDebounceTimer = setTimeout(() => { searchTerm = value; render(); }, 150);
});
document.getElementById('themeBtn').addEventListener('click', toggleTheme);
document.getElementById('calBtn').addEventListener('click', toggleCalendar);
document.getElementById('calImpBtn').addEventListener('click', toggleCalImportance);

// ---- 自動更新(5秒ごとに再取得時刻をチェック) ----
setInterval(() => {
  if(Date.now() >= nextRefreshAt) fetchAll();
}, 5000);

// ---- Service Worker登録(PWA: ホーム画面追加・オフライン表示) ----
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(e => {});  // file://等の非対応環境では黙って諦める
}

// ---- 起動 ----
loadTheme();
loadCache();
loadTranslate();
updateTrBtn();
loadTopicPref();
updateTopicBtn();
buildChips();
buildFootLinks();
tickerTape();
buildSessions();
loadCalendarPref();
buildEconCalendar();
render();
fetchAll();
