#!/bin/bash
# ============================================================
#  Build & chạy lại toàn bộ dashboard trên Mac mini (PM2)
#    - dashboard-static : web tĩnh, cổng 1234
#    - ghn-dashboard    : app Next.js real-time, cổng 1235
#  Cách dùng:  bash redeploy.sh
# ============================================================
set -e

WEB="/private/var/root/websites"
APP="$WEB/ghn-dashboard-aviet"
STATIC="$WEB/dashboard"

echo "==> [1/6] Xoá tiến trình PM2 cũ"
pm2 delete dashboard-static 2>/dev/null || true
pm2 delete ghn-dashboard   2>/dev/null || true

echo "==> [2/6] Đảm bảo fix trang login (force-dynamic)"
grep -q "force-dynamic" "$APP/app/login/page.jsx" \
  || echo "export const dynamic = 'force-dynamic';" >> "$APP/app/login/page.jsx"

echo "==> [3/6] Cài dependencies (nếu thiếu)"
cd "$APP"
[ -d node_modules ] || npm install

echo "==> [4/6] Build app Next.js"
rm -rf .next
npm run build

echo "==> [5/6] Khởi động PM2"
# Web tĩnh (1234)
pm2 serve "$STATIC" 1234 --name dashboard-static
# App Next.js (1235)
pm2 start npm --name ghn-dashboard --cwd "$APP" -- start -- -p 1235

echo "==> [6/6] Lưu cấu hình"
pm2 save

echo ""
echo "==================== XONG ===================="
pm2 list
echo ""
echo "Nhắc: kiểm tra $APP/.env có NEXTAUTH_URL đúng địa chỉ truy cập (http://...:1235)"
echo "Đổi mật khẩu: sửa DASHBOARD_PASSWORD trong .env rồi: pm2 restart ghn-dashboard"
