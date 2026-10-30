import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import { AdminPushForm } from '@/components/admin-push-form';
import { AdminShell } from '@/components/admin-shell';
import { FormAlert } from '@/components/form-alert';
import { requireFullAdmin } from '@/lib/admin';
import { getAdminQueues } from '@/lib/admin-queues';
import { getPushEnv } from '@/lib/env';
import { getBroadcastReach, listBroadcasts, type BroadcastRow } from '@/lib/push-broadcast';
import { AUDIENCE_LABELS, BROADCAST_PAUSE_MINUTES } from '@/lib/push-broadcast-fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Push-рассылки', robots: { index: false, follow: false } };

const formatDate = (date: Date) => date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function pushConfigured(): boolean {
  try {
    const env = getPushEnv();
    return Boolean(env.fcm || env.rustore || env.apns);
  } catch {
    return false;
  }
}

function Delivery({ row }: { row: BroadcastRow }) {
  if (row.pending) return <>{row.recipients - row.pending} из {row.recipients} · отправляется</>;
  return <>{row.delivered} из {row.recipients}</>;
}

/** Push to the app's members: only full admins, a test on your own phone first, then a queue with a history. */
export default async function AdminPushPage() {
  const admin = await requireFullAdmin();
  const [queues, reach, history] = await Promise.all([getAdminQueues(), getBroadcastReach(), listBroadcasts()]);
  return <AdminShell queues={queues} active="push" email={admin.email} title="Push-рассылки" subtitle={`Новости сервиса участникам с приложением. Сначала отправьте себе, между рассылками — не меньше ${BROADCAST_PAUSE_MINUTES} минут.`}>
    {!pushConfigured() && <FormAlert tone="warning" title="Отправка не настроена">Ключи FCM, RuStore Push и APNs не заданы: рассылка встанет в очередь и не уйдёт.</FormAlert>}
    <section className="admin-data-panel"><div className="admin-panel-heading"><h2>Новая рассылка</h2></div><AdminPushForm reach={reach} /></section>
    <section className="admin-data-panel">
      <div className="admin-panel-heading"><h2>История · {history.length}</h2></div>
      {history.length ? <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>Когда</th><th>Сообщение</th><th>Кому</th><th>Доставлено</th><th>Кто</th></tr></thead>
        <tbody>{history.map(row => <tr key={row.id}>
          <td>{formatDate(row.createdAt)}</td>
          <td><strong>{row.title}</strong><br /><span className="admin-table-muted">{row.body}</span><br /><span className="admin-table-muted">{row.path}</span></td>
          <td>{AUDIENCE_LABELS[row.audience]}</td>
          <td><Delivery row={row} /></td>
          <td>{row.adminEmail}</td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-table-muted">Рассылок пока не было.</p>}
    </section>
  </AdminShell>;
}
