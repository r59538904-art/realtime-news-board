'use strict';
// 銘柄検索・現在値カード。記事一覧の左のサイドバー。
// Finnhub(finnhub.io)の無料APIのみで完結させている(TradingViewには一切依存しない)。
//   検索          … GET /search
//   現在値・値幅  … GET /quote
//   企業名・ロゴ  … GET /stock/profile2(取得できなくても現在値表示は続行する。あくまで補助情報)
// 過去の値動き(ローソク足チャート)はFinnhub無料プランでは取得不可
// (/stock/candleが有料限定。実機で{"error":"You don't have access to this resource."}を確認済み)
// のため、折れ線チャートではなく「現在値カード」(現在値・前日比・当日値幅)として実装している。
//
// 対応市場は米国上場銘柄のみ(検索段階でサフィックス無しの銘柄に絞り込んでいる)。
// 東証・LSE等の海外取引所は/quoteが{"error":"You don't have access to this resource."}を
// 返し無料プランでは非対応(Twelve Data無料プランでも同じ制約を実機確認済み・"available
// starting with the Grow or Venture plan"と明示された)。Yahoo FinanceはCORS非対応
// (Access-Control-Allow-Originヘッダー無し、プロキシサーバーが必要でこの構成と相容れない)、
// StooqはAPIエンドポイント自体が404で動作していない。海外取引所のリアルタイム/準リアルタイム
// データはライセンス費用がかかるため無料プランでは提供されないのが実質的に業界共通の制約であり、
// 現状これ以上の無料の代替手段は見つかっていない。トヨタの"TM"のように米国ADR/ADSがある
// 海外企業は検索・取得できる場合がある。

// ---- Finnhub API設定 ----
// 無料アカウント(https://finnhub.io/register、クレジットカード不要)登録後、
// ダッシュボードで発行されるAPIキーをここに設定する。
// 未設定のままでも壊れない: カードが「設定が必要です」と案内を出すだけで、他の機能には影響しない。
// 注意: 静的サイトのJSにそのまま埋め込むため、このキーは誰でも閲覧できる(view-sourceで見える)。
// Finnhub無料枠のキーはブラウザから直接叩く用途を前提にした設計のため実害は小さい。
const FINNHUB_API_KEY = 'd9fe9jhr01qu5nhe58igd9fe9jhr01qu5nhe58j0';
const WL_SEARCH_DEBOUNCE_MS = 350;  // 連続入力のたびのAPI呼び出しを間引く
const WL_SEARCH_MIN_LEN = 2;        // 1文字だけでは結果が多すぎる/意味が薄いため検索しない

const WL_PREF_KEY = 'news-board-wl-pref-v1';
let watchlistOpen = true;
let wlSymbol = 'AAPL';          // 現在値カードに表示中の銘柄(Finnhubのシンボル表記そのまま)
let wlSearchTimer = null;
let wlSearchAbort = null;       // 前回の検索が終わる前に次を打ち始めた場合、古い方を中断する
let wlQuoteAbort = null;        // 同上。銘柄選択を連続で切り替えた場合の古いリクエストを中断する

// カレンダーと同じ理由(狭い画面では最初は情報量を絞りたい)で、
// 狭い画面かつ初回訪問時に限り初期状態を折りたたみにする
function loadWatchlistPref(){
  const saved = storageGet(WL_PREF_KEY);
  watchlistOpen = saved ? saved !== 'closed' : window.innerWidth > 1100;
}
function updateWlBtn(){
  const btn = document.getElementById('wlBtn');
  if(!btn) return;
  btn.textContent = watchlistOpen ? '折りたたむ ▲' : '表示する ▼';
  btn.setAttribute('aria-expanded', String(watchlistOpen));
  btn.setAttribute('aria-controls', 'wlWidget');
}
function toggleWatchlist(){
  watchlistOpen = !watchlistOpen;
  storageSet(WL_PREF_KEY, watchlistOpen ? 'open' : 'closed');
  buildWatchlist();
}

// ---- Finnhub呼び出しの共通ヘルパー ----
async function fetchFinnhub(path, params, signal){
  const query = new URLSearchParams({...params, token: FINNHUB_API_KEY});
  const response = await fetch('https://finnhub.io/api/v1' + path + '?' + query.toString(), {signal});
  if(!response.ok) throw new Error('finnhub ' + path + ' http ' + response.status);
  return response.json();
}

