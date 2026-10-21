'use client';
import { ProfileStatFill } from '@/components/profile-stat-fill';
import Link from '@/components/navigation-progress';
import { useEffect, useState, type CSSProperties } from 'react';
import { experienceLevel, type Experience } from '@/lib/experience-level';
import { LevelChipContent, LevelEmblem, LevelTierGlyph } from '@/components/level-badge';
import { LEVEL_TIERS, levelRank, nextLevelRank } from '@/lib/level-tier';

// One batched request for all visible authors, including repeated review authors.
const listeners = new Map<string, Set<(value: Experience) => void>>();
let timer: ReturnType<typeof setInterval> | undefined;
let busy = false;
async function refresh() {
  if (busy || document.visibilityState !== 'visible') return;
  busy = true;
  try {
    const names = [...listeners.keys()];
    for (let i = 0; i < names.length; i += 50) {
      const response = await fetch(`/api/profile-experience?users=${encodeURIComponent(names.slice(i, i + 50).join(','))}`, { cache: 'no-store' });
      if (!response.ok) continue;
      const values = await response.json() as Record<string, Experience>;
      for (const name of names.slice(i, i + 50)) for (const notify of listeners.get(name) ?? []) notify(values[name] ?? { xp: 0, rank: null });
    }
  } catch { /* Keep the last confirmed value while offline. */ }
  finally { busy = false; }
}
export function ProfileExperience({ username, initial = { xp: 0, rank: null }, expanded = false, achievements }: { username: string; initial?: Experience; expanded?: boolean; achievements?: { earned: number; total: number } }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const subscribers = listeners.get(username) ?? new Set();
    subscribers.add(setValue); listeners.set(username, subscribers);
    const start = setTimeout(() => { void refresh(); }, 100);
    if (!timer) { timer = setInterval(() => { void refresh(); }, 30_000); document.addEventListener('visibilitychange', refresh); }
    return () => {
      clearTimeout(start); subscribers.delete(setValue); if (!subscribers.size) listeners.delete(username);
      if (!listeners.size) { clearInterval(timer); timer = undefined; document.removeEventListener('visibilitychange', refresh); }
    };
  }, [username]);
  const progress = experienceLevel(value.xp);
  const rank = levelRank(progress.level);
  const { tier } = rank;
  if (!expanded) return <Link className="profile-level" data-level-tier={tier.key} href={`/profile/${username}#experience`} title={`${rank.label} · ${value.xp} XP${value.rank ? ` · № ${value.rank} в рейтинге` : ''}`}><LevelChipContent level={progress.level} /></Link>;
  const number = (n: number) => n.toLocaleString('ru-RU');
  const tierIndex = LEVEL_TIERS.findIndex(item => item.key === tier.key);
  const next = LEVEL_TIERS[tierIndex + 1];
  // Position on the rank road: whole tiers passed plus the share of levels inside the current one.
  const road = next ? (tierIndex + (progress.level - tier.min) / (next.min - tier.min)) / (LEVEL_TIERS.length - 1) : 1;
  // The next degree is the nearer goal; Legend keeps adding degrees, so there is always one.
  const step = nextLevelRank(progress.level);
  const levelsToNext = step.min - progress.level;
  const stats = [
    achievements && { value: `${achievements.earned} / ${achievements.total}`, label: 'достижений' },
    value.aheadPercent ? { value: `${value.aheadPercent}%`, label: 'участников позади' } : null,
    { value: `${levelsToNext} ${levelsToNext === 1 ? 'уровень' : levelsToNext < 5 ? 'уровня' : 'уровней'}`, label: `до «${step.label}»` },
  ].filter(Boolean) as { value: string; label: string }[];
  return <section className="community-panel experience-panel" id="experience" data-level-tier={tier.key} aria-labelledby="experience-title">
    <div className="experience-heading"><h2 id="experience-title">Уровень</h2><Link href="/leaderboard">{value.rank ? `№ ${value.rank} в рейтинге ↗` : 'Рейтинг ↗'}</Link></div>
    <div className="experience-summary" data-level-tier={tier.key}>
      <LevelEmblem level={progress.level} />
      <div className="experience-level-copy">
        <div className="experience-rank">
          <span className="experience-tier">{rank.label}</span>
          {rank.degrees !== null && rank.degrees > 1 && <span className="experience-degrees" role="img" aria-label={`Степень ${rank.degree} из ${rank.degrees}`}>
            {Array.from({ length: rank.degrees }, (_, index) => <i key={index} data-filled={index < rank.degree ? '' : undefined} />)}
          </span>}
        </div>
        <strong className="experience-xp">{number(value.xp)}<span> XP</span></strong>
        <div className="experience-level-progress">
          <div className="experience-level-ends" aria-hidden="true"><span>Ур. {progress.level}</span><b>{number(progress.current)} / {number(progress.required)} XP</b><span>Ур. {progress.level + 1}</span></div>
          <div className="experience-track" data-level-tier={tier.key} role="progressbar" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.current} aria-label={`Прогресс до уровня ${progress.level + 1}`}><ProfileStatFill value={progress.current / progress.required} /></div>
          <span className="experience-remaining">Ещё {number(progress.remaining)} XP до уровня {progress.level + 1}</span>
        </div>
      </div>
    </div>
    <ol className="experience-road" aria-label="Ранги" style={{ '--road': road } as CSSProperties}>
      {LEVEL_TIERS.map((item, index) => <li key={item.key} data-level-tier={item.key} data-state={index < tierIndex ? 'passed' : index === tierIndex ? 'current' : 'locked'} aria-current={index === tierIndex ? 'step' : undefined}>
        <LevelTierGlyph tier={item.key} /><span>{item.label}</span><small>ур. {item.min}</small>
      </li>)}
    </ol>
    {stats.length > 0 && <dl className="experience-stats">{stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
  </section>;
}
