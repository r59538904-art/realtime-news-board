'use strict';
// このファイルは「株価・AI・企業など金融/ビジネス関連キーワードだけに記事を絞り込む機能」を担当する。



// ================= トピック絞り込み(株価・AI・企業など金融/ビジネス関連だけ表示) =================
// ・キーワード本体(TOPIC_KEYWORDS_CJK / TOPIC_KEYWORDS_LATIN)は topic-keywords.js に分離。
//   このファイルより先に <script src="topic-keywords.js"> で読み込んでいるため、ここではグローバル変数として参照できる
// ・デフォルトOFF(全件表示)。Newsweek・CNET Japan・Business Insiderなど一般ニュース中心のソースでは
//   金融/ビジネス関連の記事が少なく、絞込ONだと表示件数が大きく減ってしまうため。
//   ヘッダーの「トピック絞込」トグルでいつでも金融/ビジネス関連のみの表示に切り替えられる(localStorageに設定を保存)
const TOPIC_PREF_KEY = 'news-board-topic-pref-v1';
const TOPIC_RE = new RegExp(
  '(?:' + TOPIC_KEYWORDS_CJK.map(escapeRe).join('|') + ')' +
  '|\\b(?:' + TOPIC_KEYWORDS_LATIN.map(escapeRe).join('|') + ')\\b',
  'i'
);
let topicFilterOn = false;
function loadTopicPref(){
  try{ topicFilterOn = localStorage.getItem(TOPIC_PREF_KEY) === 'on'; }catch(e){}
}
function updateTopicBtn(){
  const btn = document.getElementById('topicBtn');
  btn.textContent = topicFilterOn ? 'トピック絞込 ON' : 'トピック絞込 OFF';
  btn.classList.toggle('off', !topicFilterOn);
}
function matchesTopic(item){
  if(!topicFilterOn) return true;
  const text = item.title + ' ' + item.desc + ' ' + (trGet(item.title)||'') + ' ' + (trGet(item.desc)||'');
  return TOPIC_RE.test(text);
}
