// Cung cấp dữ liệu dashboard. Trên Cloudflare edge KHÔNG có tiến trình chạy nền
// (mỗi request là một isolate riêng, không chia sẻ RAM), nên bỏ vòng lặp làm mới
// + EventEmitter cũ. Thay vào đó: đọc + biến đổi Sheet NGAY trong mỗi request.
// Real-time do trình duyệt tự poll /api/data định kỳ (xem public/dashboard/boot.js).
import { buildDashboardData } from '@/lib/transform';
import { USE_MOCK_DATA } from '@/lib/devAuth';

export async function getData() {
  try {
    let data;
    if (USE_MOCK_DATA) {
      const m = await import('@/lib/mock.js');
      data = m.mockData();
    } else {
      data = await buildDashboardData();
    }
    return { data, updatedAt: Date.now(), ok: !!data };
  } catch (err) {
    // Không lộ chi tiết lỗi ra ngoài; chỉ log nội bộ.
    console.error('[store] build error:', err?.message || err);
    return { data: null, updatedAt: 0, ok: false };
  }
}
