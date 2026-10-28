import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import '@/styles/market.css';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { AdminShell } from '@/components/admin-shell';
import { BusinessSegments } from '@/components/business-shell';
import { SupportChat, SupportStatusButton } from '@/components/support-chat';
import { requireSiteAdmin } from '@/lib/admin';
import { getAdminQueues } from '@/lib/admin-queues';
import { getSupportThread, listSupportThreads, supportMessages, type SupportView } from '@/lib/support';

export const metadata: Metadata = { title: 'Поддержка', robots: { index: false } };

const VIEWS: { key: SupportView; label: string }[] = [{ key: 'unread', label: 'Ждут ответа' }, { key: 'open', label: 'Открытые' }, { key: 'closed', label: 'Закрытые' }, { key: 'all', label: 'Все' }];
const when = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

/**
 * «Поддержка»: members' chats with the team, built on the order chat. The list (waiting first by default, search by
 * name, nick, mail and text) and the open thread side by side from 960 px, one at a time on phones. Moderators answer
 * too; only administrators see a member's mail.
 */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; thread?: string }> }) {
  const [admin, params] = await Promise.all([requireSiteAdmin(), searchParams]);
  const view = VIEWS.find(item => item.key === params.view)?.key ?? 'unread';
  const query = (params.q ?? '').slice(0, 80);
  const [threads, queues, thread] = await Promise.all([listSupportThreads(view, query), getAdminQueues(), params.thread ? getSupportThread(params.thread) : null]);
  const initial = thread ? await supportMessages(thread.id) : null;
  const href = (extra: Record<string, string | undefined>) => `/admin/support?${new URLSearchParams(Object.entries({ view, q: query || undefined, ...extra }).filter((entry): entry is [string, string] => Boolean(entry[1])))}`;
  return <AdminShell queues={queues} active="support" email={admin.email} role={admin.role} title="Поддержка" subtitle="Обращения участников из «Помощи» в настройках. Ответ придёт им уведомлением, в Telegram и push.">
    <div className="support-admin" data-thread={thread ? '' : undefined}>
      <section className="support-admin-list" aria-label="Обращения">
        <div className="bc-toolbar is-inner">
          <BusinessSegments label="Обращения" items={VIEWS.map(item => ({ href: href({ view: item.key, thread: undefined }), label: item.label, current: item.key === view, ...(item.key === 'unread' ? { count: queues.support } : {}) }))} />
          <form className="bc-search is-inline" action="/admin/support" role="search">
            <input type="hidden" name="view" value={view} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input name="q" type="search" defaultValue={query} placeholder="Имя, ник или текст" aria-label="Поиск по обращениям" maxLength={80} />
          </form>
        </div>
        {threads.length ? <ul className="support-admin-threads">{threads.map(item => <li key={item.id}>
          <Link href={href({ thread: item.id })} aria-current={item.id === thread?.id ? 'page' : undefined} data-unread={item.unread || undefined}>
            <span className="support-admin-avatar" aria-hidden="true">{item.avatarId
              // eslint-disable-next-line @next/next/no-img-element -- the avatar is served from the database
              ? <img src={`/api/profile-images/${item.avatarId}`} alt="" width={40} height={40} /> : item.name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>
            <span className="support-admin-text">
              <strong>{item.name}{item.username && <small> @{item.username}</small>}</strong>
              <span>{item.lastFromStaff && 'Вы: '}{item.preview}</span>
            </span>
            <span className="support-admin-meta"><time dateTime={item.lastMessageAt}>{when.format(new Date(item.lastMessageAt))}</time>
              {item.unread ? <b className="support-admin-dot" aria-label="Ждёт ответа" /> : item.status === 'closed' ? <small>закрыто</small> : null}</span>
          </Link>
        </li>)}</ul> : <div className="bc-empty"><strong>{view === 'unread' ? 'Все ответы отправлены' : 'Обращений нет'}</strong><span>{query ? 'По этому запросу ничего не нашлось.' : 'Новые обращения появятся здесь.'}</span></div>}
      </section>
      <section className="support-admin-thread" aria-label="Переписка">
        {thread && initial ? <>
          <div className="support-admin-thread-head">
            <Link className="bc-link support-admin-back" href={href({ thread: undefined })}>← К обращениям</Link>
            <div><strong>{thread.username ? <Link href={`/profile/${thread.username}`}>{thread.name}</Link> : thread.name}</strong>
              <small>{[thread.username && `@${thread.username}`, admin.role === 'admin' ? thread.email : null, `с ${when.format(new Date(thread.createdAt))}`].filter(Boolean).join(' · ')}</small></div>
            <SupportStatusButton threadId={thread.id} status={thread.status} />
          </div>
          <SupportChat key={thread.id} staff threadId={thread.id} initial={{ thread, ...initial }} empty={<div className="market-chat-empty"><strong>Пустая переписка</strong></div>} />
        </> : <div className="bc-empty support-admin-pick"><strong>Выберите обращение</strong><span>Слева — обращения участников; ждущие ответа отмечены точкой.</span></div>}
      </section>
    </div>
  </AdminShell>;
}
