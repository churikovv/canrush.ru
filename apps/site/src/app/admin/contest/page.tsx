import '@/styles/shared.css';
import '@/styles/admin.css';
import Image from 'next/image';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { AdminShell } from '@/components/admin-shell';
import { requireFullAdmin } from '@/lib/admin';
import { CONTESTS, contestPhase, DRAW_STATUS_LABELS, type ContestPhase } from '@/lib/contest';
import { getContestOverview } from '@/lib/contest-db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Конкурсы', robots: { index: false, follow: false } };

const plural = (n: number, [one, few, many]: [string, string, string]) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const PHASES: Record<ContestPhase, string> = { upcoming: 'Скоро', open: 'Идёт', results: 'Подводим итоги', over: 'Завершён' };

/** Every contest as a card: phase, entrants and the winner's state; a card opens the contest's draw page. */
export default async function AdminContestsPage() {
  const admin = await requireFullAdmin();
  const now = new Date();
  const cards = await Promise.all([...CONTESTS].sort((a, b) => b.resultsDay.localeCompare(a.resultsDay)).map(async contest => ({ contest, phase: contestPhase(contest, now), overview: await getContestOverview(contest) })));
  return <BrandShell headerAction={<Link className="admin-back-link" href="/profile">Вернуться в профиль</Link>} surfaceClassName="admin-surface">
    <AdminShell active="contest" email={admin.email} title="Конкурсы" subtitle="Выберите конкурс, чтобы посмотреть участников и провести розыгрыш.">
      <div className="contest-cards">{cards.map(({ contest, phase, overview }) => <Link key={contest.key} href={`/admin/contest/${contest.key}`} className="contest-card" data-phase={phase}>
        <span className="contest-card-art"><Image src={contest.image.src} width={contest.image.width} height={contest.image.height} alt="" sizes="160px" /></span>
        <span className="contest-card-body">
          <span className="admin-status" data-phase={phase}>{PHASES[phase]}</span>
          <strong>{contest.title}</strong>
          <span className="contest-card-prize">{contest.prize}{contest.tagLabel ? ` + тег «${contest.tagLabel}»` : ''}</span>
          <span className="admin-table-muted">Приём до {contest.lastDayLabel} · итоги {contest.resultsLabel}</span>
          <span className="contest-card-stats"><span><b>{overview.participants}</b> {plural(overview.participants, ['участник', 'участника', 'участников'])}</span><span><b>{overview.withTelegram}</b> с Telegram</span>{overview.redraws > 0 && <span><b>{overview.redraws}</b> {plural(overview.redraws, ['переигровка', 'переигровки', 'переигровок'])}</span>}</span>
          <span className="contest-card-winner">{overview.current ? <>Победитель {overview.current.winnerUsername ? `@${overview.current.winnerUsername}` : 'выбран'} · {DRAW_STATUS_LABELS[overview.current.status].toLowerCase()}</> : phase === 'open' ? 'Розыгрыш после окончания приёма' : 'Победитель не выбран'}</span>
        </span>
      </Link>)}</div>
      <p className="admin-chart-note">Новый конкурс добавляется записью в <code>CONTESTS</code> (<code>src/lib/contest.ts</code>): даты, приз, картинка, тексты баннера и тег победителя.</p>
    </AdminShell>
  </BrandShell>;
}
