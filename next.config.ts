import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * Development only: other devices on the same network (a phone testing the
 * app over Wi-Fi) may load the dev server's scripts. Without this the page
 * renders but never becomes interactive on that device. Production builds
 * ignore it. Comma-separated hostnames or IPs, e.g. "192.168.1.71".
 */
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config: NextConfig = {
  allowedDevOrigins: devOrigins,
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['mongoose', 'pino', 'ioredis', 'bcryptjs', 'nodemailer', 'sharp'],
  experimental: {
    // Server Actions are public POST endpoints; cap the body.
    serverActions: { bodySizeLimit: '256kb' },
  },
  headers() {
    return Promise.resolve([
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        // Always revalidated, so a fixed worker reaches every phone on its next visit.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]);
  },
};

export default withNextIntl(config);
