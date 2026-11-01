import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import '@/styles/market.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from '@/components/navigation-progress';
import { AdminBotForm } from '@/components/admin-bot-form';
import { AdminShell } from '@/components/admin-shell';
import { requireFullAdmin } from '@/lib/admin';
import { getAdminQueues } from '@/lib/admin-queues';
import { BOT_DIALOG_DAYS, findBotMembers, getBotDialog, getTelegramNick, listBotDialogs, type BotMember } from '@/lib/bot-messages';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Сообщения бота', robots: { index: false } };

const when = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

function Avatar({ member }: { member: Pick<BotMember, 'avatarId' | 'name'> }) {
  return <span className="support-admin-avatar" aria-hidden="true">{member.avatarId
    // eslint-disable-next-line @next/next/no-img-element -- the avatar is served from the database
    ? <img src={`/api/profile-images/${member.avatarId}`} alt="" width={40} height={40} /> : member.name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>;
}

/** Telegram answers over the network, so the nick arrives after the page and a slow answer holds nothing up. */
async function TelegramNickLine({ userId }: { userId: string }) {
  const telegram = await getTelegramNick(userId);
  if (!telegram) return null;
  if (telegram.username) return <span className="bot-dialog-nick">Telegram: <a href={`https://t.me/${telegram.username}`} target="_blank" rel="noopener noreferrer">@{telegram.username} ↗</a></span>;
  return <span className="bot-dialog-nick">{telegram.failed ? 'Ник в Telegram не удалось получить' : 'В Telegram ника нет'}</span>;
}

/**
 * «Сообщения бота»: the team writes to one member through the Telegram bot, for example to the winner of a contest.
 * The member's answer comes back here for a week after the message; beyond that their text in the bot is a drink search.
 */
export default async function AdminBotPage({ searchParams }: { searchParams: Promise<{ user?: string; q?: string }> }) {
  const [admin, params] = await Promise.all([requireFullAdmin(), searchParams]);
  const query = (params.q ?? '').trim().slice(0, 80);
  // The dialog goes first: opening it marks the answers read, and the list and the badge should already know.
  const open = params.user ? await getBotDialog(params.user) : null;
  const [dialogs, found, queues] = await Promise.all([listBotDialogs(), query ? findBotMembers(query) : [], getAdminQueues()]);
  return <AdminShell queues={queues} active="bot" email={admin.email} role={admin.role} title="Сообщения бота" subtitle={`Личные сообщения участникам через Telegram-бота. Ответ приходит сюда в течение ${BOT_DIALOG_DAYS} дней после вашего сообщения`}>
    <div className="support-admin" data-thread={open ? '' : undefined}>
      <section className="support-admin-list" aria-label="Диалоги">
        <div className="bc-toolbar is-inner">
          <form className="bc-search is-inline" action="/admin/bot" role="search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input name="q" type="search" defaultValue={query} placeholder="Ник на сайте, имя или почта" aria-label="Найти участника" maxLength={80} />
          </form>
        </div>
        {query ? (found.length ? <ul className="support-admin-threads">{found.map(member => <li key={member.id}>
          <Link href={`/admin/bot?user=${encodeURIComponent(member.id)}`} aria-current={member.id === open?.member.id ? 'page' : undefined}>
            <Avatar member={member} />
            <span className="support-admin-text"><strong>{member.name}{member.username && <small> {member.username}</small>}</strong><span>{member.reachable ? 'Бот запущен' : 'Не запускал бота'}</span></span>
          </Link>
        </li>)}</ul> : <div className="bc-empty"><strong>Никого не нашли</strong><span>Проверьте ник или почту.</span></div>)
          : dialogs.length ? <ul className="support-admin-threads">{dialogs.map(item => <li key={item.id}>
            <Link href={`/admin/bot?user=${encodeURIComponent(item.id)}`} aria-current={item.id === open?.member.id ? 'page' : undefined} data-unread={item.unread > 0 || undefined}>
              <Avatar member={item} />
              <span className="support-admin-text"><strong>{item.name}{item.username && <small> {item.username}</small>}</strong><span>{item.lastFromTeam && 'Вы: '}{item.preview}</span></span>
              <span className="support-admin-meta"><time dateTime={new Date(item.lastMessageAt).toISOString()}>{when.format(new Date(item.lastMessageAt))}</time>{item.unread > 0 && <b className="support-admin-dot" aria-label="Новый ответ" />}</span>
            </Link>
          </li>)}</ul> : <div className="bc-empty"><strong>Диалогов пока нет</strong><span>Найдите участника по нику или откройте его из конкурса.</span></div>}
      </section>
      <section className="support-admin-thread" aria-label="Диалог">
        {open ? <>
          <div className="support-admin-thread-head">
            <Link className="bc-link support-admin-back" href="/admin/bot">← К диалогам</Link>
            <div><strong>{open.member.username ? <Link href={`/profile/${open.member.username}`}>{open.member.name}</Link> : open.member.name}</strong>
              <Suspense fallback={<span className="bot-dialog-nick">Спрашиваем ник в Telegram…</span>}><TelegramNickLine userId={open.member.id} /></Suspense>
              <small>{[open.member.username && `на сайте ${open.member.username}`, open.member.email, open.member.reachable ? 'бот запущен' : 'не запускал бота'].filter(Boolean).join(' · ')}</small></div>
          </div>
          {open.messages.length ? <div className="bot-dialog-scroll"><ol className="bot-dialog">{open.messages.map(message => <li key={message.id} data-team={message.fromTeam || undefined}>
            <p>{message.text}</p><time dateTime={new Date(message.createdAt).toISOString()}>{when.format(new Date(message.createdAt))}{message.failed && ' · не доставлено'}</time>
          </li>)}</ol></div> : open.member.reachable && <div className="bc-empty"><strong>Сообщений пока нет</strong><span>Напишите первым: участник получит сообщение от бота.</span></div>}
          {!open.member.reachable && <p className="bot-dialog-note">Участник не запускал бота или остановил его, поэтому сообщение не дойдёт. Свяжитесь с участником по почте или в Telegram напрямую.</p>}
          <AdminBotForm key={open.member.id} userId={open.member.id} disabled={!open.member.reachable} />
        </> : <div className="bc-empty support-admin-pick"><strong>Выберите участника</strong><span>Слева диалоги и поиск по нику, имени и почте.</span></div>}
      </section>
    </div>
  </AdminShell>;
}
