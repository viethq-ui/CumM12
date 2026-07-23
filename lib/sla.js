// Tính các chỉ số SLA tổng (toàn kỳ) cho một kho — dùng CÙNG công thức weighted
// như bảng "Trạng Thái Mục Tiêu (SLA)" ở tab Tổng quan (app.js buildOverview).
export function computeSla(data, sla) {
  sla = sla || {};

  // Leadtime TB có trọng số = Σ(volume × leadtime) / Σ(volume)
  let v = 0, vl = 0;
  (data.LT_DATA || []).forEach((r) => { v += r[2]; vl += r[2] * r[4]; });
  const leadtime = v ? +(vl / v).toFixed(2) : 0;

  // Cost/kg = Σ(Tổng chi phí) / Σ(KG)
  const C = data.COST_DATA || { dates: [], cost: [], kg: [] };
  let c = 0, kg = 0;
  (C.dates || []).forEach((dt, i) => {
    const cc = (C.cost || [])[i] || 0, k = (C.kg || [])[i] || 0;
    if (cc > 0 && k > 0) { c += cc; kg += k; }
  });
  const costKg = kg ? +(c / kg).toFixed(1) : 0;

  // Năng suất Đơn/h = Σ(sản lượng) / Σ(giờ công); W/h = Σ(khối lượng) / Σ(giờ công)
  let dv = 0, dh = 0, wv = 0, wh = 0;
  (data.PROD_DATA || []).forEach((x) => {
    const h = x[5];
    if (h > 0) {
      if (x[4] > 0) { dv += x[4]; dh += h; }
      if (x[6] > 0) { wv += x[6]; wh += h; }
    }
  });
  const donH = dh ? +(dv / dh).toFixed(2) : 0;
  const wH = wh ? +(wv / wh).toFixed(2) : 0;

  // FL/NVCT = Σ(tỷ lệ ngày × NVCT ngày) / Σ(NVCT ngày)
  const H = data.HR_DATA || { dates: [], fl: [], nvct: [] };
  let hr = 0, hwt = 0, hsum = 0, hn = 0;
  (H.dates || []).forEach((dt, i) => {
    const r = (H.fl || [])[i]; const w = (H.nvct || [])[i] || 0;
    if (r != null && !isNaN(r)) { hr += r * w; hwt += w; hsum += r; hn++; }
  });
  const flnvct = hwt ? +(hr / hwt).toFixed(1) : (hn ? +(hsum / hn).toFixed(1) : 0);

  return {
    leadtime, costKg, donH, wH, flnvct,
    ok: {
      leadtime: leadtime > 0 && sla.leadtimeH != null && leadtime <= sla.leadtimeH,
      costKg: costKg > 0 && sla.costKg != null && costKg <= sla.costKg,
      donH: sla.prodDonH != null && donH >= sla.prodDonH,
      wH: sla.prodWH != null && wH >= sla.prodWH,
      flnvct: flnvct > 0 && sla.flnvct != null && flnvct <= sla.flnvct,
    },
  };
}
