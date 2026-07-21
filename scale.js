'use strict';
// ページ全体をウィンドウ幅に応じて拡大縮小し、640px以上ならどんな画面サイズ・
// OS表示拡大率・ブラウザズームでも同じデザイン(比率)で表示されるようにする。
//
// transform:scale()ではなくzoomを使う理由: transformを祖先要素に掛けると、その祖先が
// position:fixed/stickyな子要素の新しいcontaining blockになってしまい、左右パネル
// (株価パネル・経済指標カレンダー)の「スクロールに追従する」動作が効かなくなる
// (実際に発生・報告を受けて修正。真下にスクロールすると画面外へ消えてしまっていた)。
// zoomはレイアウトレベルでの拡大縮小(実質的に有効CSSピクセル密度を変える)であり、
// containing blockを新たに作らないため、position:sticky/fixedの動作を妨げない。
//
// 640px以下(スマホ)ではzoomを適用しない(常に1)。デスクトップ用デザインの縮図だと
// 文字・ボタンが実寸で数mmまで小さくなり操作できなくなるため(実際に発生・報告を受けて
// 修正)、この幅ではstyle.css側の専用モバイルレイアウト(@media (max-width:640px))に
// 委ね、#scaleWrapの幅も100%へ切り替わる
const SCALE_DESIGN_WIDTH = 1900;
const MOBILE_BREAKPOINT = 640;  // style.cssの@media (max-width:640px)と揃えること

function applyPageScale(){
  const wrap = document.getElementById('scaleWrap');
  if(!wrap) return;
  wrap.style.zoom = window.innerWidth <= MOBILE_BREAKPOINT ? 1 : window.innerWidth / SCALE_DESIGN_WIDTH;
}

window.addEventListener('resize', applyPageScale);
applyPageScale();
