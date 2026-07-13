// Danh sách kho. Mỗi kho là 1 Google Sheet (công khai, đọc qua CSV).
// Chống SSRF: CHỈ các sheetId liệt kê ở đây mới được phép đọc.
//
// `prod` = ánh xạ cột của tab "Năng suất" (khác nhau giữa các kho).
//   Chỉ số là vị trí cột (0 = cột A). Đặt -1 nếu kho không có cột đó.
//   labH = Số giờ công, totVol = Tổng sản lượng (đơn), weight = Khối lượng (Kg).
// LEADTIME và COST hiện dùng chung cấu trúc (date=cột C, cost/kg=cột H, v.v.).

const WAREHOUSES = [
  {
    key: 'hcm20',
    name: 'KTC HCM 20',
    sheetId: '1ANQbBZ7UukF4l4il6dVMO0z6Sdql9rQz14mLCb45oJw',
    prod: { slot: 3, type: 4, labH: 8, totVol: 9, donH: 10, weight: 11, wH: 12, week: 13 },
    sla: { leadtimeH: 5, costKg: 119, prodDonH: 100, prodWH: 190 },
    // Nhân sự: tab dạng ma trận; dòng có cột H chứa `row` là tỷ lệ FL/NVCT tổng của kho.
    hr: { tab: 'Nhân sự HCM 20', row: 'FL/NVCT HCM 20' },
  },
  {
    key: 'songthan',
    name: 'KCT Sóng Thần',
    sheetId: '1qmZUMU47-s6PKxSqolx8OrYhaY8KMCSIZB0FVekwnzw',
    prod: { slot: -1, type: -1, labH: 3, totVol: 4, donH: 6, weight: 7, wH: 8, week: -1 },
    sla: { leadtimeH: 3, costKg: 119, prodDonH: 45, prodWH: 420 },
    hr: { tab: 'Nhân sự ST', row: 'FL/NVCT ST' },
  },
];

// Cho phép nạp đè bằng biến môi trường WAREHOUSES (JSON) nếu cần.
function load() {
  const raw = process.env.WAREHOUSES;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {
      /* dùng mặc định bên dưới */
    }
  }
  return WAREHOUSES;
}

const LIST = load();
export const ALLOWED_SHEET_IDS = new Set(LIST.map((w) => w.sheetId));

export function listWarehouses() {
  return LIST.map((w) => ({ key: w.key, name: w.name, sla: w.sla || null }));
}
export function warehouseFor(key) {
  return LIST.find((w) => w.key === key) || LIST[0] || null;
}
export function defaultKey() {
  return LIST[0] ? LIST[0].key : null;
}
