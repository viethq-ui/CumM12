import { verifyToken, readCookie, COOKIE_NAME } from '@/lib/session';
import { listWarehouses } from '@/lib/warehouses';
import { SKIP_AUTH } from '@/lib/devAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Trả danh sách kho (key + tên) để client dựng bộ chọn. Cần đăng nhập.
export async function GET(req) {
  if (!SKIP_AUTH) {
    const session = await verifyToken(process.env.NEXTAUTH_SECRET, readCookie(req, COOKIE_NAME));
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json({ warehouses: listWarehouses() }, { headers: { 'Cache-Control': 'no-store' } });
}
