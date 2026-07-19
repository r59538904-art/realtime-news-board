'use strict';
// このファイルは「複数の機能から共通で使う小さな汎用ヘルパー関数」を提供する(状態は持たない)。



// ================= 汎用ユーティリティ(複数ファイルから共通で使う小さな関数) =================
// escapeRe: 正規表現の特殊文字をエスケープ(topic-filter.js・sentiment.js のキーワード一致で使用)
function escapeRe(text){ return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// stripHtml: HTMLタグを除去してプレーンテキスト化(feed.js・translate.js で使用)
// セキュリティ上の注意: RSSフィードの本文は未検証・外部由来(悪意ある<img src=x onerror=...>等が
// 混入し得る)。document.createElement('div')に直接innerHTMLで流し込む方式は、そのdivを画面に
// 追加していなくても<img>のonerror等は実際に発火してしまう(検証済み)ため使わない。
// 代わりにDOMParserでパースする: DOMParserが生成するdocumentはブラウジングコンテキストを
// 持たないため、画像等のリソース読み込みもイベントハンドラの発火も一切起きない(安全)。
function stripHtml(html){
  if(!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent||'').replace(/\s+/g,' ').trim();
}

// isSafeUrl: RSS由来のリンク(item.link)がhttp/https以外(javascript:等)でないか確認する。
// javascript:リンクはクリック時にページ内でそのまま実行されてしまうため、記事カードのリンク先に使う前に必ず通す
function isSafeUrl(url){
  try{ return ['http:','https:'].includes(new URL(url).protocol); }
  catch(e){ return false; }
}

// buildKeywordRe: 日英キーワードリストから一致判定用の正規表現を組み立てる
// (topic-filter.js のトピック絞り込みと sentiment.js のセンチメント判定で共通使用)。
// 日本語キーワードは部分一致、英字キーワードは英単語の一部への誤爆(例: "heroes"→ROE)を防ぐため
// 単語境界(\b)付きで一致させる
function buildKeywordRe(cjkWords, latinWords, flags){
  return new RegExp(
    '(?:' + cjkWords.map(escapeRe).join('|') + ')' +
    '|\\b(?:' + latinWords.map(escapeRe).join('|') + ')\\b',
    flags
  );
}
