import { verifyToken, readCookie, COOKIE_NAME } from '@/lib/session';
import { getData } from '@/lib/store';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { SKIP_AUTH } from '@/lib/devAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(req) {
  // 1) Phải đăng nhập (trừ dev-bypass). Xác minh cookie phiên đã ký (edge-safe).
  if (!SKIP_AUTH) {
    const session = await verifyToken(process.env.NEXTAUTH_SECRET, readCookie(req, COOKIE_NAME));
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 2) Rate limit per-IP (best-effort trên edge).
  const rl = rateLimit(clientIp(req), { max: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'Retry-After': String(rl.retryAfter) },
    });
  }

  // 3) Trả dữ liệu (chỉ đúng các trường dashboard cần).
  try {
    const { data, ok } = await getData();
    if (!ok || !data) {
      return Response.json({ error: 'Data unavailable' }, { status: 503 });
    }
    return Response.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    // Không lộ stack trace / chi tiết nội bộ.
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
