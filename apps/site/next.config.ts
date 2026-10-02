import type { NextConfig } from 'next';

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '26mb' },
    proxyClientMaxBodySize: '26mb',
  },
  outputFileTracingIncludes: {
    '/prices': ['./data/catalog.json'],
    '/catalog/*': ['./data/ingredients.json'],
  },
  async headers() {
    return [{ source: '/images/products/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'leonardo.edadeal.io' },
      { protocol: 'https', hostname: '**.edadeal.io' },
    ],
  },
  logging: {
    serverFunctions: false,
    incomingRequests: {
      ignore: [/\/auth\/confirm/, /\/api\/auth\/magic-link\/verify/],
    },
  },
} satisfies NextConfig;

export default nextConfig;
