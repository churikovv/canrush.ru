'use client';
import { ProfileStatFill } from '@/components/profile-stat-fill';
import Link from '@/components/navigation-progress';
import { useEffect, useState } from 'react';
import { experienceLevel, type Experience } from '@/lib/experience-level';
import { LevelChipContent, LevelEmblem } from '@/components/level-badge';
import { levelTier } from '@/lib/level-tier';

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
  const { tier, next } = levelTier(progress.level);
  if (!expanded) return <Link className="profile-level" data-level-tier={tier.key} href={`/profile/${username}#experience`} title={`${tier.label} · ${value.xp} XP${value.rank ? ` · № ${value.rank} в рейтинге` : ''}`}><LevelChipContent level={progress.level} /></Link>;
  return <section className="community-panel experience-panel" id="experience" aria-labelledby="experience-title">
    <div className="experience-heading"><h2 id="experience-title">Уровень</h2><Link href="/leaderboard">{value.rank ? `№ ${value.rank} в рейтинге ↗` : 'Рейтинг ↗'}</Link></div>
    <div className="experience-summary" data-level-tier={tier.key}><LevelEmblem level={progress.level} /><div className="experience-level-copy"><span className="experience-tier">{tier.label}</span><strong>{value.xp.toLocaleString('ru-RU')} XP</strong><span>Ещё {progress.remaining} XP до уровня {progress.level + 1}{next && ` · «${next.label}» с уровня ${next.min}`}</span></div></div>
    <div className="experience-extra">{achievements && <span>Достижения: получено {achievements.earned} из {achievements.total}</span>}{Boolean(value.aheadPercent && value.aheadPercent > 0) && <span>Больше опыта, чем у {value.aheadPercent}% пользователей</span>}</div>
    <div className="experience-track" data-level-tier={tier.key} role="progressbar" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.current} aria-label="Прогресс уровня"><ProfileStatFill value={progress.current / progress.required} /></div>

  </section>;
}
