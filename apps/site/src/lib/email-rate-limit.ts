import { createHmac } from 'node:crypto';

export const EMAIL_RATE_LIMIT_MAX = 3;
export const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export function normalizeEmailForRateLimit(email: string): string {
  return email.trim().normalize('NFKC').toLowerCase();
}

export function emailRateLimitKey(email: string, secret: string): string {
  return `magic-link-email:${createHmac('sha256', secret)
    .update(normalizeEmailForRateLimit(email), 'utf8')
    .digest('base64url')}`;
}
