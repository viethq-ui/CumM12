'use client';

import { useState } from 'react';

export default function LoginClient({ hasPassword }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitPassword(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      setErr(res.status === 429 ? 'Thử lại quá nhiều lần, đợi chút.' : 'Mật khẩu không đúng');
    } catch {
      setErr('Lỗi kết nối, thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          width: '100%', maxWidth: 380, background: '#1a2235', border: '1px solid #2a3550',
          borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.4)',
        }}
      >
        <div
          style={{
            width: 56, height: 56, margin: '0 auto 18px', borderRadius: 14,
            background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff',
          }}
        >
          GHN
        </div>
        <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>Operations Dashboard</h1>
        <p style={{ fontSize: 13, color: '#8b9cc7', margin: '0 0 24px' }}>Vui lòng đăng nhập để tiếp tục</p>

        {hasPassword ? (
          <form onSubmit={submitPassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Mật khẩu"
              autoFocus
              style={{
                padding: '12px 14px', borderRadius: 10, border: '1px solid #2a3550',
                background: '#0f1525', color: '#f0f4ff', fontSize: 14,
              }}
            />
            {err && <div style={{ color: '#ef4444', fontSize: 12 }}>{err}</div>}
            <button
              type="submit"
              disabled={busy || !pw}
              style={{
                padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', color: '#fff', fontSize: 14, fontWeight: 600,
                opacity: busy || !pw ? 0.6 : 1,
              }}
            >
              {busy ? 'Đang vào…' : 'Đăng nhập'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 12, color: '#ef4444' }}>
            Chưa cấu hình cách đăng nhập. Đặt DASHBOARD_PASSWORD trong biến môi trường.
          </p>
        )}
      </div>
    </main>
  );
}
