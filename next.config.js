/** @type {import('next').NextConfig} */
const nextConfig = {
  // Quy tắc bảo mật: không lộ phiên bản framework
  poweredByHeader: false,
  reactStrictMode: true,

  // Security headers tĩnh áp cho mọi response.
  // (Content-Security-Policy được set per-request trong middleware.js vì cần nonce.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
