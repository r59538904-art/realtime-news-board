'use strict';
// このファイルは「記事一覧の描画(ソースフィルターチップ・記事カード・フッターリンク)」を担当する。



// ================= 記事一覧の描画(ソースフィルターチップ・カード・フッターリンク) =================

// ---- 状態 ----
let activeFilters = new Set(SOURCES.map(source=>source.id)); // 全ソースON
let searchTerm = '';

// ---- 相対時刻 ----
function relTime(ts){
  if(!ts) return '時刻不明';
  const diffMin = Math.round((Date.now()-ts)/60000);
  if(diffMin < 1) return 'たった今';
  if(diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.round(diffMin/60);
  if(diffH < 24) return `${diffH}時間前`;
  return `${Math.round(diffH/24)}日前`;
}

// ---- NEWバッジ(公開から60分以内の記事に目印) ----
const NEW_WINDOW_MS = 60*60*1000;
function isNewItem(item){
  return !!item.pubDate && (Date.now() - item.pubDate) <= NEW_WINDOW_MS;
}

// render()はbuildChips()のクリック処理から呼ばれるため、buildChips()より前(上)にここで定義しておく
function render(){
  const grid = document.getElementById('grid');
  // 更新のたびにgrid内を全部作り直す(下記)ため、そのままだと画面が一瞬0件になって
  // ブラウザがスクロール位置を先頭方向にずらしてしまう。再構築の前後で位置を保存・復元して防ぐ
  // (style.cssのscroll-behavior:smoothの影響を受けないよう、復元はbehavior:'instant'を明示する)
  const scrollYBeforeRebuild = window.scrollY;
  const restoreScroll = ()=> window.scrollTo({top: scrollYBeforeRebuild, left: 0, behavior: 'instant'});

  let merged = [];
  const seen = new Set();
  SOURCES.forEach(source=>{
    if(!activeFilters.has(source.id)) return;
    const items = itemsBySource[source.id] || [];
    items.forEach(item=>{
      const key = item.link || item.title;
      if(!key || seen.has(key)) return;
      seen.add(key);
      merged.push({...item, source});
    });
  });
  // 鮮度上限はMAX_AGE_MS(feed.js)が既定だが、Xのように投稿頻度が高いソースは
  // sources.json側で個別にmaxAgeMsを短く設定できる(例: nikkei-xは2日=172800000ms)
  merged = merged.filter(item => !item.pubDate || (Date.now()-item.pubDate) <= (item.source.maxAgeMs || MAX_AGE_MS));
  if(topicFilterOn) merged = merged.filter(matchesTopic);
  if(searchTerm){
    const query = searchTerm.toLowerCase();
    merged = merged.filter(item => {
      const jaTitle = trGet(item.title) || '', jaDesc = trGet(item.desc) || '';
      return item.title.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query)
          || jaTitle.toLowerCase().includes(query) || jaDesc.toLowerCase().includes(query);
    });
  }
  merged.sort((itemA,itemB)=> (itemB.pubDate||0) - (itemA.pubDate||0));

  grid.innerHTML = '';
  if(!merged.length){
    grid.innerHTML = `<div class="empty">該当するニュースがありません</div>`;
    restoreScroll();
    return;
  }
  const fragment = document.createDocumentFragment();
  const wantTitle = [], wantDesc = [];
  let enCount = 0;
  merged.slice(0,MAX_DISPLAY).forEach(item=>{
    const isEN = item.source.lang === 'EN';
    const jaTitle = (isEN && translateOn) ? trGet(item.title) : null;
    const jaDesc  = (isEN && translateOn) ? trGet(item.desc)  : null;
    if(isEN && translateOn){
      if(!jaTitle) wantTitle.push(item.title);
      if(!jaDesc && item.desc && enCount < TR_DESC_LIMIT) wantDesc.push(item.desc);
      enCount++;
    }
    const langLabel = isEN ? (jaTitle ? 'EN → JA 自動翻訳' : 'EN') : 'JA';
    const sentiment = getSentiment(item);
    const isNew = isNewItem(item);
    const cardEl = document.createElement('a');
    cardEl.className = 'card';
    // item.linkはRSS由来(未検証)のため、http/https以外(javascript:等)ならリンク先を無効化する
    cardEl.href = isSafeUrl(item.link) ? item.link : '#';
    cardEl.target = '_blank'; cardEl.rel = 'noopener noreferrer';
    // セキュリティ上の注意: ここで組み立てるinnerHTMLに埋め込むのは自前データ(source.color等の配色・
    // ラベル文字列)のみ。RSS由来(未検証・外部由来)の記事タイトル・本文は下でtextContentとして
    // 差し込んでおり、HTMLとして解釈されない(スクリプト実行等のXSSを防ぐ)。
    cardEl.innerHTML = `
      <div class="meta">
        <div class="meta-left">
          <span class="src-badge" style="--src:${item.source.color};border-color:${item.source.color}66;background:${item.source.color}14">${item.source.short}${item.source.sub ? '<span class="genre">'+item.source.sub+'</span>' : ''}</span>
          ${isNew ? '<span class="new-badge">NEW</span>' : ''}
        </div>
        <div class="meta-right">
          ${sentiment ? `<span class="sentiment ${sentiment}">${sentiment==='pos'?'▲':'▼'}</span>` : ''}
          <time>${relTime(item.pubDate)}</time>
        </div>
      </div>
      <h3></h3>
      ${jaTitle ? '<div class="orig"></div>' : ''}
      <p></p>
      <span class="lang">${langLabel}</span>`;
    cardEl.querySelector('h3').textContent = jaTitle || item.title;
    if(jaTitle) cardEl.querySelector('.orig').textContent = item.title;   // 原文を小さく併記
    cardEl.querySelector('p').textContent = jaDesc || item.desc;
    fragment.appendChild(cardEl);
  });
  grid.appendChild(fragment);
  restoreScroll();
  wantTitle.forEach(trEnqueue);   // 見出しを優先して翻訳キューへ
  wantDesc.forEach(trEnqueue);
}

