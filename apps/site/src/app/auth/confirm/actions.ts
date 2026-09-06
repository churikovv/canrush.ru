'use server';

import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies/utils';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAuthEnv } from '@/lib/env';
import { isMagicLinkToken } from '@/lib/magic-link-url';

function originOf(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function safeRedirectPath(value: string | null, expectedOrigin: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, expectedOrigin);
    if (url.origin !== expectedOrigin) return undefined;
    if (url.pathname !== '/profile' && url.pathname !== '/auth/error') return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

async function applyResponseCookies(response: Response): Promise<void> {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;

  const cookieStore = await cookies();
  for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
    cookieStore.set(name, attributes.value, toCookieOptions(attributes));
  }
}

export async function confirmMagicLink(formData: FormData): Promise<never> {
  const token = formData.get('token');
  if (!isMagicLinkToken(token)) redirect('/auth/error?error=INVALID_TOKEN');

  const requestHeaders = await headers();
  const expectedOrigin = getAuthEnv().authUrl;
  const fetchSite = requestHeaders.get('sec-fetch-site');
  const origin = originOf(requestHeaders.get('origin'));
  const referer = originOf(requestHeaders.get('referer'));
  const trustedRequest =
    fetchSite === 'same-origin' || origin === expectedOrigin || (!origin && referer === expectedOrigin);

  if (!trustedRequest) redirect('/auth/error?error=INVALID_REQUEST');

  const verificationResponse = await auth.api.magicLinkVerify({
    query: {
      token,
      callbackURL: '/profile',
      newUserCallbackURL: '/profile',
      errorCallbackURL: '/auth/error',
    },
    headers: new Headers(requestHeaders),
    asResponse: true,
  });
  const destination = safeRedirectPath(verificationResponse.headers.get('location'), expectedOrigin);
  if (!destination) redirect('/auth/error?error=INVALID_REQUEST');

  await applyResponseCookies(verificationResponse);
  redirect(destination);
}
