'use strict';
// このファイルは「複数の機能から共通で使う小さな汎用ヘルパー関数」を提供する(状態は持たない)。
// ================= 汎用ユーティリティ(複数ファイルから共通で使う小さな関数) =================
// escapeRe: 正規表現の特殊文字をエスケープ(topic-filter.js・sentiment.js のキーワード一致で使用)
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// stripHtml: HTMLタグを除去してプレーンテキスト化(feed.js・translate.js で使用)
function stripHtml(s){
  if(!s) return '';
  const d = document.createElement('div');
  d.innerHTML = s;
  return (d.textContent||'').replace(/\s+/g,' ').trim();
}
