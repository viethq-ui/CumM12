// Đọc Google Sheet công khai qua CSV (gviz). Chạy được trên Cloudflare edge
// vì chỉ dùng `fetch` toàn cục — KHÔNG dùng googleapis/fs/path (chỉ có ở Node).
//
// Chống SSRF: CHỈ duy nhất Sheet ID trong env được phép đọc.
// Không bao giờ nhận ID/URL từ phía client.
const ALLOWED_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// --- Đọc qua CSV công khai (Sheet phải chia sẻ "Anyone with the link: Viewer") ---
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

async function getTabViaCsv(tab) {
  const url =
    `https://docs.google.com/spreadsheets/d/${ALLOWED_SHEET_ID}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { redirect: 'follow' });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('csv')) {
    throw new Error(
      `Không đọc được tab "${tab}" qua CSV (Sheet có thể đang riêng tư). ` +
        `Hãy bật chia sẻ "Anyone with the link: Viewer".`
    );
  }
  return parseCsv(await res.text());
}

// Đọc toàn bộ một tab (gồm cả dòng tiêu đề). Chỉ Sheet ID đã allowlist.
export async function getTab(tab) {
  if (!ALLOWED_SHEET_ID) throw new Error('Chưa cấu hình GOOGLE_SHEET_ID.');
  return getTabViaCsv(tab);
}
