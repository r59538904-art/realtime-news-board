'use strict';
// 全ファイル共通の汎用ヘルパー(状態は持たない)。

// 正規表現の特殊文字をエスケープする
function escapeRe(text){
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// HTMLタグを除去してプレーンテキストにする(XSS対策の土台)。
// DOMParserが生成するdocumentは画像読み込みもイベント発火も起きないため、
// <img onerror=...> のような悪意あるHTMLを渡しても安全に無害化できる。
function stripHtml(html){
  if(!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

// URLがhttp/httpsであることを確認する(javascript:等の危険なリンクを排除)
function isSafeUrl(url){
  try{ return ['http:', 'https:'].includes(new URL(url).protocol); }
  catch(e){ return false; }
}

// 色指定が「#始まりの16進カラーコード」であることを確認する
// (外部データ由来の色をstyle属性へ渡す前に必ず通す)
function isSafeColor(color){
  return typeof color === 'string' && /^#[0-9a-f]{3,8}$/i.test(color);
}

// 指定タグの要素を作る(class・テキストは省略可)。
// テキストは必ずtextContentで入れるため、HTMLとして解釈されない。
function el(tag, className, text){
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text != null) node.textContent = text;
  return node;
}

// 折りたたみ切り替えボタンの表示更新(テキスト+aria-expanded+aria-controls)。
// calendar.js(カレンダー)・watchlist.js(株価パネル)で全く同じパターンだったため共通化した
function updateCollapseBtn(btnId, isOpen, controlsId){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  btn.textContent = isOpen ? '折りたたむ ▲' : '表示する ▼';
  btn.setAttribute('aria-expanded', String(isOpen));
  btn.setAttribute('aria-controls', controlsId);
}

// 日英キーワードリストから一致判定用の正規表現を組み立てる。
// 日本語は部分一致、英字は誤爆防止のため単語境界(\b)付きで一致させる。
function buildKeywordRe(cjkWords, latinWords, flags){
  return new RegExp(
    '(?:' + cjkWords.map(escapeRe).join('|') + ')' +
    '|\\b(?:' + latinWords.map(escapeRe).join('|') + ')\\b',
    flags
  );
}

// キーワード判定(トピック絞り込み・センチメント判定)で共通して使う「判定対象テキスト」を作る。
// 原文(title・desc)と、翻訳が届いていればその訳文も対象に含める
function keywordSearchText(item){
  return item.title + ' ' + item.desc + ' ' + (trGet(item.title) || '') + ' ' + (trGet(item.desc) || '');
}

// ---- localStorageの安全なラッパー ----
// プライベートブラウジング・容量超過・Cookie無効化設定などでlocalStorageが例外を
// 投げる環境があるため、単純な1キーの読み書きはこの3関数を経由し、失敗時は
// 静かにfallback値を返す/書き込みを諦める(各所に同じtry/catchを繰り返し書かない)。
// 複数キーの読み込みを1トランザクションとして扱いたい場合(失敗時に全体を初期化したい等)は
// このラッパーではなく従来どおり呼び出し側で直接try/catchすること(feed.js・translate.jsのキャッシュ処理等)。
function storageGet(key, fallback = null){
  try{ const value = localStorage.getItem(key); return value === null ? fallback : value; }
  catch(e){ return fallback; }
}
function storageSet(key, value){
  try{ localStorage.setItem(key, value); return true; }
  catch(e){ return false; }
}
function storageRemove(key){
  try{ localStorage.removeItem(key); return true; }
  catch(e){ return false; }
}
