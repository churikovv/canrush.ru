import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { AvatarFrame } from '@/components/avatar-frame';
import { MONTHLY_TOP_REWARDS, monthlyTopLabels, type getMonthlyTop } from '@/lib/monthly-top';
import { profileTagLabel } from '@/lib/profile-achievements';

const Medal = () => <svg className="lb-medal" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h4l1.5 5L10 9 7 2Zm10 0h-4l-1.5 5L14 9l3-7Z" fill="currentColor" opacity=".55" /><circle cx="12" cy="15" r="6.5" fill="currentColor" /><path d="m12 11.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2.1Z" fill="#fff" opacity=".85" /></svg>;
const Gift = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3.5-5.5-3.5-5.5-1S9 8 12 8Zm0 0c1.5-3.5 5.5-3.5 5.5-1S15 8 12 8Z" /></svg>;

/**
 * «Топ-3 за месяц» on /leaderboard: the prize card, then the three leaders of the running month in the same ladder rows
 * as the all-time table (`lb-*` in leaderboard.css) — place with a medal, framed avatar, nick and tag, month XP — with
 * the prize each place takes on the right. The first place gets the same soft gold wash.
 */
export function MonthlyTop({ data }: { data: Awaited<ReturnType<typeof getMonthlyTop>> }) {
  const { month, settles } = monthlyTopLabels(data.month);
  const rewards = MONTHLY_TOP_REWARDS.map(value => `+${value.toLocaleString('ru-RU')}`).join(', ').replace(/, ([^,]*)$/, ' и $1');
  return <section className="monthly-top" aria-labelledby="monthly-top-title">
    <div className="monthly-top-hero">
      <Image className="monthly-top-art" src="/brand/achievements/top.png" width={128} height={128} alt="" />
      <div className="monthly-top-copy">
        <span className="profile-tag" data-tag="top">ТОП</span>
        <h3 id="monthly-top-title">Топ-3 за {month}</h3>
        <p>Итоги {settles}: {rewards} XP и тег «ТОП» в профиль навсегда.</p>
      </div>
    </div>
    {data.leaders.length ? <ol className="lb-list monthly-top-list">{data.leaders.map(entry => <li key={entry.username} data-rank={entry.place}>
      <Link className="lb-row monthly-top-row" href={`/profile/${entry.username}`}>
        <span className="lb-rank"><b>{entry.place}</b><Medal /><span className="sr-only"> место</span></span>
        <span className="lb-avatar" data-frame={entry.frame}>
          {entry.avatarId ? <Image src={`/api/profile-images/${entry.avatarId}`} width={56} height={56} unoptimized alt="" /> : <span aria-hidden="true">{entry.username[0]?.toUpperCase()}</span>}
          <AvatarFrame frame={entry.frame} />
        </span>
        <span className="lb-main">
          <span className="lb-name"><strong>{entry.username}</strong>{entry.tag && <span className="profile-tag" data-tag={entry.tag}>{profileTagLabel(entry.tag)}</span>}</span>
          <span className="lb-stats"><span>{entry.xp.toLocaleString('ru-RU')} XP за месяц</span></span>
        </span>
        <strong className="monthly-top-prize" title="Награда за место"><Gift />+{entry.reward.toLocaleString('ru-RU')}<small>XP</small></strong>
      </Link>
    </li>)}</ol> : <p className="community-empty">В этом месяце опыт ещё никто не набрал — первые трое заберут награду.</p>}
    {data.winners.month && data.winners.entries.length > 0 && <p className="monthly-top-winners">Победители за {monthlyTopLabels(data.winners.month).month}: {data.winners.entries.map((entry, index) => <span key={entry.username}>{index ? ', ' : ''}<Link href={`/profile/${entry.username}`}>@{entry.username}</Link></span>)}</p>}
  </section>;
}
