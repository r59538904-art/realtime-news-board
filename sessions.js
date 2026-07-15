'use strict';
// このファイルは「世界の株式市場の取引セッション表示(開場中ハイライト・現在時刻カーソル)」を担当する。
// ================= 世界の取引セッション(各市場の開始・終了時間) =================
// sekai-market-tv.html(market API get)からの移植。日本時間24H軸で各市場の開場帯を表示し、
// 現在開いている市場は金色でハイライト、縦線が現在時刻を示す。
// データ本体(MKT・SESS)は market-sessions.js に分離。
function tzParts(tz, d=new Date()){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(d);
  const g=t=>p.find(x=>x.type===t).value;
  return {wd:g('weekday'), h:+g('hour')%24, m:+g('minute')};
}
function isMktOpen(mkt){
  const cfg=MKT[mkt]; if(!cfg) return true;
  const {wd,h,m}=tzParts(cfg.tz);
  if(wd==='Sat'||wd==='Sun') return false;
  const now=h*60+m;
  return cfg.spans.some(([h1,m1,h2,m2])=>now>=h1*60+m1&&now<h2*60+m2);
}
function tzOffsetMin(tz){
  const now=new Date();
  const loc=new Date(now.toLocaleString('en-US',{timeZone:tz}));
  const utc=new Date(now.toLocaleString('en-US',{timeZone:'UTC'}));
  return (loc-utc)/60000;
}
function buildSessions(){
  const track=document.getElementById('sessTrack');
  if(!track) return;
  track.innerHTML='';
  const grid=document.createElement('div'); grid.className='hourgrid';
  for(let h=0;h<=24;h+=3){
    const x=h/24*100;
    const sp=document.createElement('span'); sp.style.left=x+'%'; grid.appendChild(sp);
    const lb=document.createElement('label'); lb.style.left=x+'%'; lb.textContent=String(h).padStart(2,'0'); grid.appendChild(lb);
  }
  track.appendChild(grid);
  const jstOff=tzOffsetMin('Asia/Tokyo');
  SESS.forEach(s=>{
    const off=tzOffsetMin(s.tz);
    const shift=(jstOff-off)/60;
    let o=(s.o+shift+24)%24, c=(s.c+shift+24)%24;
    const row=document.createElement('div'); row.className='sess-row';
    row.style.top=(s.row*15)+'px';
    const mk=(a,b)=>{
      const bar=document.createElement('div');
      bar.className='sess-bar'+(isMktOpen(s.mkt)?' live':'');
      bar.style.left=(a/24*100)+'%'; bar.style.width=((b-a)/24*100)+'%';
      bar.innerHTML=`<b>${s.label}</b>`;
      row.appendChild(bar);
    };
    if(o<c) mk(o,c); else { mk(o,24); mk(0,c); }
    track.appendChild(row);
  });
  const cur=document.createElement('div'); cur.className='now-cursor'; cur.id='nowCursor';
  track.appendChild(cur);
  moveSessionCursor();
}
function moveSessionCursor(){
  const p=tzParts('Asia/Tokyo');
  const c=document.getElementById('nowCursor');
  if(c) c.style.left=((p.h+p.m/60)/24*100)+'%';
}
setInterval(moveSessionCursor, 30000);
setInterval(buildSessions, 5*60*1000);
