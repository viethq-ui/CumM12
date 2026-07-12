// Rate limit per-IP đơn giản, lưu trong bộ nhớ. Trên Cloudflare edge mỗi isolate
// có bộ nhớ riêng nên đây chỉ là best-effort (không chống được kẻ tấn công phân tán);
// vẫn hữu ích để chặn spam từ một client trong cùng một isolate.
// Cửa sổ trượt: tối đa `max` request trong `windowMs`.
const buckets = new Map();

export function rateLimit(ip, { max = 60, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const key = ip || 'unknown';
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  const ok = b.count <= max;
  const retryAfter = Math.ceil((b.reset - now) / 1000);
  return { ok, retryAfter, remaining: Math.max(0, max - b.count) };
}

export function clientIp(req) {
  // Cloudflare gắn IP thật vào CF-Connecting-IP.
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
