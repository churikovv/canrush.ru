'use client';
import { ProfileStatFill } from '@/components/profile-stat-fill';
import Link from '@/components/navigation-progress';
import { useEffect, useState } from 'react';
import { experienceLevel, type Experience } from '@/lib/experience-level';

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
export function ProfileExperience({ username, initial = { xp: 0, rank: null }, expanded = false }: { username: string; initial?: Experience; expanded?: boolean }) {
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
  if (!expanded) return <Link className="profile-level" href={`/profile/${username}#experience`} title={`${value.xp} XP${value.rank ? ` · № ${value.rank} в рейтинге` : ''}`}>Ур. {progress.level}</Link>;
  return <section className="community-panel experience-panel" id="experience" aria-labelledby="experience-title">
    <div className="experience-heading"><h2 id="experience-title">Уровень</h2><Link href="/leaderboard">{value.rank ? `№ ${value.rank} в рейтинге ↗` : 'Рейтинг ↗'}</Link></div>
    <div className="experience-summary"><strong className="experience-level-number" aria-label={`Уровень ${progress.level}`}>{progress.level}</strong><div className="experience-level-copy"><strong>{value.xp.toLocaleString('ru-RU')} XP</strong><span>Ещё {progress.remaining} XP до уровня {progress.level + 1}</span></div></div>
    <div className="experience-track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.current} aria-label="Прогресс уровня"><ProfileStatFill value={progress.current / progress.required} /></div>

  </section>;
}
