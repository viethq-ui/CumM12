// === CORE ===
setInterval(()=>{document.getElementById('clk').textContent=new Date().toLocaleString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})},1000);
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(b.dataset.t).classList.add('active')});
Chart.defaults.color='#8b9cc7';Chart.defaults.borderColor='rgba(42,53,80,.5)';Chart.defaults.font.family='Inter';Chart.defaults.font.size=11;
Chart.defaults.plugins.legend.labels.usePointStyle=true;
const CI={};function dc(id){if(CI[id]){CI[id].destroy();delete CI[id]}}
function mkA(t,ic,ti,m){return`<div class="alrt ${t}"><div class="alrt-icon"><span class="material-icons-round">${ic}</span></div><div><h4>${ti}</h4><p>${m}</p></div></div>`}

// === LEADTIME ===
function buildLT(){
  const slots=["0-6h","6-12h","12-24h",">24h"];
  const slotColors=["#3b82f6","#06b6d4","#f59e0b","#ef4444"];

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
    <div class="kpi b"><div class="kpi-label">LT TB Có Trọng Số</div><div class="kpi-val">${overallWLT}h</div><div class="kpi-chg up"><span class="material-icons-round">functions</span>Σ(vol×lt)/Σ(vol)</div></div>
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
      {label:'TB toàn kỳ',data:keys.map(()=>avg.toFixed(2)),borderColor:'#ef4444',borderDash:[5,5],pointRadius:0,yAxisID:'y'}
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
  const D=COST_DATA;
  const ckDates=[],ckVals=[];
  D.dates.forEach((dt,i)=>{if(dt&&D.costKg[i]!=null&&D.costKg[i]>0&&D.costKg[i]<500){ckDates.push(dt);ckVals.push(D.costKg[i])}});

  // KPIs
  const lastCK=ckVals[ckVals.length-1]||0;
  const avgCK=ckVals.length?(ckVals.reduce((a,b)=>a+b,0)/ckVals.length):0;
  const minCK=Math.min(...ckVals),maxCK=Math.max(...ckVals);
  const last7=ckVals.slice(-7),avg7=last7.reduce((a,b)=>a+b,0)/last7.length;
  const prev7=ckVals.slice(-14,-7),avgP7=prev7.length?prev7.reduce((a,b)=>a+b,0)/prev7.length:avg7;
  const chg7=((avg7-avgP7)/avgP7*100).toFixed(1);
  document.getElementById('costKpis').innerHTML=`
    <div class="kpi b"><div class="kpi-label">Cost/Kg Gần Nhất</div><div class="kpi-val">${lastCK.toFixed(0)} đ</div><div class="kpi-chg ${lastCK>avgCK?'down':'up'}"><span class="material-icons-round">${lastCK>avgCK?'arrow_upward':'arrow_downward'}</span>${Math.abs((lastCK-avgCK)/avgCK*100).toFixed(1)}% vs TB</div></div>
    <div class="kpi g"><div class="kpi-label">Cost/Kg TB</div><div class="kpi-val">${avgCK.toFixed(0)} đ</div></div>
    <div class="kpi o"><div class="kpi-label">7 Ngày Gần Nhất</div><div class="kpi-val">${avg7.toFixed(0)} đ</div><div class="kpi-chg ${chg7>=0?'down':'up'}"><span class="material-icons-round">${chg7>=0?'arrow_upward':'arrow_downward'}</span>${Math.abs(chg7)}% vs 7 ngày trước</div></div>
    <div class="kpi p"><div class="kpi-label">Min / Max</div><div class="kpi-val">${minCK.toFixed(0)} - ${maxCK.toFixed(0)}</div></div>`;

  // Charts
  dc('c5');CI.c5=new Chart(document.getElementById('c5'),{type:'line',data:{labels:ckDates,datasets:[{label:'Cost/Kg',data:ckVals,borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.1)',fill:true,tension:.3,pointRadius:2,pointBackgroundColor:'#ef4444'},{label:'TB',data:ckDates.map(()=>avgCK.toFixed(1)),borderColor:'#f59e0b',borderDash:[5,5],pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'VNĐ/Kg'}},x:{ticks:{maxTicksLimit:20}}}}});

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
  const weeks=[...new Set(PROD_DATA.map(d=>d[0]))].sort((a,b)=>a-b);
  function aggByWeek(filter){return weeks.map(w=>{let d=PROD_DATA.filter(x=>x[0]===w);if(filter)d=filter(d);if(!d.length)return{donH:0,wH:0};return{donH:+(d.reduce((a,x)=>a+x[9],0)/d.length).toFixed(2),wH:+(d.reduce((a,x)=>a+x[11],0)/d.length).toFixed(2)}})}

  const allAgg=aggByWeek();
  const avgDonH=+(allAgg.reduce((a,x)=>a+x.donH,0)/allAgg.length).toFixed(2);
  const avgWH=+(allAgg.reduce((a,x)=>a+x.wH,0)/allAgg.length).toFixed(2);
  const lastW=allAgg[allAgg.length-1],prevW=allAgg[allAgg.length-2];
  const chgD=prevW.donH?((lastW.donH-prevW.donH)/prevW.donH*100).toFixed(1):0;

  document.getElementById('prodKpis').innerHTML=`
    <div class="kpi b"><div class="kpi-label">NS Đơn/h TB</div><div class="kpi-val">${avgDonH}</div></div>
    <div class="kpi g"><div class="kpi-label">NS W/h TB</div><div class="kpi-val">${avgWH}</div></div>
    <div class="kpi o"><div class="kpi-label">Tuần ${weeks[weeks.length-1]} Đơn/h</div><div class="kpi-val">${lastW.donH}</div><div class="kpi-chg ${chgD>=0?'up':'down'}"><span class="material-icons-round">${chgD>=0?'arrow_upward':'arrow_downward'}</span>${Math.abs(chgD)}% vs tuần trước</div></div>
    <div class="kpi p"><div class="kpi-label">Tuần ${weeks[weeks.length-1]} W/h</div><div class="kpi-val">${lastW.wH}</div></div>`;

  function renderProd(){
    const sf=document.getElementById('prSlot').value,tf=document.getElementById('prType').value;
    const filter=d=>{let r=d;if(sf!=='all')r=r.filter(x=>x[2]===sf);if(tf!=='all')r=r.filter(x=>x[3]===tf);return r};
    const data=weeks.map(w=>{let d=filter(PROD_DATA.filter(x=>x[0]===w));if(!d.length)return{donH:0,wH:0};return{donH:+(d.reduce((a,x)=>a+x[9],0)/d.length).toFixed(2),wH:+(d.reduce((a,x)=>a+x[11],0)/d.length).toFixed(2)}});
    const lbls=weeks.map(w=>'Tuần '+w);
    dc('c9');CI.c9=new Chart(document.getElementById('c9'),{type:'line',data:{labels:lbls,datasets:[{label:'Đơn/h',data:data.map(d=>d.donH),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.15)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'#3b82f6'},{label:'TB',data:data.map(()=>avgDonH),borderColor:'#ef4444',borderDash:[5,5],pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Đơn/h'}}}}});
    dc('c10');CI.c10=new Chart(document.getElementById('c10'),{type:'line',data:{labels:lbls,datasets:[{label:'W/h (Kg)',data:data.map(d=>d.wH),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.15)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'#10b981'},{label:'TB',data:data.map(()=>avgWH),borderColor:'#f59e0b',borderDash:[5,5],pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Kg/h'}}}}});
  }
  document.getElementById('prSlot').onchange=renderProd;document.getElementById('prType').onchange=renderProd;renderProd();

  dc('c11');const dayShift=aggByWeek(d=>d.filter(x=>x[2]==='06h-18h')),nightShift=aggByWeek(d=>d.filter(x=>x[2]==='18h-06h'));
  CI.c11=new Chart(document.getElementById('c11'),{type:'bar',data:{labels:weeks.map(w=>'T'+w),datasets:[{label:'06h-18h',data:dayShift.map(d=>d.donH),backgroundColor:'#3b82f6cc',borderRadius:4},{label:'18h-06h',data:nightShift.map(d=>d.donH),backgroundColor:'#8b5cf6cc',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Đơn/h'}}}}});

  dc('c12');const rcv=aggByWeek(d=>d.filter(x=>x[3]==='receive')),dlv=aggByWeek(d=>d.filter(x=>x[3]==='deliver'));
  CI.c12=new Chart(document.getElementById('c12'),{type:'bar',data:{labels:weeks.map(w=>'T'+w),datasets:[{label:'Nhận hàng',data:rcv.map(d=>d.donH),backgroundColor:'#06b6d4cc',borderRadius:4},{label:'Giao hàng',data:dlv.map(d=>d.donH),backgroundColor:'#f59e0bcc',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{title:{display:true,text:'Đơn/h'}}}}});

  // === PROD ALERTS TABLE ===
  function pctBadge(cur,prev){if(!prev)return'<span class="chg flat">N/A</span>';const c=((cur-prev)/prev*100).toFixed(1);const cls=Math.abs(c)>5?(c>0?'up':'down'):'flat';return`<span class="chg ${cls}"><span class="material-icons-round">${c>=0?'arrow_upward':'arrow_downward'}</span>${c>=0?'+':''}${c}%</span>`}
  function tblWrap(icon,color,title,headers,rows){let h=`<div class="cmp-section"><div class="cmp-header"><span class="material-icons-round" style="color:var(--${color})">${icon}</span>${title}</div><table class="cmp-table"><thead><tr>`;headers.forEach(hd=>h+=`<th>${hd}</th>`);h+='</tr></thead><tbody>';rows.forEach(r=>{h+='<tr>';r.forEach(c=>h+=`<td>${c}</td>`);h+='</tr>'});return h+'</tbody></table></div>'}

  const lw=weeks[weeks.length-1],pwk=weeks[weeks.length-2];
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
  const pwDay=dayShift[dayShift.length-2],pwNight=nightShift[nightShift.length-2];
  shRows.push([`Ca ngày (06h-18h)`,`<span class="val">${pwDay.donH}</span>`,`<span class="val">${lwDay.donH}</span>`,pctBadge(lwDay.donH,pwDay.donH)]);
  shRows.push([`Ca đêm (18h-06h)`,`<span class="val">${pwNight.donH}</span>`,`<span class="val">${lwNight.donH}</span>`,pctBadge(lwNight.donH,pwNight.donH)]);
  shRows.push([`TB Ca ngày toàn kỳ`,`<span class="val">${dayAvg.toFixed(1)}</span>`,'','']);
  shRows.push([`TB Ca đêm toàn kỳ`,`<span class="val">${nightAvg.toFixed(1)}</span>`,'','']);
  prodHtml+=tblWrap('nights_stay','purple',`SO SÁNH CA LÀM VIỆC — Đơn/h`,['Ca',`T${pwk}`,`T${lw}`,'Biến động'],shRows);

  // Receive vs Deliver
  const rdRows=[];
  const lwRcv=rcv[rcv.length-1],lwDlv=dlv[dlv.length-1];
  const pwRcv=rcv[rcv.length-2],pwDlv=dlv[dlv.length-2];
  rdRows.push(['Nhận hàng',`<span class="val">${pwRcv.donH}</span>`,`<span class="val">${lwRcv.donH}</span>`,pctBadge(lwRcv.donH,pwRcv.donH)]);
  rdRows.push(['Giao hàng',`<span class="val">${pwDlv.donH}</span>`,`<span class="val">${lwDlv.donH}</span>`,pctBadge(lwDlv.donH,pwDlv.donH)]);
  rdRows.push([`TB Nhận toàn kỳ`,`<span class="val">${rcvAvg.toFixed(1)}</span>`,'','']);
  rdRows.push([`TB Giao toàn kỳ`,`<span class="val">${dlvAvg.toFixed(1)}</span>`,'','']);
  prodHtml+=tblWrap('swap_horiz','orange','SO SÁNH NHẬN / GIAO HÀNG — Đơn/h',['Loại',`T${pwk}`,`T${lw}`,'Biến động'],rdRows);

  document.getElementById('prodAlerts').innerHTML=prodHtml;
}

// Init
buildLT();buildCost();buildProd();
