'use strict';
// 記事一覧・ソースフィルターチップ・フッターリンクの描画。
// XSS対策: 記事データ(RSS由来・翻訳結果)は一切innerHTMLに通さず、
// すべてcreateElement+textContent(utils.jsのel)で組み立てる。

// ---- 状態 ----
let activeFilters = new Set(SOURCES.map(source => source.id));  // 初期状態は全ソースON
let searchTerm = '';

// ---- 表示ヘルパー ----
// タイムスタンプを「◯分前」形式の相対時刻にする
function relTime(ts){
  if(!ts) return '時刻不明';
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if(diffMin < 1) return 'たった今';
  if(diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.round(diffMin / 60);
  if(diffH < 24) return `${diffH}時間前`;
  return `${Math.round(diffH / 24)}日前`;
}

// 公開から60分以内の記事にNEWバッジを付ける
const NEW_WINDOW_MS = 60 * 60 * 1000;
function isNewItem(item){
  return !!item.pubDate && (Date.now() - item.pubDate) <= NEW_WINDOW_MS;
}

// ---- 表示対象の選別 ----
// 全ソースの記事を「重複排除 → 鮮度 → トピック → 検索語」の順で絞り込み、新しい順に並べる
function visibleItems(){
  const merged = [];
  const seen = new Set();
  SOURCES.forEach(source => {
    if(!activeFilters.has(source.id)) return;
    (itemsBySource[source.id] || []).forEach(item => {
      const key = item.link || item.title;
      if(!key || seen.has(key)) return;
      seen.add(key);
      merged.push({...item, source});
    });
  });
  // 鮮度上限は既定MAX_AGE_MS(4日)。高頻度ソースはsources.json側のmaxAgeMsで個別に短縮できる
  let filtered = merged.filter(item => !item.pubDate || (Date.now() - item.pubDate) <= (item.source.maxAgeMs || MAX_AGE_MS));
  if(topicFilterOn) filtered = filtered.filter(matchesTopic);
  if(searchTerm){
    const query = searchTerm.toLowerCase();
    filtered = filtered.filter(item => {
      const jaTitle = trGet(item.title) || '', jaDesc = trGet(item.desc) || '';
      return item.title.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query)
          || jaTitle.toLowerCase().includes(query) || jaDesc.toLowerCase().includes(query);
    });
  }
  return filtered.sort((itemA, itemB) => (itemB.pubDate || 0) - (itemA.pubDate || 0));
}

// ---- 記事カード ----
function buildCard(item, jaTitle, jaDesc){
  const card = el('a', 'card');
  card.href = item.link || '#';               // linkはfeed.jsのsanitizeItemsで検証済み(不正なら空)
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  // 配信元カラーは検証済みの16進コードだけを--src変数として渡す(不正値はCSS側の既定色になる)
  if(isSafeColor(item.source.color)) card.style.setProperty('--src', item.source.color);

  const metaLeft = el('div', 'meta-left');
  const badge = el('span', 'src-badge', item.source.short);
  if(item.source.sub) badge.appendChild(el('span', 'genre', item.source.sub));
  metaLeft.appendChild(badge);
  if(isNewItem(item)) metaLeft.appendChild(el('span', 'new-badge', 'NEW'));

  const metaRight = el('div', 'meta-right');
  const sentiment = getSentiment(item);
  if(sentiment) metaRight.appendChild(el('span', 'sentiment ' + sentiment, sentiment === 'pos' ? '▲' : '▼'));
  metaRight.appendChild(el('time', null, relTime(item.pubDate)));

  const meta = el('div', 'meta');
  meta.append(metaLeft, metaRight);

  card.appendChild(meta);
  card.appendChild(el('h3', null, jaTitle || item.title));
  if(jaTitle) card.appendChild(el('div', 'orig', item.title));  // 翻訳表示時は原文も小さく併記
  card.appendChild(el('p', null, jaDesc || item.desc));
  card.appendChild(el('span', 'lang', item.source.lang === 'EN' ? (jaTitle ? 'EN → JA 自動翻訳' : 'EN') : 'JA'));
  return card;
}

// ---- 一覧描画 ----
function render(){
  const grid = document.getElementById('grid');
  // grid全体を作り直すとスクロール位置が先頭側へずれることがあるため、前後で保存・復元する。
  // ただし実際にずれていない限りscrollTo自体を呼ばない(モバイルでは位置が変わらない
  // scrollTo呼び出しでも慣性スクロールが打ち切られてしまうため、無駄な呼び出しを避ける)
  const scrollYBeforeRebuild = window.scrollY;
  const restoreScroll = () => {
    if(window.scrollY !== scrollYBeforeRebuild) window.scrollTo({top: scrollYBeforeRebuild, left: 0, behavior: 'instant'});
  };

  const items = visibleItems();
  grid.textContent = '';
  if(!items.length){
    grid.appendChild(el('div', 'empty', '該当するニュースがありません'));
    restoreScroll();
    return;
  }

  const fragment = document.createDocumentFragment();
  const wantTitle = [], wantDesc = [];
  let enCount = 0;
  items.slice(0, MAX_DISPLAY).forEach(item => {
    const isEN = item.source.lang === 'EN';
    const jaTitle = (isEN && translateOn) ? trGet(item.title) : null;
    const jaDesc  = (isEN && translateOn) ? trGet(item.desc)  : null;
    if(isEN && translateOn){
      if(!jaTitle) wantTitle.push(item.title);
      if(!jaDesc && item.desc && enCount < TR_DESC_LIMIT) wantDesc.push(item.desc);
      enCount++;
    }
    fragment.appendChild(buildCard(item, jaTitle, jaDesc));
  });
  grid.appendChild(fragment);
  restoreScroll();
  wantTitle.forEach(trEnqueue);               // 見出しを優先して翻訳キューへ
  wantDesc.forEach(trEnqueue);
}

