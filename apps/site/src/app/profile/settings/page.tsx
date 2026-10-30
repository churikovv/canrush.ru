import '@/styles/shared.css';
import '@/styles/profile.css';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { getBlockedMembers } from '@/lib/member-blocks';
import { BlockMemberButton } from '@/components/block-member-button';
import { ThemeSettings } from '@/components/theme-settings';
import { parseSiteTheme, SITE_THEME_COOKIE, type SiteTheme } from '@/lib/site-theme';
import Link from '@/components/navigation-progress';
import { auth } from '@/lib/auth';
import { getPool } from '@/db/pool';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileEditForm, type SettingsGroup, type SettingsRow } from '@/components/profile-edit-form';
import { ProfileExperience } from '@/components/profile-experience';
import { ProfileConnections } from '@/components/profile-connections';
import { AchievementPicker } from '@/components/profile-community-controls';
import { NOTIFICATION_OPTIONS } from '@/lib/notification-preferences';
import { getTelegramEnv } from '@/lib/env';
import { TELEGRAM_PROVIDER_ID } from '@/lib/telegram-auth';
import { isTelegramPlaceholderEmail } from '@/lib/telegram-init-data';
import { TelegramLinkButton, TelegramUnlinkButton } from '@/components/telegram-link-button';
import { siteRoleForEmail } from '@/lib/admin';
import { experienceLevel } from '@/lib/experience-level';
import { getFavoriteGroups } from '@/lib/catalog';
import { getProfileRatings, getProfileWall, getConnections, getProfileCommunity } from '@/lib/profile-community';
import { getListings } from '@/lib/market';
import { getExperience } from '@/lib/profile-experience';
import { ensureOwnProfile } from '@/lib/profile';
import { profileTagLabel, visibleProfileAchievements } from '@/lib/profile-achievements';
import { CITIES, DEFAULT_CITY } from '@canrush/shared';
import { TELEGRAM_BOT_OPTIONS } from '@/lib/telegram-bot/settings';
import { LEGAL_DETAILS } from '@/lib/legal';
import { TELEGRAM_BOT_URL, TELEGRAM_CHANNEL_URL } from '@/components/telegram-promo';
import { saveNotificationSettings, saveTelegramBotSettings, unlinkTelegram } from './actions';
import { supportUnreadForUser } from '@/lib/support';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Профиль и настройки', robots: { index: false, follow: false } };

const ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const ICONS = {
  theme: <svg {...ICON}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>,
  notifications: <svg {...ICON}><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  telegram: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.7 3.3a1.6 1.6 0 0 0-1.7-.2L2.9 9.6c-1.2.5-1.1 2.2.1 2.6l3.9 1.2 1.5 4.8c.3.9 1.4 1.2 2.1.5l2.2-2.1 4.1 3c.9.7 2.2.2 2.4-.9l2.6-13.9c.1-.6-.1-1.2-.6-1.5ZM10 14.2l-.6 3.2-1.1-3.6 9.4-7.5-7.7 7.9Z" /></svg>,
  blocked: <svg {...ICON}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>,
  email: <svg {...ICON}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>,
  about: <svg {...ICON}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
  help: <svg {...ICON}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /><path d="M9.5 8.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4M12 14.5h.01" /></svg>,
  admin: <svg {...ICON}><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-3 10 2 2 4-4" /></svg>,
};
const blockedDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });
const THEME_LABELS: Record<SiteTheme, string> = { system: 'Системная', light: 'Светлая', graphite: 'Тёмная' };

