import '@/styles/shared.css';
import '@/styles/profile.css';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ThemeSettings } from '@/components/theme-settings';
import { parseSiteTheme, SITE_THEME_COOKIE } from '@/lib/site-theme';
import Link from '@/components/navigation-progress';
import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getPool } from '@/db/pool';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { NOTIFICATION_OPTIONS } from '@/lib/notification-preferences';
import { getTelegramEnv } from '@/lib/env';
import { TELEGRAM_PROVIDER_ID } from '@/lib/telegram-auth';
import { isTelegramPlaceholderEmail } from '@/lib/telegram-init-data';
import { TelegramLinkButton } from '@/components/telegram-link-button';
import { isSiteAdminEmail } from '@/lib/admin';
import { CITIES, DEFAULT_CITY } from '@canrush/shared';
import { TELEGRAM_BOT_OPTIONS } from '@/lib/telegram-bot/settings';
import { saveNotificationSettings, saveTelegramBotSettings, unlinkTelegram } from './actions';
export const metadata = { title: 'Настройки', robots: { index: false, follow: false } };
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const theme = parseSiteTheme((await cookies()).get(SITE_THEME_COOKIE)?.value) ?? 'system';
  const { rows } = session ? await getPool().query<{ kind: string; enabled: boolean }>('select kind,enabled from "notificationPreference" where "userId"=$1', [session.user.id]) : { rows: [] };
  const preferences = new Map(rows.map(row => [row.kind, row.enabled]));
  const telegramLinked = session ? ((await getPool().query('select 1 from "account" where "userId" = $1 and "providerId" = $2 limit 1', [session.user.id, TELEGRAM_PROVIDER_ID])).rowCount ?? 0) > 0 : false;
  const telegramOnly = session ? isTelegramPlaceholderEmail(session.user.email) : false;
  const telegram = getTelegramEnv();
  const botChat = session && telegram && telegramLinked ? (await getPool().query<Record<string, boolean> & { city: string | null; blocked: boolean }>(`select c.*, c."blockedAt" is not null as blocked from "telegramChat" c
    join account a on a."providerId" = $2 and a."accountId" = c."telegramId"::text where a."userId" = $1`, [session.user.id, TELEGRAM_PROVIDER_ID])).rows[0] : undefined;
  const isAdmin = session && botChat ? await isSiteAdminEmail(session.user.email) : false;
  const query = await searchParams;
  return <BrandShell headerAction={<ProfileNavigation />} surfaceClassName="profile-surface">
    <section className="community-directory profile-settings"><ProfileBackButton /><h1>Настройки</h1>
      <ThemeSettings theme={theme} />
      {session ? <>
      <section className="community-panel ym-hide-content"><h2>Аккаунт</h2>{telegramOnly ? <p className="field-help">Аккаунт создан через Telegram, вход выполняется в мини-приложении CanRush.</p> : <div className="profile-edit-field"><label htmlFor="account-email">Почта</label><input id="account-email" type="email" value={session.user.email} readOnly /><p className="field-help">Почта для входа в аккаунт. Для смены требуется повторное подтверждение.</p></div>}
        </section>
      <form action={saveNotificationSettings} className="community-panel"><h2>Уведомления</h2>
        <p className="community-section-note">Выберите, о каких новых событиях сообщать на сайте. Уже полученные уведомления сохранятся.</p>
        {NOTIFICATION_OPTIONS.map(option => <label className="notification-setting" key={option.kind}><span>{option.label}</span><input type="checkbox" name={option.kind} defaultChecked={preferences.get(option.kind) ?? true} /></label>)}
        <button className="community-button" type="submit">Сохранить настройки</button>
        {query.saved === '1' && <p role="status">Настройки сохранены.</p>}
      </form>
      {telegram && <section className="community-panel telegram-settings" id="telegram"><h2>Telegram</h2>
        {telegramLinked ? <>
          <p className="community-section-note">Telegram привязан: мини-приложение CanRush открывает этот аккаунт без письма.</p>
          {!telegramOnly && <form action={unlinkTelegram}><button className="community-button" type="submit">Отвязать Telegram</button></form>}
          <h3>Бот @{telegram.botUsername}</h3>
          {botChat && !botChat.blocked ? <form action={saveTelegramBotSettings} className="telegram-bot-settings">
            <p className="community-section-note">Что бот присылает в Telegram. Уведомления сайта приходят по тем же правилам, что выбраны выше.</p>
            {TELEGRAM_BOT_OPTIONS.filter(option => !option.adminOnly || isAdmin).map(option => <label className="notification-setting" key={option.column}><span>{option.label}</span><input type="checkbox" name={option.column} defaultChecked={botChat[option.column] ?? true} /></label>)}
            <label className="notification-setting"><span>Город для цен и акций</span><select name="city" defaultValue={botChat.city ?? DEFAULT_CITY.id}>{CITIES.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
            <button className="community-button" type="submit">Сохранить</button>
            {query.saved === 'telegram' && <p role="status">Настройки бота сохранены.</p>}
          </form> : <>
            <p className="community-section-note">Бот присылает уведомления сайта, сообщения маркета и акции на ваше избранное, а ещё ищет энергетики прямо в чате.</p>
            <a className="community-button" href={`https://t.me/${telegram.botUsername}?start=settings`} target="_blank" rel="noopener noreferrer">{botChat?.blocked ? 'Снова подключить бота' : 'Подключить бота'}</a>
          </>}
        </> : <>
          <p className="community-section-note">Привяжите Telegram, чтобы входить в этот аккаунт из мини-приложения CanRush и получать уведомления от бота @{telegram.botUsername}. Ссылка для привязки действует 10 минут.</p>
          <TelegramLinkButton />
        </>}
      </section>}
      </> : <section className="community-panel"><h2>Аккаунт и уведомления</h2><p>Войдите, чтобы настроить уведомления и посмотреть данные аккаунта.</p><Link className="community-button" href="/sign-in">Войти</Link></section>}
    </section>
  </BrandShell>;
}