// ---- 現在値カードの構築 ----
async function buildWatchlist(){
  const container = document.getElementById('wlWidget');
  if(!container) return;
  container.textContent = '';
  updateWlBtn();
  if(!watchlistOpen) return;             // 折りたたみ中は取得自体を行わない(通信節約)
  if(!FINNHUB_API_KEY){
    container.appendChild(el('div', 'wl-result-note', '株価表示にはFinnhub APIキーの設定が必要です'));
    return;
  }
  container.appendChild(el('div', 'wl-result-note', '読み込み中…'));

  if(wlQuoteAbort) wlQuoteAbort.abort();
  const controller = new AbortController();
  wlQuoteAbort = controller;
  const [quoteResult, profileResult] = await Promise.allSettled([
    fetchFinnhub('/quote', {symbol: wlSymbol}, controller.signal),
    fetchFinnhub('/stock/profile2', {symbol: wlSymbol}, controller.signal),
  ]);
  if(controller.signal.aborted) return;  // より新しい選択に追い越された場合、古い結果は描画しない

  if(quoteResult.status !== 'fulfilled' || !quoteResult.value || quoteResult.value.c == null){
    console.error('現在値の取得に失敗:', quoteResult.reason || quoteResult.value);
    container.textContent = '';
    container.appendChild(el('div', 'wl-result-note', '現在値を取得できませんでした'));
    return;
  }
  // 企業名・ロゴ(/stock/profile2)はあくまで補助情報のため、失敗しても現在値表示は続行する
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  renderWlQuote(quoteResult.value, profile);
}

function formatPrice(value, profile){
  if(value == null || Number.isNaN(value)) return '─';
  const currency = (profile && profile.currency) || '';
  return value.toLocaleString('ja-JP', {maximumFractionDigits: 2}) + (currency ? ' ' + currency : '');
}
function renderWlQuote(quote, profile){
  const container = document.getElementById('wlWidget');
  if(!container) return;
  container.textContent = '';
  const card = el('div', 'wl-quote');

  const header = el('div', 'wl-quote-header');
  if(profile && isSafeUrl(profile.logo)){
    const logo = document.createElement('img');
    logo.src = profile.logo;
    logo.alt = '';                       // 隣に企業名テキストがあるため装飾画像として扱う
    logo.loading = 'lazy';
    logo.className = 'wl-quote-logo';
    header.appendChild(logo);
  }
  const nameWrap = el('div', 'wl-quote-namewrap');
  nameWrap.appendChild(el('div', 'wl-quote-name', (profile && profile.name) || wlSymbol));
  nameWrap.appendChild(el('div', 'wl-quote-sym', wlSymbol));
  header.appendChild(nameWrap);
  card.appendChild(header);

  card.appendChild(el('div', 'wl-quote-price', formatPrice(quote.c, profile)));

  const isUp = quote.d >= 0;
  const change = el('div', 'wl-quote-change ' + (isUp ? 'pos' : 'neg'),
    (isUp ? '▲ +' : '▼ ') + Math.abs(quote.d).toFixed(2) + ' (' + (isUp ? '+' : '−') + Math.abs(quote.dp).toFixed(2) + '%)');
  card.appendChild(change);

  // 当日値幅バー: 安値〜高値のレンジの中で現在値がどこに位置するかを視覚化する
  if(typeof quote.h === 'number' && typeof quote.l === 'number' && quote.h > quote.l){
    const range = el('div', 'wl-quote-range');
    range.appendChild(el('span', 'wl-quote-range-label', formatPrice(quote.l, profile)));
    const track = el('div', 'wl-quote-range-track');
    const pct = Math.min(100, Math.max(0, (quote.c - quote.l) / (quote.h - quote.l) * 100));
    const marker = el('div', 'wl-quote-range-marker');
    marker.style.left = pct + '%';
    track.appendChild(marker);
    range.appendChild(track);
    range.appendChild(el('span', 'wl-quote-range-label', formatPrice(quote.h, profile)));
    card.appendChild(range);
  }

  const grid = el('div', 'wl-quote-grid');
  [['始値', quote.o], ['前日終値', quote.pc], ['高値', quote.h], ['安値', quote.l]].forEach(([label, value]) => {
    const cell = el('div', 'wl-quote-cell');
    cell.appendChild(el('span', 'wl-quote-cell-label', label));
    cell.appendChild(el('span', 'wl-quote-cell-value', formatPrice(value, profile)));
    grid.appendChild(cell);
  });
  card.appendChild(grid);

  if(quote.t){
    const updatedText = '更新: ' + new Date(quote.t * 1000).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'});
    card.appendChild(el('div', 'wl-quote-updated', updatedText));
  }
  container.appendChild(card);
}

