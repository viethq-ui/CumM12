// ============ CẤU HÌNH NÂNG CẤP ============
// MỤC TIÊU (SLA) — chỉnh các số này theo mục tiêu thực tế của kho.
// leadtime & cost: THẤP hơn = tốt;  năng suất: CAO hơn = tốt.
window.SLA = window.SLA || { leadtimeH: 12, costKg: 120, prodDonH: 30, prodWH: 500 };
// Trạng thái bộ lọc khoảng thời gian toàn cục.
window.RANGE = window.RANGE || { mode: 'all', from: null, to: null };

function _parseISO(s){ return new Date(String(s).slice(0,10)+'T00:00:00'); }
function _parseDMY(s){ const p=String(s).split('/'); return new Date(+p[2],+p[1]-1,+p[0]); }
function _latestDate(){
  let m=null;
  (window.LT_DATA||[]).forEach(r=>{const d=_parseISO(r[1]);if(!isNaN(d)&&(!m||d>m))m=d;});
  (window.PROD_DATA||[]).forEach(r=>{const d=_parseISO(r[1]);if(!isNaN(d)&&(!m||d>m))m=d;});
  ((window.COST_DATA||{}).dates||[]).forEach(s=>{const d=_parseDMY(s);if(!isNaN(d)&&(!m||d>m))m=d;});
  return m;
}
function _bounds(){
  const r=window.RANGE;
  if(!r||r.mode==='all') return {from:null,to:null};
  if(r.mode==='custom') return {from:r.from?new Date(r.from+'T00:00:00'):null,to:r.to?new Date(r.to+'T23:59:59'):null};
  const days=+r.mode, last=_latestDate();
  if(!last) return {from:null,to:null};
  const from=new Date(last); from.setDate(from.getDate()-(days-1));
  return {from,to:last};
}
function inRange(d){ const b=_bounds(); if(b.from&&d<b.from)return false; if(b.to&&d>b.to)return false; return true; }
function ltInRange(){ return (window.LT_DATA||[]).filter(r=>inRange(_parseISO(r[1]))); }
function prodInRange(){ return (window.PROD_DATA||[]).filter(r=>inRange(_parseISO(r[1]))); }
function costInRange(){ const D=window.COST_DATA||{dates:[],costKg:[]}; const o={dates:[],costKg:[]}; (D.dates||[]).forEach((dt,i)=>{ if(inRange(_parseDMY(dt))){o.dates.push(dt);o.costKg.push((D.costKg||[])[i]);} }); return o; }

// === CORE ===
setInterval(()=>{document.getElementById('clk').textContent=new Date().toLocaleString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})},1000);
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.t).classList.add('active')});
Chart.defaults.color='#8b9cc7';Chart.defaults.borderColor='rgba(42,53,80,.5)';Chart.defaults.font.family='Inter';Chart.defaults.font.size=11;
Chart.defaults.plugins.legend.labels.usePointStyle=true;
const CI={};function dc(id){if(CI[id]){CI[id].destroy();delete CI[id]}}
function mkA(t,ic,ti,m){return`<div class="alrt ${t}"><div class="alrt-icon"><span class="material-icons-round">${ic}</span></div><div><h4>${ti}</h4><p>${m}</p></div></div>`}

