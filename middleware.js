import { NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/session';
import { SKIP_AUTH } from '@/lib/devAuth';

// Đường dẫn cần đăng nhập mới được vào.
function isProtected(pathname) {
  return (
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname === '/api/data' ||
    pathname === '/api/stream'
  );
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // 1) Nonce + Content-Security-Policy (per-request).
  const nonce = btoa(crypto.randomUUID());
  // Ở chế độ `next dev`, Next.js/HMR dùng eval -> cần 'unsafe-eval' thì React mới
  // hydrate được. CHỈ bật khi dev; production tuyệt đối không có 'unsafe-eval'.
  const devEval = process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : '';
  const csp = [
    "default-src 'self'",
    // 'self' cho file script cùng origin; nonce cho script nội tuyến của Next; CDN cho Chart.js
    `script-src 'self' 'nonce-${nonce}'${devEval} https://cdn.jsdelivr.net`,
    // 'unsafe-inline' cần cho khối <style> + thuộc tính style động của dashboard
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Chỉ ép https khi site THẬT SỰ chạy https; nếu http (NAT) thì KHÔNG ép,
    // nếu không trình duyệt sẽ upgrade tài nguyên http -> https và hỏng.
    ...((process.env.NEXTAUTH_URL || '').startsWith('https://') ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  // 2) Cổng đăng nhập. (Bỏ qua khi AUTH_MODE=none hoặc dev-bypass.)
  if (isProtected(pathname) && !SKIP_AUTH) {
    const raw = req.cookies.get(COOKIE_NAME)?.value;
    const session = await verifyToken(process.env.NEXTAUTH_SECRET, raw);
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // 3) Chuyển nonce vào request để Next gắn vào <script> của nó.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  // 4) Trang chủ "/" -> phục vụ dashboard tĩnh.
  let res;
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard/index.html';
    res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    res = NextResponse.next({ request: { headers: requestHeaders } });
  }

  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  // Áp cho mọi route trừ asset tĩnh của Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
