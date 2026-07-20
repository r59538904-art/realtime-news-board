'use strict';
// 保存済みテーマを描画前に適用し、切替時のちらつき(FOUC)を防ぐ。
// <head>内でdefer/asyncなしに読み込み、最初の描画より前に同期実行させる必要がある。
try{
  var t = localStorage.getItem('news-board-theme-v1');
  if(t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
}catch(e){}
