'use strict';
// このファイルは「記事一覧の描画(ソースフィルターチップ・記事カード・フッターリンク)」を担当する。
// ================= 記事一覧の描画(ソースフィルターチップ・カード・フッターリンク) =================

// ---- 状態 ----
let activeFilters = new Set(SOURCES.map(s=>s.id)); // 全ソースON
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
function isNewItem(it){
  return !!it.pubDate && (Date.now() - it.pubDate) <= NEW_WINDOW_MS;
}

function sourceGroups(){
  const order = []; const byGroup = {};
  SOURCES.forEach(s=>{
    if(!byGroup[s.group]){ byGroup[s.group] = {label:s.short, ids:[]}; order.push(byGroup[s.group]); }
    byGroup[s.group].ids.push(s.id);
  });
  return order;
}
function buildChips(){
  const wrap = document.getElementById('chips');
  wrap.innerHTML = '';
  const allChip = document.createElement('div');
  allChip.className = 'chip' + (activeFilters.size===SOURCES.length ? ' on' : '');
  allChip.textContent = 'すべて';
  allChip.onclick = ()=>{ activeFilters = new Set(SOURCES.map(s=>s.id)); buildChips(); render(); };
  wrap.appendChild(allChip);

  const noneChip = document.createElement('div');
  noneChip.className = 'chip' + (activeFilters.size===0 ? ' on' : '');
  noneChip.textContent = 'すべて解除';
  noneChip.onclick = ()=>{ activeFilters = new Set(); buildChips(); render(); }; // 明示的に空集合(0件表示)にする
  wrap.appendChild(noneChip);

  sourceGroups().forEach(g=>{
    const isOn = g.ids.every(id=>activeFilters.has(id));
    const chip = document.createElement('div');
    chip.className = 'chip' + (isOn ? ' on' : '');
    chip.textContent = g.label;
    chip.onclick = ()=>{
      const on = g.ids.every(id=>activeFilters.has(id));
      // 「すべて解除」チップの新設に伴い、最後の1グループを外した際に自動で全選択へ戻す
      // 特殊挙動は廃止(空集合も明示的に意味のある状態として扱う)
      if(on){ g.ids.forEach(id=>activeFilters.delete(id)); }
      else  { g.ids.forEach(id=>activeFilters.add(id)); }
      buildChips(); render();
    };
    wrap.appendChild(chip);
  });
}

function render(){
  const grid = document.getElementById('grid');
  let merged = [];
  const seen = new Set();
  SOURCES.forEach(src=>{
    if(!activeFilters.has(src.id)) return;
    const items = itemsBySource[src.id] || [];
    items.forEach(it=>{
      const key = it.link || it.title;
      if(!key || seen.has(key)) return;
      seen.add(key);
      merged.push({...it, source:src});
    });
  });
  merged = merged.filter(it => !it.pubDate || (Date.now()-it.pubDate) <= MAX_AGE_MS); // 2日より古い記事は表示しない
  if(topicFilterOn) merged = merged.filter(matchesTopic);
  if(searchTerm){
    const q = searchTerm.toLowerCase();
    merged = merged.filter(it => {
      const jt = trGet(it.title) || '', jd = trGet(it.desc) || '';
      return it.title.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)
          || jt.toLowerCase().includes(q) || jd.toLowerCase().includes(q);
    });
  }
  merged.sort((a,b)=> (b.pubDate||0) - (a.pubDate||0));

  grid.innerHTML = '';
  if(!merged.length){
    grid.innerHTML = `<div class="empty">該当するニュースがありません</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  const wantTitle = [], wantDesc = [];
  let enCount = 0;
  merged.slice(0,MAX_DISPLAY).forEach(it=>{
    const isEN = it.source.lang === 'EN';
    const jaTitle = (isEN && translateOn) ? trGet(it.title) : null;
    const jaDesc  = (isEN && translateOn) ? trGet(it.desc)  : null;
    if(isEN && translateOn){
      if(!jaTitle) wantTitle.push(it.title);
      if(!jaDesc && it.desc && enCount < TR_DESC_LIMIT) wantDesc.push(it.desc);
      enCount++;
    }
    const langLabel = isEN ? (jaTitle ? 'EN → JA 自動翻訳' : 'EN') : 'JA';
    const sentiment = getSentiment(it);
    const isNew = isNewItem(it);
    const a = document.createElement('a');
    a.className = 'card';
    a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = `
      <div class="meta">
        <div class="meta-left">
          <span class="src-badge" style="--src:${it.source.color};border-color:${it.source.color}66;background:${it.source.color}14">${it.source.short}${it.source.sub ? '<span class="genre">'+it.source.sub+'</span>' : ''}</span>
          ${isNew ? '<span class="new-badge">NEW</span>' : ''}
        </div>
        <div class="meta-right">
          ${sentiment ? `<span class="sentiment ${sentiment}">${sentiment==='pos'?'▲':'▼'}</span>` : ''}
          <time>${relTime(it.pubDate)}</time>
        </div>
      </div>
      <h3></h3>
      ${jaTitle ? '<div class="orig"></div>' : ''}
      <p></p>
      <span class="lang">${langLabel}</span>`;
    a.querySelector('h3').textContent = jaTitle || it.title;
    if(jaTitle) a.querySelector('.orig').textContent = it.title;   // 原文を小さく併記
    a.querySelector('p').textContent = jaDesc || it.desc;
    frag.appendChild(a);
  });
  grid.appendChild(frag);
  wantTitle.forEach(trEnqueue);   // 見出しを優先して翻訳キューへ
  wantDesc.forEach(trEnqueue);
}

// ---- フッターリンク ----
function buildFootLinks(){
  const wrap = document.getElementById('footLinks');
  const uniq = [];
  const seen = new Set();
  SOURCES.forEach(s=>{ if(!seen.has(s.home)){ seen.add(s.home); uniq.push(s); } });
  uniq.forEach((s,i)=>{
    const a = document.createElement('a');
    a.href = s.home; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = s.short;
    wrap.appendChild(a);
  });
}
