'use strict';
// このファイルは「世界の株式市場(取引セッション)の開場時間データ」を定義する。ロジックは持たない(表示ロジックは sessions.js)。



// ================= 世界の取引セッション 用データ定義 =================
// ・表示ロジック本体(tzParts・isMktOpen・buildSessions等)は sessions.js 側にあり、このファイルはデータのみを持つ
// ・MKT: 開場判定(isMktOpen)用の市場コード → タイムゾーン・開場時間帯(spans, 24時間制[開始時,開始分,終了時,終了分])
// ・SESS: セッションバー描画用の一覧。o/cはその市場のローカル時間での開場/閉場時刻(小数、例 9.5=9時30分)
const MKT = {
  tse :{tz:'Asia/Tokyo',        spans:[[9,0,11,30],[12,30,15,30]]},
  sse :{tz:'Asia/Shanghai',     spans:[[9,30,11,30],[13,0,15,0]]},
  hk  :{tz:'Asia/Hong_Kong',    spans:[[9,30,12,0],[13,0,16,0]]},
  krx :{tz:'Asia/Seoul',        spans:[[9,0,15,30]]},
  lse :{tz:'Europe/London',     spans:[[8,0,16,30]]},
  euronext:{tz:'Europe/Paris',  spans:[[9,0,17,30]]},
  nyse:{tz:'America/New_York',  spans:[[9,30,16,0]]},
};
const SESS=[
  {label:'東京 TSE',             mkt:'tse',      tz:'Asia/Tokyo',       o:9,   c:15.5, row:0},
  {label:'上海/深セン SSE・SZSE', mkt:'sse',      tz:'Asia/Shanghai',    o:9.5, c:15,   row:1},
  {label:'香港 HKEX',            mkt:'hk',       tz:'Asia/Hong_Kong',   o:9.5, c:16,   row:2},
  {label:'ソウル KRX',           mkt:'krx',      tz:'Asia/Seoul',       o:9,   c:15.5, row:3},
  {label:'ロンドン LSE',         mkt:'lse',      tz:'Europe/London',    o:8,   c:16.5, row:4},
  {label:'パリ ユーロネクスト',   mkt:'euronext', tz:'Europe/Paris',     o:9,   c:17.5, row:5},
  {label:'ニューヨーク NYSE・NASDAQ',mkt:'nyse',  tz:'America/New_York', o:9.5, c:16,   row:6},
];
