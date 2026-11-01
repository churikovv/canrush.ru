import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import { decideHuntOrderAction } from '@/app/admin/hunt/actions';
import { AdminShell } from '@/components/admin-shell';
import { FormAlert } from '@/components/form-alert';
import Link from '@/components/navigation-progress';
import { requireFullAdmin } from '@/lib/admin';
import { getAdminQueues } from '@/lib/admin-queues';
import { HUNT_ORDER_STATUS, huntItemName, huntLastDay, huntPayoutLabel } from '@/lib/hunt-fields';
import { huntIssued, listHuntOrders } from '@/lib/hunt';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Охота за ценниками', robots: { index: false, follow: false } };

const formatDate = (date: Date) => date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Заявки на обмен ценников. Только админы: здесь деньги и расшифрованные реквизиты, которые стираются вместе с решением по заявке. */
export default async function AdminHuntPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const admin = await requireFullAdmin();
  const { error } = await searchParams;
  const [queues, orders, { event, issued }] = await Promise.all([getAdminQueues(), listHuntOrders(), huntIssued()]);
  return <AdminShell queues={queues} active="hunt" email={admin.email} title="Охота за ценниками" subtitle={`Начислено ${issued.toLocaleString('ru-RU')} из ${event.budget.toLocaleString('ru-RU')} · приём до ${huntLastDay(event.endsAt)}, сгорание после ${huntLastDay(event.burnsAt)}`}>
    {error && <FormAlert tone="error">{error}</FormAlert>}
    <section className="admin-data-panel">
      <div className="admin-panel-heading"><h2>Заявки · {orders.length}</h2></div>
      {orders.length ? <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>Участник</th><th>Обмен</th><th>Магазины</th><th>Дата</th><th>Статус</th><th /></tr></thead>
        <tbody>{orders.map(order => <tr key={order.id}>
          <td>{order.username ? <Link href={`/profile/${encodeURIComponent(order.username)}`}>{order.username}</Link> : (order.name ?? 'Аккаунт удалён')}{order.email && <><br /><span className="admin-table-muted">{order.email}</span></>}</td>
          <td><b>{huntItemName(order.item)}</b><br />{order.amount.toLocaleString('ru-RU')} ₽{order.status === 'new' && order.payout !== null && <><br /><span className="admin-table-muted">{order.payout ? huntPayoutLabel(order.payout) : 'Реквизиты не читаются'}</span></>}</td>
          <td>{order.stores} · {order.earned} ц.</td>
          <td>{formatDate(order.createdAt)}</td>
          <td>{HUNT_ORDER_STATUS[order.status]}{order.note && <><br /><span className="admin-table-muted">{order.note}</span></>}</td>
          <td>{order.status === 'new' && <div className="hunt-admin-actions">
            {order.userId && order.telegram && <Link className="community-button community-button-secondary admin-action-button" href={`/admin/bot?user=${order.userId}`}>Написать</Link>}
            <form action={decideHuntOrderAction}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="status" value="done" /><button className="community-button admin-action-button">Выполнено</button></form>
            <form action={decideHuntOrderAction}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="status" value="cancelled" /><input name="note" required maxLength={300} placeholder="Причина отмены" aria-label="Причина отмены" /><button className="community-button community-button-secondary admin-action-button">Отменить</button></form>
          </div>}</td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-table-muted">Заявок пока нет.</p>}
    </section>
  </AdminShell>;
}
