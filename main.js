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
// バックグラウンドタブ(他タブ表示中・最小化中など)では取得を止め、通信量とバッテリーを節約する。
// フォアグラウンドに戻った瞬間は再取得時刻を過ぎていれば即座に取得し直し、
// 古い表示のままユーザーが気づかず放置される事態を防ぐ
setInterval(() => {
  if(document.hidden) return;
  if(Date.now() >= nextRefreshAt) fetchAll();
}, 5000);
document.addEventListener('visibilitychange', () => {
  if(!document.hidden && Date.now() >= nextRefreshAt) fetchAll();
});

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
initEconCalendarLazy();
render();
fetchAll();
