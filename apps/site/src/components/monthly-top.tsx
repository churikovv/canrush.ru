import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { MONTHLY_TOP_REWARDS, monthlyTopLabels, type getMonthlyTop } from '@/lib/monthly-top';

export function MonthlyTop({ data }: { data: Awaited<ReturnType<typeof getMonthlyTop>> }) {
  const { month, settles } = monthlyTopLabels(data.month);
  const rewards = MONTHLY_TOP_REWARDS.map(value => `+${value}`).join(', ').replace(/, ([^,]*)$/, ' и $1');
  return <div className="monthly-top">
    <div className="monthly-top-hero">
      <Image className="monthly-top-art" src="/brand/achievements/top.png" width={128} height={128} alt="" />
      <div className="monthly-top-copy">
        <span className="profile-tag" data-tag="top">ТОП</span>
        <h3>Топ-3 за {month}</h3>
        <p>Итоги {settles}: {rewards} XP и тег «ТОП» в профиль навсегда.</p>
      </div>
    </div>
    {data.leaders.length ? <ol className="monthly-top-podium">{data.leaders.map(entry => <li key={entry.username} data-place={entry.place}>
      <Link href={`/profile/${entry.username}`}>
        <span className="monthly-top-place" aria-label={`${entry.place} место`}>{entry.place}</span>
        <span className="wall-avatar">{entry.avatarId ? <Image src={`/api/profile-images/${entry.avatarId}`} width={40} height={40} unoptimized alt="" /> : entry.username[0]?.toUpperCase()}</span>
        <span className="leaderboard-name">@{entry.username}<small>{entry.xp.toLocaleString('ru-RU')} XP за месяц</small></span>
        <strong>+{entry.reward} XP</strong>
      </Link>
    </li>)}</ol> : <p className="community-empty">В этом месяце опыт ещё никто не набрал — первые трое заберут награду.</p>}
    {data.winners.month && data.winners.entries.length > 0 && <p className="monthly-top-winners">Победители за {monthlyTopLabels(data.winners.month).month}: {data.winners.entries.map((entry, index) => <span key={entry.username}>{index ? ', ' : ''}<Link href={`/profile/${entry.username}`}>@{entry.username}</Link></span>)}</p>}
  </div>;
}
