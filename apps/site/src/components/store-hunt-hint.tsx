import Image from 'next/image';
import type { CSSProperties } from 'react';
import { TagIcon } from '@/components/hunt-icons';
import { FULL_STORE_PRICES, HUNT_TASKS } from '@/lib/hunt-fields';

const CHECK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;

/**
 * Подсказка охоты в форме магазина, в манере баннера раздела: магазин растёт с каждым выполненным условием, полоса показывает, сколько
 * осталось. Условия те же, что в триггере `hunt_store`. «Условия» — в новой вкладке: уход со страницы потерял бы заполненную форму.
 */
export function StoreHuntHint({ photo, point, prices, isNew }: { photo: boolean; point: boolean; prices: number; isNew: boolean }) {
  const counted = Math.min(prices, FULL_STORE_PRICES);
  const steps = [{ label: 'Фото', done: photo }, { label: 'Точка на карте', done: point }, { label: `Цены ${counted} из ${FULL_STORE_PRICES}`, done: prices >= FULL_STORE_PRICES }];
  const done = steps.filter(step => step.done).length;
  const share = (Number(photo) + Number(point) + counted / FULL_STORE_PRICES) / steps.length;
  const full = done === steps.length;
  const reward = HUNT_TASKS.find(task => task.key === 'full')?.amount;
  return <aside className="hunt-hint" data-stage="3" data-full={full || undefined} aria-label="Охота за ценниками">
    <Image className="hunt-hint-shop" src={`/brand/hunt/store-${Math.max(done, 1)}-cutout.webp`} width={360} height={240} sizes="112px" unoptimized alt="" />
    <div className="hunt-hint-copy">
      <small>{full ? 'Магазин полный' : 'Соберите полный магазин'}</small>
      <b>Охота за ценниками</b>
    </div>
    <div className="hunt-hint-reward">{isNew ? <><b>+{reward}</b><small>ценников</small></> : <TagIcon size={30} />}</div>
    <span className="can-meter hunt-hint-meter" style={{ '--share': share } as CSSProperties} aria-hidden="true"><i /></span>
    <ul className="hunt-hint-steps">
      {steps.map(step => <li key={step.label} data-done={step.done || undefined}>{step.done && CHECK}{step.label}</li>)}
      <li className="hunt-hint-rules"><a href="/hunt" target="_blank" rel="noopener">Условия</a></li>
    </ul>
  </aside>;
}
