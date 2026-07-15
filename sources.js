'use strict';
// このファイルは「ニュース取得元(RSSフィード)の一覧データ」を定義する。ロジックは持たない。



// ================= ニュースソース定義 =================
// group: フィルターチップの単位 / sub: カードに添えるジャンル表示
// 未収載: Reuters(公開RSSを2020年頃に廃止。reutersagency.com/feed=404, reuters.com/world/rss=401ボット遮断, Thomson Reuters IR=403)
// 新しい配信元を増やしたいときはこの配列に1行追加するだけでOK(index.html側の変更は不要)
// 注記(2026-07): Bloomberg公式RSS(feeds.bloomberg.com配下、旧markets/economics/technologyの3フィード)は
// 直接アクセスで404(廃止された模様)のため、姉妹メディアBNN Bloomberg(Bloomberg News配信記事を含む)の
// RSSに差し替えた(直接curlで200・鮮度良好・bot遮断の兆候なしを確認済み。中継プロキシ越しの100%の
// 疎通は保証できないが、旧URLは常時404で確実に空だったため後退にはならない)。カテゴリ別フィード
// (technology/economy)は空だったため、市況・経済・テックの3分割はやめ単一フィードに統合。
// Investing.comは直接アクセスは200だがサイト側のCloudflareボット対策で中継プロキシ(allorigins/rss2json)
// からのアクセスが時々ブロックされることを確認済み。Google News経由への切替も試したが改善が不明瞭だったため、
// 元のURLに戻している(取得に失敗した場合は前回キャッシュ表示にフォールバックする仕組みで吸収)。
// Tech in Asiaは、Google Newsのサイト内検索が既定で関連度順ソートのため取得記事の大半が2日以上前の
// 古い記事になり鮮度フィルタで弾かれていたことが判明。クエリに when:2d を追加し日付順ソートに変更した。
const SOURCES = [
  {id:'bbg-news', group:'bbg', name:'Bloomberg News(BNN Bloomberg配信)', short:'Bloomberg',  home:'https://www.bnnbloomberg.ca/', rss:'https://www.bnnbloomberg.ca/arc/outboundfeeds/rss/?outputType=xml', lang:'EN', color:'#d8b46e'},
  {id:'nhk-eco',  group:'nhk', sub:'経済',   name:'NHKニュース(経済)',     short:'NHK',        home:'https://news.web.nhk/newsweb', rss:'https://news.web.nhk/n-data/conf/na/rss/cat5.xml', lang:'JA', color:'#6fa8dc'},
  {id:'nhk-gen',  group:'nhk', sub:'総合',   name:'NHKニュース(主要)',     short:'NHK',        home:'https://news.web.nhk/newsweb', rss:'https://news.web.nhk/n-data/conf/na/rss/cat0.xml', lang:'JA', color:'#6fa8dc'},
  {id:'nikkei-asia',group:'nikkei-asia',name:'Nikkei Asia',        short:'Nikkei Asia',home:'https://asia.nikkei.com/',     rss:'https://asia.nikkei.com/rss/feed/nar',              lang:'EN', color:'#5fbf8f'},
  {id:'ft',       group:'ft',        name:'Financial Times(Markets)', short:'FT',        home:'https://www.ft.com/',          rss:'https://www.ft.com/markets?format=rss',              lang:'EN', color:'#e28f8f'},
  {id:'cnbc',     group:'cnbc',      name:'CNBC(US Top News)',     short:'CNBC',        home:'https://www.cnbc.com/',        rss:'https://www.cnbc.com/id/100003114/device/rss/rss.html', lang:'EN', color:'#4fa8e0'},
  {id:'economist',group:'economist', name:'The Economist(Finance & economics)', short:'Economist', home:'https://www.economist.com/', rss:'https://www.economist.com/finance-and-economics/rss.xml', lang:'EN', color:'#d9534f'},
  {id:'forbes',   group:'forbes',    name:'Forbes(Business)',      short:'Forbes',      home:'https://www.forbes.com/',      rss:'https://www.forbes.com/business/feed/',              lang:'EN', color:'#e0a15a'},
  {id:'techcrunch',group:'techcrunch',name:'TechCrunch',           short:'TechCrunch',  home:'https://techcrunch.com/',      rss:'https://techcrunch.com/feed/',                       lang:'EN', color:'#2dd4bf'},
  {id:'japantimes',group:'japantimes',name:'The Japan Times',      short:'Japan Times', home:'https://www.japantimes.co.jp/', rss:'https://www.japantimes.co.jp/feed/',                lang:'EN', color:'#c17a5a'},
  {id:'newsweek', group:'newsweek',  name:'Newsweek',              short:'Newsweek',    home:'https://www.newsweek.com/',    rss:'https://www.newsweek.com/rss',                       lang:'EN', color:'#8b93c9'},
  {id:'businessinsider',group:'businessinsider',name:'Business Insider',short:'Business Insider',home:'https://www.businessinsider.com/', rss:'https://www.businessinsider.com/rss', lang:'EN', color:'#7fd45a'},
  {id:'digiday',  group:'digiday',   name:'Digiday',               short:'Digiday',     home:'https://digiday.com/',         rss:'https://digiday.com/feed/',                          lang:'EN', color:'#f0a83c'},
  {id:'venturebeat',group:'venturebeat',name:'VentureBeat',        short:'VentureBeat', home:'https://venturebeat.com/',     rss:'https://venturebeat.com/feed/',                      lang:'EN', color:'#6ec9e0'},
  {id:'geekwire', group:'geekwire',  name:'GeekWire',              short:'GeekWire',    home:'https://www.geekwire.com/',    rss:'https://www.geekwire.com/feed/',                     lang:'EN', color:'#5ecf9e'},
  {id:'techinasia',group:'techinasia',name:'Tech in Asia(Google News経由)',short:'Tech in Asia',home:'https://www.techinasia.com/',  rss:'https://news.google.com/rss/search?q=site:techinasia.com%20when:2d&hl=en-US&gl=US&ceid=US:en', lang:'EN', color:'#c9a8e0'},
  {id:'itmedia-news',group:'itmedia-news',name:'ITmedia NEWS',      short:'ITmedia NEWS',home:'https://www.itmedia.co.jp/news/', rss:'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml', lang:'JA', color:'#4fb8d4'},
  {id:'itmedia-biz',group:'itmedia-biz', name:'ITmedia ビジネスオンライン',short:'ITmediaビジネス',home:'https://www.itmedia.co.jp/business/', rss:'https://rss.itmedia.co.jp/rss/2.0/business.xml', lang:'JA', color:'#9a8cf2'},
  {id:'nikkei-biz',group:'nikkei-biz',name:'日経ビジネス電子版',    short:'日経ビジネス', home:'https://business.nikkei.com/', rss:'https://business.nikkei.com/rss/sns/nb.rdf',        lang:'JA', color:'#d987b8'},
  {id:'bbc-biz',  group:'bbc-biz',   name:'BBC News Business',     short:'BBC',         home:'https://www.bbc.com/news/business', rss:'http://feeds.bbci.co.uk/news/business/rss.xml', lang:'EN', color:'#b7bfd6'},
  {id:'itmedia-ai',group:'itmedia-ai',name:'ITmedia AI+',          short:'ITmedia AI+', home:'https://www.itmedia.co.jp/aiplus/', rss:'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml',      lang:'JA', color:'#b07cf0'},
  {id:'xtech',    group:'xtech',     name:'日経クロステック',     short:'日経xTECH',   home:'https://xtech.nikkei.com/',    rss:'https://xtech.nikkei.com/rss/index.rdf',             lang:'JA', color:'#7ed09c'},
  {id:'investing-jp',group:'investing-jp',name:'Investing.com(Stock Market News)',short:'Investing.com',home:'https://www.investing.com/', rss:'https://www.investing.com/rss/news_25.rss',      lang:'EN', color:'#e07a9e'},
  {id:'cnet-japan',group:'cnet-japan',name:'CNET Japan',           short:'CNET Japan',  home:'https://japan.cnet.com/',      rss:'http://feed.japan.cnet.com/rss/index.rdf',           lang:'JA', color:'#55c2b8'},
  {id:'marketwatch',group:'marketwatch',name:'MarketWatch',        short:'MarketWatch', home:'https://www.marketwatch.com/', rss:'https://feeds.content.dowjones.io/public/rss/mw_topstories', lang:'EN', color:'#c7cf6e'},
  {id:'zuu',      group:'zuu',       name:'ZUU online',            short:'ZUU online',  home:'https://zuuonline.com/',       rss:'https://zuuonline.com/feed',                          lang:'JA', color:'#d17ee0'},
];
