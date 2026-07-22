'use strict';
// 簡易センチメント判定: 見出し・要約中のポジ/ネガ単語の出現数を比べ、
// 多い側に▲(緑)/▼(赤)を付ける。同数・該当なしはバッジを出さない。
// 単語リストはsentiment-keywords.jsに分離。厳密な感情分析ではなく参考情報。
//
// 打ち消し表現の近くにある一致は逆方向としてカウントする(例:「上昇しなかった」は
// 「上昇」というポジティブ語の単純な出現ではなく、実質ネガティブな内容のため)。
// 日本語の打ち消しは動詞の活用語尾として単語の直後に付くことが多く(例:「上昇し+なかった」)、
// 英語は動詞の前に置かれることが多い(例:「did not rise」)ため、一致箇所の前後どちらも見る。
// あくまで簡易的な文字列近傍判定であり、構文解析はしていない(「上昇しないわけではない」の
// ような二重否定や、離れた場所にある無関係な打ち消し表現の誤検出等は非対応)。

const SENTIMENT_POS_RE = buildKeywordRe(SENTIMENT_POS_CJK, SENTIMENT_POS_LATIN, 'gi');
const SENTIMENT_NEG_RE = buildKeywordRe(SENTIMENT_NEG_CJK, SENTIMENT_NEG_LATIN, 'gi');

const SENTIMENT_NEGATION_MARKERS = [
  'ない','なかった','せず','ならなかった','とはならず','見送り','否定','困難',
  'not ',"n't",'no longer','fails to','failed to','unable to','without',
];
function isNegatedMatch(text, index, length){
  const start = Math.max(0, index - 12);
  const end = Math.min(text.length, index + length + 12);
  const window = text.slice(start, end);
  return SENTIMENT_NEGATION_MARKERS.some(marker => window.includes(marker));
}
// 一致を「打ち消されていない一致数」「打ち消された一致数」に分けて数える
// (打ち消された分は呼び出し側で逆方向のスコアへ加算する)
function countSentimentMatches(text, re){
  let valid = 0, negated = 0;
  for(const match of text.matchAll(re)){
    if(isNegatedMatch(text, match.index, match[0].length)) negated++;
    else valid++;
  }
  return {valid, negated};
}

function getSentiment(item){
  const text = keywordSearchText(item);
  const pos = countSentimentMatches(text, SENTIMENT_POS_RE);
  const neg = countSentimentMatches(text, SENTIMENT_NEG_RE);
  const posScore = pos.valid + neg.negated;  // 「下落しなかった」等、打ち消されたネガ語もポジ側に加算
  const negScore = neg.valid + pos.negated;  // 「上昇しなかった」等、打ち消されたポジ語もネガ側に加算
  if(posScore > negScore) return 'pos';
  if(negScore > posScore) return 'neg';
  return null;
}
