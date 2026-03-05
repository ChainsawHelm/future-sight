/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Prevent clickjacking
        { key: 'X-Frame-Options', value: 'DENY' },
        // Prevent MIME-type sniffing
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Control referrer info
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Legacy XSS protection
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        // Restrict browser features
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        // Force HTTPS for 1 year
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        // Content Security Policy
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com", // Next.js needs inline scripts
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://*.plaid.com",
            "frame-src https://*.plaid.com",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
          ].join('; '),
        },
        // Prevent embedding in other sites
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ],
    },
  ],
};

module.exports = nextConfig;
