import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getPool } from '@/db/pool';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { NOTIFICATION_OPTIONS } from '@/lib/notification-preferences';
import { saveNotificationSettings } from './actions';
export const metadata = { title: 'Настройки уведомлений', robots: { index: false, follow: false } };
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const { rows } = await getPool().query<{ kind: string; enabled: boolean }>('select kind,enabled from "notificationPreference" where "userId"=$1', [session.user.id]);
  const preferences = new Map(rows.map(row => [row.kind, row.enabled]));
  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <section className="community-directory profile-settings"><Link href="/profile">← В профиль</Link><h1>Настройки</h1>
      <form action={saveNotificationSettings} className="community-panel"><h2>Уведомления</h2>
        <p className="community-section-note">Выберите, о каких новых событиях сообщать на сайте. Уже полученные уведомления сохранятся.</p>
        {NOTIFICATION_OPTIONS.map(option => <label className="notification-setting" key={option.kind}><span>{option.label}</span><input type="checkbox" name={option.kind} defaultChecked={preferences.get(option.kind) ?? true} /></label>)}
        <button className="community-button" type="submit">Сохранить настройки</button>
        {(await searchParams).saved === '1' && <p role="status">Настройки сохранены.</p>}
      </form>
    </section>
  </BrandShell>;
}
