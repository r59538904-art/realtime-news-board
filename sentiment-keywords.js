'use strict';
// このファイルは「簡易センチメント判定(▲/▼表示)で使うポジティブ/ネガティブ単語リスト」を定義する。ロジックは持たない(判定ロジックは sentiment.js)。



// ================= 簡易センチメント判定 用キーワード定義 =================
// ・判定ロジック本体(buildSentimentRe・getSentiment)は sentiment.js 側にあり、このファイルは単語リストのみを持つ
// ・トピック絞り込み(topic-keywords.js)と同じ方式: 日本語は部分一致、英字は単語境界(\b)付きで一致
const SENTIMENT_POS_CJK = [
  '上方修正','増益','最高値','急伸','急騰','好調','黒字転換','増収増益','強気','最高益','買い推奨','拡大','反発','上昇',
];
const SENTIMENT_POS_LATIN = [
  'rally','surge','soar','jump','gain','beat','record high','outperform','bullish','rebound','upgrade',
];
const SENTIMENT_NEG_CJK = [
  '下方修正','減益','安値','急落','暴落','不振','赤字転落','減収減益','弱気','最安値','売り推奨','縮小','低迷','下落',
];
const SENTIMENT_NEG_LATIN = [
  'slump','plunge','crash','warning','miss','record low','underperform','bearish','tumble','slide',
  'recession','layoff','layoffs','downgrade',
];
