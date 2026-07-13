import LoginClient from './login-client';

// Render động theo request để Next gắn được CSP nonce vào script -> React hydrate được.
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export const metadata = {
  title: 'Đăng nhập — GHN Dashboard',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const hasPassword = !!process.env.DASHBOARD_PASSWORD;
  return <LoginClient hasPassword={hasPassword} />;
}
