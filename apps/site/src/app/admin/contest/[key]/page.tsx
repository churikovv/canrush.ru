import '@/styles/shared.css';
import '@/styles/admin.css';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { AdminShell } from '@/components/admin-shell';
import { ContestDrawForm, ContestWinnerActions } from '@/components/contest-admin-controls';
import { requireSiteAdmin } from '@/lib/admin';
import { contestPhase, DRAW_STATUS_LABELS, findContest } from '@/lib/contest';
import { getContestDraws, getContestParticipants, type ContestParticipant } from '@/lib/contest-db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Конкурс', robots: { index: false, follow: false } };

const date = (value: Date | string) => new Date(value).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short' });
const dateTime = (value: Date) => value.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const memberLabel = (entry: ContestParticipant | undefined) => entry ? (entry.username ? `@${entry.username}` : entry.name.trim() || entry.email) : 'Аккаунт удалён';

function Contact({ entry }: { entry: ContestParticipant | undefined }) {
  if (!entry) return <span className="admin-table-muted">аккаунт удалён</span>;
  if (entry.telegramUsername) return <a href={`https://t.me/${entry.telegramUsername}`} target="_blank" rel="noopener noreferrer">Написать @{entry.telegramUsername} ↗</a>;
  if (entry.telegramLinked) return <span>Telegram привязан — написать через бота</span>;
  return <span>{entry.email}</span>;
}

export default async function AdminContestPage({ params }: { params: Promise<{ key: string }> }) {
  const admin = await requireSiteAdmin();
  const contest = findContest((await params).key);
  if (!contest) notFound();
  const [participants, draws] = await Promise.all([getContestParticipants(contest), getContestDraws(contest)]);
  const people = new Map(participants.map(entry => [entry.id, entry]));
  const current = draws.find(draw => draw.status !== 'unreachable');
  const excluded = new Set(draws.filter(draw => draw.status === 'unreachable').map(draw => draw.winnerId));
  const phase = contestPhase(contest, new Date());
  return <BrandShell headerAction={<Link className="admin-back-link" href="/profile">Вернуться в профиль</Link>} surfaceClassName="admin-surface">
    <AdminShell active="contest" email={admin.email} title={contest.title}
      subtitle={`${contest.prize} · банка в календаре до ${contest.lastDayLabel}, итоги ${contest.resultsLabel}${phase === 'open' ? ' · приём идёт' : ''}.`}
      actions={<Link className="community-button community-button-secondary" href="/admin/contest">Все конкурсы</Link>}>
      <div className="admin-metrics">{[
        { label: 'Участники', value: participants.length, note: 'Отметили банку, без админов и заблокированных' },
        { label: 'С Telegram', value: participants.filter(entry => entry.telegram).length, note: 'Можно написать напрямую' },
        { label: 'Переигровки', value: excluded.size, note: excluded.size ? 'Не вышли на связь и выбыли' : 'Пока не было' },
      ].map(item => <div className="admin-metric" key={item.label}><span className="admin-metric-head">{item.label}</span><strong>{item.value.toLocaleString('ru-RU')}</strong><small>{item.note}</small></div>)}</div>

      <section className="admin-data-panel" aria-labelledby="contest-draw-title">
        <div className="admin-panel-heading"><h2 id="contest-draw-title">Победитель</h2><span>Случайно, один участник — один шанс</span></div>
        {current ? <div className="contest-winner" data-status={current.status}>
          <div>
            <span className="admin-status">{DRAW_STATUS_LABELS[current.status]}</span>
            <strong>{current.winnerUsername ? <Link href={`/profile/${current.winnerUsername}`}>@{current.winnerUsername}</Link> : memberLabel(current.winnerId ? people.get(current.winnerId) : undefined)}</strong>
            <Contact entry={current.winnerId ? people.get(current.winnerId) : undefined} />
            <span className="admin-table-muted">Выбран {dateTime(current.drawnAt)} из {current.poolSize}{current.resolvedAt ? ` · отмечено ${dateTime(current.resolvedAt)}` : ''}</span>
          </div>
          {current.status === 'pending' && <ContestWinnerActions contestKey={contest.key} drawId={current.id} tagLabel={contest.tag ? contest.tagLabel ?? contest.tag : undefined} />}
        </div>
          : <ContestDrawForm contestKey={contest.key} entries={participants.map(({ id, cans, telegram, avatar }) => ({ cans, telegram, avatar, excluded: excluded.has(id) }))} closedReason={phase === 'open' || phase === 'upcoming' ? `Розыгрыш откроется после ${contest.lastDayLabel}, когда закончится приём.` : undefined} />}
        {draws.length > (current ? 1 : 0) && <details className="contest-draw-history"><summary>История розыгрышей · {draws.length}</summary><ol>{draws.map(draw => <li key={draw.id} data-status={draw.status}>
          <strong>{draw.winnerUsername ? `@${draw.winnerUsername}` : memberLabel(draw.winnerId ? people.get(draw.winnerId) : undefined)}</strong>
          <span className="admin-status">{DRAW_STATUS_LABELS[draw.status]}</span>
          <span className="admin-table-muted">{dateTime(draw.drawnAt)} · из {draw.poolSize} · {[draw.filters.telegram && 'с Telegram', draw.filters.avatar && 'с аватаром'].filter(Boolean).join(', ') || 'без доп. условий'} · {draw.drawnBy}</span>
        </li>)}</ol></details>}
      </section>

      <section className="admin-data-panel" aria-labelledby="contest-people-title">
        <div className="admin-panel-heading"><h2 id="contest-people-title">Участники <span>{participants.length}</span></h2></div>
        {participants.length ? <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="Участники конкурса"><table className="admin-table"><thead><tr>{['Участник', 'Банок', 'Дней', 'Отметки', 'Telegram', 'Аватар', 'С нами'].map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>
          {participants.map(entry => <tr key={entry.id}>
            <td><div className="admin-table-identity">{entry.username ? <Link href={`/profile/${entry.username}`}>{entry.name || entry.username}</Link> : <strong>{entry.name || entry.email}</strong>}<span>{entry.username ? `@${entry.username}` : entry.email}</span></div>{entry.drawStatus && <span className="admin-status">{DRAW_STATUS_LABELS[entry.drawStatus]}</span>}</td>
            <td>{entry.cans}</td><td>{entry.days}</td><td>{date(entry.firstDay)}{entry.lastDay !== entry.firstDay && ` – ${date(entry.lastDay)}`}</td>
            <td>{entry.telegramUsername ? <a href={`https://t.me/${entry.telegramUsername}`} target="_blank" rel="noopener noreferrer">@{entry.telegramUsername}</a> : entry.telegramLinked ? 'привязан' : <span className="admin-table-muted">нет</span>}</td>
            <td>{entry.avatar ? 'да' : <span className="admin-table-muted">нет</span>}</td>
            <td>{date(entry.createdAt)}</td>
          </tr>)}
        </tbody></table></div> : <div className="admin-empty-result"><strong>Пока никто не отметил банку</strong><span>Участники появятся здесь после первой отметки в календаре.</span></div>}
      </section>
    </AdminShell>
  </BrandShell>;
}
