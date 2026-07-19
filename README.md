# 世界ニュース速報 — リアルタイム経済ニュースボード

Financial Times、CNBC、NHK、Bloomberg、Investing.com、FRB/ECB/日銀公式発表、FXStreet など約38の投資/金融専門ソースを集約する経済ニュースボードです。RSS取得はGitHub Actions上のPythonが定期的に行い、結果を静的JSONとしてコミットする方式のため、ブラウザ側(`index.html`)はビルド不要のまま動作します。

公開URL: https://r59538904-art.github.io/realtime-news-board/

## アーキテクチャ

1. `.github/workflows/fetch-news.yml`(GitHub Actions)が `scripts/fetch_news.py` を実行
2. `fetch_news.py` が `sources.json` の各ソースを直接fetchし(CORSプロキシを使わないサーバー側取得)、`news.json` と `sources.js` を生成してコミット
3. ブラウザ側(`feed.js`)は `news.json` を1分おきにfetchして画面に反映するだけ(ブラウザから個別RSSやプロキシへは一切アクセスしない)

### 自動実行について

GitHub Actionsの`schedule`(cron)トリガーは`fetch-news.yml`に`*/5`間隔で設定していますが、環境によっては予約実行がGitHub側で発火しないことがあります。その保険として、`.github/workflows/cron-dispatch.yml`という別ワークフローが独立したオフセットの`schedule`で`workflow_dispatch`を叩く二重化を行っています。それでも発火しない場合の最終手段として、外部の無料cronサービス(例: cron-job.org)からGitHub REST APIの`workflow_dispatch`エンドポイントを1分おきに叩く運用に切り替えることもできます(このリポジトリのActions実行権限のみを持つトークンを発行して利用してください)。

## ファイル構成

デザイン(`style.css`)・データ・機能ロジックをそれぞれ役割ごとに分離しています。各ファイルの先頭に「このファイルは何を担当するか」を1行コメントで明記しているので、修正したい機能に対応するファイルだけを開けば済みます。

| ファイル | 役割 |
|---|---|
| `index.html` | ページの骨組みと起動処理(イベント登録・自動更新・初期化呼び出し) |
| `style.css` | 画面デザイン(ダーク/ライトモード対応) |
| `sources.json` | 配信元定義の正本。**配信元を追加/削除/変更したい場合はこのファイルを編集する** |
| `sources.js` | `sources.json` から自動生成されるJS版データ(**手編集しない**。`fetch_news.py`が再生成する) |
| `topic-keywords.js` | データ: トピック絞り込み用の単語リスト |
| `sentiment-keywords.js` | データ: 簡易センチメント判定用の単語リスト |
| `market-sessions.js` | データ: 世界の株式市場の開場時間 |
| `utils.js` | 共通ヘルパー関数(`stripHtml`・`isSafeUrl`・`buildKeywordRe`等) |
| `theme.js` | ダーク/ライトモード切り替え |
| `feed.js` | 静的`news.json`の取得・キャッシュ・更新ステータス表示 |
| `translate.js` | 英語記事の自動日本語翻訳 |
| `topic-filter.js` | トピック絞り込みロジック |
| `sentiment.js` | 簡易センチメント判定ロジック |
| `render.js` | 記事一覧・フィルターチップ・フッターリンクの描画 |
| `ticker.js` | TradingView相場ティッカー表示 |
| `sessions.js` | 世界の取引セッション表示 |
| `privacy.html` | プライバシーポリシー |
| `scripts/fetch_news.py` | RSS取得本体(Python)。`sources.json`→`sources.js`の再生成、全ソースの並列fetch、`news.json`の書き出しを行う |
| `scripts/requirements.txt` | 上記スクリプトの依存パッケージ(`requests`, `feedparser`) |
| `.github/workflows/fetch-news.yml` | 上記スクリプトを定期実行するGitHub Actions定義 |
| `.github/workflows/cron-dispatch.yml` | `fetch-news.yml`のschedule未発火対策として、別スケジュールから`workflow_dispatch`を叩く冗長化ワークフロー |
| `news.json` | 取得済み記事データ(自動生成・自動コミットされる静的JSON) |

## 対応ニュースソース(約38)

為替・政策金利・商品・国際情勢に強いソースを重視して横断収集しています。

