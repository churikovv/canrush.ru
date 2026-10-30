import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { AdminShell } from '@/components/admin-shell';
import { BusinessSegments } from '@/components/business-shell';
import { requireFullAdmin } from '@/lib/admin';
import { getAdminQueues } from '@/lib/admin-queues';
import { listErrorGroups } from '@/lib/error-log';
import { setErrorHiddenAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ошибки сайта', robots: { index: false, follow: false } };

const when = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

/**
 * «Ошибки»: server errors and crashes in browsers, grouped (`src/lib/error-log.ts`), newest first. Administrators only:
 * a stack is not for moderators. Groups silent for 30 days disappear.
 */
export default async function AdminErrorsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const [admin, params] = await Promise.all([requireFullAdmin(), searchParams]);
  const hidden = params.view === 'hidden';
  const page = Math.min(1000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const [{ items, hasMore, visible, hidden: hiddenCount }, queues] = await Promise.all([listErrorGroups(hidden, page), getAdminQueues()]);
  const href = (view: boolean, to = 1) => `/admin/errors?${new URLSearchParams({ ...(view ? { view: 'hidden' } : {}), ...(to > 1 ? { page: String(to) } : {}) })}`;
  return <AdminShell queues={queues} active="errors" email={admin.email} role={admin.role} title="Ошибки сайта" subtitle="Ошибки сервера и сбои в браузерах за 30 дней. О новых приходит сообщение в Telegram, не чаще раза в час на ошибку.">
    <BusinessSegments label="Ошибки" items={[{ href: href(false), label: 'Активные', current: !hidden, count: visible }, { href: href(true), label: 'Скрытые', current: hidden, count: hiddenCount }]} />
    {items.length ? <div className="bc-table-card"><table className="bc-table admin-error-table">
      <thead><tr><th scope="col">Ошибка</th><th scope="col">Где</th><th scope="col">Повторов</th><th scope="col">Последний раз</th><th scope="col"><span className="sr-only">Действие</span></th></tr></thead>
      <tbody>{items.map(item => <tr key={item.hash}>
        <td>
          <span className="admin-error-message">{item.message}</span>
          {item.stack && <details className="admin-error-stack"><summary>Стек</summary><pre>{item.stack}</pre></details>}
        </td>
        <td data-label="Где"><span className="admin-error-where"><span className="bc-pill" data-tone={item.source === 'server' ? 'bad' : 'mid'}>{item.source === 'server' ? 'Сервер' : 'Браузер'}</span><code>{item.path}</code></span></td>
        <td data-label="Повторов">{item.count.toLocaleString('ru-RU')}</td>
        <td data-label="Последний раз"><time dateTime={item.lastSeenAt.toISOString()} title={`Впервые: ${when.format(item.firstSeenAt)}`}>{when.format(item.lastSeenAt)}</time></td>
        <td className="admin-error-action"><form action={setErrorHiddenAction}>
          <input type="hidden" name="hash" value={item.hash} />
          {!hidden && <input type="hidden" name="hidden" value="1" />}
          <button className="bc-button is-outline" type="submit">{hidden ? 'Вернуть' : 'Скрыть'}</button>
        </form></td>
      </tr>)}</tbody>
    </table></div> : <div className="bc-empty"><strong>{hidden ? 'Скрытых ошибок нет' : 'Ошибок нет'}</strong><span>{hidden ? 'Скрытая ошибка продолжает считаться, но не присылает сообщений.' : 'Новые ошибки появятся здесь и придут в Telegram.'}</span></div>}
    {(page > 1 || hasMore) && <nav className="admin-table-pagination" aria-label="Страницы ошибок"><span>Страница {page}</span><div>{page > 1 && <Link href={href(hidden, page - 1)}>← Назад</Link>}{hasMore && <Link href={href(hidden, page + 1)}>Далее →</Link>}</div></nav>}
  </AdminShell>;
}
