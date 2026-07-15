世界ニュース速報
リアルタイム経済ニュースボード
BBC、Bloomberg、Financial Times、CNBC、NHK、Nikkei Asia、TechCrunch、ITmedia など約26の公開RSSフィードを集約する、サーバー不要の経済ニュースボードです。index.html をブラウザで開くだけで利用できます(ビルド不要)。

## ファイル構成
デザイン(style.css)・データ・機能ロジックをそれぞれ役割ごとに分離しています。各ファイルの先頭に「このファイルは何を担当するか」を1行コメントで明記しているので、修正したい機能に対応するファイルだけを開けば済みます。

- `index.html` — ページの骨組みと、起動処理(イベント登録・自動更新・初期化呼び出し)のみ
- `style.css` — 画面デザイン(ダーク/ライトモード対応)
- `sources.js` — データ: ニュース取得元(RSSフィード)の一覧
- `topic-keywords.js` — データ: トピック絞り込み用の単語リスト
- `sentiment-keywords.js` — データ: 簡易センチメント判定用の単語リスト
- `market-sessions.js` — データ: 世界の株式市場の開場時間
- `utils.js` — 共通ヘルパー関数
- `theme.js` — ダーク/ライトモード切り替え
- `feed.js` — RSS取得・キャッシュ・更新ステータス表示
- `translate.js` — 英語記事の自動日本語翻訳
- `topic-filter.js` — トピック絞り込みロジック
- `sentiment.js` — 簡易センチメント判定ロジック
- `render.js` — 記事一覧・フィルターチップ・フッターリンクの描画
- `ticker.js` — TradingView相場ティッカー表示
- `sessions.js` — 世界の取引セッション表示
主な機能
約26の公開RSSフィードを横断して収集
BBC、The Japan Times、Financial Times、CNBC、Bloomberg、The Economist、Forbes、Newsweek、Business Insider、MarketWatch、Investing.com、TechCrunch、Digiday、VentureBeat、GeekWire、Tech in Asia、Nikkei Asia、NHK、ITmedia（NEWS・ビジネス・AI+）、日経ビジネス、日経クロステック、CNET Japan、ZUU online に対応(Bloombergは公式RSSが廃止されているため、Google Newsのサイト内検索RSS経由で取得。WSJ・CNNは公式RSSの配信が長期間停止していたため未収載)

1分ごとの自動更新
過去2日以内に公開された記事を自動で表示

英語記事の日本語表示
MyMemory または Google 翻訳を利用し、英語見出しを日本語へ自動翻訳。原文見出しもあわせて確認できます

関心トピックで絞り込み
株価、AI、企業関連のキーワードをワンクリックでON/OFF切替

簡易センチメント表示
見出し・要約内の頻出語から、上向き・下向きの傾向を ▲ / ▼ で表示

見やすい記事管理
NEWバッジ、配信元フィルター、キーワード検索に対応

マーケット情報の併記
TradingViewティッカーにより、為替や主要株価指数を同一画面で確認可能

使い方
index.html をブラウザで直接開くだけで動作します。
GitHub Pagesなどの静的ホスティングサービスに配置して公開することもできます。インストールやビルドは不要です。
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
