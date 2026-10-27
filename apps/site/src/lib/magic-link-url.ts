const MAGIC_LINK_TOKEN_PATTERN = /^[A-Za-z]{32}$/;

/**
 * Who signs in: a member («Для себя») or a business («Бизнес»). The letter's link carries only this flag, never an
 * address, and each audience has its one fixed page to land on.
 */
export type SignInAudience = 'personal' | 'business';
export const AUDIENCE_DESTINATION: Record<SignInAudience, '/profile' | '/business/cabinet'> = { personal: '/profile', business: '/business/cabinet' };

export function parseSignInAudience(value: unknown): SignInAudience {
  return value === 'business' ? 'business' : 'personal';
}

/** The audience of a sign-in request from Better Auth's own verify URL: business only for the cabinet callback. */
export function audienceFromVerifyUrl(url: string): SignInAudience {
  try { return new URL(url).searchParams.get('callbackURL') === AUDIENCE_DESTINATION.business ? 'business' : 'personal'; }
  catch { return 'personal'; }
}

export function isMagicLinkToken(value: unknown): value is string {
  return typeof value === 'string' && MAGIC_LINK_TOKEN_PATTERN.test(value);
}

export function buildMagicLinkConfirmationUrl(baseUrl: string, token: string, audience: SignInAudience = 'personal'): string {
  if (!isMagicLinkToken(token)) throw new Error('Invalid magic link token');
  const url = new URL('/auth/confirm', baseUrl);
  url.searchParams.set('token', token);
  if (audience === 'business') url.searchParams.set('for', 'business');
  return url.toString();
}

export function buildMagicLinkVerificationPath(token: string, audience: SignInAudience = 'personal'): string {
  if (!isMagicLinkToken(token)) throw new Error('Invalid magic link token');
  const params = new URLSearchParams({
    token,
    callbackURL: AUDIENCE_DESTINATION[audience],
    newUserCallbackURL: AUDIENCE_DESTINATION[audience],
    errorCallbackURL: '/auth/error',
  });
  return `/api/auth/magic-link/verify?${params.toString()}`;
}
