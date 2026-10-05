import { catalogGroupSlug, decodeCatalogGroupSlug } from '@/lib/catalog-query';
import { Buffer } from 'node:buffer';
import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SIGNED_IN_PAGES = /^\/(?:profile(?:\/(?:edit|favorites|tierlists))?|tierlists\/(?:new|[^/]+\/edit))$/u;

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const development = process.env.NODE_ENV === 'development';
  const productionHttps = process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:';
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://mc.yandex.ru https://yastatic.net${development ? " 'unsafe-eval'" : ''}`,
    development ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data: https://mc.yandex.ru",
    "font-src 'self'",
    "connect-src 'self' https://mc.yandex.ru",
    "child-src blob: https://mc.yandex.ru",
    "frame-src blob: https://mc.yandex.ru",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    productionHttps ? 'upgrade-insecure-requests' : '',
  ].filter(Boolean);
  const contentSecurityPolicy = directives.join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const pathname = request.nextUrl.pathname;
  const productSegment = /^\/catalog\/([^/]+)$/.exec(pathname)?.[1];
  const identity = productSegment ? decodeCatalogGroupSlug(productSegment) : null;
  const canonical = identity ? catalogGroupSlug(identity.brand, identity.flavor) : null;
  const productRedirect = canonical && canonical !== productSegment ? request.nextUrl.clone() : null;
  if (productRedirect) productRedirect.pathname = `/catalog/${canonical}`;
  const response = productRedirect ? NextResponse.redirect(productRedirect, 301) :
    SIGNED_IN_PAGES.test(pathname) && !getSessionCookie(request)
      ? NextResponse.redirect(new URL('/sign-in', request.url))
      : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');

  if (
    pathname === '/auth/confirm' ||
    pathname === '/auth/error' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/tierlists') ||
    pathname === '/catalog' ||
    pathname === '/prices' ||
    pathname.startsWith('/catalog/') ||
    pathname.startsWith('/api/auth')
  ) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  }
  if (pathname === '/auth/confirm' || pathname.startsWith('/api/auth/magic-link/verify')) {
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  if (productionHttps) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
