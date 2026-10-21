import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { LevelEmblem, LevelTierGlyph } from '@/components/level-badge';
import { displayName } from '@/components/wall-post';
import { LEGEND_DEGREE_STEP, LEVEL_TIERS, rankUpRank, type LevelRank } from '@/lib/level-tier';
import { profileTagLabel } from '@/lib/profile-achievements';
import type { RankUpRow } from '@/lib/profile-community';

const eventTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });

function note(rank: LevelRank) {
  if (rank.tier.key === 'gold') return 'Первый из высоких рангов CanRush';
  if (rank.tier.key === 'platinum') return 'Впереди только Легенда';
  return rank.degree === 1 ? `Высший ранг CanRush. Дальше — новая степень каждые ${LEGEND_DEGREE_STEP} уровней` : `Следующая степень — на ${rank.min + LEGEND_DEGREE_STEP} уровне`;
}
// Confetti pieces around the emblem: position, colour slot, delay. Pure CSS, still until the card's cycle runs.
const CONFETTI = [
  { x: 6, y: 18, delay: 0 }, { x: 22, y: 4, delay: -.6 }, { x: 78, y: 8, delay: -1.2 }, { x: 94, y: 26, delay: -1.9 },
  { x: 90, y: 78, delay: -2.4 }, { x: 70, y: 94, delay: -3.1 }, { x: 14, y: 86, delay: -3.6 }, { x: 2, y: 56, delay: -4.2 },
];

/** A feed event: a member reached gold, platinum, legend or a further legend degree. The look escalates with the tier. */
export function RankUpCard({ rankUp }: { rankUp: RankUpRow }) {
  const rank = rankUpRank(rankUp.tier, rankUp.degree);
  const { tier } = rank;
  const tierIndex = LEVEL_TIERS.findIndex(item => item.key === tier.key);
  const newDegree = rank.degree > 1;
  const name = displayName(rankUp);
  const profileHref = `/profile/${rankUp.username}`;
  const avatar = rankUp.avatarId ? <Image src={`/api/profile-images/${rankUp.avatarId}`} width={28} height={28} unoptimized alt="" /> : (rankUp.username || rankUp.name).slice(0, 1).toUpperCase();
  const tag = profileTagLabel(rankUp.tag);
  return <article id={`rank-up-${rankUp.id}`} className="rank-up-card" data-level-tier={tier.key} aria-label={`${name} — ${newDegree ? 'новая степень' : 'новый ранг'} «${rank.label}»`}>
    <div className="rank-up-stage" aria-hidden="true">
      <span className="rank-up-rays" />
      {CONFETTI.map(piece => <span key={`${piece.x}-${piece.y}`} className="rank-up-confetti" style={{ left: `${piece.x}%`, top: `${piece.y}%`, animationDelay: `${piece.delay}s` }} />)}
      <LevelEmblem level={rank.min} />
    </div>
    <div className="rank-up-copy">
      <p className="rank-up-eyebrow">{newDegree ? 'Новая степень' : 'Новый ранг'} · {rank.min} уровень</p>
      <p className="rank-up-title"><span>{rank.label}</span></p>
      <p className="rank-up-person">
        <Link className="rank-up-avatar" href={profileHref} tabIndex={-1} aria-hidden="true">{avatar}</Link>
        <Link className="rank-up-name" href={profileHref}>{name}</Link>
        {tag && <span className="profile-tag" data-tag={rankUp.tag}>{tag}</span>}
      </p>
      <p className="rank-up-note">{note(rank)}</p>
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
