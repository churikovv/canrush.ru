import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { BETA_ENGINE_PLACES, type BetaEngine } from '@/lib/beta-engine';
import type { Contest } from '@/lib/contest';
import { achievementImage } from '@/lib/profile-achievements';
import { MONTHLY_TOP_REWARDS, monthlyTopLabels } from '@/lib/monthly-top';

const count = (value: number) => value.toLocaleString('ru-RU');

/**
 * Short event banners above the home feed: the month's top (rewards for the top three, always on), the running
 * giveaway (rules on /contest) and the beta «Двигатель» places while they last. On phones they scroll sideways.
 */
export function HomeEvents({ monthly, contest, joined, engine, signedIn }: {
  monthly: { month: string; leader: string | null };
  contest: { contest: Contest; phase: 'open' | 'results' } | null;
  joined: boolean;
  engine: BetaEngine;
  signedIn: boolean;
}) {
  const engineOpen = engine.taken < BETA_ENGINE_PLACES;
  const top = monthlyTopLabels(monthly.month);
  return <section className="home-events" aria-label="События">
    <Link className="home-event" data-event="monthly" href="/leaderboard">
      <Image className="home-event-art" src={achievementImage('top')} width={112} height={112} sizes="56px" alt="" />
      <span className="home-event-copy">
        <small>Топ месяца · {top.month}</small>
        <strong>+{MONTHLY_TOP_REWARDS[0]} XP за 1 место</strong>
        <span>{monthly.leader ? `Лидер: @${monthly.leader}` : `Итоги ${top.settles}`}</span>
      </span>
      <span className="home-event-arrow" aria-hidden="true">›</span>
    </Link>
    {contest && <Link className="home-event" data-event="contest" href="/contest">
      <Image className="home-event-art" src={contest.contest.image.src} width={96} height={122} sizes="56px" alt="" />
      <span className="home-event-copy">
        <small>{contest.phase === 'open' ? `Розыгрыш до ${contest.contest.lastDayLabel}` : `Итоги ${contest.contest.resultsLabel}`}</small>
        <strong>{contest.contest.title}</strong>
        <span>на {contest.contest.prize} · {contest.phase !== 'open' ? 'подводим итоги' : joined ? 'вы участвуете ✓' : 'отметь банку'}</span>
      </span>
      <span className="home-event-arrow" aria-hidden="true">›</span>
    </Link>}
    {engineOpen && <Link className="home-event" data-event="engine" href={engine.number ? (engine.username ? `/profile/${engine.username}/achievements` : '/profile') : signedIn ? '/profile' : '/sign-in'}>
      <Image className="home-event-art" src="/brand/achievements/engine.png" width={112} height={112} sizes="56px" alt="" />
      <span className="home-event-copy">
        <small>Бета Canrush</small>
        <strong>{engine.number ? `Ты двигатель №${engine.number}` : 'Стань двигателем Canrush'}</strong>
        <span>Осталось {count(BETA_ENGINE_PLACES - engine.taken)} из {count(BETA_ENGINE_PLACES)} мест</span>
      </span>
      <span className="home-event-arrow" aria-hidden="true">›</span>
    </Link>}
  </section>;
}
