'use client';

import Image from 'next/image';
import { useState } from 'react';
import { AvatarFrame } from '@/components/avatar-frame';
import Link from '@/components/navigation-progress';
import { Gift, Medal } from '@/components/week-race-icons';
import { DEFAULT_PROFILE_APPEARANCE } from '@/lib/profile-appearance';
import { profileTagLabel } from '@/lib/profile-achievements';
import { WEEK_PRIZES, isFirstWeek, weekGoal, weekPrize, weekReward } from '@/lib/season-fields';
import type { WeekRace } from '@/lib/week-race';

const number = (value: number) => value.toLocaleString('ru-RU');
const placeLabel = (places: string) => (places === '1' ? '1 место' : `${places} места`);

/** С какой группы открыть примерку: своя, а вне десятки — ближайшая; гостю показываем главный приз. */
function startPrize(race: WeekRace, signedIn: boolean) {
  if (!signedIn) return 0;
  const own = race.viewer ? weekPrize(race.viewer.place) : null;
  return own ? WEEK_PRIZES.indexOf(own) : WEEK_PRIZES.length - 1;
}

/** Примерка наград недели: своя строка рейтинга с тегом выбранной группы мест и сколько опыта до неё. Ничего не сохраняет. */
export function WeekRaceTry({ race, signedIn }: { race: WeekRace; signedIn: boolean }) {
  const [picked, setPicked] = useState(() => startPrize(race, signedIn));
  const prize = WEEK_PRIZES[picked] ?? WEEK_PRIZES[0]!;
  const { me } = race;
  const frame = me?.frame ?? DEFAULT_PROFILE_APPEARANCE.frame;
  const goal = weekGoal(prize, race.leaders.map(entry => entry.xp), race.viewer);

  return <div className="race-try">
    <h3>Примерьте награду</h3>
    <ul className="lb-list week-race-list race-try-preview">
      <li data-rank={picked + 1}>
        <div className="lb-row week-race-row">
          <span className="lb-rank"><b>{prize.places}</b><Medal /><span className="sr-only"> место</span></span>
          <span className="lb-avatar" data-frame={frame}>
            {me?.avatarId ? <Image src={`/api/profile-images/${me.avatarId}`} width={56} height={56} unoptimized alt="" /> : <span aria-hidden="true">{me?.username?.[0]?.toUpperCase() ?? 'В'}</span>}
            <AvatarFrame frame={frame} />
          </span>
          <span className="lb-main">
            <span className="lb-name">
              <strong>{me?.username ?? 'Вы'}</strong>
              <span key={prize.tag} className="race-try-tag"><span className="profile-tag" data-tag={prize.tag}>{profileTagLabel(prize.tag)}</span></span>
            </span>
            <span className="lb-stats" aria-live="polite">
              {!signedIn ? <span><Link href="/sign-in">Войдите</Link>, чтобы побороться за тег</span>
                : goal.kind === 'here' ? <span>Вы сейчас в этой группе</span>
                : goal.kind === 'above' ? <span>Вы уже выше этой группы</span>
                : goal.kind === 'open' ? <span>Место свободно: хватит любого опыта</span>
                : <span>Не хватает {number(goal.xp)} XP</span>}
            </span>
          </span>
          <strong className="week-race-prize" title="Награда за место"><Gift />+{number(weekReward(prize, race.now))}<small>XP</small></strong>
        </div>
      </li>
    </ul>
    <div className="race-try-picks" role="group" aria-label="Какое место примерить">
      {WEEK_PRIZES.map((item, index) => <button key={item.tag} type="button" aria-pressed={index === picked} onClick={() => setPicked(index)}>{placeLabel(item.places)}</button>)}
    </div>
    {isFirstWeek(race.now) && <p className="race-try-note">Первая неделя: награды вдвое меньше. Со следующей недели — полные.</p>}
  </div>;
}
