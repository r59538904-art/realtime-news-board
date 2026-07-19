'use strict';
// 簡易センチメント判定: 見出し・要約中のポジ/ネガ単語の出現数を比べ、
// 多い側に▲(緑)/▼(赤)を付ける。同数・該当なしはバッジを出さない。
// 単語リストはsentiment-keywords.jsに分離。厳密な感情分析ではなく参考情報。

const SENTIMENT_POS_RE = buildKeywordRe(SENTIMENT_POS_CJK, SENTIMENT_POS_LATIN, 'gi');
const SENTIMENT_NEG_RE = buildKeywordRe(SENTIMENT_NEG_CJK, SENTIMENT_NEG_LATIN, 'gi');

function getSentiment(item){
  const text = item.title + ' ' + item.desc + ' ' + (trGet(item.title) || '') + ' ' + (trGet(item.desc) || '');
  const posCount = (text.match(SENTIMENT_POS_RE) || []).length;
  const negCount = (text.match(SENTIMENT_NEG_RE) || []).length;
  if(posCount > negCount) return 'pos';
  if(negCount > posCount) return 'neg';
  return null;
}
