// Cung cấp dữ liệu dashboard cho MỘT kho. Trên Cloudflare edge không có tiến
// trình nền nên đọc + biến đổi Sheet ngay trong mỗi request. Real-time do trình
// duyệt tự poll /api/data định kỳ (xem public/dashboard/boot.js).
import { buildDashboardData } from '@/lib/transform';
import { warehouseFor } from '@/lib/warehouses';
import { USE_MOCK_DATA } from '@/lib/devAuth';

export async function getData(whKey) {
  try {
    let data;
    if (USE_MOCK_DATA) {
      const m = await import('@/lib/mock.js');
      data = m.mockData();
    } else {
      const wh = warehouseFor(whKey);
      if (!wh) return { data: null, updatedAt: 0, ok: false };
      data = await buildDashboardData(wh);
    }
    return { data, updatedAt: Date.now(), ok: !!data };
  } catch (err) {
    console.error('[store] build error:', err?.message || err);
    return { data: null, updatedAt: 0, ok: false, error: String((err && err.message) || err) };
  }
}
