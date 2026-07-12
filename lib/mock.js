// CHỈ dùng cho dev khi chưa cấu hình Google Sheet.
// Import JSON trực tiếp (edge-safe, không dùng fs) để build Cloudflare không lỗi.
import data from '@/lib/mock/data.json';

export function mockData() {
  return data;
}
