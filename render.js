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
  // grid全体を作り直すとスクロール位置が先頭側へずれるため、前後で保存・復元する
  const scrollYBeforeRebuild = window.scrollY;
  const restoreScroll = () => window.scrollTo({top: scrollYBeforeRebuild, left: 0, behavior: 'instant'});

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