// === LEADTIME ===
function buildLT(){
  const LT_DATA=ltInRange();
  const SLA=window.SLA;
  const slots=["0-6h","6-12h","12-24h",">24h"];
  const slotColors=["#3b82f6","#06b6d4","#f59e0b","#ef4444"];
  if(!LT_DATA.length){document.getElementById('ltKpis').innerHTML='<div class="kpi b" style="grid-column:1/-1"><div class="kpi-label">Leadtime</div><div class="kpi-val" style="font-size:15px">Không có dữ liệu trong khoảng đã chọn</div></div>';['c1','c2','c3','c4'].forEach(dc);document.getElementById('ltAlerts').innerHTML='';return;}

  // Helper: weighted average LT = Σ(vol×lt) / Σ(vol)
  function wAvg(rows){
    const totalVol=rows.reduce((a,d)=>a+d[2],0);
    if(!totalVol)return 0;
    return rows.reduce((a,d)=>a+d[2]*d[4],0)/totalVol;
  }

  // Compute daily weighted avg
  const dailyMap={};
  LT_DATA.forEach(([slot,date,vol,pct,lt])=>{
    if(!dailyMap[date])dailyMap[date]={vol:0,volLt:0};
    dailyMap[date].vol+=vol;
    dailyMap[date].volLt+=vol*lt;
  });
  const dailyDates=Object.keys(dailyMap).sort();
  const dailyWLT=dailyDates.map(d=>+(dailyMap[d].volLt/dailyMap[d].vol).toFixed(2));
  const dailyVols=dailyDates.map(d=>dailyMap[d].vol);

  // Overall weighted avg
  const totalVol=LT_DATA.reduce((a,d)=>a+d[2],0);
  const overallWLT=+(LT_DATA.reduce((a,d)=>a+d[2]*d[4],0)/totalVol).toFixed(2);
  // Last day
  const lastDate=dailyDates[dailyDates.length-1];
  const lastWLT=dailyWLT[dailyWLT.length-1];
  const lastVol=dailyVols[dailyVols.length-1];
  // Previous day comparison
  const prevWLT=dailyWLT[dailyWLT.length-2]||lastWLT;
  const chgDay=((lastWLT-prevWLT)/prevWLT*100).toFixed(1);

  // KPIs
  document.getElementById('ltKpis').innerHTML=`
    <div class="kpi b ${overallWLT<=SLA.leadtimeH?'sla-ok':'sla-bad'}"><div class="kpi-label">LT TB Có Trọng Số</div><div class="kpi-val">${overallWLT}h</div><div class="kpi-sla ${overallWLT<=SLA.leadtimeH?'ok':'bad'}"><span class="material-icons-round">${overallWLT<=SLA.leadtimeH?'check_circle':'error'}</span>Mục tiêu ≤ ${SLA.leadtimeH}h</div></div>
    <div class="kpi g"><div class="kpi-label">Ngày ${lastDate.slice(5)}</div><div class="kpi-val">${lastWLT}h</div><div class="kpi-chg ${parseFloat(chgDay)<=0?'up':'down'}"><span class="material-icons-round">${parseFloat(chgDay)<=0?'arrow_downward':'arrow_upward'}</span>${Math.abs(chgDay)}% vs hôm trước</div></div>
    <div class="kpi o"><div class="kpi-label">Đơn Ngày ${lastDate.slice(5)}</div><div class="kpi-val">${(lastVol/1000).toFixed(0)}K</div></div>
    <div class="kpi p"><div class="kpi-label">Tổng Đơn Toàn Kỳ</div><div class="kpi-val">${(totalVol/1e6).toFixed(1)}M</div></div>`;

  // Chart 1: Weighted LT trend by day/week/month
  function renderC1(){
    dc('c1');
    const view=document.getElementById('ltView').value;
    const slotF=document.getElementById('ltSlot').value;
    let filtered=LT_DATA;
    if(slotF!=='all')filtered=filtered.filter(d=>d[0]===slotF);
    // Group with weighted avg
    const grp={};
    filtered.forEach(([s,dt,v,p,lt])=>{
      let key=dt;
      const d=new Date(dt);
      if(view==='weekly'){const wk=getISOWeek(d);key=`T${wk}`}
      if(view==='monthly')key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(!grp[key])grp[key]={volLt:0,vol:0};
      grp[key].volLt+=v*lt;grp[key].vol+=v;
    });
    const keys=Object.keys(grp).sort();
    const vals=keys.map(k=>+(grp[k].volLt/grp[k].vol).toFixed(2));
    const vols=keys.map(k=>grp[k].vol);
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    CI.c1=new Chart(document.getElementById('c1'),{type:'line',data:{labels:keys,datasets:[
      {label:'LT TB (h)',data:vals,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.1)',fill:true,tension:.3,pointRadius:view==='daily'?2:4,pointBackgroundColor:'#3b82f6',yAxisID:'y'},
      {label:'Số đơn',data:vols,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.08)',fill:true,tension:.3,pointRadius:0,yAxisID:'y1',type:'bar',barPercentage:.4},
      {label:'TB toàn kỳ',data:keys.map(()=>avg.toFixed(2)),borderColor:'#ef4444',borderDash:[5,5],pointRadius:0,yAxisID:'y'},
      {label:'Mục tiêu ('+SLA.leadtimeH+'h)',data:keys.map(()=>SLA.leadtimeH),borderColor:'#10b981',borderDash:[8,4],borderWidth:2,pointRadius:0,yAxisID:'y'}
    ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top'},tooltip:{callbacks:{label:function(ctx){if(ctx.datasetIndex===1)return`Số đơn: ${(ctx.raw/1000).toFixed(0)}K`;return ctx.dataset.label+': '+ctx.raw+'h'}}}},scales:{y:{title:{display:true,text:'Giờ'},position:'left'},y1:{title:{display:true,text:'Số đơn'},position:'right',grid:{drawOnChartArea:false}},x:{ticks:{maxTicksLimit:view==='daily'?20:15}}}}});
  }
  // ISO week helper
  function getISOWeek(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-(t.getDay()+6)%7);const w1=new Date(t.getFullYear(),0,4);return 1+Math.round(((t-w1)/864e5-(3-(w1.getDay()+6)%7))/7)}
  document.getElementById('ltView').onchange=renderC1;
  document.getElementById('ltSlot').onchange=renderC1;
  renderC1();

  // Chart 2: Weighted avg by slot
  dc('c2');
  const slotWAvg=slots.map(s=>{const d=LT_DATA.filter(x=>x[0]===s);const tv=d.reduce((a,x)=>a+x[2],0);return tv?+(d.reduce((a,x)=>a+x[2]*x[4],0)/tv).toFixed(2):0});
  const slotVol=slots.map(s=>LT_DATA.filter(x=>x[0]===s).reduce((a,x)=>a+x[2],0));
  CI.c2=new Chart(document.getElementById('c2'),{type:'bar',data:{labels:['0-6h','6-12h','12-24h','>24h'],datasets:[{label:'LT TB (h)',data:slotWAvg,backgroundColor:slotColors.map(c=>c+'cc'),borderColor:slotColors,borderWidth:1,borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'Giờ'}}}}});

  // Chart 3: Volume pie
  dc('c3');
  CI.c3=new Chart(document.getElementById('c3'),{type:'doughnut',data:{labels:['0-6h','6-12h','12-24h','>24h'],datasets:[{data:slotVol,backgroundColor:slotColors.map(c=>c+'cc'),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right'}}}});

  // Chart 4: Weighted LT by day of week
  dc('c4');
  const dayNames=['CN','T2','T3','T4','T5','T6','T7'];
  const dayWLT=dayNames.map((_,i)=>{const d=LT_DATA.filter(x=>{const dt=new Date(x[1]);return dt.getDay()===i});const tv=d.reduce((a,x)=>a+x[2],0);return tv?+(d.reduce((a,x)=>a+x[2]*x[4],0)/tv).toFixed(2):0});
  CI.c4=new Chart(document.getElementById('c4'),{type:'bar',data:{labels:dayNames,datasets:[{label:'LT TB (h)',data:dayWLT,backgroundColor:dayNames.map((_,i)=>i===0||i===6?'#f59e0bcc':'#3b82f6cc'),borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'Giờ'}}}}});

  // === SHARED TABLE HELPERS ===
  function isoToDMY(iso){const p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
  function getISOWeek(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-(t.getDay()+6)%7);const w1=new Date(t.getFullYear(),0,4);return 1+Math.round(((t-w1)/864e5-(3-(w1.getDay()+6)%7))/7)}
  function pctBadge(cur,prev,inverse){
    if(!prev||!cur)return'<span class="chg flat">N/A</span>';
    const c=((cur-prev)/prev*100).toFixed(1);const bad=inverse?(c<0):(c>0);
    const cls=Math.abs(c)>5?(bad?'down':'up'):'flat';
    return`<span class="chg ${cls}"><span class="material-icons-round">${c>=0?'arrow_upward':'arrow_downward'}</span>${c>=0?'+':''}${c}%</span>`;
  }
  function fN(n){return n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1000).toFixed(0)+'K':n.toFixed(0)}
  function tblWrap(icon,color,title,headers,rows,noteDate){
    let h=`<div class="cmp-section"><div class="cmp-header"><span class="material-icons-round" style="color:var(--${color})">${icon}</span>${title}</div><table class="cmp-table"><thead><tr>`;
    headers.forEach(hd=>h+=`<th>${hd}</th>`);
    h+='</tr></thead><tbody>';
    rows.forEach(r=>{h+='<tr>';r.forEach(c=>h+=`<td>${c}</td>`);h+='</tr>'});
    h+='</tbody></table>';
    if(noteDate&&typeof NOTES_DATA!=='undefined'){const nk=isoToDMY(noteDate);if(NOTES_DATA[nk])h+=`<div class="cmp-note"><span class="material-icons-round">sticky_note_2</span><div><b>Ghi chú ${noteDate}:</b> ${NOTES_DATA[nk]}</div></div>`}
    h+='</div>';return h;
  }

  // ===== LEADTIME ALERTS TABLE =====
  const lastIdx=dailyDates.length-1;
  const curDate=dailyDates[lastIdx],curLT=dailyWLT[lastIdx],curVol=dailyVols[lastIdx];
  const dowNames=['CN','T2','T3','T4','T5','T6','T7'];
  const curDow=new Date(curDate).getDay();

  // Daily rows
  const dRows=[];
  // 1. vs yesterday
  if(lastIdx>=1){const p=lastIdx-1;dRows.push(['vs Hôm trước ('+dailyDates[p].slice(5)+')',`<span class="val">${dailyWLT[p]}h</span>`,`<span class="val">${curLT}h</span>`,fN(dailyVols[p]),fN(curVol),pctBadge(curLT,dailyWLT[p],false)])}
  // 2. vs same weekday
  const sameDow=dailyDates.map((d,i)=>({d,i})).filter(x=>new Date(x.d).getDay()===curDow&&x.i<lastIdx).reverse();
  if(sameDow.length>=1){const sw=sameDow[0];dRows.push([`vs ${dowNames[curDow]} tuần trước (${sw.d.slice(5)})`,`<span class="val">${dailyWLT[sw.i]}h</span>`,`<span class="val">${curLT}h</span>`,fN(dailyVols[sw.i]),fN(curVol),pctBadge(curLT,dailyWLT[sw.i],false)])}
  // 3. vs similar volume
  const simD=dailyDates.map((d,i)=>({d,i,v:dailyVols[i]})).filter(x=>x.i<lastIdx&&Math.abs(x.v-curVol)/curVol<0.1).sort((a,b)=>Math.abs(a.v-curVol)-Math.abs(b.v-curVol));
  if(simD.length>=1){const s=simD[0];dRows.push([`vs SL tương đương (${s.d.slice(5)}, ${fN(s.v)})`,`<span class="val">${dailyWLT[s.i]}h</span>`,`<span class="val">${curLT}h</span>`,fN(s.v),fN(curVol),pctBadge(curLT,dailyWLT[s.i],false)])}

  let ltHtml=tblWrap('calendar_today','blue',`SO SÁNH THEO NGÀY — ${curDate} (${dowNames[curDow]})`,['So sánh','LT Trước','LT Nay','SL Trước','SL Nay','Biến động'],dRows,curDate);

  // Weekly rows
  const wMap={};dailyDates.forEach((d,i)=>{const wk=getISOWeek(new Date(d));if(!wMap[wk])wMap[wk]={vl:0,v:0,n:0};wMap[wk].vl+=dailyVols[i]*dailyWLT[i];wMap[wk].v+=dailyVols[i];wMap[wk].n++});
  const wNums=Object.keys(wMap).map(Number).sort((a,b)=>a-b);
  if(wNums.length>=2){
    const cw=wNums[wNums.length-1],pw=wNums[wNums.length-2];
    const cwLT=+(wMap[cw].vl/wMap[cw].v).toFixed(2),cwV=wMap[cw].v;
    const pwLT=+(wMap[pw].vl/wMap[pw].v).toFixed(2),pwV=wMap[pw].v;
    const wRows=[['vs Tuần trước (T'+pw+')',`<span class="val">${pwLT}h</span>`,`<span class="val">${cwLT}h</span>`,fN(pwV),fN(cwV),pctBadge(cwLT,pwLT,false)]];
    const simW=wNums.filter(w=>w!==cw&&Math.abs(wMap[w].v-cwV)/cwV<0.15).map(w=>({w,lt:+(wMap[w].vl/wMap[w].v).toFixed(2),v:wMap[w].v})).sort((a,b)=>Math.abs(a.v-cwV)-Math.abs(b.v-cwV));
    if(simW.length)wRows.push([`vs T${simW[0].w} (SL≈${fN(simW[0].v)})`,`<span class="val">${simW[0].lt}h</span>`,`<span class="val">${cwLT}h</span>`,fN(simW[0].v),fN(cwV),pctBadge(cwLT,simW[0].lt,false)]);
    ltHtml+=tblWrap('date_range','cyan',`SO SÁNH THEO TUẦN — T${cw} (${wMap[cw].n} ngày)`,['So sánh','LT Trước','LT Nay','SL Trước','SL Nay','Biến động'],wRows);
  }

  // Monthly rows
  const mMap={};dailyDates.forEach((d,i)=>{const m=d.slice(0,7);if(!mMap[m])mMap[m]={vl:0,v:0,n:0};mMap[m].vl+=dailyVols[i]*dailyWLT[i];mMap[m].v+=dailyVols[i];mMap[m].n++});
  const mons=Object.keys(mMap).sort();
  if(mons.length>=2){
    const mRows=[];
    for(let i=mons.length-1;i>=1;i--){
      const cm=mons[i],pm=mons[i-1];
      const cmLT=+(mMap[cm].vl/mMap[cm].v).toFixed(2),pmLT=+(mMap[pm].vl/mMap[pm].v).toFixed(2);
      mRows.push([`${cm} vs ${pm}`,`<span class="val">${pmLT}h</span>`,`<span class="val">${cmLT}h</span>`,fN(mMap[pm].v)+` (${mMap[pm].n}d)`,fN(mMap[cm].v)+` (${mMap[cm].n}d)`,pctBadge(cmLT,pmLT,false)]);
    }
    ltHtml+=tblWrap('event_note','purple','SO SÁNH THEO THÁNG',['So sánh','LT Trước','LT Nay','SL Trước','SL Nay','Biến động'],mRows);
  }
  document.getElementById('ltAlerts').innerHTML=ltHtml;
}

// === COST ===
function buildCost(){
  const COST_DATA=costInRange();
  const SLA=window.SLA;
  const D=COST_DATA;
  const ckDates=[],ckVals=[];
  D.dates.forEach((dt,i)=>{if(dt&&D.costKg[i]!=null&&D.costKg[i]>0&&D.costKg[i]<500){ckDates.push(dt);ckVals.push(D.costKg[i])}});
  if(!ckVals.length){document.getElementById('costKpis').innerHTML='<div class="kpi b" style="grid-column:1/-1"><div class="kpi-label">Cost</div><div class="kpi-val" style="font-size:15px">Không có dữ liệu trong khoảng đã chọn</div></div>';['c5','c6','c7','c8'].forEach(dc);document.getElementById('costAlerts').innerHTML='';return;}

  // KPIs
  const lastCK=ckVals[ckVals.length-1]||0;
  const avgCK=ckVals.length?(ckVals.reduce((a,b)=>a+b,0)/ckVals.length):0;
  const minCK=Math.min(...ckVals),maxCK=Math.max(...ckVals);
  const last7=ckVals.slice(-7),avg7=last7.reduce((a,b)=>a+b,0)/last7.length;
  const prev7=ckVals.slice(-14,-7),avgP7=prev7.length?prev7.reduce((a,b)=>a+b,0)/prev7.length:avg7;
  const chg7=((avg7-avgP7)/avgP7*100).toFixed(1);
  document.getElementById('costKpis').innerHTML=`
    <div class="kpi b ${lastCK<=SLA.costKg?'sla-ok':'sla-bad'}"><div class="kpi-label">Cost/Kg Gần Nhất</div><div class="kpi-val">${lastCK.toFixed(0)} đ</div><div class="kpi-sla ${lastCK<=SLA.costKg?'ok':'bad'}"><span class="material-icons-round">${lastCK<=SLA.costKg?'check_circle':'error'}</span>Mục tiêu ≤ ${SLA.costKg}đ</div></div>
    <div class="kpi g"><div class="kpi-label">Cost/Kg TB</div><div class="kpi-val">${avgCK.toFixed(0)} đ</div></div>
    <div class="kpi o"><div class="kpi-label">7 Ngày Gần Nhất</div><div class="kpi-val">${avg7.toFixed(0)} đ</div><div class="kpi-chg ${chg7>=0?'down':'up'}"><span class="material-icons-round">${chg7>=0?'arrow_upward':'arrow_downward'}</span>${Math.abs(chg7)}% vs 7 ngày trước</div></div>
    <div class="kpi p"><div class="kpi-label">Min / Max</div><div class="kpi-val">${minCK.toFixed(0)} - ${maxCK.toFixed(0)}</div></div>`;

  // Charts
  dc('c5');CI.c5=new Chart(document.getElementById('c5'),{type:'line',data:{labels:ckDates,datasets:[{label:'Cost/Kg',data:ckVals,borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.1)',fill:true,tension:.3,pointRadius:2,pointBackgroundColor:'#ef4444'},{label:'TB',data:ckDates.map(()=>avgCK.toFixed(1)),borderColor:'#f59e0b',borderDash:[5,5],pointRadius:0},{label:'Mục tiêu ('+SLA.costKg+'đ)',data:ckDates.map(()=>SLA.costKg),borderColor:'#10b981',borderDash:[8,4],borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'VNĐ/Kg'}},x:{ticks:{maxTicksLimit:20}}}}});

  dc('c6');const byMonth={};ckDates.forEach((dt,i)=>{const p=dt.split('/');const key=p[1]+'/'+p[2];if(!byMonth[key])byMonth[key]={s:0,c:0};byMonth[key].s+=ckVals[i];byMonth[key].c++});
  const mKeys=Object.keys(byMonth).sort((a,b)=>{const[ma,ya]=a.split('/');const[mb,yb]=b.split('/');return(ya+ma).localeCompare(yb+mb)});
  const mVals=mKeys.map(k=>+(byMonth[k].s/byMonth[k].c).toFixed(1));
  CI.c6=new Chart(document.getElementById('c6'),{type:'bar',data:{labels:mKeys,datasets:[{label:'Cost/Kg TB Tháng',data:mVals,backgroundColor:mVals.map(v=>v>130?'rgba(239,68,68,.7)':v>110?'rgba(245,158,11,.7)':'rgba(16,185,129,.7)'),borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'VNĐ/Kg'}}}}});

  dc('c7');const byWeek={};let wi=0;for(let i=0;i<ckDates.length;i+=7){const chunk=ckVals.slice(i,i+7);byWeek['W'+(++wi)]=+(chunk.reduce((a,b)=>a+b,0)/chunk.length).toFixed(1)}
  const wKeys=Object.keys(byWeek),wVals=wKeys.map(k=>byWeek[k]);
  CI.c7=new Chart(document.getElementById('c7'),{type:'line',data:{labels:wKeys,datasets:[{label:'Cost/Kg TB Tuần',data:wVals,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,.1)',fill:true,tension:.3,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'VNĐ/Kg'}},x:{ticks:{maxTicksLimit:15}}}}});

  dc('c8');const l30d=ckDates.slice(-30),l30v=ckVals.slice(-30),avg30=l30v.reduce((a,b)=>a+b,0)/l30v.length;
  CI.c8=new Chart(document.getElementById('c8'),{type:'bar',data:{labels:l30d,datasets:[{label:'Cost/Kg',data:l30v,backgroundColor:l30v.map(v=>v>avg30*1.15?'rgba(239,68,68,.7)':v<avg30*0.85?'rgba(16,185,129,.7)':'rgba(59,130,246,.5)'),borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'VNĐ/Kg'}},x:{ticks:{maxTicksLimit:15}}}}});

  // === COST ALERTS TABLE ===
  function isoToDMY(iso){const p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
  function pctBadge(cur,prev){if(!prev)return'<span class="chg flat">N/A</span>';const c=((cur-prev)/prev*100).toFixed(1);const cls=Math.abs(c)>5?(c>0?'down':'up'):'flat';return`<span class="chg ${cls}"><span class="material-icons-round">${c>=0?'arrow_upward':'arrow_downward'}</span>${c>=0?'+':''}${c}%</span>`}
  function tblWrap(icon,color,title,headers,rows,noteDate){let h=`<div class="cmp-section"><div class="cmp-header"><span class="material-icons-round" style="color:var(--${color})">${icon}</span>${title}</div><table class="cmp-table"><thead><tr>`;headers.forEach(hd=>h+=`<th>${hd}</th>`);h+='</tr></thead><tbody>';rows.forEach(r=>{h+='<tr>';r.forEach(c=>h+=`<td>${c}</td>`);h+='</tr>'});h+='</tbody></table>';if(noteDate&&typeof NOTES_DATA!=='undefined'){const dd=noteDate.split('/');const nk=dd[0]+'/'+dd[1]+'/'+dd[2];if(NOTES_DATA[nk])h+=`<div class="cmp-note"><span class="material-icons-round">sticky_note_2</span><div><b>Ghi chú:</b> ${NOTES_DATA[nk]}</div></div>`}return h+'</div>'}

  const li=ckDates.length-1,curCK=ckVals[li],curDt=ckDates[li];
  const cDRows=[];
  // vs yesterday
  if(li>=1)cDRows.push(['vs Hôm trước ('+ckDates[li-1]+')',`<span class="val">${ckVals[li-1].toFixed(0)}đ</span>`,`<span class="val">${curCK.toFixed(0)}đ</span>`,pctBadge(curCK,ckVals[li-1])]);
  // vs same weekday (find by parsing date)
  function parseDMY(s){const p=s.split('/');return new Date(+p[2],+p[1]-1,+p[0])}
  const curCDow=parseDMY(curDt).getDay();
  const sameCDow=ckDates.map((d,i)=>({d,i})).filter(x=>parseDMY(x.d).getDay()===curCDow&&x.i<li).reverse();
  if(sameCDow.length>=1){const sw=sameCDow[0];cDRows.push([`vs ${['CN','T2','T3','T4','T5','T6','T7'][curCDow]} trước (${sw.d})`,`<span class="val">${ckVals[sw.i].toFixed(0)}đ</span>`,`<span class="val">${curCK.toFixed(0)}đ</span>`,pctBadge(curCK,ckVals[sw.i])])}
  // vs 7-day avg
  if(li>=7){const avg7d=ckVals.slice(li-7,li).reduce((a,b)=>a+b,0)/7;cDRows.push([`vs TB 7 ngày trước`,`<span class="val">${avg7d.toFixed(0)}đ</span>`,`<span class="val">${curCK.toFixed(0)}đ</span>`,pctBadge(curCK,avg7d)])}

  let costHtml=tblWrap('calendar_today','blue',`SO SÁNH THEO NGÀY — ${curDt}`,['So sánh','Cost Trước','Cost Nay','Biến động'],cDRows,curDt);

  // Weekly
  const cWMap={};ckDates.forEach((dt,i)=>{const wk=Math.ceil((i+1)/7);if(!cWMap[wk])cWMap[wk]={s:0,n:0};cWMap[wk].s+=ckVals[i];cWMap[wk].n++});
  const cWNums=Object.keys(cWMap).map(Number).sort((a,b)=>a-b);
  if(cWNums.length>=2){
    const cw=cWNums[cWNums.length-1],pw=cWNums[cWNums.length-2];
    const cwA=+(cWMap[cw].s/cWMap[cw].n).toFixed(1),pwA=+(cWMap[pw].s/cWMap[pw].n).toFixed(1);
    const cwRows=[['vs Tuần trước',`<span class="val">${pwA}đ</span>`,`<span class="val">${cwA}đ</span>`,pctBadge(cwA,pwA)]];
    costHtml+=tblWrap('date_range','cyan',`SO SÁNH THEO TUẦN`,['So sánh','Cost TB Trước','Cost TB Nay','Biến động'],cwRows);
  }

  // Monthly
  if(mKeys.length>=2){
    const cmRows=[];
    for(let i=mKeys.length-1;i>=1;i--){
      cmRows.push([`${mKeys[i]} vs ${mKeys[i-1]}`,`<span class="val">${mVals[i-1]}đ</span>`,`<span class="val">${mVals[i]}đ</span>`,pctBadge(mVals[i],mVals[i-1])]);
    }
    costHtml+=tblWrap('event_note','purple','SO SÁNH THEO THÁNG',['So sánh','Cost TB Trước','Cost TB Nay','Biến động'],cmRows);
  }
  document.getElementById('costAlerts').innerHTML=costHtml;
}

// === PRODUCTIVITY ===
function buildProd(){
  const PROD_DATA=prodInRange();
  const SLA=window.SLA;
  const weeks=[...new Set(PROD_DATA.map(d=>d[0]))].sort((a,b)=>a-b);
  if(!weeks.length){document.getElementById('prodKpis').innerHTML='<div class="kpi b" style="grid-column:1/-1"><div class="kpi-label">Năng suất</div><div class="kpi-val" style="font-size:15px">Không có dữ liệu trong khoảng đã chọn</div></div>';['c9','c10','c11','c12'].forEach(dc);document.getElementById('prodAlerts').innerHTML='';return;}
  function aggByWeek(filter){return weeks.map(w=>{let d=PROD_DATA.filter(x=>x[0]===w);if(filter)d=filter(d);if(!d.length)return{donH:0,wH:0};return{donH:+(d.reduce((a,x)=>a+x[9],0)/d.length).toFixed(2),wH:+(d.reduce((a,x)=>a+x[11],0)/d.length).toFixed(2)}})}

  const allAgg=aggByWeek();
  const avgDonH=+(allAgg.reduce((a,x)=>a+x.donH,0)/allAgg.length).toFixed(2);
  const avgWH=+(allAgg.reduce((a,x)=>a+x.wH,0)/allAgg.length).toFixed(2);
  const lastW=allAgg[allAgg.length-1],prevW=allAgg[allAgg.length-2]||null;
  const chgD=(prevW&&prevW.donH)?((lastW.donH-prevW.donH)/prevW.donH*100).toFixed(1):0;

  document.getElementById('prodKpis').innerHTML=`
    <div class="kpi b ${avgDonH>=SLA.prodDonH?'sla-ok':'sla-bad'}"><div class="kpi-label">NS Đơn/h TB</div><div class="kpi-val">${avgDonH}</div><div class="kpi-sla ${avgDonH>=SLA.prodDonH?'ok':'bad'}"><span class="material-icons-round">${avgDonH>=SLA.prodDonH?'check_circle':'error'}</span>Mục tiêu ≥ ${SLA.prodDonH}</div></div>
    <div class="kpi g ${avgWH>=SLA.prodWH?'sla-ok':'sla-bad'}"><div class="kpi-label">NS W/h TB</div><div class="kpi-val">${avgWH}</div><div class="kpi-sla ${avgWH>=SLA.prodWH?'ok':'bad'}"><span class="material-icons-round">${avgWH>=SLA.prodWH?'check_circle':'error'}</span>Mục tiêu ≥ ${SLA.prodWH}</div></div>
    <div class="kpi o"><div class="kpi-label">Tuần ${weeks[weeks.length-1]} Đơn/h</div><div class="kpi-val">${lastW.donH}</div><div class="kpi-chg ${chgD>=0?'up':'down'}"><span class="material-icons-round">${chgD>=0?'arrow_upward':'arrow_downward'}</span>${Math.abs(chgD)}% vs tuần trước</div></div>
    <div class="kpi p"><div class="kpi-label">Tuần ${weeks[weeks.length-1]} W/h</div><div class="kpi-val">${lastW.wH}</div></div>`;

  function renderProd(){
    const sf=document.getElementById('prSlot').value,tf=document.getElementById('prType').value;
    const filter=d=>{let r=d;if(sf!=='all')r=r.filter(x=>x[2]===sf);if(tf!=='all')r=r.filter(x=>x[3]===tf);return r};
    const data=weeks.map(w=>{let d=filter(PROD_DATA.filter(x=>x[0]===w));if(!d.length)return{donH:0,wH:0};return{donH:+(d.reduce((a,x)=>a+x[9],0)/d.length).toFixed(2),wH:+(d.reduce((a,x)=>a+x[11],0)/d.length).toFixed(2)}});
    const lbls=weeks.map(w=>'Tuần '+w);
    dc('c9');CI.c9=new Chart(document.getElementById('c9'),{type:'line',data:{labels:lbls,datasets:[{label:'Đơn/h',data:data.map(d=>d.donH),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.15)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'#3b82f6'},{label:'TB',data:data.map(()=>avgDonH),borderColor:'#ef4444',borderDash:[5,5],pointRadius:0},{label:'Mục tiêu ('+SLA.prodDonH+')',data:data.map(()=>SLA.prodDonH),borderColor:'#10b981',borderDash:[8,4],borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Đơn/h'}}}}});
    dc('c10');CI.c10=new Chart(document.getElementById('c10'),{type:'line',data:{labels:lbls,datasets:[{label:'W/h (Kg)',data:data.map(d=>d.wH),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.15)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'#10b981'},{label:'TB',data:data.map(()=>avgWH),borderColor:'#f59e0b',borderDash:[5,5],pointRadius:0},{label:'Mục tiêu ('+SLA.prodWH+')',data:data.map(()=>SLA.prodWH),borderColor:'#3b82f6',borderDash:[8,4],borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Kg/h'}}}}});
  }
  document.getElementById('prSlot').onchange=renderProd;document.getElementById('prType').onchange=renderProd;renderProd();

  dc('c11');const dayShift=aggByWeek(d=>d.filter(x=>x[2]==='06h-18h')),nightShift=aggByWeek(d=>d.filter(x=>x[2]==='18h-06h'));
  CI.c11=new Chart(document.getElementById('c11'),{type:'bar',data:{labels:weeks.map(w=>'T'+w),datasets:[{label:'06h-18h',data:dayShift.map(d=>d.donH),backgroundColor:'#3b82f6cc',borderRadius:4},{label:'18h-06h',data:nightShift.map(d=>d.donH),backgroundColor:'#8b5cf6cc',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Đơn/h'}}}}});

  dc('c12');const rcv=aggByWeek(d=>d.filter(x=>x[3]==='receive')),dlv=aggByWeek(d=>d.filter(x=>x[3]==='deliver'));
  CI.c12=new Chart(document.getElementById('c12'),{type:'bar',data:{labels:weeks.map(w=>'T'+w),datasets:[{label:'Nhận hàng',data:rcv.map(d=>d.donH),backgroundColor:'#06b6d4cc',borderRadius:4},{label:'Giao hàng',data:dlv.map(d=>d.donH),backgroundColor:'#f59e0bcc',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Đơn/h'}}}}});

  // === PROD ALERTS TABLE ===
  function pctBadge(cur,prev){if(!prev)return'<span class="chg flat">N/A</span>';const c=((cur-prev)/prev*100).toFixed(1);const cls=Math.abs(c)>5?(c>0?'up':'down'):'flat';return`<span class="chg ${cls}"><span class="material-icons-round">${c>=0?'arrow_upward':'arrow_downward'}</span>${c>=0?'+':''}${c}%</span>`}
  function tblWrap(icon,color,title,headers,rows){let h=`<div class="cmp-section"><div class="cmp-header"><span class="material-icons-round" style="color:var(--${color})">${icon}</span>${title}</div><table class="cmp-table"><thead><tr>`;headers.forEach(hd=>h+=`<th>${hd}</th>`);h+='</tr></thead><tbody>';rows.forEach(r=>{h+='<tr>';r.forEach(c=>h+=`<td>${c}</td>`);h+='</tr>'});return h+'</tbody></table></div>'}

  const lw=weeks[weeks.length-1],pwk=weeks.length>=2?weeks[weeks.length-2]:'—';
  const nightAvg=nightShift.reduce((a,d)=>a+d.donH,0)/nightShift.length;
  const dayAvg=dayShift.reduce((a,d)=>a+d.donH,0)/dayShift.length;
  const rcvAvg=rcv.reduce((a,d)=>a+d.donH,0)/rcv.length;
  const dlvAvg=dlv.reduce((a,d)=>a+d.donH,0)/dlv.length;

  // Weekly comparison table
  const pRows=[];
  if(allAgg.length>=2){
    pRows.push(['Đơn/h',`<span class="val">${prevW.donH}</span>`,`<span class="val">${lastW.donH}</span>`,pctBadge(lastW.donH,prevW.donH)]);
    pRows.push(['Kg/h',`<span class="val">${prevW.wH}</span>`,`<span class="val">${lastW.wH}</span>`,pctBadge(lastW.wH,prevW.wH)]);
  }
  let prodHtml=tblWrap('date_range','cyan',`SO SÁNH TUẦN ${lw} vs TUẦN ${pwk}`,['Chỉ tiêu',`T${pwk}`,`T${lw}`,'Biến động'],pRows);

  // Shift comparison
  const shRows=[];
  const lwDay=dayShift[dayShift.length-1],lwNight=nightShift[nightShift.length-1];
  const pwDay=dayShift.length>=2?dayShift[dayShift.length-2]:null,pwNight=nightShift.length>=2?nightShift[nightShift.length-2]:null;
  if(pwDay)shRows.push([`Ca ngày (06h-18h)`,`<span class="val">${pwDay.donH}</span>`,`<span class="val">${lwDay.donH}</span>`,pctBadge(lwDay.donH,pwDay.donH)]);
  if(pwNight)shRows.push([`Ca đêm (18h-06h)`,`<span class="val">${pwNight.donH}</span>`,`<span class="val">${lwNight.donH}</span>`,pctBadge(lwNight.donH,pwNight.donH)]);
  shRows.push([`TB Ca ngày toàn kỳ`,`<span class="val">${dayAvg.toFixed(1)}</span>`,'','']);
  shRows.push([`TB Ca đêm toàn kỳ`,`<span class="val">${nightAvg.toFixed(1)}</span>`,'','']);
  prodHtml+=tblWrap('nights_stay','purple',`SO SÁNH CA LÀM VIỆC — Đơn/h`,['Ca',`T${pwk}`,`T${lw}`,'Biến động'],shRows);

  // Receive vs Deliver
  const rdRows=[];
  const lwRcv=rcv[rcv.length-1],lwDlv=dlv[dlv.length-1];
  const pwRcv=rcv.length>=2?rcv[rcv.length-2]:null,pwDlv=dlv.length>=2?dlv[dlv.length-2]:null;
  if(pwRcv)rdRows.push(['Nhận hàng',`<span class="val">${pwRcv.donH}</span>`,`<span class="val">${lwRcv.donH}</span>`,pctBadge(lwRcv.donH,pwRcv.donH)]);
  if(pwDlv)rdRows.push(['Giao hàng',`<span class="val">${pwDlv.donH}</span>`,`<span class="val">${lwDlv.donH}</span>`,pctBadge(lwDlv.donH,pwDlv.donH)]);
  rdRows.push([`TB Nhận toàn kỳ`,`<span class="val">${rcvAvg.toFixed(1)}</span>`,'','']);
  rdRows.push([`TB Giao toàn kỳ`,`<span class="val">${dlvAvg.toFixed(1)}</span>`,'','']);
  prodHtml+=tblWrap('swap_horiz','orange','SO SÁNH NHẬN / GIAO HÀNG — Đơn/h',['Loại',`T${pwk}`,`T${lw}`,'Biến động'],rdRows);

  document.getElementById('prodAlerts').innerHTML=prodHtml;
}

// === TỔNG QUAN ===
function buildOverview(){
  const LT=ltInRange(), C=costInRange(), P=prodInRange(), S=window.SLA;
  // Leadtime TB có trọng số
  const tv=LT.reduce((a,d)=>a+d[2],0);
  const ltAvg=tv?+(LT.reduce((a,d)=>a+d[2]*d[4],0)/tv).toFixed(2):0;
  // Cost/Kg TB (lọc giá trị hợp lệ)
  const cv=[]; C.dates.forEach((dt,i)=>{const v=C.costKg[i]; if(v!=null&&v>0&&v<500)cv.push(v);});
  const costAvg=cv.length?Math.round(cv.reduce((a,b)=>a+b,0)/cv.length):0;
  // Năng suất TB
  const donH=P.length?+(P.reduce((a,x)=>a+x[9],0)/P.length).toFixed(2):0;
  const wH=P.length?+(P.reduce((a,x)=>a+x[11],0)/P.length).toFixed(2):0;

  const okLT=ltAvg>0&&ltAvg<=S.leadtimeH, okC=costAvg>0&&costAvg<=S.costKg, okD=donH>=S.prodDonH, okW=wH>=S.prodWH;
  function card(cls,label,val,ok,tgt){return `<div class="kpi ${cls} ${ok?'sla-ok':'sla-bad'}"><div class="kpi-label">${label}</div><div class="kpi-val">${val}</div><div class="kpi-sla ${ok?'ok':'bad'}"><span class="material-icons-round">${ok?'check_circle':'error'}</span>${tgt}</div></div>`}
  document.getElementById('ovKpis').innerHTML=
    card('b','Leadtime TB (trọng số)',ltAvg+'h',okLT,'Mục tiêu ≤ '+S.leadtimeH+'h')+
    card('o','Cost / Kg TB',costAvg+'đ',okC,'Mục tiêu ≤ '+S.costKg+'đ')+
    card('g','Năng suất Đơn/h TB',donH,okD,'Mục tiêu ≥ '+S.prodDonH)+
    card('p','Năng suất W/h TB',wH,okW,'Mục tiêu ≥ '+S.prodWH);

  function row(name,cur,tgt,ok){return `<tr><td>${name}</td><td class="val">${cur}</td><td class="val">${tgt}</td><td>${ok?'<span class="sla ok"><span class="material-icons-round">check_circle</span>Đạt</span>':'<span class="sla bad"><span class="material-icons-round">error</span>Không đạt</span>'}</td></tr>`}
  document.getElementById('ovSla').innerHTML=
    '<div class="cmp-section"><table class="cmp-table"><thead><tr><th>Chỉ tiêu</th><th>Hiện tại</th><th>Mục tiêu</th><th>Trạng thái</th></tr></thead><tbody>'+
    row('Leadtime TB (giờ)',ltAvg+'h','≤ '+S.leadtimeH+'h',okLT)+
    row('Cost/Kg TB (đ)',costAvg+'đ','≤ '+S.costKg+'đ',okC)+
    row('Năng suất Đơn/h',donH,'≥ '+S.prodDonH,okD)+
    row('Năng suất W/h (Kg/h)',wH,'≥ '+S.prodWH,okW)+
    '</tbody></table></div>';

  // co1: Leadtime theo ngày
  const dm={}; LT.forEach(([s,dt,v,p,lt])=>{if(!dm[dt])dm[dt]={vl:0,v:0};dm[dt].vl+=v*lt;dm[dt].v+=v;});
  const dk=Object.keys(dm).sort(), dv=dk.map(k=>+(dm[k].vl/dm[k].v).toFixed(2));
  dc('co1'); if(dk.length)CI.co1=new Chart(document.getElementById('co1'),{type:'line',data:{labels:dk,datasets:[{label:'LT TB (h)',data:dv,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.1)',fill:true,tension:.3,pointRadius:2},{label:'Mục tiêu',data:dk.map(()=>S.leadtimeH),borderColor:'#10b981',borderDash:[8,4],borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{y:{title:{display:true,text:'Giờ'}},x:{ticks:{maxTicksLimit:20}}}}});
  // co2: Cost theo ngày
  dc('co2'); if(cv.length){const cd=[],cc=[];C.dates.forEach((dt,i)=>{const v=C.costKg[i];if(v!=null&&v>0&&v<500){cd.push(dt);cc.push(v);}});CI.co2=new Chart(document.getElementById('co2'),{type:'line',data:{labels:cd,datasets:[{label:'Cost/Kg',data:cc,borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.1)',fill:true,tension:.3,pointRadius:2},{label:'Mục tiêu',data:cd.map(()=>S.costKg),borderColor:'#10b981',borderDash:[8,4],borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{y:{title:{display:true,text:'VNĐ/Kg'}},x:{ticks:{maxTicksLimit:20}}}}});}
  // co3: Năng suất theo tuần
  dc('co3'); const wks=[...new Set(P.map(d=>d[0]))].sort((a,b)=>a-b);
  const wv=wks.map(w=>{const d=P.filter(x=>x[0]===w);return d.length?+(d.reduce((a,x)=>a+x[9],0)/d.length).toFixed(2):0;});
  if(wks.length)CI.co3=new Chart(document.getElementById('co3'),{type:'line',data:{labels:wks.map(w=>'Tuần '+w),datasets:[{label:'Đơn/h',data:wv,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.12)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'#3b82f6'},{label:'Mục tiêu',data:wks.map(()=>S.prodDonH),borderColor:'#10b981',borderDash:[8,4],borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{y:{title:{display:true,text:'Đơn/h'}}}}});
}

// === XUẤT BÁO CÁO ===
function _activeTab(){const t=document.querySelector('.tab.active');return t?t.dataset.t:'ov';}
function exportPNG(){
  const panel=document.getElementById(_activeTab());
  const cs=[...panel.querySelectorAll('canvas')].filter(c=>c.width&&c.height);
  if(!cs.length){alert('Không có biểu đồ để xuất.');return;}
  const pad=18,w=Math.max(...cs.map(c=>c.width))+pad*2,h=cs.reduce((a,c)=>a+c.height+pad,pad);
  const out=document.createElement('canvas');out.width=w;out.height=h;
  const ctx=out.getContext('2d');ctx.fillStyle='#0a0e1a';ctx.fillRect(0,0,w,h);
  let y=pad;cs.forEach(c=>{ctx.drawImage(c,pad,y);y+=c.height+pad;});
  const a=document.createElement('a');a.href=out.toDataURL('image/png');a.download='dashboard-'+_activeTab()+'.png';a.click();
}
function _csv(rows){return rows.map(r=>r.map(c=>{c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\n');}
function _dl(name,text){const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,%EF%BB%BF'+encodeURIComponent(text);a.download=name;a.click();}
function exportCSV(){
  const t=_activeTab();let rows=[];
  if(t==='lt'||t==='ov'){const LT=ltInRange();const m={};LT.forEach(([s,dt,v,p,lt])=>{if(!m[dt])m[dt]={vl:0,v:0};m[dt].vl+=v*lt;m[dt].v+=v;});rows=[['Ngày','Leadtime TB (h)','Số đơn']];Object.keys(m).sort().forEach(k=>rows.push([k,(m[k].vl/m[k].v).toFixed(2),m[k].v]));}
  else if(t==='cost'){const C=costInRange();rows=[['Ngày','Cost/Kg (đ)']];C.dates.forEach((dt,i)=>rows.push([dt,C.costKg[i]]));}
  else if(t==='prod'){const P=prodInRange();const wks=[...new Set(P.map(d=>d[0]))].sort((a,b)=>a-b);rows=[['Tuần','Đơn/h TB','W/h TB']];wks.forEach(w=>{const d=P.filter(x=>x[0]===w);if(d.length)rows.push([w,(d.reduce((a,x)=>a+x[9],0)/d.length).toFixed(2),(d.reduce((a,x)=>a+x[11],0)/d.length).toFixed(2)]);});}
  _dl('dashboard-'+t+'.csv',_csv(rows));
}

// === WIRING ===
function rebuildAll(){[buildOverview,buildLT,buildCost,buildProd].forEach(fn=>{try{fn();}catch(e){console.error(e);}});}
window.rebuildAll=rebuildAll;
(function(){
  const gr=document.getElementById('gRange'),gf=document.getElementById('gFrom'),gt=document.getElementById('gTo');
  if(gr){
    gr.onchange=function(){
      if(gr.value==='custom'){gf.style.display='';gt.style.display='';}
      else{gf.style.display='none';gt.style.display='none';window.RANGE={mode:gr.value,from:null,to:null};rebuildAll();}
    };
    const apply=()=>{if(gr.value==='custom'){window.RANGE={mode:'custom',from:gf.value||null,to:gt.value||null};rebuildAll();}};
    gf.onchange=apply;gt.onchange=apply;
  }
  const png=document.getElementById('btnPng'),csv=document.getElementById('btnCsv'),pdf=document.getElementById('btnPdf');
  if(png)png.onclick=exportPNG;if(csv)csv.onclick=exportCSV;if(pdf)pdf.onclick=()=>window.print();
})();

// Init
rebuildAll();
