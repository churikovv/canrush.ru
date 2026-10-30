import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import '@/styles/feed.css';
import { stopGiveawayAction } from '@/app/admin/giveaways/actions';
import { AdminGiveawayForm } from '@/components/admin-giveaway-form';
import { AdminShell } from '@/components/admin-shell';
import { requireFullAdmin } from '@/lib/admin';
import { getAdminQueues } from '@/lib/admin-queues';
import { GIVEAWAY_STATUS_LABELS, giveawayStatus, moscowInputValue } from '@/lib/spin-giveaway-fields';
import { listGiveaways } from '@/lib/spin-giveaways';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Раздачи круток', robots: { index: false, follow: false } };

const formatDate = (date: Date) => date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const DAY = 86_400_000;

/** Spin giveaways: a banner in the feed that gifts Банкомат spins for a look. Only full admins: this is a currency. */
export default async function AdminGiveawaysPage() {
  const admin = await requireFullAdmin();
  const [queues, history] = await Promise.all([getAdminQueues(), listGiveaways()]);
  // eslint-disable-next-line react-hooks/purity -- a server component renders once per request.
  const now = Date.now();
  return <AdminShell queues={queues} active="giveaways" email={admin.email} title="Раздачи круток" subtitle="Баннер в ленте дарит крутки Банкомата за просмотр: участник держит его на экране и забирает подарок. Только новости сервиса: реклама партнёров сюда не идёт.">
    <section className="admin-data-panel"><div className="admin-panel-heading"><h2>Новая раздача</h2></div><AdminGiveawayForm start={moscowInputValue(now)} end={moscowInputValue(now + 3 * DAY)} /></section>
    <section className="admin-data-panel">
      <div className="admin-panel-heading"><h2>История · {history.length}</h2></div>
      {history.length ? <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>Раздача</th><th>Круток</th><th>Когда</th><th>Увидели</th><th>Забрали</th><th>Статус</th><th /></tr></thead>
        <tbody>{history.map(row => {
          const status = giveawayStatus(row, now);
          return <tr key={row.id}>
            <td><strong>{row.title}</strong><br /><span className="admin-table-muted">{row.body}</span><br /><span className="admin-table-muted">{row.adminEmail}</span></td>
            <td>{row.spins} · {row.viewSeconds} с</td>
            <td>{formatDate(row.startsAt)} —<br />{formatDate(row.endsAt)}</td>
            <td>{row.seen}</td>
            <td>{row.claimed}{row.maxClaims !== null && ` из ${row.maxClaims}`}{row.seen > 0 && <><br /><span className="admin-table-muted">{Math.round(row.claimed / row.seen * 100)}% увидевших</span></>}</td>
            <td>{GIVEAWAY_STATUS_LABELS[status]}</td>
            <td>{(status === 'live' || status === 'planned') && <form action={stopGiveawayAction}><input type="hidden" name="id" value={row.id} /><button className="community-button community-button-secondary" type="submit">Остановить</button></form>}</td>
          </tr>;
        })}</tbody>
      </table></div> : <p className="admin-table-muted">Раздач пока не было.</p>}
    </section>
  </AdminShell>;
}
