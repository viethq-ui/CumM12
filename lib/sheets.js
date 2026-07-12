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

// Đọc toàn bộ một tab của MỘT sheetId đã allowlist (gồm cả dòng tiêu đề).
export async function getTab(tab, sheetId) {
  if (!sheetId || !ALLOWED_SHEET_IDS.has(sheetId)) {
    throw new Error('Sheet ID không hợp lệ / chưa được cho phép.');
  }
  // _cb + no-store: luôn đọc dữ liệu mới nhất (tránh Next.js/CDN cache lại bản cũ).
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_cb=${Date.now()}`;
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('csv')) {
    throw new Error(
      `Không đọc được tab "${tab}" qua CSV (Sheet có thể đang riêng tư). ` +
        `Hãy bật chia sẻ "Anyone with the link: Viewer".`
    );
  }
  return parseCsv(await res.text());
}
