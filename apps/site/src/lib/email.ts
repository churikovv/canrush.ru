import nodemailer, { type Transporter } from 'nodemailer';
import { getAuthEnv, getSmtpEnv } from '@/lib/env';
import { buildMagicLinkConfirmationUrl, type SignInAudience } from '@/lib/magic-link-url';
import type { WeeklyReport } from '@/lib/business-report';
import { comebackPreheader, comebackSubject, plural, type ComebackDigest, type ComebackDrink } from '@/lib/comeback-email-fields';
import { LEGAL_DETAILS } from '@/lib/legal';
import { marketOpen } from '@/lib/market-open';

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

/** Six digits read in threes: «482 913». Only digits ever reach the letter. */
const spacedCode = (code: string) => code.replace(/\D/g, '').replace(/^(\d{3})(\d{3})$/, '$1 $2');

/**
 * The sign-in letter: the link, and — when there is one — the code for the same sign-in. The code is for a link that
 * opened in the mail app's own browser: the member types it on the sign-in page they came from.
 */
export function renderMagicLinkEmail(link: string, audience: SignInAudience = 'personal', code?: string): MagicLinkEmailContent {
  const safeLink = escapeHtml(link);
  const letter = LETTER[audience];
  const digits = code ? spacedCode(code) : '';
  const codeHtml = digits ? `<p style="font-size:16px;line-height:1.5;margin:0 0 8px">Или введите код на странице входа:</p><p style="font-size:32px;line-height:1;font-weight:700;letter-spacing:6px;color:#000;margin:0 0 24px;font-family:'Courier New',monospace">${escapeHtml(digits)}</p>` : '';
  return {
    subject: letter.subject,
    text: [
      letter.lead,
      link,
      ...(digits ? ['', `Или введите код на странице входа: ${digits}`] : []),
      '',
      digits ? 'Ссылка и код действуют 15 минут и срабатывают один раз.' : 'Ссылка действует 15 минут и срабатывает один раз.',
      'Если вы не запрашивали вход, просто проигнорируйте письмо.',
    ].join('\n'),
    html: `<!doctype html><html lang="ru"><body style="margin:0;background:#f3f4f6;color:#3e3e3f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px"><tr><td><div style="font-size:24px;font-weight:700;color:#000;margin-bottom:16px">${letter.subject}</div><p style="font-size:16px;line-height:1.5;margin:0 0 24px">Подтвердите вход. ${digits ? 'Ссылка и код действуют 15 минут и срабатывают' : 'Ссылка действует 15 минут и срабатывает'} один раз.</p><p style="margin:0 0 24px"><a href="${safeLink}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:16px;line-height:1;padding:16px 20px;border-radius:16px">${letter.button}</a></p>${codeHtml}<p style="font-size:13px;line-height:1.5;color:#3e3e3f;margin:0 0 8px;overflow-wrap:anywhere">${safeLink}</p><p style="font-size:13px;line-height:1.5;color:#656566;margin:0">Если вы не запрашивали вход, просто проигнорируйте письмо.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

/** Sends the sign-in letter through the configured SMTP; a business letter comes from «<name> для бизнеса», same address. */
export async function sendMagicLinkEmail(email: string, token: string, audience: SignInAudience = 'personal', code?: string): Promise<void> {
  const auth = getAuthEnv();
  const smtp = getSmtpEnv();
  const link = buildMagicLinkConfirmationUrl(auth.authUrl, token, audience);
  const content = renderMagicLinkEmail(link, audience, code);

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
export function renderBusinessApprovedEmail(business: string, link: string, pilotUntil: Date | null = null): MagicLinkEmailContent {
  const safe = { business: escapeHtml(business), link: escapeHtml(link) };
  const opened = ['ответы на отзывы от имени компании и шаблоны', 'новые напитки в каталоге — сразу, без модерации', marketOpen() ? 'правки карточек и объявления от имени компании' : 'правки карточек'];
  if (pilotUntil) opened.unshift('тариф «Бренд» бесплатно до ' + new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).format(pilotUntil) + ': аналитика поиска, карточек и конкурентов, разбор нейросетью, отчёт на почту');
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
export async function sendBusinessApprovedEmail(to: string, business: string, pilotUntil: Date | null = null): Promise<void> {
  const smtp = getSmtpEnv();
  const content = renderBusinessApprovedEmail(business, new URL('/business/cabinet', getAuthEnv().authUrl).toString(), pilotUntil);
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

const MAIL_INK = '#000', MAIL_MUTED = '#656566', MAIL_BRAND = '#006eff', MAIL_SOFT = '#f6f7f9';
const mailButton = (href: string, label: string) => `<a href="${escapeHtml(href)}" style="display:inline-block;background:${MAIL_BRAND};color:#fff;text-decoration:none;font-size:15px;font-weight:700;line-height:1;padding:14px 20px;border-radius:14px">${escapeHtml(label)}</a>`;
const mailHeading = (title: string, note = '') => `<div style="font-size:18px;font-weight:700;color:${MAIL_INK};margin:32px 0 ${note ? 2 : 12}px">${escapeHtml(title)}</div>${note ? `<div style="font-size:13px;color:${MAIL_MUTED};margin-bottom:12px">${escapeHtml(note)}</div>` : ''}`;
const mailCover = (drink: ComebackDrink, size: number) => drink.cover
  ? `<img src="${escapeHtml(drink.cover)}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;object-fit:contain;border:0">`
  : `<div style="width:${size}px;height:${size}px;line-height:${size}px;text-align:center;font-size:${Math.round(size / 2.5)}px;color:${MAIL_BRAND}">⚡</div>`;

/** Две банки в ряд: на телефоне ячейки по ~140 px, этого хватает обложке и подписи. */
function mailDrinkGrid(drinks: readonly ComebackDrink[]): string {
  const rows: string[] = [];
  for (let index = 0; index < drinks.length; index += 2) {
    rows.push(`<tr>${drinks.slice(index, index + 2).map(drink => `<td width="50%" valign="top" style="padding:0 4px 12px"><a href="${escapeHtml(drink.href)}" style="text-decoration:none;color:${MAIL_INK};display:block">`
      + `<div style="background:${MAIL_SOFT};border-radius:14px;padding:10px 0" align="center">${mailCover(drink, 104)}</div>`
      + `<div style="font-size:12px;color:${MAIL_MUTED};margin-top:8px;overflow-wrap:anywhere">${escapeHtml(drink.brand)}</div>`
      + `<div style="font-size:14px;font-weight:700;color:${MAIL_INK};overflow-wrap:anywhere">${escapeHtml(drink.name)}</div></a></td>`).join('')}${index + 1 >= drinks.length ? '<td width="50%"></td>' : ''}</tr>`);
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin:0 -4px">${rows.join('')}</table>`;
}

/**
 * «Что нового на CanRush» тому, кто давно не заходил: события сайта, непрочитанные уведомления, новые энергетики, статьи
 * и что обсуждают на неделе. Только служебные новости сайта, без рекламы партнёров; внизу — почему письмо пришло и
 * ссылка отписки. Всё из базы экранируется.
 */
export function renderComebackEmail(digest: ComebackDigest, base: string, unsubscribe: string): MagicLinkEmailContent {
  const settings = new URL('/profile/settings?section=notifications', base).toString();
  const home = new URL('/', base).toString();
  const greeting = digest.username ? `Привет, @${digest.username}!` : 'Привет!';
  const unreadText = digest.unread ? `У вас ${digest.unread} ${plural(digest.unread, 'непрочитанное уведомление', 'непрочитанных уведомления', 'непрочитанных уведомлений')}` : '';
  const newDrinksNote = digest.newDrinks.total > digest.newDrinks.items.length ? `Всего новых: ${digest.newDrinks.total}` : '';
  const text = [
    greeting,
    'Вот что сейчас интересного на CanRush.',
    ...digest.events.flatMap(event => ['', event.title, event.text, `${event.button}: ${event.href}`]),
    ...(unreadText ? ['', `${unreadText}: ${new URL('/?notifications=open', base)}`] : []),
    ...(digest.newDrinks.items.length ? ['', 'Новые энергетики в каталоге:', ...digest.newDrinks.items.map(drink => `— ${drink.brand} · ${drink.name}: ${drink.href}`), ...(newDrinksNote ? [newDrinksNote] : [])] : []),
    ...(digest.articles.length ? ['', 'Новые статьи:', ...digest.articles.map(article => `— ${article.title}: ${article.href}`)] : []),
    ...(digest.popular.length ? ['', 'Обсуждают на этой неделе:', ...digest.popular.map(drink => `— ${drink.brand} · ${drink.name} (${drink.note ?? ''}): ${drink.href}`)] : []),
    '',
    `Открыть CanRush: ${home}`,
    '',
    'Письмо пришло, потому что вы давно не заходили на CanRush. Такие письма приходят не чаще раза в две недели.',
    `Отписаться: ${unsubscribe}`,
    `Вопросы — ${LEGAL_DETAILS.contactEmail}`,
  ].join('\n');

  const events = digest.events.map(event => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4ff;border-radius:16px;margin-top:16px"><tr>`
    + (event.image ? `<td width="88" valign="top" style="padding:18px 0 18px 16px"><img src="${escapeHtml(event.image)}" width="80" height="83" alt="" style="display:block;width:80px;height:auto;border:0"></td>` : '')
    + `<td valign="top" style="padding:18px 16px"><div style="font-size:18px;font-weight:700;color:${MAIL_INK};margin-bottom:6px">${escapeHtml(event.title)}</div>`
    + `<div style="font-size:14px;line-height:1.5;color:#3e3e3f;margin-bottom:14px">${escapeHtml(event.text)}</div>${mailButton(event.href, event.button)}</td></tr></table>`).join('');
  const unread = unreadText ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MAIL_SOFT};border-radius:16px;margin-top:16px"><tr>`
    + `<td style="padding:16px;font-size:15px;color:${MAIL_INK}"><b>${escapeHtml(unreadText)}</b><div style="font-size:13px;color:${MAIL_MUTED};margin-top:2px">Ответы, лайки и подписчики ждут на сайте</div></td>`
    + `<td align="right" style="padding:16px"><a href="${escapeHtml(new URL('/?notifications=open', base).toString())}" style="color:${MAIL_BRAND};font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap">Открыть</a></td></tr></table>` : '';
  const drinks = digest.newDrinks.items.length ? mailHeading('Новые энергетики в каталоге', newDrinksNote || 'Их добавили участники и бренды') + mailDrinkGrid(digest.newDrinks.items) : '';
  const articles = digest.articles.length ? mailHeading('Новое в «Новостях»') + digest.articles.map(article => `<a href="${escapeHtml(article.href)}" style="display:block;text-decoration:none;padding:14px 16px;background:${MAIL_SOFT};border-radius:14px;margin-bottom:8px">`
    + `<div style="font-size:16px;font-weight:700;color:${MAIL_INK};overflow-wrap:anywhere">${escapeHtml(article.title)}</div>`
    + (article.summary ? `<div style="font-size:14px;line-height:1.5;color:#3e3e3f;margin-top:4px;overflow-wrap:anywhere">${escapeHtml(article.summary)}</div>` : '')
    + `<div style="font-size:12px;color:${MAIL_MUTED};margin-top:6px">${article.minutes} мин чтения</div></a>`).join('') : '';
  const popular = digest.popular.length ? mailHeading('Обсуждают на этой неделе') + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed">${digest.popular.map(drink => `<tr>`
    + `<td width="64" valign="middle" style="padding:6px 0"><a href="${escapeHtml(drink.href)}" style="display:block;background:${MAIL_SOFT};border-radius:12px;padding:4px">${mailCover(drink, 48)}</a></td>`
    + `<td valign="middle" style="padding:6px 0 6px 12px"><a href="${escapeHtml(drink.href)}" style="text-decoration:none"><div style="font-size:12px;color:${MAIL_MUTED};overflow-wrap:anywhere">${escapeHtml(drink.brand)}</div>`
    + `<div style="font-size:15px;font-weight:700;color:${MAIL_INK};overflow-wrap:anywhere">${escapeHtml(drink.name)}</div>${drink.note ? `<div style="font-size:12px;color:${MAIL_BRAND}">${escapeHtml(drink.note)}</div>` : ''}</a></td></tr>`).join('')}</table>` : '';

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(comebackSubject(digest))}</title></head>`
    + `<body style="margin:0;background:#f3f4f6;color:#3e3e3f;font-family:Arial,sans-serif">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(comebackPreheader(digest))}</div>`
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px"><tr><td align="center">`
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;table-layout:fixed">`
    + `<tr><td style="background:${MAIL_BRAND};padding:20px 24px"><a href="${escapeHtml(home)}" style="text-decoration:none;color:#fff;font-size:20px;font-weight:700"><img src="${escapeHtml(new URL('/brand/mail/logo.png', base).toString())}" width="160" height="34" alt="CanRush" style="display:block;border:0;color:#fff"></a></td></tr>`
    + `<tr><td style="padding:28px 24px 32px">`
    + `<div style="font-size:24px;font-weight:700;color:${MAIL_INK}">${escapeHtml(greeting)}</div>`
    + `<div style="font-size:15px;line-height:1.5;color:#3e3e3f;margin-top:6px">Вот что сейчас интересного на CanRush.</div>`
    + events + unread + drinks + articles + popular
    + `<p style="margin:32px 0 0">${mailButton(home, 'Открыть CanRush')}</p>`
    + `</td></tr></table>`
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px"><tr><td style="padding:16px 12px 0;font-size:12px;line-height:1.6;color:${MAIL_MUTED}">`
    + `Письмо пришло, потому что вы давно не заходили на CanRush. Такие письма приходят не чаще раза в две недели. `
    + `<a href="${escapeHtml(unsubscribe)}" style="color:${MAIL_MUTED}">Отписаться</a> · <a href="${escapeHtml(settings)}" style="color:${MAIL_MUTED}">Настройки уведомлений</a><br>`
    + `Вопросы — <a href="mailto:${LEGAL_DETAILS.contactEmail}" style="color:${MAIL_MUTED}">${LEGAL_DETAILS.contactEmail}</a>. Сайт для тех, кому 18+.`
    + `</td></tr></table></td></tr></table></body></html>`;
  return { subject: comebackSubject(digest), text, html };
}

/**
 * Письмо тому, кто давно не заходил: от основного адреса сайта (`SMTP_USER`, на проде — noreply@canrush.ru), ответы — на
 * почту поддержки. `List-Unsubscribe` с one-click (RFC 8058) ведёт на `/api/unsubscribe` с той же подписью.
 */
export async function sendComebackEmail(to: string, digest: ComebackDigest, unsubscribe: string): Promise<void> {
  const smtp = getSmtpEnv();
  const content = renderComebackEmail(digest, getAuthEnv().authUrl, unsubscribe);
  const oneClick = new URL(unsubscribe);
  oneClick.pathname = '/api/unsubscribe';
  await getTransporter().sendMail({
    from: { name: smtp.fromName, address: smtp.user },
    replyTo: LEGAL_DETAILS.contactEmail,
    to, subject: content.subject, text: content.text, html: content.html,
    headers: { 'List-Unsubscribe': `<${oneClick.toString()}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  });
}
