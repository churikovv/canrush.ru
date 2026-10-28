'use client';
import { useState, useTransition } from 'react';
import { restoreStreakAction } from '@/app/profile/calendar-actions';
import { StreakFlame } from '@/components/streak-flame';
import type { StreakRestore as Offer } from '@/lib/drink-calendar-fields';

const DAY_TITLE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const title = (day: string) => DAY_TITLE.format(new Date(`${day}T00:00:00Z`));
const plural = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'день' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'дня' : 'дней';

/**
 * «Вернуть огонёк» under the calendar banner: the missed day and the streak it brings back, one button. Within the
 * 15 days after the last restore it only says when the next one is possible. The page refreshes itself after the
 * action (revalidatePath), so the restored day appears in the month.
 */
export function StreakRestore({ offer }: { offer: Exclude<Offer, null> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  if ('availableOn' in offer) return <div className="streak-restore is-later">
    <StreakFlame length={1} size={22} state="out" />
    <div><strong>Огонёк погас</strong><small>Вернуть его можно будет с {title(offer.availableOn)} — раз в 15 дней.</small></div>
  </div>;
  return <div className="streak-restore" role="region" aria-label="Вернуть огонёк">
    <StreakFlame length={offer.length} size={26} state="waiting" />
    <div><strong>Забыли отметить {title(offer.day)}?</strong>
      <small>Верните огонёк — серия снова будет {offer.length} {plural(offer.length)}. Можно раз в 15 дней.</small>
      {error && <small role="alert">{error}</small>}</div>
    <button type="button" disabled={pending} onClick={() => start(async () => { const result = await restoreStreakAction(); if (result.error) setError(result.error); })}>
      {pending ? 'Возвращаем…' : 'Вернуть огонёк'}
    </button>
  </div>;
}
