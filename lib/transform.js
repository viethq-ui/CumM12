// Chuyển dữ liệu thô từ Google Sheet sang đúng cấu trúc dashboard cần
// (LT_DATA / COST_DATA / PROD_DATA / NOTES_DATA).
//
// Ánh xạ theo CẤU TRÚC THẬT của Sheet (đã đối chiếu trực tiếp):
//
//  Tab LEADTIME:  A Tháng | B Tuần | C Ngày(DD/MM/YYYY) | D Móc giờ | E Time
//                 | F Sản lượng | G Tỷ lệ | H LeadTime
//  Tab COST:      A Tháng | B Tuần | C Ngày(DD/MM/YYYY) | D KG/ngày | E Chi phí FL
//                 | F Tổng lương | G Tổng chi phí | H Cost/kg
//  Tab Năng suất: A Tháng | B Week | C Ngày(YYYY-MM-DD) | D Khung giờ | E type
//                 | F Đơn nhỏ | G Cồng kềnh | H volume_package | I Số giờ công
//                 | J Tổng SL | K Năng suất(Đơn/h) | L Khối lượng | M Năng suất(W/h)
//                 | N Week_Sort
//
// Số liệu hỗ trợ cả 2 nguồn: API (số thật) và CSV (chuỗi). LEADTIME/COST dùng
// định dạng VN (',' thập phân, '.' nghìn); Năng suất dùng định dạng US ('.' thập phân).

import { getTab } from '@/lib/sheets';

const TAB = {
  lt: process.env.SHEET_TAB_LEADTIME || 'LEADTIME',
  cost: process.env.SHEET_TAB_COST || 'COST',
  prod: process.env.SHEET_TAB_PROD || 'Năng suất',
  notes: process.env.SHEET_TAB_NOTES || 'Notes',
};

const str = (v) => (v == null ? '' : String(v).trim());

// Số kiểu Việt: "1.062.923" -> 1062923 ; "67,99%" -> 67.99
function vnNum(v) {
  if (typeof v === 'number') return v;
  let s = str(v).replace(/%/g, '').replace(/\s/g, '');
  if (!s) return 0;
  s = s.replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Số kiểu US: "118.32" -> 118.32 ; "59,174" -> 59174
function usNum(v) {
  if (typeof v === 'number') return v;
  let s = str(v).replace(/%/g, '').replace(/\s/g, '').replace(/,/g, '');
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// "01/03/2026" -> "2026-03-01" ; nếu đã ISO thì giữ nguyên.
function dmyToIso(v) {
  const s = str(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

// "1.0 - 6h"->"0-6h", "2.6 - 12h"->"6-12h", "3.12 - 24h"->"12-24h", "4.>24h"->">24h"
// "1. 06h-18h"->"06h-18h", "2. 18h-06h"->"18h-06h"
function cleanSlot(v) {
  return str(v).replace(/^\d+\.\s*/, '').replace(/\s/g, '');
}

const hasDate = (r, i) => r && str(r[i]) !== '';

export async function buildDashboardData() {
  const [ltRows, costRows, prodRows] = await Promise.all([
    getTab(TAB.lt),
    getTab(TAB.cost),
    getTab(TAB.prod),
  ]);

  // --- LEADTIME --- (bỏ dòng tiêu đề)
  const LT_DATA = ltRows
    .slice(1)
    .filter((r) => hasDate(r, 2) && str(r[3]))
    .map((r) => [cleanSlot(r[3]), dmyToIso(r[2]), vnNum(r[5]), vnNum(r[6]), vnNum(r[7])]);

  // --- COST ---
  const dates = [];
  const costKg = [];
  for (const r of costRows.slice(1)) {
    if (!hasDate(r, 2)) continue;
    dates.push(str(r[2])); // giữ DD/MM/YYYY như dashboard mong đợi
    costKg.push(vnNum(r[7]));
  }
  const COST_DATA = { dates, costKg };

  // --- Năng suất ---
  // Layout PROD_DATA: [week, date, slot, type, totVol, labH, weight, 0, 0, donH, 0, wH]
  //   index 4 = Tổng sản lượng (đơn), 5 = Số giờ công, 6 = Khối lượng (Kg)
  //   index 9 = Đơn/h theo dòng, 11 = W/h theo dòng (giữ để tương thích).
  // Năng suất theo tuần được tính lại ở app.js: Σ(totVol)/Σ(labH) và Σ(weight)/Σ(labH).
  const PROD_DATA = prodRows
    .slice(1)
    .filter((r) => hasDate(r, 2) && str(r[4]))
    .map((r) => {
      const week = usNum(r[13]); // Week_Sort
      const slot = cleanSlot(r[3]); // Khung giờ
      const type = str(r[4]); // receive/deliver
      const labH = usNum(r[8]); // Số giờ công đáp ứng
      const totVol = usNum(r[9]); // Tổng sản lượng (đơn)
      const weight = usNum(r[11]); // Khối lượng (Kg)
      const donH = usNum(r[10]); // Năng suất (Đơn/h) theo dòng
      const wH = usNum(r[12]); // Năng suất (W/h) theo dòng
      return [week, dmyToIso(r[2]), slot, type, totVol, labH, weight, 0, 0, donH, 0, wH];
    });

  // --- Notes (tuỳ chọn) ---
  let NOTES_DATA = {};
  try {
    const noteRows = await getTab(TAB.notes);
    for (const r of noteRows.slice(1)) {
      const k = str(r[0]);
      if (k) NOTES_DATA[k] = str(r[1]);
    }
  } catch {
    NOTES_DATA = {}; // không có tab Notes -> bỏ qua
  }

  return { LT_DATA, COST_DATA, PROD_DATA, NOTES_DATA };
}
