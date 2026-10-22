'use client';
import { ProfileStatFill } from '@/components/profile-stat-fill';
import Link from '@/components/navigation-progress';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { experienceLevel, type Experience } from '@/lib/experience-level';
import { LevelChipContent, LevelEmblem, LevelTierGlyph } from '@/components/level-badge';
import { LEVEL_TIERS, levelRank, nextLevelRank } from '@/lib/level-tier';
import { nextLevelRewards, type LevelRewardKind } from '@/lib/level-rewards';

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
  const upcoming = nextLevelRewards(progress.level);
  const stats: { icon: StatIcon; value: string; label: string; href?: string }[] = [
    ...(achievements ? [{ icon: 'trophy' as const, value: `${achievements.earned} / ${achievements.total}`, label: 'достижений', href: `/profile/${username}/achievements` }] : []),
    ...(value.rank ? [{ icon: 'crown' as const, value: `№ ${number(value.rank)}`, label: 'в рейтинге', href: '/leaderboard' }] : []),
    ...(value.aheadPercent ? [{ icon: 'people' as const, value: `${value.aheadPercent}%`, label: 'участников позади' }] : []),
    { icon: 'bolt', value: `${levelsToNext} ${levelsToNext === 1 ? 'уровень' : levelsToNext < 5 ? 'уровня' : 'уровней'}`, label: `до «${step.label}»` },
  ];
  return <section className="community-panel experience-panel" id="experience" data-level-tier={tier.key} aria-labelledby="experience-title">
    <div className="experience-heading"><h2 id="experience-title">Уровень</h2><Link href="/leaderboard">{value.rank ? `№ ${value.rank} в рейтинге ↗` : 'Рейтинг ↗'}</Link></div>
    <div className="experience-hero" data-level-tier={tier.key}>
      <LevelEmblem level={progress.level} wings />
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
    <ol className="experience-road" aria-label="Ранги" style={{ '--road': road } as CSSProperties}>
      {LEVEL_TIERS.map((item, index) => <li key={item.key} data-level-tier={item.key} data-state={index < tierIndex ? 'passed' : index === tierIndex ? 'current' : 'locked'} aria-current={index === tierIndex ? 'step' : undefined}>
        <LevelTierGlyph tier={item.key} /><span>{item.label}</span><small>ур. {item.min}</small>
      </li>)}
    </ol>
    <ul className="experience-stats">{stats.map(stat => {
      const body = <><span className="experience-stat-icon" aria-hidden="true">{STAT_ICONS[stat.icon]}</span><strong>{stat.value}</strong><span>{stat.label}</span></>;
      return <li key={stat.label}>{stat.href ? <Link href={stat.href}>{body}</Link> : <div>{body}</div>}</li>;
    })}</ul>
    <div className="experience-rewards">
      <div className="experience-rewards-heading"><h3>Награды за уровень {upcoming.level}</h3>{upcoming.level > progress.level + 1 && <span>через {upcoming.level - progress.level} {upcoming.level - progress.level < 5 ? 'уровня' : 'уровней'}</span>}</div>
      <ul>{upcoming.rewards.map(reward => <li key={`${reward.kind}:${reward.title}`} data-reward={reward.kind} data-level-tier={reward.tier}>
        <span className="experience-reward-icon" aria-hidden="true">{reward.kind === 'rank' ? reward.tier && <LevelTierGlyph tier={reward.tier} /> : REWARD_ICONS[reward.kind]}</span>
        <strong>{reward.title}</strong><span>{reward.note}</span>
      </li>)}</ul>
    </div>
  </section>;
}

type StatIcon = 'trophy' | 'crown' | 'people' | 'bolt';
const ICON = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const STAT_ICONS: Record<StatIcon, ReactNode> = {
  trophy: <svg {...ICON}><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20h7M10 17h4" /></svg>,
  crown: <svg {...ICON}><path d="m3.5 8 4.2 3.6L12 5l4.3 6.6L20.5 8 19 18H5L3.5 8Z" /></svg>,
  people: <svg {...ICON}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.5a6.5 6.5 0 0 1 3 5.5" /></svg>,
  bolt: <svg {...ICON}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>,
};
const REWARD_ICONS: Record<Exclude<LevelRewardKind, 'rank'>, ReactNode> = {
  theme: <svg {...ICON}><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-1.9 2-1.9h2.3A3.7 3.7 0 0 0 21 11a8.6 8.6 0 0 0-9-8Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></svg>,
  frame: <svg {...ICON}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="10" r="3" /><path d="M6.6 18.5a6.5 6.5 0 0 1 10.8 0" /></svg>,
  feed: <svg {...ICON}><path d="M4 5h16M4 10h16M4 15h10M4 20h7" /><path d="m17 17 2 2 3-4" /></svg>,
};
