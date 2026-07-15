'use strict';
// このファイルは「トピック絞り込みで使う単語リスト」を定義する。ロジックは持たない(判定ロジックは topic-filter.js)。
// ================= トピック絞り込みキーワード定義 =================
// ・NHK総合や現代ビジネスのような雑多なフィードから事件・芸能等を弾き、金融/ビジネス/テック系記事だけ残す
// ・タイトル+要約(原文・翻訳文どちらも)にキーワードのいずれかを含む記事だけを通す
// ・日本語キーワードは部分一致、英字キーワードは英単語の一部に誤爆しないよう単語境界(\b)付きで一致させる
// ・判定ロジック本体(TOPIC_RE・matchesTopic)は topic-filter.js 側にあり、このファイルは単語リストのみを持つ
// ・キーワードを追加/編集したいときはこのファイルだけ触ればOK(他ファイルの変更は不要)
const TOPIC_KEYWORDS_CJK = [
  '株','株式','株価','相場','為替','円安','円高','決算','業績','増収','減収','増益','減益','黒字','赤字',
  '買収','合併','提携','出資','上場','自社株買い','配当','格付け','レーティング','投資判断','目標株価',
  'アナリスト','ファンド','機関投資家','金利','利上げ','利下げ','日銀','インフレ','景気','関税','半導体',
  '人工知能','生成','テック','スタートアップ','企業','経営','社長','時価総額','証券','投資家','資金調達',
  '業界再編','経済','巨額',
  'ホルムズ海峡','戦争','デフレ','公開買い付け','サーキットブレーカー','投資信託','銀行','証券会社',
  // 以下は追加分。英字の略語(PER/EPS/ROEなど)は単語境界なしの部分一致だと
  // "heroes"→ROE、"revenue"→EV、"steps"→EPSのように誤爆するため、単語境界ありの
  // TOPIC_KEYWORDS_LATIN側に入れている(この配列には日本語・カタカナのみを置く)
  '日経平均','東証','プライム市場','グロース市場','NYダウ','S&P500',
  'ボラティリティ','リスクオフ','米国債','国債','長期金利','利回り','量的緩和','量的引き締め',
  '景気後退','リセッション','スタグフレーション','株式分割','増資','公募増資','第三者割当','希薄化',
  '転換社債','ワラント','株主優待','上方修正','下方修正','営業利益','経常利益','純利益','売上高',
  '株価収益率','業績ガイダンス','業績予想','コンセンサス予想','事業スピンオフ','事業売却','事業譲渡',
  'リストラ','人員削減','破産','民事再生','上場廃止','不正会計','行政処分','訴訟',
  'ドル円','ドル高','ドル安','ユーロ円','原油','金価格','データセンター','クラウドサービス','サイバーセキュリティ',
  '電池','再生可能エネルギー','防衛関連','バイオ','医薬品','制裁','輸出規制','地政学リスク','台湾有事','中東','紅海',
  // 世界の主要株価指数
  '日経225','コスピ','ハンセン指数','上海総合指数','深セン総合指数','ユーロストックス','ラッセル2000',
  // マクロ経済指標。CPI/PPI/PMIは英字略語のためTOPIC_KEYWORDS_LATIN側にも入れ、
  // ここには読み下した正式名称のみを置く(理由は冒頭のコメントと同じ)
  '雇用統計','失業率','賃金','消費者物価指数','生産者物価指数','小売売上高','鉱工業生産','住宅着工',
  '貿易収支','経常収支','財政赤字','政府債務','購買担当者景気指数',
  // 金融政策・為替
  '政策金利','実質金利','イールドカーブ','逆イールド','利回り曲線','為替介入','キャリートレード',
  '通貨安','通貨高','信用スプレッド','社債','ジャンク債',
  // 株式・企業(ROA/DOEは同様の理由でLATIN側 or 不採用。「オプション」「調整」は一般語すぎるため
  // 「オプション取引」「株価調整」のように具体化)
  'フリーキャッシュフロー','自己資本比率','有利子負債','ネットキャッシュ','配当性向',
  'アクティビスト投資家','物言う株主','コーポレートガバナンス','PBR改革','インサイダー取引',
  // 市場動向
  '先物','オプション取引','空売り','踏み上げ','信用取引','出来高','年初来高値','年初来安値',
  '株価調整','急騰','急落','暴落','強気相場','弱気相場','バブル','ショートカバー',
  // 国際・資源(「海運」は単独残し、「shipping」は英語側でECサイトの「配送」と紛れるため具体化)
  '貿易摩擦','保護主義','サプライチェーン','レアアース','銅価格','天然ガス','穀物価格',
  '海運','海上運賃','脱中国','ニアショアリング',
  // テーマ投資
  'ロボティクス','量子コンピュータ','フィンテック','ブロックチェーン','暗号資産','ステーブルコイン',
  '宇宙開発','インバウンド','電力不足','送電網',
];
const TOPIC_KEYWORDS_LATIN = [
  'stock','shares','equity','equities','earnings','revenue','profit','merger','acquisition',
  'ipo','buyback','dividend','rating','ratings','upgrade','downgrade','price target','analyst',
  'hedge fund','investor','rate hike','rate cut','fed','frb','inflation','gdp','tariff','chip',
  'semiconductor','ai','llm','startup','ceo','tech','funding','market','economy','nasdaq','dow jones',
  's&p','m&a','billion','deal','takeover','buyout','offering','tob',
  'hormuz','war','deflation','tender offer','circuit breaker','mutual fund','bank','brokerage',
  // 以下は追加分。単独では一般語すぎて誤爆しやすい語(forecast/outlook/beat/miss/warrant/oil/
  // gold/cloud/battery/defense/taiwan/lawsuit/guidance/consensus等)は具体化した複合語にしている。
  // "per"は"per day"等で英文に頻出しすぎるため不採用(日本語側の株価収益率とp/eで代替)
  'nikkei','topix','tse','vix','volatility','risk-off','fomc','ecb','boe',
  'treasury','treasury yield','bond yield','quantitative easing','quantitative tightening',
  'recession','stagflation','stock split','dilution','secondary offering','private placement',
  'convertible bond','stock warrant','earnings guidance','earnings forecast','earnings outlook',
  'consensus estimate','earnings beat','earnings miss','eps','ebitda','valuation','p/e','p/b','pbr','roe','mbo',
  'spin-off','divestiture','restructuring','layoffs','bankruptcy','delisting','accounting fraud','securities lawsuit',
  'dollar-yen','usd/jpy','crude oil','gold price','wti','opec','lng','gpu',
  'data center','cloud computing','cybersecurity','ev','ev battery','renewable energy','defense stocks','biotech',
  'sanctions','export controls','geopolitical risk','taiwan strait','red sea',
  'share price','shares outstanding','share buyback',
  // 世界の主要株価指数(既存のnasdaq/s&p/dow jones/topix/vixに追加)
  'kospi','hang seng','shanghai composite','ftse','dax','cac 40','russell 2000','msci',
  // マクロ経済指標(略語+正式名称の両方を採用。"per"同様、単独では頻出しすぎる語は避けている)
  'employment report','unemployment rate','wages','consumer price index','cpi',
  'producer price index','ppi','retail sales','industrial production','housing starts',
  'trade balance','current account balance','fiscal deficit','government debt',
  'purchasing managers index','pmi',
  // 金融政策・為替
  'policy interest rate','real interest rate','yield curve','inverted yield curve','fx intervention',
  'carry trade','currency depreciation','currency appreciation','credit spread','corporate bonds','junk bonds',
  // 株式・企業("doe"は鹿を意味する一般語・"Jane/John Doe"と衝突するため不採用、
  // "EV/EBITDA"は既存のev・ebitdaが個別にヒットするため追加不要)
  'return on assets','roa','free cash flow','fcf','equity ratio','interest-bearing debt','net cash',
  'dividend payout ratio','dividend on equity','activist investor','shareholder activist',
  'corporate governance','pbr reform','insider trading',
  // 市場動向("options""correction""surge""plunge""crash"は一般語すぎるため具体化)
  'futures','options trading','short selling','short squeeze','margin trading','trading volume',
  'year-to-date high','year-to-date low','market correction','price surge','price plunge','market crash',
  'bull market','bear market','asset bubble','short covering',
  // 国際・資源("shipping"はEC通販の「配送」と紛れるため"container shipping"に具体化)
  'trade friction','protectionism','supply chain','rare earths','copper prices','natural gas','grain prices',
  'container shipping','freight rates','de-risking from china','nearshoring',
  // テーマ投資
  'robotics','quantum computing','fintech','blockchain','crypto assets','stablecoins',
  'space development','inbound tourism','power shortage','power grid',
];