// ---- 銘柄検索(Finnhub /search) ----
function hideWlResults(){
  const listEl = document.getElementById('wlResults');
  if(!listEl) return;
  listEl.textContent = '';
  listEl.hidden = true;
}
function renderWlResults(items){
  const listEl = document.getElementById('wlResults');
  if(!listEl) return;
  listEl.textContent = '';
  if(!items.length){
    listEl.appendChild(el('div', 'wl-result-note', '該当する銘柄が見つかりませんでした(現在値取得は米国上場銘柄のみ対応。海外企業でも米国ADR/ADSがあれば検索可能な場合があります)'));
    listEl.hidden = false;
    return;
  }
  items.slice(0, 8).forEach(item => {
    const optionBtn = el('button', 'wl-result');
    optionBtn.type = 'button';
    optionBtn.setAttribute('role', 'option');
    optionBtn.appendChild(el('span', 'wl-result-name', item.description));
    optionBtn.appendChild(el('span', 'wl-result-sym', item.displaySymbol || item.symbol));
    // mousedownはinputのblurより先に発火するため、blur側のhideWlResultsで
    // クリックが握りつぶされる事故を防げる(clickだと間に合わないことがある)
    optionBtn.addEventListener('mousedown', e => { e.preventDefault(); selectWlSymbol(item.symbol, item.description); });
    listEl.appendChild(optionBtn);
  });
  listEl.hidden = false;
}
function selectWlSymbol(symbol, description){
  wlSymbol = symbol;
  const input = document.getElementById('wlSearch');
  if(input) input.value = description || symbol;
  hideWlResults();
  if(!watchlistOpen) toggleWatchlist();  // 折りたたみ中に選んだ場合は結果が見えるよう自動展開する
  else buildWatchlist();
}
async function searchWlSymbol(query){
  if(!FINNHUB_API_KEY){
    const listEl = document.getElementById('wlResults');
    if(listEl){
      listEl.textContent = '';
      listEl.appendChild(el('div', 'wl-result-note', '検索機能を使うにはFinnhub APIキーの設定が必要です'));
      listEl.hidden = false;
    }
    return;
  }
  if(wlSearchAbort) wlSearchAbort.abort();
  const controller = new AbortController();
  wlSearchAbort = controller;
  try{
    const data = await fetchFinnhub('/search', {q: query}, controller.signal);
    // Finnhub無料プランは海外取引所(東証・LSE等)の現在値(/quote)を返さない仕様
    // (実機確認: Twelve Data無料プランでも同じ制約を確認済み。有料プラン限定の業界共通の制約)。
    // Finnhubのシンボル表記は「サフィックス無し=米国上場」「.T/.L等のサフィックス有り=海外取引所」
    // のため、サフィックス無しの銘柄だけに絞り込む(トヨタのADR"TM"のように海外企業でも
    // 米国上場していれば取得できる場合がある)
    const items = (data && Array.isArray(data.result) ? data.result : [])
      .filter(item => item && item.symbol && item.description && !item.symbol.includes('.'));
    renderWlResults(items);
  }catch(e){
    if(e.name !== 'AbortError') console.error('銘柄検索に失敗:', e);
  }
}
function handleWlSearchInput(value){
  clearTimeout(wlSearchTimer);
  const query = value.trim();
  if(query.length < WL_SEARCH_MIN_LEN){ hideWlResults(); return; }
  wlSearchTimer = setTimeout(() => searchWlSymbol(query), WL_SEARCH_DEBOUNCE_MS);
}
