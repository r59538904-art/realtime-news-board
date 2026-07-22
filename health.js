'use strict';
// 外部API死活監視バナー。scripts/health_check.py(GitHub Actions側)が生成する
// status.jsonを読み、株価プロキシ・翻訳APIのいずれかが異常な場合はヘッダー直下に
// 警告バナーを表示する。正常時・status.json自体が取得できない時は何も表示しない
// (このバナー機能自体の不調でページ本体の利用を妨げないようにするため)。

const HEALTH_JSON_PATH = 'status.json';
const HEALTH_RECHECK_MS = 5 * 60 * 1000;  // 長時間開いたタブでも復旧/新規異常を反映するための再チェック間隔

const HEALTH_SERVICE_LABELS = {
  stockQuote: '株価現在値カード',
  translate: '自動翻訳',
};

function buildHealthMessage(failedNames){
  return '⚠ ' + failedNames.join('・') + 'が一時的に利用できない可能性があります(自動復旧を待っています)';
}

function renderHealthBanner(data){
  const existing = document.getElementById('healthBanner');
  const failedNames = Object.keys(data.services || {})
    .filter(key => data.services[key] && data.services[key].ok === false)
    .map(key => HEALTH_SERVICE_LABELS[key] || key);

  if(data.ok === false && failedNames.length){
    if(existing){ existing.textContent = buildHealthMessage(failedNames); return; }
    const banner = el('div', 'health-banner', buildHealthMessage(failedNames));
    banner.id = 'healthBanner';
    banner.setAttribute('role', 'status');
    const header = document.querySelector('header');
    if(header) header.insertAdjacentElement('afterend', banner);
  } else if(existing){
    existing.remove();
  }
}

async function checkSiteHealth(){
  try{
    const response = await fetch(HEALTH_JSON_PATH + '?t=' + Date.now());
    if(!response.ok) return;
    const data = await response.json();
    renderHealthBanner(data);
  }catch(e){
    // ネットワーク不調等で取得できないだけの可能性が高く、致命的ではないため静かに諦める
  }
}

checkSiteHealth();
setInterval(checkSiteHealth, HEALTH_RECHECK_MS);
