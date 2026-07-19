'use strict';
// このファイルは「ニュース取得元(RSSフィード)の一覧データ」を定義する。ロジックは持たない。
// 自動生成ファイル — 手編集しないこと。配信元を追加/変更したい場合は sources.json を編集し、
// scripts/fetch_news.py を実行して再生成する(GitHub Actionsが定期的に自動実行・再生成もする)。



const SOURCES = [
  {
    "id": "nhk-eco",
    "group": "nhk",
    "sub": "経済",
    "name": "NHKニュース(経済)",
    "short": "NHK",
    "home": "https://news.web.nhk/newsweb",
    "rss": "https://news.web.nhk/n-data/conf/na/rss/cat5.xml",
    "lang": "JA",
    "color": "#6fa8dc"
  },
  {
    "id": "nhk-gen",
    "group": "nhk",
    "sub": "総合",
    "name": "NHKニュース(主要)",
    "short": "NHK",
    "home": "https://news.web.nhk/newsweb",
    "rss": "https://news.web.nhk/n-data/conf/na/rss/cat0.xml",
    "lang": "JA",
    "color": "#6fa8dc"
  },
  {
    "id": "nikkei-asia",
    "group": "nikkei-asia",
    "name": "Nikkei Asia",
    "short": "Nikkei Asia",
    "home": "https://asia.nikkei.com/",
    "rss": "https://asia.nikkei.com/rss/feed/nar",
    "lang": "EN",
    "color": "#5fbf8f"
  },
  {
    "id": "ft",
    "group": "ft",
    "name": "Financial Times(Markets)",
    "short": "FT",
    "home": "https://www.ft.com/",
    "rss": "https://www.ft.com/markets?format=rss",
    "lang": "EN",
    "color": "#e28f8f"
  },
  {
    "id": "cnbc",
    "group": "cnbc",
    "name": "CNBC(US Top News)",
    "short": "CNBC",
    "home": "https://www.cnbc.com/",
    "rss": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "lang": "EN",
    "color": "#4fa8e0"
  },
  {
    "id": "economist",
    "group": "economist",
    "name": "The Economist(Finance & economics)",
    "short": "Economist",
    "home": "https://www.economist.com/",
    "rss": "https://www.economist.com/finance-and-economics/rss.xml",
    "lang": "EN",
    "color": "#d9534f"
  },
  {
    "id": "forbes",
    "group": "forbes",
    "name": "Forbes(Business)",
    "short": "Forbes",
    "home": "https://www.forbes.com/",
    "rss": "https://www.forbes.com/business/feed/",
    "lang": "EN",
    "color": "#e0a15a"
  },
  {
    "id": "techcrunch",
    "group": "techcrunch",
    "name": "TechCrunch",
    "short": "TechCrunch",
    "home": "https://techcrunch.com/",
    "rss": "https://techcrunch.com/feed/",
    "lang": "EN",
    "color": "#2dd4bf"
  },
  {
    "id": "itmedia-biz",
    "group": "itmedia-biz",
    "name": "ITmedia ビジネスオンライン",
    "short": "ITmediaビジネス",
    "home": "https://www.itmedia.co.jp/business/",
    "rss": "https://rss.itmedia.co.jp/rss/2.0/business.xml",
    "lang": "JA",
    "color": "#9a8cf2"
  },
  {
    "id": "nikkei-biz",
    "group": "nikkei-biz",
    "name": "日経ビジネス電子版",
    "short": "日経ビジネス",
    "home": "https://business.nikkei.com/",
    "rss": "https://business.nikkei.com/rss/sns/nb.rdf",
    "lang": "JA",
    "color": "#d987b8"
  },
  {
    "id": "bbc-biz",
    "group": "bbc-biz",
    "name": "BBC News Business",
    "short": "BBC",
    "home": "https://www.bbc.com/news/business",
    "rss": "http://feeds.bbci.co.uk/news/business/rss.xml",
    "lang": "EN",
    "color": "#b7bfd6"
  },
  {
    "id": "itmedia-ai",
    "group": "itmedia-ai",
    "name": "ITmedia AI+",
    "short": "ITmedia AI+",
    "home": "https://www.itmedia.co.jp/aiplus/",
    "rss": "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
    "lang": "JA",
    "color": "#b07cf0"
  },
  {
    "id": "xtech",
    "group": "xtech",
    "name": "日経クロステック",
    "short": "日経xTECH",
    "home": "https://xtech.nikkei.com/",
    "rss": "https://xtech.nikkei.com/rss/index.rdf",
    "lang": "JA",
    "color": "#7ed09c"
  },
  {
    "id": "investing-jp",
    "group": "investing-jp",
    "name": "Investing.com(Stock Market News)",
    "short": "Investing",
    "home": "https://www.investing.com/",
    "rss": "https://www.investing.com/rss/news_25.rss",
    "lang": "EN",
    "color": "#e07a9e"
  },
  {
    "id": "marketwatch",
    "group": "marketwatch",
    "name": "MarketWatch",
    "short": "MarketWatch",
    "home": "https://www.marketwatch.com/",
    "rss": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    "lang": "EN",
    "color": "#c7cf6e"
  },
  {
    "id": "zuu",
    "group": "zuu",
    "name": "ZUU online",
    "short": "ZUU online",
    "home": "https://zuuonline.com/",
    "rss": "https://zuuonline.com/feed",
    "lang": "JA",
    "color": "#d17ee0"
  },
  {
    "id": "fed-press",
    "group": "fed-press",
    "name": "Federal Reserve(FRB公式発表)",
    "short": "FRB",
    "home": "https://www.federalreserve.gov/",
    "rss": "https://www.federalreserve.gov/feeds/press_all.xml",
    "lang": "EN",
    "color": "#4a7fc9"
  },
  {
    "id": "ecb-press",
    "group": "ecb-press",
    "name": "European Central Bank(ECB公式発表)",
    "short": "ECB",
    "home": "https://www.ecb.europa.eu/",
    "rss": "https://www.ecb.europa.eu/rss/press.xml",
    "lang": "EN",
    "color": "#3d6ba8"
  },
  {
    "id": "investing-fx",
    "group": "investing-jp",
    "name": "Investing.com(Forex News)",
    "short": "Investing FX",
    "home": "https://www.investing.com/",
    "rss": "https://www.investing.com/rss/news_1.rss",
    "lang": "EN",
    "color": "#e0947a",
    "note": "investing-jpとgroupを共有し、フィルターチップを1つに統合している"
  },
  {
    "id": "investing-econ",
    "group": "investing-jp",
    "name": "Investing.com(Economic Indicators)",
    "short": "Investing 指標",
    "home": "https://www.investing.com/",
    "rss": "https://www.investing.com/rss/news_95.rss",
    "lang": "EN",
    "color": "#d98f60",
    "note": "investing-jpとgroupを共有し、フィルターチップを1つに統合している"
  },
  {
    "id": "investing-comm",
    "group": "investing-jp",
    "name": "Investing.com(Commodities & Futures)",
    "short": "Investing 商品",
    "home": "https://www.investing.com/",
    "rss": "https://www.investing.com/rss/news_11.rss",
    "lang": "EN",
    "color": "#c9825a",
    "note": "investing-jpとgroupを共有し、フィルターチップを1つに統合している"
  },
  {
    "id": "fxstreet",
    "group": "fxstreet",
    "name": "FXStreet(Forex & Commodities)",
    "short": "FXStreet",
    "home": "https://www.fxstreet.com/",
    "rss": "https://www.fxstreet.com/rss/news",
    "lang": "EN",
    "color": "#6ab04c"
  },
  {
    "id": "wsj-markets",
    "group": "wsj-markets",
    "name": "WSJ Markets(Dow Jones配信)",
    "short": "WSJ Markets",
    "home": "https://www.wsj.com/news/markets",
    "rss": "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
    "lang": "EN",
    "color": "#2c2c2c",
    "note": "廃止済みのWSJ公式RSSとは別ルート。既存MarketWatchと同じfeeds.content.dowjones.io配信基盤経由で取得"
  },
  {
    "id": "toyokeizai",
    "group": "toyokeizai",
    "name": "東洋経済オンライン",
    "short": "東洋経済",
    "home": "https://toyokeizai.net/",
    "rss": "https://toyokeizai.net/list/feed/rss",
    "lang": "JA",
    "color": "#c94f4f"
  },
  {
    "id": "diamond",
    "group": "diamond",
    "name": "ダイヤモンド・オンライン",
    "short": "ダイヤモンド",
    "home": "https://diamond.jp/",
    "rss": "https://diamond.jp/list/feed/rss/dol",
    "lang": "JA",
    "color": "#5a9bd4"
  },
  {
    "id": "guardian-biz",
    "group": "guardian-biz",
    "name": "The Guardian(Business)",
    "short": "Guardian",
    "home": "https://www.theguardian.com/uk/business",
    "rss": "https://www.theguardian.com/uk/business/rss",
    "lang": "EN",
    "color": "#90dcbf"
  },
  {
    "id": "politico",
    "group": "politico",
    "name": "Politico",
    "short": "Politico",
    "home": "https://www.politico.com/",
    "rss": "https://rss.politico.com/politics-news.xml",
    "lang": "EN",
    "color": "#e0637a",
    "note": "政治・政局ニュース(トピック絞込の政治/戦争ジャンルを補強する目的)"
  },
  {
    "id": "nhk-pol",
    "group": "nhk",
    "sub": "政治",
    "name": "NHKニュース(政治)",
    "short": "NHK",
    "home": "https://news.web.nhk/newsweb",
    "rss": "https://news.web.nhk/n-data/conf/na/rss/cat4.xml",
    "lang": "JA",
    "color": "#6fa8dc",
    "note": "nhkとgroupを共有し、フィルターチップを1つに統合している(政治ジャンルの補強)"
  },
  {
    "id": "nhk-int",
    "group": "nhk",
    "sub": "国際",
    "name": "NHKニュース(国際)",
    "short": "NHK",
    "home": "https://news.web.nhk/newsweb",
    "rss": "https://news.web.nhk/n-data/conf/na/rss/cat6.xml",
    "lang": "JA",
    "color": "#6fa8dc",
    "note": "nhkとgroupを共有し、フィルターチップを1つに統合している(戦争・地政学ジャンルの補強)"
  },
  {
    "id": "boj-press",
    "group": "boj-press",
    "name": "日本銀行(日銀公式発表)",
    "short": "日銀",
    "home": "https://www.boj.or.jp/",
    "rss": "https://www.boj.or.jp/rss/whatsnew.xml",
    "lang": "JA",
    "color": "#7ba7e0",
    "note": "FRB/ECBと並ぶ中央銀行公式枠。金融政策決定会合・オペ等の一次情報"
  },
  {
    "id": "boe-press",
    "group": "boe-press",
    "name": "Bank of England(BOE公式発表)",
    "short": "BOE",
    "home": "https://www.bankofengland.co.uk/",
    "rss": "https://www.bankofengland.co.uk/rss/news",
    "lang": "EN",
    "color": "#9184d6",
    "note": "FRB/ECB/日銀と並ぶ中央銀行公式枠"
  },
  {
    "id": "bbc-world",
    "group": "bbc-biz",
    "name": "BBC News World",
    "short": "BBC World",
    "home": "https://www.bbc.com/news/world",
    "rss": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "lang": "EN",
    "color": "#b7bfd6",
    "note": "bbc-bizとgroupを共有し、フィルターチップを1つに統合している(戦争・地政学ジャンルの補強)"
  },
  {
    "id": "defense-news",
    "group": "defense-news",
    "name": "Defense News",
    "short": "Defense News",
    "home": "https://www.defensenews.com/",
    "rss": "https://www.defensenews.com/arc/outboundfeeds/rss/",
    "lang": "EN",
    "color": "#8fae62",
    "note": "軍事・防衛産業ニュース(戦争/地政学ジャンルと防衛関連銘柄の補強)"
  },
  {
    "id": "foreign-policy",
    "group": "foreign-policy",
    "name": "Foreign Policy",
    "short": "Foreign Policy",
    "home": "https://foreignpolicy.com/",
    "rss": "https://foreignpolicy.com/feed/",
    "lang": "EN",
    "color": "#e0985c",
    "note": "外交・地政学分析(政治/戦争ジャンルの補強)"
  },
  {
    "id": "oilprice",
    "group": "oilprice",
    "name": "OilPrice.com",
    "short": "OilPrice",
    "home": "https://oilprice.com/",
    "rss": "https://oilprice.com/rss/main",
    "lang": "EN",
    "color": "#c9a04f",
    "note": "原油・エネルギー専門(商品/コモディティジャンルの補強)"
  },
  {
    "id": "coindesk",
    "group": "coindesk",
    "name": "CoinDesk",
    "short": "CoinDesk",
    "home": "https://www.coindesk.com/",
    "rss": "https://www.coindesk.com/arc/outboundfeeds/rss",
    "lang": "EN",
    "color": "#e3c34f",
    "note": "暗号資産専門。末尾スラッシュ付きのフィードURLは308リダイレクトになるためスラッシュなしで取得"
  },
  {
    "id": "seekingalpha",
    "group": "seekingalpha",
    "name": "Seeking Alpha(Breaking News)",
    "short": "Seeking Alpha",
    "home": "https://seekingalpha.com/",
    "rss": "https://seekingalpha.com/market_currents.xml",
    "lang": "EN",
    "color": "#e0766a",
    "note": "市場速報(market currents)フィード。bot対策が厳しめのサイトのため、Actions側で恒常的にFAILする場合は撤去する"
  }
];
