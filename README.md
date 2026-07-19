世界ニュース速報
リアルタイム経済ニュースボード
Financial Times、CNBC、NHK、Nikkei Asia、Investing.com、FRB/ECB/日銀/BOE公式発表、FXStreet など約39の投資/金融専門RSSフィードを集約する経済ニュースボードです。RSS取得はGitHub Actions上のPythonが定期的に行い、結果を静的JSONとしてコミットする方式のため、ブラウザ側(index.html)はビルド不要のまま動作します。

## アーキテクチャ
1. `.github/workflows/fetch-news.yml`(GitHub Actions、5分おきcron)が `scripts/fetch_news.py` を実行
2. `fetch_news.py` が `sources.json` の39ソースを直接fetchし(CORSプロキシを使わないサーバー側取得)、`news.json` と `sources.js` を生成してコミット
3. ブラウザ側(`feed.js`)は `news.json` を2分おきにfetchして画面に反映するだけ

## ファイル構成
デザイン(style.css)・データ・機能ロジックをそれぞれ役割ごとに分離しています。各ファイルの先頭に「このファイルは何を担当するか」を1行コメントで明記しているので、修正したい機能に対応するファイルだけを開けば済みます。

- `index.html` — ページの骨組みと、起動処理(イベント登録・自動更新・初期化呼び出し)のみ
- `style.css` — 画面デザイン(ダーク/ライトモード対応)
- `sources.json` — 配信元(RSSフィード)定義の正本。**配信元を追加/削除/変更したい場合はこのファイルを編集する**
- `sources.js` — `sources.json` から自動生成されるJS版データ(**手編集しない**。`scripts/fetch_news.py` が再生成する)
- `scripts/fetch_news.py` — RSS取得本体(Python)。`sources.json`→`sources.js`の再生成、全ソースの並列fetch、`news.json`の書き出しを行う
- `scripts/requirements.txt` — 上記スクリプトの依存パッケージ(`requests`, `feedparser`)
- `.github/workflows/fetch-news.yml` — 上記スクリプトを5分おきに自動実行するGitHub Actions定義
- `news.json` — 取得済み記事データ(自動生成・自動コミットされる静的JSON)
- `topic-keywords.js` — データ: トピック絞り込み用の単語リスト
- `sentiment-keywords.js` — データ: 簡易センチメント判定用の単語リスト
- `market-sessions.js` — データ: 世界の株式市場の開場時間
- `utils.js` — 共通ヘルパー関数
- `theme.js` — ダーク/ライトモード切り替え
- `feed.js` — 静的news.jsonの取得・キャッシュ・更新ステータス表示
- `translate.js` — 英語記事の自動日本語翻訳
- `topic-filter.js` — トピック絞り込みロジック
- `sentiment.js` — 簡易センチメント判定ロジック
- `render.js` — 記事一覧・フィルターチップ・フッターリンクの描画
- `ticker.js` — TradingView相場ティッカー表示
- `sessions.js` — 世界の取引セッション表示
主な機能
約39の投資/金融専門RSSフィードを横断して収集(為替・政策金利・商品・国際情勢に強いソースを重視)
BBC（Business・World）、Financial Times、CNBC、The Economist、Forbes、MarketWatch、Investing.com（株式・為替・経済指標・商品の4フィード）、Federal Reserve(FRB)公式発表、European Central Bank(ECB)公式発表、日本銀行(日銀)公式発表、Bank of England(BOE)公式発表、FXStreet、WSJ Markets、Seeking Alpha、The Guardian(Business)、Politico、Foreign Policy、Defense News、OilPrice.com、CoinDesk、TechCrunch、Nikkei Asia、NHK（経済・主要・政治・国際の4フィード）、ITmedia（ビジネス・AI+）、日経ビジネス、日経クロステック、東洋経済オンライン、ダイヤモンド・オンライン、ZUU online、日本経済新聞(X公式アカウント)に対応(日経のX投稿は通常のRSSではなく、X公式埋め込みウィジェットが使う公開エンドポイント(syndication.twitter.com)から取得しています。ログイン・Cookieは不要ですが非公開の内部エンドポイントのため、X側の仕様変更で取得できなくなる可能性があります。WSJ MarketsはMarketWatchと同じDow Jones配信基盤(feeds.content.dowjones.io)経由で取得。Bloomberg・WSJ公式RSS・CNNは配信が長期間停止／廃止済みで代替経由でも安定して表示できなかったため未収載。投資/金融特化の方針のもと、一般ニュース/ライフスタイル系のNewsweek・Business Insider・Digiday・VentureBeat・GeekWire・Japan Times・ITmedia NEWS・CNET Japan・Tech in Asiaは収載を見送っています。Nikkei Asiaの公開RSSは日時情報を含まないため、記事カードの時刻表示が「時刻不明」になります)

