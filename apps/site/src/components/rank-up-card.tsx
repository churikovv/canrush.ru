import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { LevelEmblem, LevelTierGlyph } from '@/components/level-badge';
import { displayName } from '@/components/wall-post';
import { LEVEL_TIERS, type RankUpTier } from '@/lib/level-tier';
import { profileTagLabel } from '@/lib/profile-achievements';
import type { RankUpRow } from '@/lib/profile-community';

const eventTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });

const NOTES: Record<RankUpTier, string> = {
  gold: 'Первый из высоких рангов CanRush',
  platinum: 'Впереди только Легенда',
  legend: 'Высший ранг CanRush',
};
// Confetti pieces around the emblem: position, colour slot, delay. Pure CSS, still until the card's cycle runs.
const CONFETTI = [
  { x: 6, y: 18, delay: 0 }, { x: 22, y: 4, delay: -.6 }, { x: 78, y: 8, delay: -1.2 }, { x: 94, y: 26, delay: -1.9 },
  { x: 90, y: 78, delay: -2.4 }, { x: 70, y: 94, delay: -3.1 }, { x: 14, y: 86, delay: -3.6 }, { x: 2, y: 56, delay: -4.2 },
];

/** A feed event: a member reached gold, platinum or legend. The look escalates with the tier. */
export function RankUpCard({ rankUp }: { rankUp: RankUpRow }) {
  const tierIndex = LEVEL_TIERS.findIndex(tier => tier.key === rankUp.tier);
  const tier = LEVEL_TIERS[tierIndex]!;
  const name = displayName(rankUp);
  const profileHref = `/profile/${rankUp.username}`;
  const avatar = rankUp.avatarId ? <Image src={`/api/profile-images/${rankUp.avatarId}`} width={28} height={28} unoptimized alt="" /> : (rankUp.username || rankUp.name).slice(0, 1).toUpperCase();
  const tag = profileTagLabel(rankUp.tag);
  return <article id={`rank-up-${rankUp.id}`} className="rank-up-card" data-level-tier={tier.key} aria-label={`${name} — новый ранг «${tier.label}»`}>
    <div className="rank-up-stage" aria-hidden="true">
      <span className="rank-up-rays" />
      {CONFETTI.map(piece => <span key={`${piece.x}-${piece.y}`} className="rank-up-confetti" style={{ left: `${piece.x}%`, top: `${piece.y}%`, animationDelay: `${piece.delay}s` }} />)}
      <LevelEmblem level={tier.min} />
    </div>
    <div className="rank-up-copy">
      <p className="rank-up-eyebrow">Новый ранг · {tier.min} уровень</p>
      <p className="rank-up-title"><span>{tier.label}</span></p>
      <p className="rank-up-person">
        <Link className="rank-up-avatar" href={profileHref} tabIndex={-1} aria-hidden="true">{avatar}</Link>
        <Link className="rank-up-name" href={profileHref}>{name}</Link>
        {tag && <span className="profile-tag" data-tag={rankUp.tag}>{tag}</span>}
      </p>
      <p className="rank-up-note">{NOTES[rankUp.tier]}</p>
      <ol className="rank-up-road" aria-label="Путь рангов">
        {LEVEL_TIERS.map((step, index) => <li key={step.key} data-level-tier={step.key} className={index < tierIndex ? 'is-passed' : index === tierIndex ? 'is-current' : undefined} title={`${step.label} — ${step.min} ур.`}>
          <LevelTierGlyph tier={step.key} /><span className="sr-only">{step.label}{index <= tierIndex ? ' — получен' : ''}</span>
        </li>)}
      </ol>
      <div className="rank-up-footer">
        <time dateTime={rankUp.createdAt.toISOString()}>{eventTime.format(rankUp.createdAt)}</time>
        <Link className="rank-up-cheer" href={`${profileHref}#wall`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 20 4.5-12L16 15.5 4 20Z" /><path d="M14 4.5c1.5.5 2 2 1.5 3.5M19.5 10c-1.5-.5-3 0-3.5 1.5M18 4l.5 1.5M20 7.5l1.5-.5M11 3.5 11.5 2" /></svg>
          Поздравить
        </Link>
      </div>
    </div>
  </article>;
}
