'use strict';
// 世界の取引セッション表示。日本時間24H軸に各市場の開場帯を描き、
// 開場中の市場は金色でハイライト、縦線が現在時刻を示す。
// データ(MKT・SESS)はmarket-sessions.jsに分離。

// ---- タイムゾーン計算 ----
// 指定タイムゾーンの現在の曜日・時・分を取り出す
function tzParts(tz, date = new Date()){
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit'}).formatToParts(date);
  const getPart = partType => parts.find(part => part.type === partType).value;
  return {weekday: getPart('weekday'), hour: +getPart('hour') % 24, minute: +getPart('minute')};
}
// 指定タイムゾーンのUTCからのオフセット(分)を求める
function tzOffsetMin(tz){
  const nowDate = new Date();
  const localDate = new Date(nowDate.toLocaleString('en-US', {timeZone: tz}));
  const utcDate = new Date(nowDate.toLocaleString('en-US', {timeZone: 'UTC'}));
  return (localDate - utcDate) / 60000;
}
// その市場が現地時間でいま開場中かを判定する(土日は休場)
function isMktOpen(marketId){
  const marketConfig = MKT[marketId];
  if(!marketConfig) return true;
  const {weekday, hour, minute} = tzParts(marketConfig.tz);
  if(weekday === 'Sat' || weekday === 'Sun') return false;
  const nowMinutes = hour * 60 + minute;
  return marketConfig.spans.some(([openHour, openMin, closeHour, closeMin]) =>
    nowMinutes >= openHour * 60 + openMin && nowMinutes < closeHour * 60 + closeMin);
}

// ---- 描画 ----
// 現在時刻カーソルを日本時間の位置へ動かす
function moveSessionCursor(){
  const parts = tzParts('Asia/Tokyo');
  const cursorEl = document.getElementById('nowCursor');
  if(cursorEl) cursorEl.style.left = ((parts.hour + parts.minute / 60) / 24 * 100) + '%';
}
// セッションバー全体を組み立てる(時刻目盛り → 各市場のバー → 現在時刻カーソル)
function buildSessions(){
  const track = document.getElementById('sessTrack');
  if(!track) return;
  track.textContent = '';

  const hourGridEl = el('div', 'hourgrid');
  for(let hour = 0; hour <= 24; hour += 3){
    const xPercent = hour / 24 * 100;
    const tickMark = el('span');
    tickMark.style.left = xPercent + '%';
    hourGridEl.appendChild(tickMark);
    const hourLabel = el('label', null, String(hour).padStart(2, '0'));
    hourLabel.style.left = xPercent + '%';
    hourGridEl.appendChild(hourLabel);
  }
  track.appendChild(hourGridEl);

  const jstOffsetMinutes = tzOffsetMin('Asia/Tokyo');
  SESS.forEach(session => {
    // 現地の開場/閉場時刻を日本時間へずらす(日をまたぐ場合はバーを2本に分ける)
    const shiftHours = (jstOffsetMinutes - tzOffsetMin(session.tz)) / 60;
    const openHour = (session.o + shiftHours + 24) % 24;
    const closeHour = (session.c + shiftHours + 24) % 24;
    const row = el('div', 'sess-row');
    row.style.top = (session.row * 15) + 'px';
    const addBar = (fromHour, toHour) => {
      const bar = el('div', 'sess-bar' + (isMktOpen(session.mkt) ? ' live' : ''));
      bar.style.left = (fromHour / 24 * 100) + '%';
      bar.style.width = ((toHour - fromHour) / 24 * 100) + '%';
      bar.appendChild(el('b', null, session.label));
      row.appendChild(bar);
    };
    if(openHour < closeHour) addBar(openHour, closeHour);
    else { addBar(openHour, 24); addBar(0, closeHour); }
    track.appendChild(row);
  });

  const cursorEl = el('div', 'now-cursor');
  cursorEl.id = 'nowCursor';
  track.appendChild(cursorEl);
  moveSessionCursor();
}

setInterval(moveSessionCursor, 30 * 1000);   // カーソルは30秒ごとに移動
setInterval(buildSessions, 5 * 60 * 1000);   // 開場/閉場の切り替わりは5分ごとに反映