- **総合経済/ビジネス**: Financial Times、CNBC(Top News・US News)、The Economist、Forbes、MarketWatch、TechCrunch、The Guardian(Business)、東洋経済オンライン、ダイヤモンド・オンライン、ZUU online
- **日本経済新聞グループ**: 日経ビジネス電子版、日経クロステック、日本経済新聞(X公式アカウント)— この3ソースはフィルターチップを1つ(「日経ビジネス」)に統合しています。X投稿はX公式埋め込みウィジェットが使う公開エンドポイント(`syndication.twitter.com`)から取得しており、ログイン・Cookieは不要です。ただし非公開の内部エンドポイントのため、期間に関係なく常に最新約20件しか返さない制約があり、`fetch_news.py`側で毎回の取得結果を前回分と統合して蓄積する方式(最大48時間分)を採用しています
- **NHK**: 経済・主要・政治・国際の4フィードを「NHK」チップに統合
- **BBC**: Business・Worldの2フィードを「BBC」チップに統合
- **中央銀行公式発表**: Federal Reserve(FRB)、European Central Bank(ECB)、日本銀行(日銀)
- **為替/商品/経済指標**: Investing.com(株式・為替・経済指標・商品の4フィード、1チップに統合)、FXStreet、OilPrice.com、CoinDesk
- **市況/市場データ配信**: WSJ Markets(MarketWatchと同じDow Jones配信基盤経由で取得)、Seeking Alpha
- **政治/戦争・地政学**: Politico、Foreign Policy、Defense News
- **Bloomberg**: `bloomberg.com`本体はボット検知(PerimeterX等)により自動取得を一律拒否するため、Googleニュースの公式サイト内検索RSS(`site:`検索)経由でBloomberg Japan関連記事を取得しています。記事へのリンクはGoogle Newsのリダイレクト経由になります(詳細は`sources.json`の`bloomberg-jp`エントリの`note`を参照)
- **IT/テクノロジー**: ITmedia(ビジネス・AI+)

投資/金融特化の方針のもと、一般ニュース/ライフスタイル系(Newsweek、Business Insider、Digiday、VentureBeat、GeekWire、Japan Times、ITmedia NEWS、CNET Japan、Tech in Asia等)は収載を見送っています。WSJ公式RSS・CNNは配信が長期間停止/廃止済みで代替経由でも安定取得できなかったため、Nikkei Asiaは公開RSSが日時情報を含まないため、Bank of England(BOE)公式発表は更新頻度が低く表示対象期間(4日以内)に記事が無い期間が長かったため、それぞれ収載していません。

## 主な機能

- **横断収集**: 上記ソースを5分おきにGitHub Actionsが再取得し、ブラウザ側は1分おきにその結果(`news.json`)を再取得。過去4日以内に公開された記事を自動表示(ソースによっては`sources.json`の`maxAgeMs`で個別に上限を短縮)
- **英語記事の日本語表示**: MyMemory(利用不可時はGoogle翻訳)による自動翻訳。原文見出しもあわせて確認可能
- **関心トピックで絞り込み**: 投資・金融・政治・戦争/地政学関連のキーワードをワンクリックでON/OFF切替(既定はON)
- **簡易センチメント表示**: 見出し・要約内の頻出語から上向き/下向きの傾向を▲/▼で表示
- **記事管理**: NEWバッジ、配信元フィルターチップ、キーワード検索
- **マーケット情報の併記**: TradingViewティッカーで為替・主要株価指数を同一画面に表示

## 使い方

GitHub Pagesなどのhttp(s)ホスティングに配置して公開してください。インストールやビルドは不要です(GitHub Actions側にPython実行環境が必要ですが、GitHub Actionsが自動的に用意するため利用者側の準備は不要です)。

注意: `index.html` を `file://` で直接開いた場合、`news.json` のfetchがブラウザのローカルファイル制限で失敗するため、ライブ更新は動作しません(キャッシュが無い初回訪問では記事0件表示になります)。動作確認・開発時はローカルHTTPサーバー経由で開いてください。

## 免責事項

本ボードは情報提供を目的としており、投資勧誘または投資助言を目的とするものではありません。記事の見出し・要約は各配信元の公開RSSフィード(Bloombergのみ例外的にGoogleニュース検索RSS)から取得し、原文へのリンクを掲載しています。機械翻訳およびセンチメント判定は簡易的な自動処理であるため、内容の正確性は必ず原文でご確認ください。取引および投資に関する最終的な判断は、ご自身の責任で行ってください。
