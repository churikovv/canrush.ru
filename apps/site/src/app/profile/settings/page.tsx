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
import { saveNotificationSettings } from './actions';
export const metadata = { title: 'Настройки', robots: { index: false, follow: false } };
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const theme = parseSiteTheme((await cookies()).get(SITE_THEME_COOKIE)?.value) ?? 'system';
  const { rows } = session ? await getPool().query<{ kind: string; enabled: boolean }>('select kind,enabled from "notificationPreference" where "userId"=$1', [session.user.id]) : { rows: [] };
  const preferences = new Map(rows.map(row => [row.kind, row.enabled]));
  return <BrandShell headerAction={<ProfileNavigation />} surfaceClassName="profile-surface">
    <section className="community-directory profile-settings"><ProfileBackButton /><h1>Настройки</h1>
      <ThemeSettings theme={theme} />
      {session ? <>
      <section className="community-panel ym-hide-content"><h2>Аккаунт</h2><div className="profile-edit-field"><label htmlFor="account-email">Почта</label><input id="account-email" type="email" value={session.user.email} readOnly /><p className="field-help">Почта для входа в аккаунт. Для смены требуется повторное подтверждение.</p></div></section>
      <form action={saveNotificationSettings} className="community-panel"><h2>Уведомления</h2>
        <p className="community-section-note">Выберите, о каких новых событиях сообщать на сайте. Уже полученные уведомления сохранятся.</p>
        {NOTIFICATION_OPTIONS.map(option => <label className="notification-setting" key={option.kind}><span>{option.label}</span><input type="checkbox" name={option.kind} defaultChecked={preferences.get(option.kind) ?? true} /></label>)}
        <button className="community-button" type="submit">Сохранить настройки</button>
        {(await searchParams).saved === '1' && <p role="status">Настройки сохранены.</p>}
      </form>
      </> : <section className="community-panel"><h2>Аккаунт и уведомления</h2><p>Войдите, чтобы настроить уведомления и посмотреть данные аккаунта.</p><Link className="community-button" href="/sign-in">Войти</Link></section>}
    </section>
  </BrandShell>;
}
