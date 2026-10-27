import nodemailer, { type Transporter } from 'nodemailer';
import { getAuthEnv, getSmtpEnv } from '@/lib/env';
import { buildMagicLinkConfirmationUrl, type SignInAudience } from '@/lib/magic-link-url';

let transporter: Transporter | undefined;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const smtp = getSmtpEnv();
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: true,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      servername: smtp.host,
    },
  });
  return transporter;
}

export interface MagicLinkEmailContent {
  html: string;
  subject: string;
  text: string;
}

/** Words of the letter: a member signs in to CanRush, a business opens its cabinet. */
const LETTER: Record<SignInAudience, { subject: string; lead: string; button: string }> = {
  personal: { subject: 'Вход в CanRush', lead: 'Войдите в CanRush по ссылке:', button: 'Продолжить вход' },
  business: { subject: 'Вход в кабинет CanRush для бизнеса', lead: 'Откройте кабинет CanRush для бизнеса по ссылке:', button: 'Открыть кабинет' },
};

export function renderMagicLinkEmail(link: string, audience: SignInAudience = 'personal'): MagicLinkEmailContent {
  const safeLink = escapeHtml(link);
  const letter = LETTER[audience];
  return {
    subject: letter.subject,
    text: [
      letter.lead,
      link,
      '',
      'Ссылка действует 15 минут и срабатывает один раз.',
      'Если вы не запрашивали вход, просто проигнорируйте письмо.',
    ].join('\n'),
    html: `<!doctype html><html lang="ru"><body style="margin:0;background:#f3f4f6;color:#3e3e3f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px"><tr><td><div style="font-size:24px;font-weight:700;color:#000;margin-bottom:16px">${letter.subject}</div><p style="font-size:16px;line-height:1.5;margin:0 0 24px">Подтвердите вход. Ссылка действует 15 минут и срабатывает один раз.</p><p style="margin:0 0 24px"><a href="${safeLink}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:16px;line-height:1;padding:16px 20px;border-radius:16px">${letter.button}</a></p><p style="font-size:13px;line-height:1.5;color:#3e3e3f;margin:0 0 8px;overflow-wrap:anywhere">${safeLink}</p><p style="font-size:13px;line-height:1.5;color:#656566;margin:0">Если вы не запрашивали вход, просто проигнорируйте письмо.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

/** Sends the sign-in letter through the configured SMTP; a business letter comes from «<name> для бизнеса», same address. */
export async function sendMagicLinkEmail(email: string, token: string, audience: SignInAudience = 'personal'): Promise<void> {
  const auth = getAuthEnv();
  const smtp = getSmtpEnv();
  const link = buildMagicLinkConfirmationUrl(auth.authUrl, token, audience);
  const content = renderMagicLinkEmail(link, audience);

  await getTransporter().sendMail({
    from: {
      name: audience === 'business' ? `${smtp.fromName} для бизнеса` : smtp.fromName,
      address: smtp.user,
    },
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

/** The invitation to a company's cabinet: who invites, which company, and the sign-in link for this address. */
export function renderBusinessInviteEmail(business: string, inviter: string, link: string): MagicLinkEmailContent {
  const safe = { business: escapeHtml(business), inviter: escapeHtml(inviter), link: escapeHtml(link) };
  return {
    subject: `Приглашение в команду «${business}» — CanRush для бизнеса`,
    text: [
      `${inviter} приглашает вас в команду «${business}» в кабинете CanRush для бизнеса.`,
      'Войдите с этой почтой — приглашение будет ждать в кабинете:',
      link,
      '',
      'Если вы не ждали приглашения, просто проигнорируйте письмо.',
    ].join('\n'),
    html: `<!doctype html><html lang="ru"><body style="margin:0;background:#f3f4f6;color:#3e3e3f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px"><tr><td><div style="font-size:24px;font-weight:700;color:#000;margin-bottom:16px">Приглашение в команду «${safe.business}»</div><p style="font-size:16px;line-height:1.5;margin:0 0 24px">${safe.inviter} приглашает вас управлять кабинетом компании в CanRush для бизнеса: аналитика отзывов, напитки и объявления. Войдите с этой почтой — приглашение будет ждать в кабинете.</p><p style="margin:0 0 24px"><a href="${safe.link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:16px;line-height:1;padding:16px 20px;border-radius:16px">Открыть кабинет</a></p><p style="font-size:13px;line-height:1.5;color:#656566;margin:0">Если вы не ждали приглашения, просто проигнорируйте письмо.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

export async function sendBusinessInviteEmail(to: string, business: string, inviter: string): Promise<void> {
  const smtp = getSmtpEnv();
  const link = new URL('/sign-in?for=business', getAuthEnv().authUrl).toString();
  const content = renderBusinessInviteEmail(business, inviter, link);
  await getTransporter().sendMail({
    from: { name: `${smtp.fromName} для бизнеса`, address: smtp.user },
    to, subject: content.subject, text: content.text, html: content.html,
  });
}
