const MAGIC_LINK_TOKEN_PATTERN = /^[A-Za-z]{32}$/;

export function isMagicLinkToken(value: unknown): value is string {
  return typeof value === 'string' && MAGIC_LINK_TOKEN_PATTERN.test(value);
}

export function buildMagicLinkConfirmationUrl(baseUrl: string, token: string): string {
  if (!isMagicLinkToken(token)) throw new Error('Invalid magic link token');
  const url = new URL('/auth/confirm', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function buildMagicLinkVerificationPath(token: string): string {
  if (!isMagicLinkToken(token)) throw new Error('Invalid magic link token');
  const params = new URLSearchParams({
    token,
    callbackURL: '/profile',
    newUserCallbackURL: '/profile',
    errorCallbackURL: '/auth/error',
  });
  return `/api/auth/magic-link/verify?${params.toString()}`;
}
