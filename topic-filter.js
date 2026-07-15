'use strict';
// このファイルは「株価・AI・企業など金融/ビジネス関連キーワードだけに記事を絞り込む機能」を担当する。
// ================= トピック絞り込み(株価・AI・企業など金融/ビジネス関連だけ表示) =================
// ・キーワード本体(TOPIC_KEYWORDS_CJK / TOPIC_KEYWORDS_LATIN)は topic-keywords.js に分離。
//   このファイルより先に <script src="topic-keywords.js"> で読み込んでいるため、ここではグローバル変数として参照できる
// ・デフォルトON。ヘッダーの「トピック絞込」トグルでいつでも全件表示に戻せる(localStorageに設定を保存)
const TOPIC_PREF_KEY = 'news-board-topic-pref-v1';
const TOPIC_RE = new RegExp(
  '(?:' + TOPIC_KEYWORDS_CJK.map(escapeRe).join('|') + ')' +
  '|\\b(?:' + TOPIC_KEYWORDS_LATIN.map(escapeRe).join('|') + ')\\b',
  'i'
);
let topicFilterOn = true;
function loadTopicPref(){
  try{ topicFilterOn = localStorage.getItem(TOPIC_PREF_KEY) !== 'off'; }catch(e){}
}
function updateTopicBtn(){
  const b = document.getElementById('topicBtn');
  b.textContent = topicFilterOn ? 'トピック絞込 ON' : 'トピック絞込 OFF';
  b.classList.toggle('off', !topicFilterOn);
}
function matchesTopic(it){
  if(!topicFilterOn) return true;
  const text = it.title + ' ' + it.desc + ' ' + (trGet(it.title)||'') + ' ' + (trGet(it.desc)||'');
  return TOPIC_RE.test(text);
}