// ---- ソースフィルターチップ ----
// 同じgroupのソースを1つのチップにまとめる(表示順はSOURCESの定義順)
function sourceGroups(){
  const order = [];
  const byGroup = {};
  SOURCES.forEach(source => {
    if(!byGroup[source.group]){
      byGroup[source.group] = {label: source.short, ids: []};
      order.push(byGroup[source.group]);
    }
    byGroup[source.group].ids.push(source.id);
  });
  return order;
}
function buildChips(){
  const chipsEl = document.getElementById('chips');
  chipsEl.textContent = '';

  const allChip = el('div', 'chip' + (activeFilters.size === SOURCES.length ? ' on' : ''), 'すべて');
  allChip.onclick = () => { activeFilters = new Set(SOURCES.map(source => source.id)); buildChips(); render(); };
  chipsEl.appendChild(allChip);

  const noneChip = el('div', 'chip' + (activeFilters.size === 0 ? ' on' : ''), 'すべて解除');
  noneChip.onclick = () => { activeFilters = new Set(); buildChips(); render(); };
  chipsEl.appendChild(noneChip);

  sourceGroups().forEach(group => {
    const isOn = group.ids.every(id => activeFilters.has(id));
    const chip = el('div', 'chip' + (isOn ? ' on' : ''), group.label);
    chip.onclick = () => {
      // ONのグループはOFFへ、OFFのグループはONへ(空集合も意味のある状態として扱う)
      if(group.ids.every(id => activeFilters.has(id))) group.ids.forEach(id => activeFilters.delete(id));
      else group.ids.forEach(id => activeFilters.add(id));
      buildChips();
      render();
    };
    chipsEl.appendChild(chip);
  });
}

// ---- 自動再描画の遅延(スマホでのスクロール中断防止) ----
// render()は毎回scrollToで位置を復元するため、翻訳結果の反映や自動更新など
// 「ユーザー操作によらない」再描画がスワイプ中・指を離した直後の慣性スクロール中に
// 割り込むと、スクロールが強制的に打ち切られ「かくかく」「ロールバックする」ように感じる。
// 自動系の再描画はrequestRender()を経由させ、タッチ中・スクロール中は保留して
// 落ち着いてから1回だけ反映する。ボタン操作や検索など直接の操作はrender()を直接呼び、
// 従来通り即座に反映させる(スワイプ中に同時操作されることは実質ないため)。
let userTouching = false;
let userScrolling = false;
let scrollSettleTimer = null;
let touchSafetyTimer = null;
let renderPending = false;
function flushPendingRender(){
  if(renderPending){ renderPending = false; render(); }
}
// e.touches.lengthで「残っている指の本数」を見る(2本指ピンチ等で片方だけ離れても
// touchendは発火するため、単純にtrue/falseを決め打ちすると誤って離した扱いになる)。
// touchSafetyTimerは、何らかの理由でtouchend/touchcancelが来ないまま指が離れた場合の保険
// (通常発生しないが、保留され続けると自動更新が永久に反映されなくなるため上限を設ける)
function updateTouchState(e){
  userTouching = e.touches.length > 0;
  clearTimeout(touchSafetyTimer);
  if(userTouching){
    touchSafetyTimer = setTimeout(() => { userTouching = false; if(!userScrolling) flushPendingRender(); }, 15000);
  } else if(!userScrolling){
    flushPendingRender();
  }
}
document.addEventListener('touchstart', updateTouchState, {passive: true});
document.addEventListener('touchend', updateTouchState, {passive: true});
document.addEventListener('touchcancel', updateTouchState, {passive: true});
window.addEventListener('scroll', () => {
  userScrolling = true;
  clearTimeout(scrollSettleTimer);
  // スクロールイベントが150ms止まったら「慣性スクロールも含めて止まった」とみなす
  scrollSettleTimer = setTimeout(() => {
    userScrolling = false;
    if(!userTouching) flushPendingRender();
  }, 150);
}, {passive: true});
function requestRender(){
  if(userTouching || userScrolling){ renderPending = true; return; }
  render();
}

// ---- フッターリンク ----
// 同じ配信元ホームは1回だけ載せる
function buildFootLinks(){
  const footLinksEl = document.getElementById('footLinks');
  const seen = new Set();
  SOURCES.forEach(source => {
    if(seen.has(source.home) || !isSafeUrl(source.home)) return;
    seen.add(source.home);
    const linkEl = el('a', null, source.short);
    linkEl.href = source.home;
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';
    footLinksEl.appendChild(linkEl);
  });
}
