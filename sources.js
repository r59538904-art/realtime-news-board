'use strict';
// このファイルは「ニュース取得元(RSSフィード)の一覧データ」を定義する。ロジックは持たない。



// ================= ニュースソース定義 =================
// group: フィルターチップの単位 / sub: カードに添えるジャンル表示
// 未収載: Reuters(公開RSSを2020年頃に廃止。reutersagency.com/feed=404, reuters.com/world/rss=401ボット遮断, Thomson Reuters IR=403)、
// Bloomberg(公式RSS(feeds.bloomberg.com配下)は404で廃止済み。代替の姉妹メディアBNN Bloombergも
// 中継プロキシ越しでは安定して表示できなかったため、確実性を優先し2026-07に収載を見送った)
// 新しい配信元を増やしたいときはこの配列に1行追加するだけでOK(index.html側の変更は不要)
// 注記(2026-07): Investing.comは直接アクセスは200だがサイト側のCloudflareボット対策で中継プロキシ
// (allorigins/rss2json)からのアクセスが時々ブロックされることを確認済み。Google News経由への切替も
// 試したが改善が不明瞭だったため、元のURLに戻している(取得に失敗した場合は前回キャッシュ表示に
// フォールバックする仕組みで吸収)。
// 注記(2026-07・2回目): 投資/金融専門サイトを重視する方針に転換し、一般ニュース/ライフスタイル寄りの
// ソース(Newsweek・Business Insider・Digiday・VentureBeat・GeekWire・Japan Times・ITmedia NEWS・
// CNET Japan・Tech in Asia)を削除し、代わりに為替・政策金利・商品・海外市況に強い専門ソースを追加した:
// FRB/ECBの公式発表(政策金利の一次情報)、Investing.comのForex/Economic Indicators/Commodities
// カテゴリ別フィード(既存のStock Market Newsに加えて収載)、FXStreet(為替・商品専門)、
// WSJ Markets(既存MarketWatchと同じfeeds.content.dowjones.io配信基盤で取得できることを確認、
// WSJ公式RSS(廃止済み)とは別ルート)、東洋経済オンライン・ダイヤモンド・オンライン(国内ビジネス誌)。
const SOURCES = [
  {id:'nhk-eco',  group:'nhk', sub:'経済',   name:'NHKニュース(経済)',     short:'NHK',        home:'https://news.web.nhk/newsweb', rss:'https://news.web.nhk/n-data/conf/na/rss/cat5.xml', lang:'JA', color:'#6fa8dc'},
  {id:'nhk-gen',  group:'nhk', sub:'総合',   name:'NHKニュース(主要)',     short:'NHK',        home:'https://news.web.nhk/newsweb', rss:'https://news.web.nhk/n-data/conf/na/rss/cat0.xml', lang:'JA', color:'#6fa8dc'},
  {id:'nikkei-asia',group:'nikkei-asia',name:'Nikkei Asia',        short:'Nikkei Asia',home:'https://asia.nikkei.com/',     rss:'https://asia.nikkei.com/rss/feed/nar',              lang:'EN', color:'#5fbf8f'},
  {id:'ft',       group:'ft',        name:'Financial Times(Markets)', short:'FT',        home:'https://www.ft.com/',          rss:'https://www.ft.com/markets?format=rss',              lang:'EN', color:'#e28f8f'},
  {id:'cnbc',     group:'cnbc',      name:'CNBC(US Top News)',     short:'CNBC',        home:'https://www.cnbc.com/',        rss:'https://www.cnbc.com/id/100003114/device/rss/rss.html', lang:'EN', color:'#4fa8e0'},
  {id:'economist',group:'economist', name:'The Economist(Finance & economics)', short:'Economist', home:'https://www.economist.com/', rss:'https://www.economist.com/finance-and-economics/rss.xml', lang:'EN', color:'#d9534f'},
  {id:'forbes',   group:'forbes',    name:'Forbes(Business)',      short:'Forbes',      home:'https://www.forbes.com/',      rss:'https://www.forbes.com/business/feed/',              lang:'EN', color:'#e0a15a'},
  {id:'techcrunch',group:'techcrunch',name:'TechCrunch',           short:'TechCrunch',  home:'https://techcrunch.com/',      rss:'https://techcrunch.com/feed/',                       lang:'EN', color:'#2dd4bf'},
  {id:'itmedia-biz',group:'itmedia-biz', name:'ITmedia ビジネスオンライン',short:'ITmediaビジネス',home:'https://www.itmedia.co.jp/business/', rss:'https://rss.itmedia.co.jp/rss/2.0/business.xml', lang:'JA', color:'#9a8cf2'},
  {id:'nikkei-biz',group:'nikkei-biz',name:'日経ビジネス電子版',    short:'日経ビジネス', home:'https://business.nikkei.com/', rss:'https://business.nikkei.com/rss/sns/nb.rdf',        lang:'JA', color:'#d987b8'},
  {id:'bbc-biz',  group:'bbc-biz',   name:'BBC News Business',     short:'BBC',         home:'https://www.bbc.com/news/business', rss:'http://feeds.bbci.co.uk/news/business/rss.xml', lang:'EN', color:'#b7bfd6'},
  {id:'itmedia-ai',group:'itmedia-ai',name:'ITmedia AI+',          short:'ITmedia AI+', home:'https://www.itmedia.co.jp/aiplus/', rss:'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml',      lang:'JA', color:'#b07cf0'},
  {id:'xtech',    group:'xtech',     name:'日経クロステック',     short:'日経xTECH',   home:'https://xtech.nikkei.com/',    rss:'https://xtech.nikkei.com/rss/index.rdf',             lang:'JA', color:'#7ed09c'},
  {id:'investing-jp',group:'investing-jp',name:'Investing.com(Stock Market News)',short:'Investing.com',home:'https://www.investing.com/', rss:'https://www.investing.com/rss/news_25.rss',      lang:'EN', color:'#e07a9e'},
  {id:'marketwatch',group:'marketwatch',name:'MarketWatch',        short:'MarketWatch', home:'https://www.marketwatch.com/', rss:'https://feeds.content.dowjones.io/public/rss/mw_topstories', lang:'EN', color:'#c7cf6e'},
  {id:'zuu',      group:'zuu',       name:'ZUU online',            short:'ZUU online',  home:'https://zuuonline.com/',       rss:'https://zuuonline.com/feed',                          lang:'JA', color:'#d17ee0'},
  {id:'fed-press',group:'fed-press', name:'Federal Reserve(FRB公式発表)', short:'FRB',   home:'https://www.federalreserve.gov/', rss:'https://www.federalreserve.gov/feeds/press_all.xml', lang:'EN', color:'#4a7fc9'},
  {id:'ecb-press',group:'ecb-press', name:'European Central Bank(ECB公式発表)', short:'ECB', home:'https://www.ecb.europa.eu/', rss:'https://www.ecb.europa.eu/rss/press.xml',           lang:'EN', color:'#3d6ba8'},
  {id:'investing-fx',group:'investing-fx',name:'Investing.com(Forex News)',short:'Investing.com FX',home:'https://www.investing.com/', rss:'https://www.investing.com/rss/news_1.rss',   lang:'EN', color:'#e0947a'},
  {id:'investing-econ',group:'investing-econ',name:'Investing.com(Economic Indicators)',short:'Investing.com 指標',home:'https://www.investing.com/', rss:'https://www.investing.com/rss/news_95.rss', lang:'EN', color:'#d98f60'},
  {id:'investing-comm',group:'investing-comm',name:'Investing.com(Commodities & Futures)',short:'Investing.com 商品',home:'https://www.investing.com/', rss:'https://www.investing.com/rss/news_11.rss', lang:'EN', color:'#c9825a'},
  {id:'fxstreet', group:'fxstreet',  name:'FXStreet(Forex & Commodities)', short:'FXStreet', home:'https://www.fxstreet.com/', rss:'https://www.fxstreet.com/rss/news',              lang:'EN', color:'#6ab04c'},
  {id:'wsj-markets',group:'wsj-markets',name:'WSJ Markets(Dow Jones配信)',short:'WSJ Markets',home:'https://www.wsj.com/news/markets', rss:'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', lang:'EN', color:'#2c2c2c'},
  {id:'toyokeizai',group:'toyokeizai',name:'東洋経済オンライン',   short:'東洋経済',    home:'https://toyokeizai.net/',      rss:'https://toyokeizai.net/list/feed/rss',               lang:'JA', color:'#c94f4f'},
  {id:'diamond',  group:'diamond',   name:'ダイヤモンド・オンライン', short:'ダイヤモンド', home:'https://diamond.jp/',        rss:'https://diamond.jp/list/feed/rss/dol',               lang:'JA', color:'#5a9bd4'},
];
