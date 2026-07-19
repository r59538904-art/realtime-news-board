'use strict';
// 簡易センチメント判定用のポジティブ/ネガティブ単語リスト(判定ロジックはsentiment.js)。
// 日本語は部分一致、英字は誤爆防止のため単語境界(\b)付きで一致させる。

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
