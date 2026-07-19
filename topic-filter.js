'use strict';
// このファイルは「株価・AI・企業など金融/ビジネス関連キーワードだけに記事を絞り込む機能」を担当する。



// ================= トピック絞り込み(株価・AI・企業など金融/ビジネス関連だけ表示) =================
// ・キーワード本体(TOPIC_KEYWORDS_CJK / TOPIC_KEYWORDS_LATIN)は topic-keywords.js に分離。
//   このファイルより先に <script src="topic-keywords.js"> で読み込んでいるため、ここではグローバル変数として参照できる
// ・デフォルトON(投資・金融・政治・戦争ジャンルに絞り込む、投資ニュースサイトとしての本来のスコープ)。
//   キーワードは投資/金融に加えて政治・軍事・地政学も広めにカバーしているため、
//   スポーツ・芸能・グルメ等の無関係ジャンルは除きつつ表示件数を確保できる。
//   ヘッダーの「トピック絞込」トグルでいつでも全件表示に切り替えられる(localStorageに設定を保存)
const TOPIC_PREF_KEY = 'news-board-topic-pref-v1';
const TOPIC_RE = buildKeywordRe(TOPIC_KEYWORDS_CJK, TOPIC_KEYWORDS_LATIN, 'i'); // 組み立てはutils.jsの共通ヘルパー
let topicFilterOn = true;
function loadTopicPref(){
  try{ topicFilterOn = localStorage.getItem(TOPIC_PREF_KEY) !== 'off'; }catch(e){}
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
