import type { NextConfig } from 'next';

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pg'],
  logging: {
    serverFunctions: false,
    incomingRequests: {
      ignore: [/\/auth\/confirm/, /\/api\/auth\/magic-link\/verify/],
    },
  },
} satisfies NextConfig;

export default nextConfig;
