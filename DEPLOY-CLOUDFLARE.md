# Deploy lên Cloudflare Pages (`.pages.dev`)

App đã được port sang **edge runtime** để chạy trên Cloudflare Pages, **giữ nguyên đăng nhập**.
Real-time giờ dùng **client polling** `/api/data` mỗi 20s (thay cho SSE, vì edge không có tiến trình nền).

> Máy bạn hiện **chưa cài Node.js chuẩn** (không có `npm`). Cài trước rồi mới làm được các bước dưới.

---

## 0. Cài Node.js (một lần)

Tải **Node.js v22 LTS** từ https://nodejs.org rồi cài. Mở terminal mới, kiểm tra:

```bash
node -v   # v22.x
npm -v
```

## 1. Cài dependencies

```bash
cd C:\code\dashboard
npm install
```

Việc port đã: bỏ `googleapis` (đọc Sheet qua CSV công khai), bỏ SSE + vòng lặp nền,
chuyển các route sang edge. `npm install` sẽ kéo thêm `@cloudflare/next-on-pages` + `wrangler`.

## 2. Build thử (đã xác minh) & lưu ý Windows

`next build` thường đã **build thành công** và test end-to-end đăng nhập + đọc Sheet đã pass.

> ⚠️ **`npm run pages:build` KHÔNG chạy được trên Windows** — `@cloudflare/next-on-pages`
> cần `bash` (lỗi `spawn bash ENOENT`). Đây là hạn chế của công cụ, không phải lỗi code.
> Vì vậy **hãy deploy qua Git (mục 3)** để Cloudflare tự build trên môi trường Linux.
> Nếu muốn build/preview tại máy: cài **WSL** rồi chạy `npm run pages:build` trong WSL.

## 3. Deploy qua Git (khuyến nghị cho Windows)

Đây là cách gọn nhất: Cloudflare tự build trên Linux nên không dính lỗi `bash`.

1. Đẩy thư mục `dashboard/` lên một repo GitHub (giữ `.gitignore` — **không** commit `.env*`).
2. Vào **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**, chọn repo.
3. Cấu hình build:
   - **Build command:** `npx @cloudflare/next-on-pages`
   - **Build output directory:** `.vercel/output/static`
4. Thêm compatibility flag `nodejs_compat` (mục 5) + biến môi trường (mục 4), rồi **Save and Deploy**.
5. Nhận URL dạng `https://ghn-dashboard.pages.dev`.

**Cách khác (cần WSL/macOS/Linux) — deploy trực tiếp bằng wrangler:**

```bash
npx wrangler login   # mở trình duyệt xác thực — bạn tự làm
npm run deploy
```

## 4. Đặt biến môi trường trên Cloudflare (BẮT BUỘC)

Vào **Pages project → Settings → Variables and Secrets** (cho cả *Production* và *Preview*).
Đánh dấu các giá trị nhạy cảm là **Secret**:

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `NEXTAUTH_URL` | `https://ghn-dashboard.pages.dev` | Đúng domain thật. Chỉ dùng để bật cookie `Secure` khi https |
| `NEXTAUTH_SECRET` | chuỗi random | Khóa **ký cookie phiên (HMAC)**. Tạo bằng `openssl rand -base64 32` — **đổi khác** giá trị trong `.env` |
| `DASHBOARD_PASSWORD` | mật khẩu chung mới | **KHÔNG dùng lại** `ghn@2026` |
| `GOOGLE_SHEET_ID` | `1ANQbBZ7...` | Sheet phải bật "Anyone with the link: Viewer" |
| `SHEET_TAB_LEADTIME` | `LEADTIME` | |
| `SHEET_TAB_COST` | `COST` | |
| `SHEET_TAB_PROD` | `Năng suất` | |
| `SHEET_TAB_NOTES` | `Notes` | |
| `NODE_ENV` | `production` | Cloudflare thường tự đặt |

> Sau khi đổi biến, **Retry deployment** để áp dụng.
> Bản Cloudflare **chỉ đăng nhập bằng mật khẩu chung** (không còn Google OAuth — xem mục cuối).

## 5. Bật `nodejs_compat`

Đã khai trong `wrangler.toml` (dùng cho `wrangler deploy`). Nếu deploy qua **Git**,
thêm thủ công: **Settings → Runtime → Compatibility flags** → thêm `nodejs_compat`
cho cả Production và Preview.

---

## Điểm khác so với bản Node (PM2) gốc

- **Đăng nhập:** NextAuth v4 **không chạy trên edge** (cần Node `crypto`), nên đã thay bằng
  auth nhẹ tự viết (`lib/session.js`): mật khẩu chung → cookie phiên ký HMAC-SHA256 (Web Crypto).
  → **Bỏ đăng nhập Google `@ghn.vn`.** Cần Google lại thì phải nâng NextAuth v5 (Auth.js) hoặc
  đặt trước **Cloudflare Access**. Cổng đăng nhập bằng mật khẩu vẫn giữ nguyên mức bảo vệ.
- **SSE → polling:** trình duyệt tự gọi lại `/api/data` mỗi 20s. Sửa `POLL_MS` trong
  `public/dashboard/boot.js` nếu muốn nhanh/chậm hơn.
- **Đọc Sheet:** chỉ qua CSV công khai (`lib/sheets.js`). Không còn service account.
  → Sheet **bắt buộc** ở chế độ chia sẻ công khai read-only.
- **Rate limit:** best-effort (mỗi edge isolate có RAM riêng), không chống được tấn công phân tán.
- **Không còn cache/vòng lặp nền:** mỗi request tự đọc Sheet. Sheet nhỏ nên chi phí thấp.

## Đã xác minh cục bộ ✅

`next build` pass; chạy `next start` và test: chưa đăng nhập → `/api/data` trả **401** và `/`
redirect **307** về `/login`; đăng nhập đúng mật khẩu → set cookie `ghn_session` → `/api/data`
trả **200** kèm dữ liệu Sheet thật. Việc còn lại chỉ là bước build+deploy trên Cloudflare (mục 3).

> Bản Node cũ (NextAuth + Google + SSE + service account) deploy bằng PM2 + Nginx
> (xem `DEPLOY.md`) vẫn dùng được nếu muốn quay lại.
