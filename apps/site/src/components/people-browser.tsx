import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { AvatarFrame } from '@/components/avatar-frame';
import { LevelChip } from '@/components/level-badge';
import { experienceLevel, shortXp } from '@/lib/experience-level';
import { levelTier } from '@/lib/level-tier';
import { searchPeople } from '@/lib/people-search';
import { profileTagLabel } from '@/lib/profile-achievements';

const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const CANS = (count: number) => {
  const tens = count % 100, ones = count % 10;
  return tens > 10 && tens < 20 ? 'банок' : ones === 1 ? 'банка' : ones >= 2 && ones <= 4 ? 'банки' : 'банок';
};

/** Members for /community, most experienced first (`q` still narrows by nick, name or description): framed avatar, tag, description, stats. */
export async function PeopleBrowser({ q }: { q: string }) {
  const query = q.trim().slice(0, 64);
  const people = await searchPeople(query);
  return <div className="people-browser">
    <h2 className="people-heading">{query ? 'Участники' : 'Популярные участники'}</h2>
    {people.length ? <ol className="people-list">{people.map(person => {
      const { level } = experienceLevel(person.xp);
      return <li key={person.username}><Link className="people-card" href={`/profile/${person.username}`}>
        <span className="people-avatar" data-frame={person.frame}>
          {person.avatarId ? <Image src={`/api/profile-images/${person.avatarId}`} width={64} height={64} unoptimized alt="" /> : <span aria-hidden="true">{person.username[0]?.toUpperCase()}</span>}
          <AvatarFrame frame={person.frame} />
        </span>
        <span className="people-main">
          <span className="people-name"><strong>{person.username}</strong>
            {person.tag && <span className="profile-tag" data-tag={person.tag}>{profileTagLabel(person.tag)}{person.tag === 'engine' && person.engineNumber && <small className="people-engine-number"> №{String(person.engineNumber).padStart(3, '0')}</small>}</span>}
          </span>
          <span className="people-bio">{person.bio ?? person.name}</span>
          <span className="people-stats">
            <LevelChip level={level} />
            <span title="Подписчики"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.7 2.5 3 5.2" /></svg>{compact.format(person.followers)}<span className="sr-only"> подписчиков</span></span>
            <span title="Банок в трекере"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8l1 3v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6l1-3ZM7 7h10M7 17h10" /></svg>{compact.format(person.cans)}<span className="people-stat-word"> {CANS(person.cans)}</span></span>
          </span>
        </span>
        <span className="people-xp" data-level-tier={levelTier(level).tier.key} title={`${person.xp.toLocaleString('ru-RU')} XP · место ${person.rank}`}>
          <strong>{shortXp(person.xp)}</strong><small>XP</small>
        </span>
      </Link></li>;
    })}</ol> : <p className="community-empty">Никого не нашли. Искать можно по нику, имени и описанию.</p>}
  </div>;
}