function sourceGroups(){
  const order = []; const byGroup = {};
  SOURCES.forEach(source=>{
    if(!byGroup[source.group]){ byGroup[source.group] = {label:source.short, ids:[]}; order.push(byGroup[source.group]); }
    byGroup[source.group].ids.push(source.id);
  });
  return order;
}
function buildChips(){
  const chipsEl = document.getElementById('chips');
  chipsEl.innerHTML = '';
  const allChip = document.createElement('div');
  allChip.className = 'chip' + (activeFilters.size===SOURCES.length ? ' on' : '');
  allChip.textContent = 'すべて';
  allChip.onclick = ()=>{ activeFilters = new Set(SOURCES.map(source=>source.id)); buildChips(); render(); };
  chipsEl.appendChild(allChip);

  const noneChip = document.createElement('div');
  noneChip.className = 'chip' + (activeFilters.size===0 ? ' on' : '');
  noneChip.textContent = 'すべて解除';
  noneChip.onclick = ()=>{ activeFilters = new Set(); buildChips(); render(); }; // 明示的に空集合(0件表示)にする
  chipsEl.appendChild(noneChip);

  sourceGroups().forEach(group=>{
    const isOn = group.ids.every(id=>activeFilters.has(id));
    const chip = document.createElement('div');
    chip.className = 'chip' + (isOn ? ' on' : '');
    chip.textContent = group.label;
    chip.onclick = ()=>{
      const isOn = group.ids.every(id=>activeFilters.has(id));
      // 「すべて解除」チップの新設に伴い、最後の1グループを外した際に自動で全選択へ戻す
      // 特殊挙動は廃止(空集合も明示的に意味のある状態として扱う)
      if(isOn){ group.ids.forEach(id=>activeFilters.delete(id)); }
      else    { group.ids.forEach(id=>activeFilters.add(id)); }
      buildChips(); render();
    };
    chipsEl.appendChild(chip);
  });
}

// ---- フッターリンク ----
function buildFootLinks(){
  const footLinksEl = document.getElementById('footLinks');
  const uniqueSources = [];
  const seen = new Set();
  SOURCES.forEach(source=>{ if(!seen.has(source.home)){ seen.add(source.home); uniqueSources.push(source); } });
  uniqueSources.forEach(source=>{
    const linkEl = document.createElement('a');
    linkEl.href = source.home; linkEl.target = '_blank'; linkEl.rel = 'noopener noreferrer';
    linkEl.textContent = source.short;
    footLinksEl.appendChild(linkEl);
  });
}
