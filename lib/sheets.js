// Đọc Google Sheet công khai qua CSV (gviz). Chạy được trên Cloudflare edge
// vì chỉ dùng `fetch` toàn cục — KHÔNG dùng googleapis/fs/path (chỉ có ở Node).
//
// Chống SSRF: CHỈ các sheetId đã khai trong lib/warehouses.js mới được đọc.
// Không bao giờ nhận ID/URL từ phía client (client chỉ gửi "key" của kho).
import { ALLOWED_SHEET_IDS } from '@/lib/warehouses';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* bỏ qua */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Đọc toàn bộ một tab của MỘT sheetId đã allowlist (gồm cả dòng tiêu đề).
// Có THỬ LẠI vì gviz đọc từ Cloudflare thỉnh thoảng lỗi/bị giới hạn tần suất.
export async function getTab(tab, sheetId) {
  if (!sheetId || !ALLOWED_SHEET_IDS.has(sheetId)) {
    throw new Error('Sheet ID không hợp lệ / chưa được cho phép.');
  }
  const base =
    `https://docs.google.com/spreadsheets/d/${sheetId}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  // Chỉ thêm _cb chống cache khi chạy LOCAL (dev). Trên production dùng cache của
  // gviz cho ỔN ĐỊNH (ép đọc mới mỗi lần khiến Google giới hạn -> lỗi chập chờn).
  const dev = process.env.NODE_ENV !== 'production';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const url = dev ? `${base}&_cb=${Date.now()}` : base;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('csv')) {
        const text = await res.text();
        if (text && text.trim()) return parseCsv(text);
        lastErr = new Error('body rỗng');
      } else {
        lastErr = new Error(`HTTP ${res.status}, ct=${ct}`);
      }
    } catch (e) {
      lastErr = e;
    }
    if (attempt < 4) await sleep(300 * attempt);
  }
  throw new Error(`Không đọc được tab "${tab}" sau 4 lần thử: ${(lastErr && lastErr.message) || lastErr}`);
}
