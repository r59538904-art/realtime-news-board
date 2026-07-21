'use strict';
// ページ全体をウィンドウ幅に応じて拡大縮小し、どんな画面サイズ・OS表示拡大率・
// ブラウザズームでも同じデザイン(比率)で表示されるようにする。
//
// transform:scale()ではなくzoomを使う理由: transformを祖先要素に掛けると、その祖先が
// position:fixed/stickyな子要素の新しいcontaining blockになってしまい、左右パネル
// (株価パネル・経済指標カレンダー)の「スクロールに追従する」動作が効かなくなる
// (実際に発生・報告を受けて修正。真下にスクロールすると画面外へ消えてしまっていた)。
// zoomはレイアウトレベルでの拡大縮小(実質的に有効CSSピクセル密度を変える)であり、
// containing blockを新たに作らないため、position:sticky/fixedの動作を妨げない。
// またレイアウトに実際に反映されるため、transform版で行っていたbody高さの手動計算
// (offsetHeight*scale)も不要になる(ブラウザが自然に正しいスクロール高さを算出する)。
const SCALE_DESIGN_WIDTH = 1800;

function applyPageScale(){
  const wrap = document.getElementById('scaleWrap');
  if(!wrap) return;
  wrap.style.zoom = window.innerWidth / SCALE_DESIGN_WIDTH;
}

window.addEventListener('resize', applyPageScale);
applyPageScale();
