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

// 左右パネル(株価パネル・経済指標カレンダー)の高さを画面いっぱいまで伸ばす際、
// CSSのvh単位はzoomの影響を受けない(zoomされた要素の中でも「真の」ビューポート高さの
// ままになる)ため、style.css側でheight:calc(100vh - 28px)と書いても、zoom分だけ
// 画面上では縮んで表示されてしまう(実際に発生・確認済み: zoom0.84の環境で
// 期待776pxではなく実測776px=922px×0.84と、意図した922pxの見た目に届かなかった)。
// zoom倍率を打ち消した値をCSSカスタムプロパティとして渡すことで解決する
// (--panel-height × zoom = 常に「画面の高さ - 28px」の見た目になる)
function applyPageScale(){
  const wrap = document.getElementById('scaleWrap');
  if(!wrap) return;
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  const zoom = isMobile ? 1 : window.innerWidth / SCALE_DESIGN_WIDTH;
  wrap.style.zoom = zoom;
  const panelHeightPx = isMobile ? 0 : (window.innerHeight - 28) / zoom;
  document.documentElement.style.setProperty('--panel-height', panelHeightPx + 'px');
}

window.addEventListener('resize', applyPageScale);
applyPageScale();
