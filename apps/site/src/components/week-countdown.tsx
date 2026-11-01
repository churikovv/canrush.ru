'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { countdownParts } from '@/lib/season-fields';

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Сколько осталось до итогов недели. Первый кадр считается от времени сервера, иначе секунды разошлись бы при гидрации,
 * дальше — по часам устройства. На нуле страница обновляется один раз: сервер подводит итоги и отдаёт новую неделю.
 */
export function WeekCountdown({ endsAt, now }: { endsAt: number; now: number }) {
  const router = useRouter();
  const [current, setCurrent] = useState(now);
  const refreshed = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => {
      const time = Date.now();
      setCurrent(time);
      if (time >= endsAt && refreshed.current !== endsAt) { refreshed.current = endsAt; router.refresh(); }
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt, router]);

  const { days, hours, minutes, seconds } = countdownParts(endsAt - current);
  return <div className="race-timer" role="timer" aria-label={`До итогов: ${days} дн. ${hours} ч. ${minutes} мин.`}>
    <span className="race-timer-title">До итогов</span>
    <span className="race-timer-cells" aria-hidden="true">
      {([[days, 'дн'], [pad(hours), 'ч'], [pad(minutes), 'мин'], [pad(seconds), 'сек']] as const).map(([value, label]) => <span key={label}><b>{value}</b><small>{label}</small></span>)}
    </span>
  </div>;
}
