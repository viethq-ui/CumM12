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

// Số THÔNG MINH: nhận cả US ("63,536" / "118.32") lẫn VN ("76.241,0" / "124.978").
// Dùng cho tab Năng suất vì Sheet đổi định dạng giữa chừng (tháng 4 trở đi dùng VN).
function smartNum(v) {
  if (typeof v === 'number') return v;
  let s = str(v).replace(/%/g, '').replace(/\s/g, '');
  if (!s) return 0;
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // Dấu bên phải là thập phân, dấu còn lại là ngăn nghìn.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); // VN
    else s = s.replace(/,/g, ''); // US
  } else if (hasComma) {
    const p = s.split(',');
    if (p.length > 2) s = s.replace(/,/g, ''); // 1,234,567 ngăn nghìn
    else if (p[1] && p[1].length === 3) s = p.join(''); // "63,536" -> 63536
    else s = s.replace(',', '.'); // thập phân "118,32"
  } else if (hasDot) {
    const p = s.split('.');
    if (p.length > 2) s = s.replace(/\./g, ''); // 1.234.567 ngăn nghìn (VN)
    else if (p[1] && p[1].length === 3) s = p.join(''); // "124.978" -> 124978 (VN nghìn)
    // còn lại giữ thập phân: "118.32", "537.0"
  }
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

// Bảng Nhân sự dùng tiêu đề cột dạng "Thứ 2 1-Jun" / "Chủ nhật 12-Jul" (không có năm).
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function hdrToIso(h, year) {
  const m = str(h).match(/(\d{1,2})\s*-\s*([A-Za-z]{3})/);
  if (!m) return null;
  const mon = MON[m[2].toLowerCase()];
  if (!mon) return null;
  return `${year}-${String(mon).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}

export async function buildDashboardData(wh) {
  if (!wh || !wh.sheetId) throw new Error('Thiếu cấu hình kho.');
  const sid = wh.sheetId;
  const [ltRows, costRows, prodRows] = await Promise.all([
    getTab(TAB.lt, sid),
    getTab(TAB.cost, sid),
    getTab(TAB.prod, sid),
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
  const p = wh.prod || { slot: 3, type: 4, labH: 8, totVol: 9, donH: 10, weight: 11, wH: 12, week: 13 };
  const col = (r, i) => (i >= 0 ? r[i] : undefined);
  const PROD_DATA = prodRows
    .slice(1)
    .filter((r) => hasDate(r, 2) && (p.type < 0 || str(r[p.type])))
    .map((r) => {
      const week = p.week >= 0 ? smartNum(col(r, p.week)) : 0;
      const slot = p.slot >= 0 ? cleanSlot(col(r, p.slot)) : '';
      const type = p.type >= 0 ? str(col(r, p.type)) : '';
      const labH = smartNum(col(r, p.labH)); // Số giờ công
      const totVol = smartNum(col(r, p.totVol)); // Tổng sản lượng (đơn)
      const weight = smartNum(col(r, p.weight)); // Khối lượng (Kg)
      const donH = p.donH >= 0 ? smartNum(col(r, p.donH)) : 0;
      const wH = p.wH >= 0 ? smartNum(col(r, p.wH)) : 0;
      return [week, dmyToIso(r[2]), slot, type, totVol, labH, weight, 0, 0, donH, 0, wH];
    });

  // --- Notes (tuỳ chọn) ---
  let NOTES_DATA = {};
  try {
    const noteRows = await getTab(TAB.notes, sid);
    for (const r of noteRows.slice(1)) {
      const k = str(r[0]);
      if (k) NOTES_DATA[k] = str(r[1]);
    }
  } catch {
    NOTES_DATA = {}; // không có tab Notes -> bỏ qua
  }

  // --- Nhân sự: Tỷ lệ FL/NVCT theo ngày (bảng ma trận) ---
  // Năm suy ra từ dữ liệu Leadtime (tiêu đề cột Nhân sự chỉ có ngày-tháng).
  let year = new Date().getFullYear();
  const ys = LT_DATA.map((r) => +String(r[1]).slice(0, 4)).filter((y) => y > 2000);
  if (ys.length) year = Math.max(...ys);

  let HR_DATA = { dates: [], fl: [] };
  if (wh.hr && wh.hr.tab) {
    try {
      const hrRows = await getTab(wh.hr.tab, sid);
      const header = hrRows[0] || [];
      const dateCols = [];
      header.forEach((h, i) => { const iso = hdrToIso(h, year); if (iso) dateCols.push({ i, iso }); });
      const target = str(wh.hr.row).toUpperCase();
      const flRow = hrRows.find((r) => str(r[7]).toUpperCase().includes(target)); // cột H = index 7
      if (flRow && dateCols.length) {
        const map = {};
        for (const { i, iso } of dateCols) {
          const v = flRow[i];
          if (v != null && str(v) !== '') map[iso] = vnNum(v); // "26%" -> 26
        }
        const dates = Object.keys(map).sort();
        HR_DATA = { dates, fl: dates.map((d) => map[d]) };
      }
    } catch {
      HR_DATA = { dates: [], fl: [] };
    }
  }

  return { LT_DATA, COST_DATA, PROD_DATA, NOTES_DATA, HR_DATA };
}
