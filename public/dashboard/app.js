// ============ CẤU HÌNH ============
// MỤC TIÊU (SLA) — leadtime & cost: THẤP hơn = tốt; năng suất: CAO hơn = tốt.
window.SLA = window.SLA || { leadtimeH: 5, costKg: 119, prodDonH: 100, prodWH: 190 };
// Bộ lọc khoảng thời gian toàn cục.
window.RANGE = window.RANGE || { mode: 'all', from: null, to: null };

// ---- Tiện ích ngày ----
function _parseISO(s){ return new Date(String(s).slice(0,10)+'T00:00:00'); }
function _parseDMY(s){ const p=String(s).split('/'); return new Date(+p[2],+p[1]-1,+p[0]); }
function _isoStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _dmy2iso(s){ const p=String(s).split('/'); return p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0'); }
function _addDays(iso,n){ const d=_parseISO(iso); d.setDate(d.getDate()+n); return _isoStr(d); }
function _mondayOf(iso){ const d=_parseISO(iso); const wd=(d.getDay()+6)%7; d.setDate(d.getDate()-wd); return _isoStr(d); }
function _isoWeekKey(iso){ const t=_parseISO(iso); t.setHours(0,0,0,0); t.setDate(t.getDate()+3-((t.getDay()+6)%7)); const w1=new Date(t.getFullYear(),0,4); const wk=1+Math.round(((t-w1)/864e5-(3-((w1.getDay()+6)%7)))/7); return t.getFullYear()*100+wk; }
const WD=['T2','T3','T4','T5','T6','T7','CN'];
function _dm(iso){ const p=iso.split('-'); return (+p[2])+'/'+(+p[1]); }
function fN(n){ return n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(0)+'K':String(Math.round(n)); }

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
function costInRange(){ const D=window.COST_DATA||{dates:[],costKg:[],cost:[],kg:[]}; const o={dates:[],costKg:[],cost:[],kg:[]}; (D.dates||[]).forEach((dt,i)=>{ if(inRange(_parseDMY(dt))){o.dates.push(dt);o.costKg.push((D.costKg||[])[i]);o.cost.push((D.cost||[])[i]);o.kg.push((D.kg||[])[i]);} }); return o; }

// ---- Nhóm ngày theo tuần ISO / tháng / tuần sự kiện ngày đôi ----
// Gom tuần theo SỐ TUẦN THỰC TẾ (cột B "Tuần" của Sheet, qua WEEK_MAP: ngày->số tuần).
// Nhãn = "Tuần X". Nếu ngày thiếu ánh xạ -> fallback theo ngày Thứ 7 cuối tuần.
function _weekEndSat(iso){ const d=_parseISO(iso); d.setDate(d.getDate()+(6-d.getDay())); return _isoStr(d); }
function _lastWeeks(dates,n){
  const WM=window.WEEK_MAP||{}; const by={};
  dates.forEach(d=>{
    const wk=WM[d]; let key,label;
    if(wk!=null){ key='W'+String(wk).padStart(3,'0'); label='Tuần '+wk; }
    else { const s=_weekEndSat(d); key='D'+s; label=_dm(s); }
    if(!by[key]) by[key]={dates:[],label}; by[key].dates.push(d);
  });
  const keys=Object.keys(by).sort((a,b)=>{ const ma=by[a].dates.slice().sort()[0], mb=by[b].dates.slice().sort()[0]; return ma<mb?-1:(ma>mb?1:0); });
  return keys.slice(-n).map(k=>({dates:by[k].dates,label:by[k].label}));
}
function _lastMonths(dates,n){
  const by={}; dates.forEach(d=>{const k=d.slice(0,7);(by[k]=by[k]||[]).push(d);});
  return Object.keys(by).sort().slice(-n).map(k=>({dates:by[k],label:(+k.slice(5,7))+'/'+k.slice(0,4)}));
}
function _eventWeeks(dates){
  const dset=new Set(dates);
  const years=[...new Set(dates.map(d=>+d.slice(0,4)))].sort();
  const res=[];
  years.forEach(y=>{ for(let m=1;m<=12;m++){ const mm=String(m).padStart(2,'0'); const start=y+'-'+mm+'-'+mm; const wd=[]; for(let i=0;i<7;i++){const dd=_addDays(start,i); if(dset.has(dd))wd.push(dd);} if(wd.length)res.push({dates:wd,label:m+'/'+m}); } });
  return res;
}

// ---- Chart.js ----
Chart.defaults.color='#8b9cc7';Chart.defaults.borderColor='rgba(42,53,80,.5)';Chart.defaults.font.family='Inter';Chart.defaults.font.size=11;
Chart.defaults.plugins.legend.labels.usePointStyle=true;

// Hiện số liệu ngay trên đầu mỗi cột (bỏ qua đường mục tiêu/TB).
function _fmtLbl(v){ if(v==null||v==='')return''; const n=+v; if(!isFinite(n))return String(v); if(Math.abs(n)>=1000)return (n/1000).toFixed(Math.abs(n)%1000===0?0:1)+'K'; return Number.isInteger(n)?String(n):n.toFixed(1); }
const valueLabels={ id:'valueLabels', afterDatasetsDraw(chart){ const ctx=chart.ctx; chart.data.datasets.forEach((ds,di)=>{ if(ds.type==='line')return; const meta=chart.getDatasetMeta(di); if(meta.hidden)return; meta.data.forEach((el,i)=>{ const v=ds.data[i]; const t=_fmtLbl(v); if(!t)return; ctx.save(); ctx.fillStyle='#dbe4ff'; ctx.font='600 10px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText(t, el.x, el.y-2); ctx.restore(); }); }); } };
Chart.register(valueLabels);

const CI={}; function dc(id){ if(CI[id]){CI[id].destroy();delete CI[id];} }
function _noData(name){ return '<div class="kpi b" style="grid-column:1/-1"><div class="kpi-label">'+name+'</div><div class="kpi-val" style="font-size:15px">Không có dữ liệu trong khoảng đã chọn</div></div>'; }

// Biểu đồ cột + đường mục tiêu
function _barTarget(id, labels, vals, target, unit, color){
  dc(id);
  const ds=[{label:'Giá trị', data:vals, backgroundColor:color, borderRadius:6}];
  if(target!=null) ds.push({label:'Mục tiêu ('+target+unit+')', data:labels.map(()=>target), type:'line', borderColor:'#10b981', borderDash:[8,4], borderWidth:2, pointRadius:0});
  CI[id]=new Chart(document.getElementById(id),{type:'bar',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:unit}}}}});
}
// Biểu đồ Ngày: cột nhóm tuần này vs tuần trước theo thứ (T2→CN)
function _dailyChart(id, metric, target, unit, dates){
  dc(id);
  if(!dates.length) return;
  const mon=_mondayOf(dates[dates.length-1]);
  const cur=[], prev=[];
  for(let i=0;i<7;i++){ cur.push(metric([_addDays(mon,i)])); prev.push(metric([_addDays(mon,i-7)])); }
  const ds=[
    {label:'Tuần này', data:cur, backgroundColor:'#3b82f6cc', borderRadius:5},
    {label:'Tuần trước', data:prev, backgroundColor:'#8b9cc766', borderRadius:5}
  ];
  if(target!=null) ds.push({label:'Mục tiêu', data:WD.map(()=>target), type:'line', borderColor:'#10b981', borderDash:[8,4], borderWidth:2, pointRadius:0});
  CI[id]=new Chart(document.getElementById(id),{type:'bar',data:{labels:WD,datasets:ds},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top'}},scales:{y:{title:{display:true,text:unit}}}}});
}
function _weeksChart(id, metric, target, unit, dates, n){ const w=_lastWeeks(dates,n||5); _barTarget(id, w.map(x=>x.label), w.map(x=>metric(x.dates)), target, unit, '#3b82f6cc'); }
function _eventChart(id, metric, target, unit, dates){ const e=_eventWeeks(dates); _barTarget(id, e.map(x=>'SK '+x.label), e.map(x=>metric(x.dates)), target, unit, '#f59e0bcc'); }
function _monthsChart(id, metric, target, unit, dates, n){ const m=_lastMonths(dates,n||4); _barTarget(id, m.map(x=>x.label), m.map(x=>metric(x.dates)), target, unit, '#8b5cf6cc'); }

// ---- Chỉ số theo tab (trả metric(dates)->số|null + dm + dates) ----
function _ltMetric(LT){
  const dm={}; LT.forEach(([s,dt,v,p,lt])=>{ if(!dm[dt])dm[dt]={vol:0,vl:0}; dm[dt].vol+=v; dm[dt].vl+=v*lt; });
  const dates=Object.keys(dm).sort();
  const metric= arr=>{ let vol=0,vl=0; arr.forEach(d=>{if(dm[d]){vol+=dm[d].vol;vl+=dm[d].vl;}}); return vol?+(vl/vol).toFixed(2):null; };
  const vol = arr=>{ let v=0; arr.forEach(d=>{if(dm[d])v+=dm[d].vol;}); return v; };
  return {dm,dates,metric,vol};
}
function _costMetric(C){
  // Cost/kg kỳ = Σ(Tổng chi phí)/Σ(KG). Ngày lẻ -> = cost/kg ngày đó (khớp cột H).
  const dm={};
  (C.dates||[]).forEach((dt,i)=>{
    const cost=(C.cost||[])[i], kg=(C.kg||[])[i];
    if(cost>0 && kg>0) dm[_dmy2iso(dt)]={cost,kg};
  });
  const dates=Object.keys(dm).sort();
  const metric= arr=>{ let c=0,k=0; arr.forEach(d=>{if(dm[d]){c+=dm[d].cost;k+=dm[d].kg;}}); return k?+(c/k).toFixed(1):null; };
  return {dm,dates,metric};
}
function _prodMetric(P,key){
  // Chỉ tính dòng có ĐỦ số liệu: giờ công >0 VÀ tử số (sản lượng / khối lượng) >0.
  // Dòng thiếu bị bỏ -> kỳ nào thiếu dữ liệu sẽ để trống thay vì hiện số sai lệch.
  const dm={};
  P.forEach(x=>{ const h=x[5]; if(!(h>0))return; const num=(key==='w')?x[6]:x[4]; if(!(num>0))return; const dt=x[1]; if(!dm[dt])dm[dt]={num:0,h:0}; dm[dt].num+=num; dm[dt].h+=h; });
  const dates=Object.keys(dm).sort();
  const metric= arr=>{ let n=0,h=0; arr.forEach(d=>{if(dm[d]){n+=dm[d].num;h+=dm[d].h;}}); return h?+(n/h).toFixed(2):null; };
  return {dm,dates,metric};
}
function _countPass(dates, metric, target, higher){
  let ok=0,tot=0; dates.forEach(d=>{ const v=metric([d]); if(v==null)return; tot++; if(higher?v>=target:v<=target)ok++; }); return {ok,tot};
}
function _kpiSla(cls,label,val,ok,tgt){ return '<div class="kpi '+cls+' '+(ok?'sla-ok':'sla-bad')+'"><div class="kpi-label">'+label+'</div><div class="kpi-val">'+val+'</div><div class="kpi-sla '+(ok?'ok':'bad')+'"><span class="material-icons-round">'+(ok?'check_circle':'error')+'</span>'+tgt+'</div></div>'; }
function _kpi(cls,label,val,sub){ return '<div class="kpi '+cls+'"><div class="kpi-label">'+label+'</div><div class="kpi-val">'+val+'</div>'+(sub?'<div class="kpi-chg up"><span class="material-icons-round">insights</span>'+sub+'</div>':'')+'</div>'; }

// ===== LEADTIME =====
function buildLT(){
  const S=window.SLA, LT=ltInRange();
  if(!LT.length){ document.getElementById('ltKpis').innerHTML=_noData('Leadtime'); ['c1','c2','c3','c4'].forEach(dc); return; }
  const {dates,metric,vol}=_ltMetric(LT);
  const overall=metric(dates), lastD=dates[dates.length-1], lastV=metric([lastD]);
  const pass=_countPass(dates,metric,S.leadtimeH,false);
  document.getElementById('ltKpis').innerHTML=
    _kpiSla('b','LT TB Có Trọng Số',overall+'h',overall<=S.leadtimeH,'Mục tiêu ≤ '+S.leadtimeH+'h')+
    _kpi('o','Ngày Gần Nhất '+_dm(lastD),lastV+'h')+
    _kpi('p','Tổng Đơn Toàn Kỳ',fN(vol(dates)))+
    _kpiSla('g','Số Ngày Đạt Mục Tiêu',pass.ok+'/'+pass.tot,pass.ok*2>=pass.tot,'LT ≤ '+S.leadtimeH+'h');
  _dailyChart('c1',metric,S.leadtimeH,'h',dates);
  _weeksChart('c2',metric,S.leadtimeH,'h',dates,5);
  _eventChart('c3',metric,S.leadtimeH,'h',dates);
  _monthsChart('c4',metric,S.leadtimeH,'h',dates,4);
}

// ===== COST =====
function buildCost(){
  const S=window.SLA, C=costInRange();
  const {dm,dates,metric}=_costMetric(C);
  if(!dates.length){ document.getElementById('costKpis').innerHTML=_noData('Cost'); ['c5','c6','c7','c8'].forEach(dc); return; }
  const overall=metric(dates), lastD=dates[dates.length-1], lastV=metric([lastD]);
  const vals=dates.map(d=>metric([d]));
  const mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);
  const pass=_countPass(dates,metric,S.costKg,false);
  document.getElementById('costKpis').innerHTML=
    _kpiSla('b','Cost/Kg TB',overall+'đ',overall<=S.costKg,'Mục tiêu ≤ '+S.costKg+'đ')+
    _kpi('o','Ngày Gần Nhất '+_dm(lastD),lastV+'đ')+
    _kpi('p','Min / Max',mn+' - '+mx+'đ')+
    _kpiSla('g','Số Ngày Đạt Mục Tiêu',pass.ok+'/'+pass.tot,pass.ok*2>=pass.tot,'Cost ≤ '+S.costKg+'đ');
  _dailyChart('c5',metric,S.costKg,'đ',dates);
  _weeksChart('c6',metric,S.costKg,'đ',dates,5);
  _eventChart('c7',metric,S.costKg,'đ',dates);
  _monthsChart('c8',metric,S.costKg,'đ',dates,4);
}

// ===== NĂNG SUẤT =====
function buildProd(){
  const S=window.SLA, P=prodInRange();
  if(!P.length){ document.getElementById('prodKpis').innerHTML=_noData('Năng suất'); ['c9','c10','c11','c12'].forEach(dc); return; }
  const D=_prodMetric(P,'don'), W=_prodMetric(P,'w');
  const dates=D.dates;
  const donAll=D.metric(dates), wAll=W.metric(dates);
  // tuần gần nhất
  const wk=_lastWeeks(dates,5), lastWk=wk[wk.length-1];
  const lastWkDon=lastWk?D.metric(lastWk.dates):0;
  const passW=(function(){let ok=0,tot=0;_lastWeeks(dates,999).forEach(x=>{const v=D.metric(x.dates);if(v==null)return;tot++;if(v>=S.prodDonH)ok++;});return{ok,tot};})();
  document.getElementById('prodKpis').innerHTML=
    _kpiSla('b','NS Đơn/h TB',donAll,donAll>=S.prodDonH,'Mục tiêu ≥ '+S.prodDonH)+
    _kpiSla('g','NS W/h TB',wAll,wAll>=S.prodWH,'Mục tiêu ≥ '+S.prodWH)+
    _kpi('o','Tuần Gần Nhất '+(lastWk?lastWk.label:''),lastWkDon+' đơn/h')+
    _kpiSla('p','Số Tuần Đạt Đơn/h',passW.ok+'/'+passW.tot,passW.ok*2>=passW.tot,'≥ '+S.prodDonH+' đơn/h');
  _dailyChart('c9',D.metric,S.prodDonH,'đơn/h',dates);
  _weeksChart('c10',D.metric,S.prodDonH,'đơn/h',dates,5);
  _eventChart('c11',D.metric,S.prodDonH,'đơn/h',dates);
  _monthsChart('c12',D.metric,S.prodDonH,'đơn/h',dates,4);
}

// ===== NHÂN SỰ (Tỷ lệ FL/NVCT) =====
function _hrMetric(H){
  // Tỷ lệ FL/NVCT kỳ = Σ(tỷ lệ ngày × NVCT ngày)/Σ(NVCT ngày) — weighted theo đầu người.
  const dm={}; (H.dates||[]).forEach((dt,i)=>{ const r=(H.fl||[])[i]; if(r!=null && !isNaN(r)) dm[dt]={r, w:(H.nvct||[])[i]||0}; });
  const dates=Object.keys(dm).sort();
  const metric= arr=>{ let sr=0,sw=0,sumr=0,n=0; arr.forEach(d=>{if(dm[d]){sr+=dm[d].r*dm[d].w;sw+=dm[d].w;sumr+=dm[d].r;n++;}}); if(sw>0)return +(sr/sw).toFixed(1); return n?+(sumr/n).toFixed(1):null; };
  return {dm,dates,metric};
}
function buildHR(){
  const S=window.SLA, H=window.HR_DATA||{dates:[],fl:[]};
  const {dm,dates,metric}=_hrMetric(H);
  if(!dates.length){ document.getElementById('nsKpis').innerHTML=_noData('Nhân sự'); ['ns1','ns2','ns3','ns4'].forEach(dc); return; }
  const tgt=(S&&S.flnvct)||null; // FL/NVCT: THẤP hơn = tốt
  const overall=metric(dates), lastD=dates[dates.length-1], lastV=metric([lastD]);
  const vals=dates.map(d=>metric([d])); const mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);
  const pass=tgt!=null?_countPass(dates,metric,tgt,false):null;
  document.getElementById('nsKpis').innerHTML=
    (tgt!=null?_kpiSla('b','Tỷ lệ FL/NVCT TB',overall+'%',overall<=tgt,'Mục tiêu ≤ '+tgt+'%'):_kpi('b','Tỷ lệ FL/NVCT TB',overall+'%'))+
    _kpi('o','Ngày Gần Nhất '+_dm(lastD),lastV+'%')+
    _kpi('p','Thấp / Cao',mn+'% - '+mx+'%')+
    (pass?_kpiSla('g','Số Ngày Đạt Mục Tiêu',pass.ok+'/'+pass.tot,pass.ok*2>=pass.tot,'≤ '+tgt+'%'):_kpi('g','Số Ngày Có Dữ Liệu',String(dates.length)));
  _dailyChart('ns1',metric,tgt,'%',dates);
  _weeksChart('ns2',metric,tgt,'%',dates,5);
  _eventChart('ns3',metric,tgt,'%',dates);
  _monthsChart('ns4',metric,tgt,'%',dates,4);
}

// ===== TỔNG QUAN =====
function buildOverview(){
  const S=window.SLA;
  const LT=_ltMetric(ltInRange()), C=_costMetric(costInRange()), D=_prodMetric(prodInRange(),'don'), W=_prodMetric(prodInRange(),'w');
  const ltAll=LT.dates.length?LT.metric(LT.dates):0;
  const cAll=C.dates.length?C.metric(C.dates):0;
  const dAll=D.dates.length?D.metric(D.dates):0;
  const wAll=W.dates.length?W.metric(W.dates):0;
  const okLT=ltAll>0&&ltAll<=S.leadtimeH, okC=cAll>0&&cAll<=S.costKg, okD=dAll>=S.prodDonH, okW=wAll>=S.prodWH;
  const HR=_hrMetric(window.HR_DATA||{dates:[],fl:[]});
  const hrAll=HR.dates.length?HR.metric(HR.dates):0;
  document.getElementById('ovKpis').innerHTML=
    _kpiSla('b','Leadtime TB (trọng số)',ltAll+'h',okLT,'Mục tiêu ≤ '+S.leadtimeH+'h')+
    _kpiSla('o','Cost / Kg TB',cAll+'đ',okC,'Mục tiêu ≤ '+S.costKg+'đ')+
    _kpiSla('g','Năng suất Đơn/h TB',dAll,okD,'Mục tiêu ≥ '+S.prodDonH)+
    _kpiSla('p','Năng suất W/h TB',wAll,okW,'Mục tiêu ≥ '+S.prodWH)+
    _kpiSla('b','Tỷ lệ FL/NVCT TB',hrAll+'%',hrAll>0&&hrAll<=(S.flnvct||20),'Mục tiêu ≤ '+(S.flnvct||20)+'%');
  function row(name,cur,tgt,ok){ return '<tr><td>'+name+'</td><td class="val">'+cur+'</td><td class="val">'+tgt+'</td><td>'+(ok?'<span class="sla ok"><span class="material-icons-round">check_circle</span>Đạt</span>':'<span class="sla bad"><span class="material-icons-round">error</span>Không đạt</span>')+'</td></tr>'; }
  document.getElementById('ovSla').innerHTML=
    '<div class="cmp-section"><table class="cmp-table"><thead><tr><th>Chỉ tiêu</th><th>Hiện tại</th><th>Mục tiêu</th><th>Trạng thái</th></tr></thead><tbody>'+
    row('Leadtime TB (giờ)',ltAll+'h','≤ '+S.leadtimeH+'h',okLT)+
    row('Cost/Kg TB (đ)',cAll+'đ','≤ '+S.costKg+'đ',okC)+
    row('Năng suất Đơn/h',dAll,'≥ '+S.prodDonH,okD)+
    row('Năng suất W/h (Kg/h)',wAll,'≥ '+S.prodWH,okW)+
    row('Tỷ lệ FL/NVCT (%)',hrAll+'%','≤ '+(S.flnvct||20)+'%',hrAll>0&&hrAll<=(S.flnvct||20))+
    '</tbody></table></div>';
  // Theo tuần (8 tuần) và theo tháng
  _weeksChart('ow1',LT.metric,S.leadtimeH,'h',LT.dates,8);
  _weeksChart('ow2',C.metric,S.costKg,'đ',C.dates,8);
  _weeksChart('ow3',D.metric,S.prodDonH,'đơn/h',D.dates,8);
  _weeksChart('ow4',W.metric,S.prodWH,'kg/h',W.dates,8);
  _monthsChart('om1',LT.metric,S.leadtimeH,'h',LT.dates,12);
  _monthsChart('om2',C.metric,S.costKg,'đ',C.dates,12);
  _monthsChart('om3',D.metric,S.prodDonH,'đơn/h',D.dates,12);
  _monthsChart('om4',W.metric,S.prodWH,'kg/h',W.dates,12);
}

// ===== XUẤT BÁO CÁO =====
function _activeTab(){ const t=document.querySelector('.tab.active'); return t?t.dataset.t:'ov'; }
function exportPNG(){
  const panel=document.getElementById(_activeTab());
  const cs=[...panel.querySelectorAll('canvas')].filter(c=>c.width&&c.height);
  if(!cs.length){ alert('Không có biểu đồ để xuất.'); return; }
  const pad=18, w=Math.max.apply(null,cs.map(c=>c.width))+pad*2, h=cs.reduce((a,c)=>a+c.height+pad,pad);
  const out=document.createElement('canvas'); out.width=w; out.height=h;
  const ctx=out.getContext('2d'); ctx.fillStyle='#0a0e1a'; ctx.fillRect(0,0,w,h);
  let y=pad; cs.forEach(c=>{ ctx.drawImage(c,pad,y); y+=c.height+pad; });
  const a=document.createElement('a'); a.href=out.toDataURL('image/png'); a.download='dashboard-'+_activeTab()+'.png'; a.click();
}
function _csv(rows){ return rows.map(r=>r.map(c=>{ c=String(c==null?'':c); return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c; }).join(',')).join('\n'); }
function _dl(name,text){ const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,%EF%BB%BF'+encodeURIComponent(text); a.download=name; a.click(); }
function exportCSV(){
  const t=_activeTab(); let rows=[];
  if(t==='lt'){ const m=_ltMetric(ltInRange()); rows=[['Tuần','Leadtime TB (h)']]; _lastWeeks(m.dates,999).forEach(w=>rows.push([w.label,m.metric(w.dates)])); }
  else if(t==='cost'){ const m=_costMetric(costInRange()); rows=[['Tuần','Cost/Kg TB (đ)']]; _lastWeeks(m.dates,999).forEach(w=>rows.push([w.label,m.metric(w.dates)])); }
  else if(t==='prod'){ const D=_prodMetric(prodInRange(),'don'), W=_prodMetric(prodInRange(),'w'); rows=[['Tuần','Đơn/h','W/h']]; _lastWeeks(D.dates,999).forEach(w=>rows.push([w.label,D.metric(w.dates),W.metric(w.dates)])); }
  else if(t==='ns'){ const m=_hrMetric(window.HR_DATA||{dates:[],fl:[]}); rows=[['Tuần','Tỷ lệ FL/NVCT TB (%)']]; _lastWeeks(m.dates,999).forEach(w=>rows.push([w.label,m.metric(w.dates)])); }
  else { const S=window.SLA,LT=_ltMetric(ltInRange()),C=_costMetric(costInRange()),D=_prodMetric(prodInRange(),'don'),W=_prodMetric(prodInRange(),'w'); rows=[['Chỉ tiêu','Hiện tại','Mục tiêu'],['Leadtime TB (h)',LT.dates.length?LT.metric(LT.dates):0,'<= '+S.leadtimeH],['Cost/Kg TB (đ)',C.dates.length?C.metric(C.dates):0,'<= '+S.costKg],['Đơn/h',D.dates.length?D.metric(D.dates):0,'>= '+S.prodDonH],['W/h',W.dates.length?W.metric(W.dates):0,'>= '+S.prodWH]]; }
  _dl('dashboard-'+t+'.csv',_csv(rows));
}

// ===== CORE / WIRING =====
setInterval(()=>{const e=document.getElementById('clk');if(e)e.textContent=new Date().toLocaleString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});},1000);
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');const p=document.getElementById(b.dataset.t);if(p)p.classList.add('active');});

function rebuildAll(){ [buildOverview,buildLT,buildCost,buildProd,buildHR].forEach(fn=>{try{fn();}catch(e){console.error(e);}}); }
window.rebuildAll=rebuildAll;
(function(){
  const gr=document.getElementById('gRange'),gf=document.getElementById('gFrom'),gt=document.getElementById('gTo');
  if(gr){
    gr.onchange=function(){ if(gr.value==='custom'){gf.style.display='';gt.style.display='';} else {gf.style.display='none';gt.style.display='none';window.RANGE={mode:gr.value,from:null,to:null};rebuildAll();} };
    const apply=()=>{ if(gr.value==='custom'){window.RANGE={mode:'custom',from:gf.value||null,to:gt.value||null};rebuildAll();} };
    if(gf)gf.onchange=apply; if(gt)gt.onchange=apply;
  }
  const png=document.getElementById('btnPng'),csv=document.getElementById('btnCsv'),pdf=document.getElementById('btnPdf');
  if(png)png.onclick=exportPNG; if(csv)csv.onclick=exportCSV; if(pdf)pdf.onclick=()=>window.print();
})();

// Init
rebuildAll();
