'use strict';
// トピック絞り込み: 投資/金融/政治/軍事系キーワードを含む記事だけを表示する。
// 単語リストはtopic-keywords.jsに分離。デフォルトON(ヘッダーのボタンで切替・保存)。

const TOPIC_PREF_KEY = 'news-board-topic-pref-v1';
const TOPIC_RE = buildKeywordRe(TOPIC_KEYWORDS_CJK, TOPIC_KEYWORDS_LATIN, 'i');
let topicFilterOn = true;

function loadTopicPref(){
  try{ topicFilterOn = localStorage.getItem(TOPIC_PREF_KEY) !== 'off'; }catch(e){}
}
function updateTopicBtn(){
  const btn = document.getElementById('topicBtn');
  btn.textContent = topicFilterOn ? 'トピック絞込 ON' : 'トピック絞込 OFF';
  btn.classList.toggle('off', !topicFilterOn);
}
// タイトル+要約(原文・翻訳文の両方)のどこかにキーワードがあれば通す
function matchesTopic(item){
  if(!topicFilterOn) return true;
  const text = item.title + ' ' + item.desc + ' ' + (trGet(item.title) || '') + ' ' + (trGet(item.desc) || '');
  return TOPIC_RE.test(text);
}
