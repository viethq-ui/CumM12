# GHN Operations Dashboard (real-time + bảo mật)

Dashboard vận hành GHN Miền Nam, dựng lại trên **Next.js**:

- Dữ liệu **real-time** từ Google Sheet (server tự đọc lại định kỳ, đẩy xuống trình duyệt qua SSE).
- **Đăng nhập Google** giới hạn email `@ghn.vn`.
- Áp dụng toàn bộ `security-rules.md`: security headers (CSP/HSTS/X-Frame-Options…), rate limit, chống SSRF (allowlist Sheet ID), không hardcode secret, không lộ stack trace, `noindex` cho trang nội bộ.

Giao diện + biểu đồ giữ nguyên bản gốc (`public/dashboard/`); chỉ thay nguồn dữ liệu và bọc bảo mật.

---

## 1. Cài đặt nhanh (local)

```bash
npm install
cp .env.example .env     # rồi điền giá trị thật (xem mục 2-4)
npm run dev              # mở http://localhost:3000
```

## 2. Tạo OAuth đăng nhập Google

1. Vào **Google Cloud Console** → tạo project (hoặc dùng project sẵn có).
2. **APIs & Services → OAuth consent screen**: chọn **Internal** (nếu là Google Workspace của ghn.vn) để chỉ người trong tổ chức dùng được.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → loại **Web application**.
   - **Authorized redirect URI**:
     - Local: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://DOMAIN-CUA-BAN/api/auth/callback/google`
4. Copy **Client ID / Client secret** vào `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

## 3. Tạo Service Account để đọc Sheet

1. Cùng project trên → **APIs & Services → Enable APIs** → bật **Google Sheets API**.
2. **IAM & Admin → Service Accounts → Create** → tạo key dạng **JSON**.
3. Trong file JSON lấy:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (giữ nguyên các `\n`, bọc trong dấu `"`).
4. **Mở Google Sheet → Share → mời `client_email` đó với quyền Viewer.** (Đây là cách server đọc được Sheet riêng tư mà không cần public.)
5. Lấy `GOOGLE_SHEET_ID` từ URL Sheet: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

## 4. Bố cục Google Sheet (quan trọng)

Server đọc 4 tab. Dòng 1 là tiêu đề, dữ liệu bắt đầu từ dòng 2. Đổi tên tab trong `.env` nếu cần.

| Tab (mặc định) | Cột A | B | C | D | E | … | J | … | L |
|---|---|---|---|---|---|---|---|---|---|
| **Leadtime** | slot (`0-6h`…) | date `YYYY-MM-DD` | volume | pct | lt | | | | |
| **Cost** | date `DD/MM/YYYY` | costKg | | | | | | | |
| **Productivity** | week (số) | date `YYYY-MM-DD` | slot (`06h-18h`/`18h-06h`) | type (`receive`/`deliver`) | … | | **đơn/h** | | **w/h** |
| **Notes** | key (`DD/MM/YYYY` hoặc `Tháng x`) | nội dung ghi chú | | | | | | | |

> Productivity cần đủ 12 cột **A→L**; cột **J** = năng suất đơn/h, cột **L** = năng suất kg/h (đúng như dữ liệu gốc). Nếu sheet của bạn xếp khác, sửa lại ánh xạ trong `lib/transform.js`.

`NEXTAUTH_SECRET`: tạo bằng `openssl rand -base64 32`.

---

## 5. Deploy lên server (PM2)

Trên server đã có Node ≥ 18 và PM2:

```bash
git clone <repo>  ghn-dashboard   # hoặc copy thư mục lên server
cd ghn-dashboard
npm ci                            # hoặc npm install
# tạo .env trên server với giá trị production (NEXTAUTH_URL = https://domain-thật)
npm run build
pm2 start npm --name "web-dashboard" -- start -- -p 1234
pm2 save
```

Cập nhật về sau:

```bash
git pull
npm install
npm run build
pm2 restart web-dashboard
```

Nếu tiến trình cũ lỗi:

```bash
pm2 delete web-dashboard
pm2 start npm --name "web-dashboard" -- start -- -p 1234
pm2 save
```

### HTTPS / domain
App chạy HTTP ở cổng 1234. Đặt **Nginx (hoặc Caddy)** phía trước để cấp **HTTPS** và proxy về `127.0.0.1:1234`. Bắt buộc HTTPS thì HSTS, cookie `Secure`, và `upgrade-insecure-requests` mới có hiệu lực. Với SSE, thêm vào Nginx:

```nginx
location /api/stream {
    proxy_pass http://127.0.0.1:1234;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_read_timeout 1h;
}
```

`NEXTAUTH_URL` phải đúng domain https công khai, và redirect URI tương ứng đã khai trong Google OAuth (mục 2).

---

## Kiến trúc

```
app/login                  trang đăng nhập Google
app/api/auth/[...nextauth] NextAuth (Google, chặn theo domain @ghn.vn)
app/api/data               trả snapshot dữ liệu (cần đăng nhập, rate-limit)
app/api/stream             SSE đẩy dữ liệu mỗi lần Sheet đổi
lib/sheets.js              đọc Sheet bằng service account (allowlist 1 Sheet ID)
lib/transform.js           Sheet -> LT_DATA/COST_DATA/PROD_DATA/NOTES_DATA
lib/store.js               cache + vòng lặp làm mới + phát SSE
lib/ratelimit.js           giới hạn request per-IP
middleware.js              cổng đăng nhập + CSP (nonce) + security headers
public/dashboard/          giao diện gốc + boot.js (nạp dữ liệu real-time)
```

## Đối chiếu với `security-rules.md`

- **Auth/Authz**: mọi trang & API dữ liệu nội bộ đứng sau đăng nhập Google domain `@ghn.vn`; danh tính lấy từ session phía server, không tin ID từ client.
- **Secrets**: toàn bộ key đọc từ env (`.env` không commit); không log/không trả secret.
- **CSRF & Session**: cookie `HttpOnly` + `Secure` + `SameSite=Lax`; NextAuth có CSRF cho luồng đăng nhập; API dữ liệu chỉ `GET` (không đổi trạng thái).
- **Transport**: HSTS bật; chạy sau Nginx HTTPS (xem mục 5).
- **Security headers**: CSP (`default-src 'self'` + nonce), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` đã tắt.
- **Rate limiting**: per-IP, trả `429` + `Retry-After`.
- **Data exposure / SSRF**: chỉ trả đúng dữ liệu dashboard; không lộ stack trace; `noindex`; chỉ đọc đúng **một** Sheet ID đã allowlist, không nhận URL/ID từ người dùng.
