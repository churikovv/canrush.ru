import nodemailer, { type Transporter } from 'nodemailer';
import { getAuthEnv, getSmtpEnv } from '@/lib/env';
import { buildMagicLinkConfirmationUrl } from '@/lib/magic-link-url';

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

export function renderMagicLinkEmail(link: string): MagicLinkEmailContent {
  const safeLink = escapeHtml(link);
  return {
    subject: 'Вход в CanRush',
    text: [
      'Войдите в CanRush по ссылке:',
      link,
      '',
      'Ссылка действует 5 минут и срабатывает один раз.',
      'Если вы не запрашивали вход, просто проигнорируйте письмо.',
    ].join('\n'),
    html: `<!doctype html><html lang="ru"><body style="margin:0;background:#f3f4f6;color:#3e3e3f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px"><tr><td><div style="font-size:24px;font-weight:700;color:#000;margin-bottom:16px">Вход в CanRush</div><p style="font-size:16px;line-height:1.5;margin:0 0 24px">Подтвердите вход. Ссылка действует 5 минут и срабатывает один раз.</p><p style="margin:0 0 24px"><a href="${safeLink}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:16px;line-height:1;padding:16px 20px;border-radius:16px">Продолжить вход</a></p><p style="font-size:13px;line-height:1.5;color:#3e3e3f;margin:0 0 8px;overflow-wrap:anywhere">${safeLink}</p><p style="font-size:13px;line-height:1.5;color:#656566;margin:0">Если вы не запрашивали вход, просто проигнорируйте письмо.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const auth = getAuthEnv();
  const smtp = getSmtpEnv();
  const link = buildMagicLinkConfirmationUrl(auth.authUrl, token);
  const content = renderMagicLinkEmail(link);

  await getTransporter().sendMail({
    from: {
      name: smtp.fromName,
      address: smtp.user,
    },
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
