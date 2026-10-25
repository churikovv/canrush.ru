import type { NextConfig } from 'next';

const nextConfig = {
  output: 'standalone',
  experimental: {
    // Pages visited in the last 30 seconds open from the client cache without a server round trip: going back and
    // forth between tabs (most of all in the Android app on slow phones) is instant. Server actions that change data
    // revalidate their paths, which clears these entries.
    staleTimes: { dynamic: 30 },
    serverActions: { bodySizeLimit: '26mb' },
    proxyClientMaxBodySize: '26mb',
  },
  outputFileTracingIncludes: {
    '/prices': ['./data/catalog.json'],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'leonardo.edadeal.io' },
      { protocol: 'https', hostname: '**.edadeal.io' },
    ],
    // Optimized sources are at most 300px (products) or icons, so wide variants only repeat the original
    // and bloat every srcset on the 100-card home page. 1920 stays for full-width images.
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    deviceSizes: [640, 1080, 1920],
  },
  async headers() {
    // Public files get `max-age=0` by default. Product photos are named by a hash of their source URL and
    // never rewritten; brand assets and retailer icons can be replaced under the same name, so they revalidate sooner.
    // The image optimizer inherits these max-ages for its `/_next/image` responses.
    return [
      { source: '/images/products/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }] },
      { source: '/images/retailers/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=604800' }] },
      { source: '/brand/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ];
  },
  logging: {
    serverFunctions: false,
    incomingRequests: {
      ignore: [/\/auth\/confirm/, /\/api\/auth\/magic-link\/verify/],
    },
  },
} satisfies NextConfig;

export default nextConfig;
