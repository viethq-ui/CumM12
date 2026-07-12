# Deploy lên VPS (PM2, cổng 1235)

## 0. Điều kiện tiên quyết (QUAN TRỌNG)
Ở production, đăng nhập Google là **bắt buộc** (cờ dev-bypass tự tắt). Cần:
- Một **tên miền** trỏ về VPS (vd `dashboard.ghn.vn`) + **HTTPS** (Nginx/Caddy).
- **Google OAuth**: tạo OAuth client (Web), khai **Authorized redirect URI**:
  `https://dashboard.ghn.vn/api/auth/callback/google`
- Lấy `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

> Nếu CHƯA có domain + OAuth: chưa nên mở ra internet. Nhắn lại để mình thêm chế độ
> truy cập nội bộ tạm thời (mật khẩu chung) — KHÔNG dùng dev-bypass ở production.

## 1. Đưa code lên VPS
```bash
cd /var/www                      # thư mục tuỳ bạn
git clone <repo> ghn-dashboard   # hoặc rsync/scp cả thư mục lên
cd ghn-dashboard
npm ci                           # hoặc: npm install
```

## 2. Tạo file .env (production) — KHÔNG copy .env.local của máy dev
Tạo `/var/www/ghn-dashboard/.env`:
```
NEXTAUTH_URL=https://dashboard.ghn.vn
NEXTAUTH_SECRET=<chạy: openssl rand -base64 32>

GOOGLE_CLIENT_ID=<từ Google OAuth>
GOOGLE_CLIENT_SECRET=<từ Google OAuth>
ALLOWED_EMAIL_DOMAIN=ghn.vn

GOOGLE_SHEET_ID=1ANQbBZ7UukF4l4il6dVMO0z6Sdql9rQz14mLCb45oJw
SHEET_TAB_LEADTIME=LEADTIME
SHEET_TAB_COST=COST
SHEET_TAB_PROD=Năng suất
SHEET_TAB_NOTES=Notes
REFRESH_MS=20000

# (Khuyến nghị) để Sheet về Private rồi bật service account:
# GOOGLE_SERVICE_ACCOUNT_KEY_FILE=service-account.json
```
Lưu ý: KHÔNG đặt `DEV_AUTH_BYPASS` ở production.

## 3. Build & chạy PM2 (cổng 1235)
Lần đầu:
```bash
npm run build
pm2 start npm --name "web-dashboard" -- start -- -p 1235
pm2 save
```

Nếu tiến trình cũ lỗi, xoá rồi tạo lại:
```bash
pm2 delete web-dashboard
npm run build
pm2 start npm --name "web-dashboard" -- start -- -p 1235
pm2 save
```

## 4. Cập nhật về sau (reset)
```bash
git pull            # hoặc đẩy code mới lên
npm install
npm run build
pm2 restart web-dashboard
```

## 5. Nginx HTTPS phía trước (proxy về 127.0.0.1:1235)
Xem `nginx.conf.example`. Quan trọng: bật cấu hình SSE cho `/api/stream`
(proxy_buffering off) thì real-time mới chạy mượt qua Nginx.

Sau khi sửa Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Kiểm tra nhanh sau khi deploy
```bash
pm2 logs web-dashboard --lines 50      # xem log
curl -I http://127.0.0.1:1235/login    # app sống chưa (200)
```
Mở `https://dashboard.ghn.vn` → đăng nhập Google `@ghn.vn` → thấy dashboard.
