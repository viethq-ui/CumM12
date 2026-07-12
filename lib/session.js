// Phiên đăng nhập nhẹ, edge-native: ký cookie bằng HMAC-SHA256 (Web Crypto).
// Chạy được cả trên Cloudflare edge lẫn Node — KHÔNG dùng thư viện Node crypto,
// nên thay được NextAuth v4 (vốn không chạy trên edge).

export const COOKIE_NAME = 'ghn_session';
const MAX_AGE = 60 * 60 * 8; // 8 tiếng

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlFromBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesFromB64url(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// Tạo token: payloadBase64url.signatureBase64url
export async function createToken(secret, payload = {}) {
  const body = { sub: 'shared', ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const p = b64urlFromBytes(enc.encode(JSON.stringify(body)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(p)));
  return `${p}.${b64urlFromBytes(sig)}`;
}

// Trả payload nếu chữ ký hợp lệ và chưa hết hạn; ngược lại null.
export async function verifyToken(secret, token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const p = token.slice(0, dot);
  const s = token.slice(dot + 1);
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, bytesFromB64url(s), enc.encode(p));
    if (!ok) return null;
    const body = JSON.parse(dec.decode(bytesFromB64url(p)));
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

// Đọc 1 cookie từ header Cookie (dùng trong route handler edge).
export function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Chuỗi Set-Cookie để đăng nhập / đăng xuất.
export function sessionCookie(token, { secure }) {
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${MAX_AGE}`];
  if (secure) flags.push('Secure');
  return `${COOKIE_NAME}=${token}; ${flags.join('; ')}`;
}

export function clearCookie({ secure }) {
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) flags.push('Secure');
  return `${COOKIE_NAME}=; ${flags.join('; ')}`;
}