5分ごとにGitHub Actionsが記事を再取得し、ブラウザ側は1分ごとにその結果(news.json)を再取得
過去4日以内に公開された記事を自動で表示(FRB/ECB公式発表やEconomist・日経クロステック等は更新頻度が2〜3日おきのことがあるため)

英語記事の日本語表示
MyMemory または Google 翻訳を利用し、英語見出しを日本語へ自動翻訳。原文見出しもあわせて確認できます

関心トピックで絞り込み
投資・金融・政治・戦争/地政学関連のキーワードをワンクリックでON/OFF切替(デフォルトはONでこれらのジャンルのみ表示。OFFにすると全記事表示)

簡易センチメント表示
見出し・要約内の頻出語から、上向き・下向きの傾向を ▲ / ▼ で表示

見やすい記事管理
NEWバッジ、配信元フィルター、キーワード検索に対応

マーケット情報の併記
TradingViewティッカーにより、為替や主要株価指数を同一画面で確認可能

使い方
GitHub Pagesなどのhttp(s)ホスティングに配置して公開してください。インストールやビルドは不要です(GitHub Actions側にPython実行環境は必要ですが、GitHub Actionsが自動的に用意するため利用者側の準備は不要です)。
注意: index.html を `file://` で直接開いた場合、`news.json` のfetchがブラウザのローカルファイル制限で失敗するため、ライブ更新は動作しません(初回訪問でキャッシュが全く無い場合は記事0件表示になります)。動作確認・開発時は `python -m http.server` 等のローカルサーバー経由で開いてください。
免責事項
本ボードは情報提供を目的としており、投資勧誘または投資助言を目的とするものではありません。
記事の見出し・要約は各配信元の公開RSSフィードから取得し、原文へのリンクを掲載しています。機械翻訳およびセンチメント判定は簡易的な自動処理であるため、内容の正確性は必ず原文でご確認ください。
取引および投資に関する最終的な判断は、ご自身の責任で行ってください。

Google AdSenseでの収益化手順
1. 本サイトがGitHub Pages等で一般公開されていることを確認する(審査には公開URLが必須)。
2. https://www.google.com/adsense/ から自分のGoogleアカウントでアカウントを作成し、サイトのURLを登録して審査を申請する。
3. 承認後、AdSense管理画面で「パブリッシャーID」(pub-で始まる番号)を確認する。
4. index.html 内の `<!-- Google AdSense: ... -->` コメントブロックのコメントを外し、`ca-pub-XXXXXXXXXXXXXXXX` を実際のIDに置き換える。
5. ads.txt の該当行のコメント(`# `)を外し、同じくIDを置き換える。
6. AdSense管理画面の「プライバシーとメッセージ(Funding Choices)」でEEA/UK訪問者向けの同意管理(CMP)タグを作成し、index.html のAdSenseスクリプトの直後に追加する。
7. privacy.html(プライバシーポリシー)の内容を実情に合わせて確認・調整する。
