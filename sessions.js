'use strict';
// このファイルは「世界の株式市場の取引セッション表示(開場中ハイライト・現在時刻カーソル)」を担当する。



// ================= 世界の取引セッション(各市場の開始・終了時間) =================
// sekai-market-tv.html(market API get)からの移植。日本時間24H軸で各市場の開場帯を表示し、
// 現在開いている市場は金色でハイライト、縦線が現在時刻を示す。
// データ本体(MKT・SESS)は market-sessions.js に分離。
function tzParts(tz, date=new Date()){
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(date);
  const getPart = partType=>parts.find(part=>part.type===partType).value;
  return {weekday:getPart('weekday'), hour:+getPart('hour')%24, minute:+getPart('minute')};
}
function isMktOpen(marketId){
  const marketConfig=MKT[marketId]; if(!marketConfig) return true;
  const {weekday,hour,minute}=tzParts(marketConfig.tz);
  if(weekday==='Sat'||weekday==='Sun') return false;
  const nowMinutes=hour*60+minute;
  return marketConfig.spans.some(([openHour,openMin,closeHour,closeMin])=>nowMinutes>=openHour*60+openMin&&nowMinutes<closeHour*60+closeMin);
}
function tzOffsetMin(tz){
  const nowDate=new Date();
  const localDate=new Date(nowDate.toLocaleString('en-US',{timeZone:tz}));
  const utcDate=new Date(nowDate.toLocaleString('en-US',{timeZone:'UTC'}));
  return (localDate-utcDate)/60000;
}

// buildSessions()から呼ばれるため、buildSessions()より前(上)にここで定義しておく
function moveSessionCursor(){
  const parts=tzParts('Asia/Tokyo');
  const cursorEl=document.getElementById('nowCursor');
  if(cursorEl) cursorEl.style.left=((parts.hour+parts.minute/60)/24*100)+'%';
}
function buildSessions(){
  const track=document.getElementById('sessTrack');
  if(!track) return;
  track.innerHTML='';
  const hourGridEl=document.createElement('div'); hourGridEl.className='hourgrid';
  for(let hour=0;hour<=24;hour+=3){
    const xPercent=hour/24*100;
    const tickMark=document.createElement('span'); tickMark.style.left=xPercent+'%'; hourGridEl.appendChild(tickMark);
    const hourLabel=document.createElement('label'); hourLabel.style.left=xPercent+'%'; hourLabel.textContent=String(hour).padStart(2,'0'); hourGridEl.appendChild(hourLabel);
  }
  track.appendChild(hourGridEl);
  const jstOffsetMinutes=tzOffsetMin('Asia/Tokyo');
  SESS.forEach(session=>{
    const sessionOffsetMinutes=tzOffsetMin(session.tz);
    const shiftHours=(jstOffsetMinutes-sessionOffsetMinutes)/60;
    let openHour=(session.o+shiftHours+24)%24, closeHour=(session.c+shiftHours+24)%24;
    const row=document.createElement('div'); row.className='sess-row';
    row.style.top=(session.row*15)+'px';
    const addBar=(fromHour,toHour)=>{
      const bar=document.createElement('div');
      bar.className='sess-bar'+(isMktOpen(session.mkt)?' live':'');
      bar.style.left=(fromHour/24*100)+'%'; bar.style.width=((toHour-fromHour)/24*100)+'%';
      bar.innerHTML=`<b>${session.label}</b>`;
      row.appendChild(bar);
    };
    if(openHour<closeHour) addBar(openHour,closeHour); else { addBar(openHour,24); addBar(0,closeHour); }
    track.appendChild(row);
  });
  const cursorEl=document.createElement('div'); cursorEl.className='now-cursor'; cursorEl.id='nowCursor';
  track.appendChild(cursorEl);
  moveSessionCursor();
}
setInterval(moveSessionCursor, 30000);
setInterval(buildSessions, 5*60*1000);
