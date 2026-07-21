'use strict';
// ページ全体をウィンドウ幅に応じて拡大縮小し、どんな画面サイズ・OS表示拡大率・
// ブラウザズームでも同じデザイン(比率)で表示されるようにする。
// レスポンシブブレークポイントで個別にレイアウトを組み替える方式では、実際の
// ブラウザ幅(CSS px)を正確に予測できず、意図したレイアウトが発動しない不満が
// 繰り返し出たため、この「常に丸ごと拡大縮小」方式に切り替えた。
//
// #scaleWrap(style.cssでwidth:1800px固定)に対してtransform:scaleを適用する。
// transformは要素のレイアウトサイズ(offsetHeight等)に影響しないため、
// scaleWrap.offsetHeightは常に「等倍(1800px幅)での本来の高さ」を返す。
// これに実際のscaleを掛けた値をbodyのheightへ反映することで、ブラウザの
// スクロールバーが縮小後の見た目の高さと一致するようにしている。
const SCALE_DESIGN_WIDTH = 1800;

function applyPageScale(){
  const wrap = document.getElementById('scaleWrap');
  if(!wrap) return;
  const scale = window.innerWidth / SCALE_DESIGN_WIDTH;
  wrap.style.transform = 'scale(' + scale + ')';
  document.body.style.height = (wrap.offsetHeight * scale) + 'px';
}

window.addEventListener('resize', applyPageScale);
// ニュース一覧の件数変化・株価パネル/カレンダーウィジェットの読み込みなど、
// #scaleWrapの本来の高さ(縮小前)が変わるたびに自動で再計算する。
// 個々の更新箇所すべてから手動で呼び出すより、ResizeObserverに任せる方が
// 呼び出し漏れが起きず確実
if(typeof ResizeObserver !== 'undefined'){
  const wrap = document.getElementById('scaleWrap');
  if(wrap) new ResizeObserver(applyPageScale).observe(wrap);
}
applyPageScale();
