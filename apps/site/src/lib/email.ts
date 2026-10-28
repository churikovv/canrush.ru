import nodemailer, { type Transporter } from 'nodemailer';
import { getAuthEnv, getSmtpEnv } from '@/lib/env';
import { buildMagicLinkConfirmationUrl, type SignInAudience } from '@/lib/magic-link-url';
import type { WeeklyReport } from '@/lib/business-report';

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

/** The good news after the team approves a company: what opened in the cabinet, and a button to it. */
export function renderBusinessApprovedEmail(business: string, link: string): MagicLinkEmailContent {
  const safe = { business: escapeHtml(business), link: escapeHtml(link) };
  const opened = ['аналитика отзывов, поиска и карточек ваших напитков', 'разбор отзывов нейросетью', 'ответы на отзывы от имени компании', 'новые напитки в каталоге — сразу, без модерации', 'объявления в маркете от имени компании'];
  return {
    subject: `Компания «${business}» подтверждена — CanRush для бизнеса`,
    text: [
      `Готово! Команда CanRush проверила и подтвердила компанию «${business}».`,
      '',
      'В кабинете теперь открыто:',
      ...opened.map(item => `— ${item}`),
      '',
      'Напитки компании по-прежнему прикрепляются через проверку — так в аналитику попадает только ваше.',
      '',
      'Открыть кабинет:',
      link,
    ].join('\n'),
    html: `<!doctype html><html lang="ru"><body style="margin:0;background:#f3f4f6;color:#3e3e3f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px"><tr><td><div style="display:inline-block;background:#e6f0ff;color:#006eff;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;margin-bottom:16px">✓ Компания подтверждена</div><div style="font-size:24px;font-weight:700;color:#000;margin-bottom:16px">Добро пожаловать, «${safe.business}»!</div><p style="font-size:16px;line-height:1.5;margin:0 0 16px">Команда CanRush проверила компанию — кабинет открыт полностью. Теперь доступно:</p><ul style="font-size:15px;line-height:1.6;margin:0 0 16px;padding-left:20px">${opened.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p style="font-size:14px;line-height:1.5;color:#656566;margin:0 0 24px">Напитки компании по-прежнему прикрепляются через проверку — так в аналитику попадает только ваше.</p><p style="margin:0 0 24px"><a href="${safe.link}" style="display:inline-block;background:#006eff;color:#fff;text-decoration:none;font-size:16px;line-height:1;padding:16px 20px;border-radius:16px">Открыть кабинет</a></p><p style="font-size:13px;line-height:1.5;color:#656566;margin:0">Вопросы — просто ответьте на это письмо или напишите на hello@canrush.ru.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

/** Sends the approval letter to the company's owner, from «<name> для бизнеса». */
export async function sendBusinessApprovedEmail(to: string, business: string): Promise<void> {
  const smtp = getSmtpEnv();
  const content = renderBusinessApprovedEmail(business, new URL('/business/cabinet', getAuthEnv().authUrl).toString());
  await getTransporter().sendMail({
    from: { name: `${smtp.fromName} для бизнеса`, address: smtp.user },
    to, subject: content.subject, text: content.text, html: content.html,
  });
}

/** «12 (+3)», «12 (−2)», «12» — the week's value and its change against the week before. */
function weekChange(now: number, before: number): string {
  const delta = now - before;
  return delta ? `${now} (${delta > 0 ? '+' : '−'}${Math.abs(delta)})` : String(now);
}
const reportDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * The Monday letter of a company: last week against the week before — reviews and their average, searches with the
 * brand, card views and store taps — the newest reviews and the competitors' line, with buttons to the cabinet and to
 * the switch that turns it off. Every value from the database is escaped.
 */
export function renderBusinessWeeklyEmail(report: WeeklyReport, link: string, settings: string): MagicLinkEmailContent {
  const period = `${reportDay.format(new Date(`${report.from}T00:00:00Z`))} — ${reportDay.format(new Date(`${report.to}T00:00:00Z`))}`;
  const stats = [
    ['Отзывы', weekChange(report.reviews.now, report.reviews.before), report.reviews.score === null ? '' : `средняя ${report.reviews.score.toLocaleString('ru-RU')}`],
    ['Поиски с брендом', weekChange(report.searches.now, report.searches.before), report.searches.missed ? `${report.searches.missed} без результатов` : ''],
    ['Просмотры карточек', weekChange(report.views.now, report.views.before), ''],
    ['Переходы в магазины', weekChange(report.clicks.now, report.clicks.before), ''],
  ];
  const text = [
    `${report.business}: неделя ${period}`,
    '',
    ...stats.map(([label, value, note]) => `${label}: ${value}${note ? ` · ${note}` : ''}`),
    ...(report.latest.length ? ['', 'Свежие отзывы:', ...report.latest.map(item => `— ${item.drink}, ${item.score}/10: ${item.text}`)] : []),
    ...(report.rivals.length ? ['', 'Вы и конкуренты (отзывы · просмотры за неделю):', ...report.rivals.map(item => `— ${item.label}: ${item.reviews} · ${item.views}`)] : []),
    '',
    `Кабинет: ${link}`,
    `Отключить отчёт: ${settings}`,
  ].join('\n');
  const cell = 'padding:12px 0;border-bottom:1px solid #eceef1;font-size:15px';
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f3f4f6;color:#3e3e3f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;padding:28px 24px;table-layout:fixed"><tr><td>`
    + `<div style="font-size:13px;color:#656566;margin-bottom:6px">Отчёт за неделю · ${escapeHtml(period)}</div>`
    + `<div style="font-size:24px;font-weight:700;color:#000;margin-bottom:20px">${escapeHtml(report.business)}</div>`
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${stats.map(([label, value, note]) => `<tr><td style="${cell};color:#656566">${escapeHtml(label!)}</td><td align="right" style="${cell};color:#000;font-weight:700">${escapeHtml(value!)}${note ? `<div style="font-size:12px;font-weight:400;color:#656566">${escapeHtml(note)}</div>` : ''}</td></tr>`).join('')}</table>`
    + `<p style="font-size:12px;color:#656566;margin:8px 0 0">В скобках — изменение к прошлой неделе.</p>`
    + (report.latest.length ? `<div style="font-size:17px;font-weight:700;color:#000;margin:28px 0 8px">Свежие отзывы</div>${report.latest.map(item => `<div style="padding:12px 14px;background:#f6f7f9;border-radius:12px;margin-bottom:8px"><div style="font-size:13px;color:#656566;margin-bottom:4px">${escapeHtml(item.drink)} · <b style="color:#006eff">${escapeHtml(String(item.score))}/10</b></div><div style="font-size:14px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(item.text)}</div></div>`).join('')}` : '')
    + (report.rivals.length ? `<div style="font-size:17px;font-weight:700;color:#000;margin:28px 0 8px">Вы и конкуренты</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-size:12px;color:#656566;padding-bottom:4px">Бренд</td><td align="right" style="font-size:12px;color:#656566">Отзывы</td><td align="right" style="font-size:12px;color:#656566">Просмотры</td></tr>${report.rivals.map(item => `<tr><td style="${cell};overflow-wrap:anywhere${item.own ? ';color:#006eff;font-weight:700' : ''}">${escapeHtml(item.label)}</td><td align="right" style="${cell}">${item.reviews}</td><td align="right" style="${cell}">${item.views}</td></tr>`).join('')}</table>` : '')
    + `<p style="margin:28px 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#006eff;color:#fff;text-decoration:none;font-size:16px;line-height:1;padding:16px 20px;border-radius:16px">Открыть кабинет</a></p>`
    + `<p style="font-size:12px;line-height:1.5;color:#656566;margin:0">Отчёт приходит по понедельникам. <a href="${escapeHtml(settings)}" style="color:#656566">Отключить</a></p>`
    + `</td></tr></table></td></tr></table></body></html>`;
  return { subject: `${report.business}: отчёт за неделю ${period} — CanRush для бизнеса`, text, html };
}

/** Sends the weekly report from «<name> для бизнеса», with a one-click-to-settings unsubscribe header. */
export async function sendBusinessWeeklyEmail(to: string, report: WeeklyReport): Promise<void> {
  const smtp = getSmtpEnv();
  const base = getAuthEnv().authUrl;
  const settings = new URL('/business/cabinet?section=settings&tab=notifications', base).toString();
  const content = renderBusinessWeeklyEmail(report, new URL('/business/cabinet', base).toString(), settings);
  await getTransporter().sendMail({
    from: { name: `${smtp.fromName} для бизнеса`, address: smtp.user },
    to, subject: content.subject, text: content.text, html: content.html,
    headers: { 'List-Unsubscribe': `<${settings}>` },
  });
}
