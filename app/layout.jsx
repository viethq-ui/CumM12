export const metadata = {
  title: 'GHN Operations Dashboard',
  // Trang dữ liệu nội bộ: không cho search engine index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#0a0e1a',
          color: '#f0f4ff',
        }}
      >
        {children}
      </body>
    </html>
  );
}
