import { createToken, sessionCookie, clearCookie } from '@/lib/session';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const isSecure = () => (process.env.NEXTAUTH_URL || '').startsWith('https://');

// Đăng nhập bằng mật khẩu chung -> đặt cookie phiên đã ký (HMAC).
export async function POST(req) {
  // Chặn dò mật khẩu: giới hạn số lần thử theo IP.
  const rl = rateLimit(clientIp(req), { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'Retry-After': String(rl.retryAfter) },
    });
  }

  let password = '';
  try {
    const body = await req.json();
    password = (body && body.password) || '';
  } catch {
    /* body rỗng/không hợp lệ -> coi như sai */
  }

  const expected = process.env.DASHBOARD_PASSWORD || '';
  if (!expected || password !== expected) {
    return Response.json({ error: 'invalid' }, { status: 401 });
  }

  const token = await createToken(process.env.NEXTAUTH_SECRET);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': sessionCookie(token, { secure: isSecure() }),
    },
  });
}

// Đăng xuất -> xóa cookie.
export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': clearCookie({ secure: isSecure() }),
    },
  });
}
