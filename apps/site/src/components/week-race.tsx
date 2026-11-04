import { VerifiedMark } from '@/components/verified-mark';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { AvatarFrame } from '@/components/avatar-frame';
import { WeekCountdown } from '@/components/week-countdown';
import { Gift, Medal } from '@/components/week-race-icons';
import { WeekRaceTry } from '@/components/week-race-try';
import { profileTagLabel } from '@/lib/profile-achievements';
import { TOP_PLACES } from '@/lib/season-fields';
import type { WeekRace } from '@/lib/week-race';
import { ProfileTag } from '@/components/profile-tag';


const number = (value: number) => value.toLocaleString('ru-RU');

/** Гонка недели: примерка наград, десятка лидеров строками `lb-*` с наградой за место и место зрителя. */
export function WeekRaceBoard({ race, signedIn }: { race: WeekRace; signedIn: boolean }) {
  return <section className="week-race" aria-labelledby="race-title">
    <div className="week-race-hero">
      <Image className="week-race-art" src="/brand/medals/top.png" width={128} height={128} alt="" />
      <div className="week-race-copy">
        <h2 id="race-title">Гонка недели</h2>
        <p>Итоги в понедельник. Тег держится всю следующую неделю.</p>
      </div>
      <WeekCountdown endsAt={race.endsAt} now={race.now} />
    </div>
    <WeekRaceTry race={race} signedIn={signedIn} />
    {race.leaders.length ? <ol className="lb-list week-race-list">{race.leaders.map(entry => <li key={entry.username} data-rank={entry.place <= 3 ? entry.place : undefined}>
      <Link className="lb-row week-race-row" href={`/profile/${entry.username}`}>
        <span className="lb-rank"><b>{entry.place}</b>{entry.place <= 3 && <Medal />}<span className="sr-only"> место</span></span>
        <span className="lb-avatar" data-frame={entry.frame}>
          {entry.avatarId ? <Image src={`/api/profile-images/${entry.avatarId}`} width={56} height={56} unoptimized alt="" /> : <span aria-hidden="true">{entry.username[0]?.toUpperCase()}</span>}
          <AvatarFrame frame={entry.frame} />
        </span>
        <span className="lb-main">
          <span className="lb-name"><strong>{entry.username}</strong>{entry.verified && <VerifiedMark />}{entry.tag && <ProfileTag tag={entry.tag}>{profileTagLabel(entry.tag)}</ProfileTag>}</span>
          <span className="lb-stats"><span>{number(entry.xp)} XP за неделю</span></span>
        </span>
        <strong className="week-race-prize" title="Награда за место"><Gift />+{number(entry.reward)}<small>XP</small></strong>
      </Link>
    </li>)}</ol> : <p className="community-empty">На этой неделе опыт ещё никто не набрал: первые {TOP_PLACES} заберут награду.</p>}
    {race.viewer && race.viewer.gap > 0 && <p className="race-viewer"><b>Вы на {race.viewer.place} месте</b> · {number(race.viewer.xp)} XP · до десятки {number(race.viewer.gap)} XP</p>}
    {race.winners.length > 0 && <p className="week-race-winners">Победители прошлой недели: {race.winners.map((name, index) => <span key={name}>{index > 0 && ', '}<Link href={`/profile/${name}`}>@{name}</Link></span>)}</p>}
  </section>;
}