/** One settings panel, styled like the profile editor's sections. */
function Panel({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return <section className="community-panel profile-editor-group profile-settings" aria-labelledby={`settings-${id}-title`}>
    <div className="profile-editor-group-heading"><h2 id={`settings-${id}-title`}>{title}</h2>{note && <p>{note}</p>}</div>
    {children}
  </section>;
}

const ARROW = <svg {...ICON} width={16} height={16}><path d="m9 6 6 6-6 6" /></svg>;
const TG_GLYPH = <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.7 3.3a1.6 1.6 0 0 0-1.7-.2L2.9 9.6c-1.2.5-1.1 2.2.1 2.6l3.9 1.2 1.5 4.8c.3.9 1.4 1.2 2.1.5l2.2-2.1 4.1 3c.9.7 2.2.2 2.4-.9l2.6-13.9c.1-.6-.1-1.2-.6-1.5ZM10 14.2l-.6 3.2-1.1-3.6 9.4-7.5-7.7 7.9Z" /></svg>;
const CHECK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
/** Icons of the bot's delivery rows, by `TELEGRAM_BOT_OPTIONS` column (plus the city). */
const BOT_ICONS = {
  notify: ICONS.notifications,
  market: <svg {...ICON}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  promoAlerts: <svg {...ICON}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><path d="M7.5 7.5h.01" /></svg>,
  weeklyDigest: <svg {...ICON}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>,
  adminSummary: ICONS.admin,
  city: <svg {...ICON}><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>,
};
const ABOUT_ICONS = {
  terms: <svg {...ICON}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>,
  privacy: <svg {...ICON}><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" /><rect x="9.5" y="10.5" width="5" height="4.5" rx="1" /><path d="M10.5 10.5V9.5a1.5 1.5 0 0 1 3 0v1" /></svg>,
  deletion: <svg {...ICON}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
  bot: <svg {...ICON}><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5" /></svg>,
};
const PERK_ICONS = {
  login: <svg {...ICON}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l4-4-4-4M14 12H4" /></svg>,
};
/** Notification kinds by theme, so the switches read as short lists. */
const NOTIFICATION_GROUPS = [
  { title: 'Отзывы и комментарии', kinds: ['like', 'review-comment', 'comment-reply', 'business-reply'] },
  { title: 'Сообщество', kinds: ['follow', 'mention', 'wall-comment', 'overtaken'] },
  { title: 'Компании и цены', kinds: ['company-post', 'price'] },
  { title: 'Трекер и Банкомат', kinds: ['reminder'] },
] as const;
/** The options of a group; the last one also takes any kind no group names yet. */
function notificationsOf(group: (typeof NOTIFICATION_GROUPS)[number]) {
  const grouped = new Set<string>(NOTIFICATION_GROUPS.flatMap(item => item.kinds));
  const last = group === NOTIFICATION_GROUPS[NOTIFICATION_GROUPS.length - 1];
  return NOTIFICATION_OPTIONS.filter(option => (group.kinds as readonly string[]).includes(option.kind) || (last && !grouped.has(option.kind)));
}
const NOTIFICATION_ICONS: Record<(typeof NOTIFICATION_OPTIONS)[number]['kind'], ReactNode> = {
  follow: <svg {...ICON}><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6" /></svg>,
  like: <svg {...ICON}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>,
  'review-comment': <svg {...ICON}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /></svg>,
  'comment-reply': <svg {...ICON}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v5" /></svg>,
  'business-reply': <svg {...ICON}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>,
  'company-post': <svg {...ICON}><path d="M4 11v2a1 1 0 0 0 1 1h2l5 4V6L7 10H5a1 1 0 0 0-1 1Z" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>,
  mention: <svg {...ICON}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></svg>,
  'wall-comment': <svg {...ICON}><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>,
  price: <svg {...ICON}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><path d="M7.5 7.5h.01" /></svg>,
  overtaken: <svg {...ICON}><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>,
  reminder: <svg {...ICON}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M5 3 2 6M19 3l3 3" /></svg>,
};
const EXTERNAL = <svg {...ICON} width={16} height={16}><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>;

/**
 * Documents and contacts. The site shows them in the footer; the Android app hides the footer, so the stores'
 * reviewers (and members) find the policy and account deletion here.
 */
function AboutLinks() {
  const { contactEmail } = LEGAL_DETAILS;
  const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
  const row = (icon: ReactNode, title: string, hint: string, tail: ReactNode, tone?: string) => <>
    <span className={`settings-row-icon${tone ? ` ${tone}` : ''}`} aria-hidden="true">{icon}</span>
    <span className="settings-row-text"><strong>{title}</strong><small>{hint}</small></span>
    <span className="settings-row-tail" aria-hidden="true">{tail}</span>
  </>;
  return <div className="settings-groups settings-about">
    <section className="settings-group" aria-labelledby="settings-about-docs">
      <h3 className="settings-group-title" id="settings-about-docs">Документы</h3>
      <div className="settings-list">
        <Link className="settings-row" href="/terms">{row(ABOUT_ICONS.terms, 'Пользовательское соглашение', 'Правила сервиса и права на него', ARROW)}</Link>
        <Link className="settings-row" href="/privacy">{row(ABOUT_ICONS.privacy, 'Политика обработки данных', 'Какие данные мы храним и зачем', ARROW)}</Link>
        <Link className="settings-row" href="/account-deletion">{row(ABOUT_ICONS.deletion, 'Удаление аккаунта', 'Как удалить аккаунт и что с данными', ARROW)}</Link>
      </div>
    </section>
    <section className="settings-group" aria-labelledby="settings-about-contact">
      <h3 className="settings-group-title" id="settings-about-contact">Связь</h3>
      <div className="settings-list">
        <a className="settings-row" href={`mailto:${contactEmail}`}>{row(ICONS.email, 'Написать нам', contactEmail, EXTERNAL)}</a>
        <a className="settings-row" href={TELEGRAM_CHANNEL_URL} {...external}>{row(ICONS.telegram, 'Telegram-канал CanRush', 'Новости, акции и обновления', EXTERNAL, 'is-telegram')}</a>
        <a className="settings-row" href={TELEGRAM_BOT_URL} {...external}>{row(ABOUT_ICONS.bot, 'Telegram-бот CanRush', 'Поиск энергетиков прямо в чате', EXTERNAL, 'is-telegram')}</a>
      </div>
    </section>
    <p className="settings-about-note">Используя CanRush, вы подтверждаете своё совершеннолетие. Сервис не аффилирован и не одобрен производителями или ретейлерами; информация представлена в ознакомительных целях. canrush.ru © 2026</p>
  </div>;
}

/** Profile editing and site settings in one place (the header's gear): islands of rows, each opening its panel. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const theme = parseSiteTheme((await cookies()).get(SITE_THEME_COOKIE)?.value) ?? 'system';
  if (!session) return <BrandShell headerAction={<ProfileNavigation />} surfaceClassName="profile-surface">
    <section className="community-directory profile-settings"><h1>Настройки</h1>
      <ThemeSettings theme={theme} />
      <section className="community-panel"><h2>Аккаунт и уведомления</h2><p>Войдите, чтобы настроить профиль, уведомления и посмотреть данные аккаунта.</p><Link className="community-button" href="/sign-in">Войти</Link></section>
      <Panel id="about" title="О CanRush"><AboutLinks /></Panel>
    </section>
  </BrandShell>;

  const query = await searchParams;
  const profile = await ensureOwnProfile(session.user);
  const telegram = getTelegramEnv();
  const telegramOnly = isTelegramPlaceholderEmail(session.user.email);
  const [ratings, wall, listings, experience, friends, favorites, community, siteRole, preferenceRows, telegramLinked, blocked, ownedFrames, announcements] = await Promise.all([
    getProfileRatings(profile.id), getProfileWall(profile.id), getListings(1, profile.id, false, profile.username), getExperience([profile.username]), getConnections(profile.id, 'friends'), getFavoriteGroups(profile.id), getProfileCommunity(profile.id, profile.id), siteRoleForEmail(session.user.email),
    getPool().query<{ kind: string; enabled: boolean }>('select kind,enabled from "notificationPreference" where "userId"=$1', [session.user.id]).then(result => result.rows),
    getPool().query('select 1 from "account" where "userId" = $1 and "providerId" = $2 limit 1', [session.user.id, TELEGRAM_PROVIDER_ID]).then(result => (result.rowCount ?? 0) > 0),
    getBlockedMembers(session.user.id),
    getPool().query<{ key: string }>('select key from "gachaCosmetic" where "userId" = $1', [session.user.id]).then(result => result.rows.map(row => row.key)),
    getPool().query<{ pushAnnouncements: boolean }>('select "pushAnnouncements" from "user" where id = $1', [session.user.id]).then(result => result.rows[0]?.pushAnnouncements ?? true),
  ]);
  const preferences = new Map(preferenceRows.map(row => [row.kind, row.enabled]));
  // «Помощь»: the member's chat with the team is its own screen (/support); the row says when the team has answered.
  const supportUnread = await supportUnreadForUser(session.user.id);
  const botChat = telegram && telegramLinked ? (await getPool().query<Record<string, boolean> & { city: string | null; blocked: boolean }>(`select c.*, c."blockedAt" is not null as blocked from "telegramChat" c
    join account a on a."providerId" = $2 and a."accountId" = c."telegramId"::text where a."userId" = $1`, [session.user.id, TELEGRAM_PROVIDER_ID])).rows[0] : undefined;

  // Administrators see secret tags and the bot's admin summary; moderators only get the panel link.
  const viewerIsAdmin = siteRole === 'admin';
  const achievements = visibleProfileAchievements(viewerIsAdmin, community.earned);
  const earned = community.earned.filter(key => achievements.some(item => item.key === key));
  const layoutPreviews = {
    favorites: favorites.length ? <div className="layout-listing-previews">{favorites.slice(0, 3).map(item => <div key={`${item.brand}:${item.flavor}`}>{item.coverImageUrl && <Image src={item.coverImageUrl} width={80} height={80} alt="" />}<strong>{item.brand}</strong></div>)}</div> : <p>Пока нет избранных напитков.</p>,
    experience: <ProfileExperience username={profile.username} initial={experience[profile.username]} expanded />,
    ratings: <div><strong className="layout-score">{ratings.overall.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} / 10</strong><p>Средняя оценка · {ratings.count} отзывов</p></div>,
    listings: listings.items.length ? <div className="layout-listing-previews">{listings.items.slice(0, 2).map(item => <div key={item.id}>{item.photos[0] && <Image src={`/api/market-photos/${item.photos[0]}?size=thumbnail`} width={80} height={80} unoptimized alt="" />}<strong>{item.title}</strong></div>)}</div> : <p>Вы пока не создавали объявлений.</p>,
    wall: <div><p>{wall.comments[0]?.text ?? 'Здесь пока тихо. Оставьте первый комментарий.'}</p><span className="community-muted">Записей: {wall.count}</span></div>,
    social: <ProfileConnections username={profile.username} friends={friends} />,
  };

  const enabledNotifications = NOTIFICATION_OPTIONS.filter(option => preferences.get(option.kind) ?? true).length;
  const settings: SettingsGroup[] = [{ key: 'settings', title: 'Настройки', rows: [
    { key: 'theme', title: 'Тема сайта', value: THEME_LABELS[theme], icon: ICONS.theme, panel: <ThemeSettings theme={theme} /> },
    { key: 'notifications', title: 'Уведомления', value: `Включено ${enabledNotifications} из ${NOTIFICATION_OPTIONS.length}`, icon: ICONS.notifications, panel:
      <Panel id="notifications" title="Уведомления" note="Выберите, о каких новых событиях сообщать на сайте. Уже полученные уведомления сохранятся.">
        <form action={saveNotificationSettings} className="settings-groups">
          {NOTIFICATION_GROUPS.map(group => <section key={group.title} className="settings-group" aria-label={group.title}>
            <h3 className="settings-group-title">{group.title}</h3>
            <div className="settings-list">
              {notificationsOf(group).map(option => <label className="settings-row" key={option.kind}>
                <span className="settings-row-icon" aria-hidden="true">{NOTIFICATION_ICONS[option.kind]}</span>
                <span className="settings-row-text"><strong>{option.label}</strong></span>
                <input className="settings-switch" type="checkbox" role="switch" name={option.kind} defaultChecked={preferences.get(option.kind) ?? true} />
              </label>)}
            </div>
          </section>)}
          <section className="settings-group" aria-label="Новости CanRush">
            <h3 className="settings-group-title">Новости CanRush</h3>
            <div className="settings-list">
              <label className="settings-row">
                <span className="settings-row-icon" aria-hidden="true"><svg {...ICON}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Zm13-3a5 5 0 0 1 0 8" /></svg></span>
                <span className="settings-row-text"><strong>Новости и события в приложении</strong><small>Push о новых сезонах и событиях CanRush</small></span>
                <input className="settings-switch" type="checkbox" role="switch" name="announcements" defaultChecked={announcements} />
              </label>
            </div>
          </section>
          <button className="community-button settings-save" type="submit">Сохранить настройки</button>
          {query.saved === '1' && <p className="settings-saved" role="status">{CHECK}Настройки сохранены.</p>}
        </form>
      </Panel> },
    ...(telegram ? [{ key: 'telegram-bot', title: 'Вход и бот Telegram', tone: 'telegram', icon: ICONS.telegram,
      value: telegramLinked ? (botChat && !botChat.blocked ? `Привязан · бот @${telegram.botUsername} подключён` : 'Привязан · бот не подключён') : 'Не привязан',
      panel: <Panel id="telegram" title="Вход и бот Telegram">
        {telegramLinked ? <>
          <div className="tg-settings-card is-linked">
            <span className="tg-settings-icon" aria-hidden="true">{TG_GLYPH}<span className="tg-settings-check">{CHECK}</span></span>
            <div className="tg-settings-copy"><span className="tg-settings-title"><strong>Telegram привязан</strong><span className="tg-settings-chip is-on">Вход включён</span></span><span>Мини-приложение CanRush открывает этот аккаунт сразу, без письма.</span></div>
          </div>
          <div className="tg-settings-bot">
            <div className="tg-settings-bot-head"><h3>Бот @{telegram.botUsername}</h3><span className={`tg-settings-chip${botChat && !botChat.blocked ? ' is-on' : ''}`}>{botChat && !botChat.blocked ? 'Подключён' : botChat?.blocked ? 'Остановлен' : 'Не подключён'}</span></div>
          {botChat && !botChat.blocked ? <form action={saveTelegramBotSettings} className="telegram-bot-settings">
            <p className="community-section-note">Что бот присылает в Telegram. Уведомления сайта приходят по тем же правилам, что выбраны в «Уведомлениях».</p>
            <div className="settings-list">
              {TELEGRAM_BOT_OPTIONS.filter(option => !option.adminOnly || viewerIsAdmin).map(option => <label className="settings-row" key={option.column}>
                <span className="settings-row-icon" aria-hidden="true">{BOT_ICONS[option.column]}</span>
                <span className="settings-row-text"><strong>{option.label}</strong><small>{option.hint}</small></span>
                <input className="settings-switch" type="checkbox" role="switch" name={option.column} defaultChecked={botChat[option.column] ?? true} />
              </label>)}
              <label className="settings-row">
                <span className="settings-row-icon" aria-hidden="true">{BOT_ICONS.city}</span>
                <span className="settings-row-text"><strong>Город для цен и акций</strong><small>Для подборки и поиска в боте</small></span>
                <select className="settings-select" name="city" defaultValue={botChat.city ?? DEFAULT_CITY.id}>{CITIES.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select>
              </label>
            </div>
            <button className="community-button settings-save" type="submit">Сохранить</button>
            {query.saved === 'telegram' && <p className="settings-saved" role="status">{CHECK}Настройки бота сохранены.</p>}
          </form> : <>
            <p className="community-section-note">{botChat?.blocked ? 'Бот остановлен в Telegram. Нажмите «Старт» в чате, и он снова будет присылать уведомления.' : 'Бот присылает уведомления сайта, сообщения маркета и акции на ваше избранное, а ещё ищет энергетики прямо в чате.'}</p>
            <a className="community-button tg-settings-link" href={`https://t.me/${telegram.botUsername}?start=settings`} target="_blank" rel="noopener noreferrer">{TG_GLYPH}{botChat?.blocked ? 'Снова подключить бота' : 'Подключить бота'}</a>
          </>}
          </div>
          <div className="tg-settings-danger">
            {telegramOnly
              ? <p className="field-help">Аккаунт создан через Telegram, поэтому отвязать его нельзя: войти без Telegram будет нечем.</p>
              : <><div><strong>Отвязать Telegram</strong><span>Вход останется по почте {session.user.email}. Привязать снова можно в любой момент.</span></div><TelegramUnlinkButton action={unlinkTelegram} /></>}
          </div>
        </> : <>
          <div className="tg-settings-invite">
            <span className="tg-settings-icon" aria-hidden="true">{TG_GLYPH}</span>
            <strong>Привяжите Telegram</strong>
            <span>Один раз — и аккаунт открывается в Telegram без писем, а бот присылает всё важное.</span>
          </div>
          <div className="settings-list tg-settings-perks">
            <div className="settings-row"><span className="settings-row-icon is-telegram" aria-hidden="true">{PERK_ICONS.login}</span><span className="settings-row-text"><strong>Вход в один тап</strong><small>Мини-приложение CanRush открывает аккаунт сразу</small></span></div>
            <div className="settings-row"><span className="settings-row-icon is-telegram" aria-hidden="true">{ICONS.notifications}</span><span className="settings-row-text"><strong>Уведомления и маркет</strong><small>Ответы, подписки и сообщения заказов от @{telegram.botUsername}</small></span></div>
            <div className="settings-row"><span className="settings-row-icon is-telegram" aria-hidden="true">{BOT_ICONS.promoAlerts}</span><span className="settings-row-text"><strong>Акции на избранное</strong><small>Каждое утро и подборка недели</small></span></div>
          </div>
          <TelegramLinkButton />
          <p className="field-help tg-settings-hint">Откроется Telegram — подтвердите там. Ссылка действует 10 минут.</p>
        </>}
      </Panel> } satisfies SettingsRow] : []),
    { key: 'blocked', title: 'Заблокированные', value: blocked.length ? `Заблокировано: ${blocked.length}` : 'Никого', icon: ICONS.blocked, panel:
      <Panel id="blocked" title="Заблокированные участники" note="Заблокированные не могут вам отвечать, писать на вашей стене, подписываться и заказывать у вас, а их записи, комментарии и отзывы скрыты от вас.">
        {blocked.length ? <ul className="blocked-members">{blocked.map(member => {
          const name = member.name.trim() && !member.name.includes('@') ? member.name : member.username ?? 'Участник';
          const person = <>
            <span className="blocked-member-avatar" aria-hidden="true">{member.avatarId ? <Image src={`/api/profile-images/${member.avatarId}`} width={44} height={44} unoptimized alt="" /> : name.slice(0, 1).toUpperCase()}</span>
            <span className="blocked-member-text"><strong>{name}</strong><small>{member.username ? `@${member.username} · ` : ''}заблокирован {blockedDate.format(member.blockedAt)}</small></span>
          </>;
          return <li key={member.id}>
            {member.username ? <Link className="blocked-member" href={`/profile/${member.username}`}>{person}</Link> : <span className="blocked-member">{person}</span>}
            <BlockMemberButton userId={member.id} name={member.username ? `@${member.username}` : 'участника'} initiallyBlocked compact />
          </li>;
        })}</ul> : <div className="blocked-members-empty"><span aria-hidden="true">{ICONS.blocked}</span><p>Вы никого не блокировали. Заблокировать участника можно на его профиле или после жалобы.</p></div>}
      </Panel> },
  ] }, ...(siteRole ? [{ key: 'admin', title: 'Администрирование', rows: [
    { key: 'admin', title: 'Админ-панель', value: 'Аналитика, жалобы, модерация', tone: 'admin', icon: ICONS.admin, href: '/admin' } satisfies SettingsRow,
  ] }] : []), { key: 'about', title: 'О CanRush', rows: [
    { key: 'help', title: 'Помощь и поддержка', value: supportUnread ? 'Новый ответ поддержки' : 'Напишите команде CanRush', tone: supportUnread ? 'admin' : undefined, icon: ICONS.help, href: '/support' } satisfies SettingsRow,
    { key: 'about', title: 'Документы и связь', value: 'Соглашение, политика, удаление аккаунта', icon: ICONS.about, panel:
      <Panel id="about" title="Документы и связь"><AboutLinks /></Panel> },
  ] }];
  const accountRows: SettingsRow[] = [{ key: 'email', title: 'Почта для входа', value: telegramOnly ? 'Вход через Telegram' : session.user.email, icon: ICONS.email, panel:
    <Panel id="email" title="Почта для входа">
      {telegramOnly ? <p className="field-help">Аккаунт создан через Telegram, вход выполняется в мини-приложении CanRush.</p> : <div className="profile-edit-field"><label htmlFor="account-email">Почта</label><input id="account-email" type="email" value={session.user.email} readOnly /><p className="field-help">Почта для входа в аккаунт. Для смены требуется повторное подтверждение.</p></div>}
    </Panel> }];

  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <ProfileEditForm level={experienceLevel(experience[profile.username]?.xp ?? 0).level} xp={experience[profile.username]?.xp ?? 0} ownedFrames={ownedFrames} profile={profile} layoutPreviews={layoutPreviews}
      tags={{ earned: earned.length, total: achievements.length, selected: profileTagLabel(community.tags[0]), picker: <AchievementPicker key={community.tags.join(',')} earned={earned} selected={community.tags} progress={community.progress} isOwn viewerIsAdmin={viewerIsAdmin} /> }}
      settings={settings} accountRows={accountRows} />
  </BrandShell>;
}
