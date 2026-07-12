// Tắt đăng nhập hoàn toàn (AUTH_MODE=none) — dùng nếu bạn chấp nhận để công khai.
export const AUTH_DISABLED = process.env.AUTH_MODE === 'none';

// Bỏ qua đăng nhập khi chạy dev (chỉ khi NODE_ENV != production VÀ DEV_AUTH_BYPASS=1).
export const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === '1';

// Cờ tổng: bỏ qua kiểm tra đăng nhập.
export const SKIP_AUTH = AUTH_DISABLED || DEV_AUTH_BYPASS;

// Dùng mock data khi dev mà chưa khai báo Google Sheet.
export const USE_MOCK_DATA =
  process.env.NODE_ENV !== 'production' && !process.env.GOOGLE_SHEET_ID;
