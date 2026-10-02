'use client';
import Link from 'next/link';
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
    <div className="community-section-heading"><h2 id="experience-title">Уровень {progress.level}</h2><Link href="/leaderboard">{value.rank ? `№ ${value.rank} в рейтинге ↗` : 'Рейтинг ↗'}</Link></div>
    <div className="experience-total"><strong>{value.xp.toLocaleString('ru-RU')} <span>XP</span></strong><span>Ещё {progress.remaining} XP до уровня {progress.level + 1}</span></div>
    <progress max={progress.required} value={progress.current} aria-label="Прогресс уровня" />
    <details><summary>Как получать опыт</summary><ul><li>Новый отзыв о напитке: +25 XP.</li><li>Публикация тирлиста: +50 XP, первые 10 тирлистов.</li><li>Напиток в избранном: +2 XP, первые 20 напитков.</li><li>Новое достижение: +20 XP. Роль администратора не даёт опыта.</li></ul><p>Каждое действие учитывается один раз. Повторное добавление и редактирование не дают опыта. При равном XP место в рейтинге общее.</p></details>
  </section>;
}
