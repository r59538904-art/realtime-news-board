'use strict';
// このファイルは「記事見出し・要約からの簡易センチメント(強気▲/弱気▼)判定」を担当する。
// ================= 簡易センチメント判定(投資家がパッと良し悪しを見分けられるように) =================
// ・単語リスト本体(SENTIMENT_POS/NEG_CJK・LATIN)は sentiment-keywords.js に分離
// ・トピック絞り込みと同じ手法(日英キーワード・英字は単語境界付き)でポジティブ/ネガティブを判定
// ・厳密な感情分析ではなく見出し・要約中の頻出語による簡易判定。ポジ/ネガどちらかが多く出現した記事にのみ
//   小さな▲(緑)/▼(赤)バッジを付け、同数・該当なしの場合はバッジを出さない(中立を強調しすぎない)
function buildSentimentRe(cjk, latin){
  return new RegExp('(?:' + cjk.map(escapeRe).join('|') + ')' + '|\\b(?:' + latin.map(escapeRe).join('|') + ')\\b', 'gi');
}
const SENTIMENT_POS_RE = buildSentimentRe(SENTIMENT_POS_CJK, SENTIMENT_POS_LATIN);
const SENTIMENT_NEG_RE = buildSentimentRe(SENTIMENT_NEG_CJK, SENTIMENT_NEG_LATIN);
function getSentiment(it){
  const text = it.title + ' ' + it.desc + ' ' + (trGet(it.title)||'') + ' ' + (trGet(it.desc)||'');
  const pos = (text.match(SENTIMENT_POS_RE)||[]).length;
  const neg = (text.match(SENTIMENT_NEG_RE)||[]).length;
  if(pos > neg) return 'pos';
  if(neg > pos) return 'neg';
  return null;
}
