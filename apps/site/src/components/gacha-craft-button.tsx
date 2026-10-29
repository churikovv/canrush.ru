'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { craftAction } from '@/app/gacha/actions';
import { ShardIcon } from '@/components/gacha-machine';

/**
 * Пустая ячейка альбома: силуэт и «собрать за N осколков». Название открывается только в подтверждении — до решения
 * банка остаётся сюрпризом.
 */
export function GachaCraftButton({ brand, flavor, name, cost, shards }: { brand: string; flavor: string; name: string; cost: number; shards: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const enough = shards >= cost;
  return <button type="button" className="gacha-craft" disabled={!enough || pending} title={enough ? `Собрать за ${cost} осколков` : `Нужно ${cost} осколков`}
    aria-label={`Собрать карточку за ${cost} осколков`}
    onClick={() => {
      if (!window.confirm(`Собрать «${brand} · ${name}» за ${cost} осколков?`)) return;
      setError(undefined);
      start(async () => {
        const result = await craftAction(brand, flavor);
        if ('error' in result) { setError(result.error); window.alert(result.error); return; }
        router.refresh();
      });
    }} data-error={error ? '' : undefined}>
    <ShardIcon size={11} />{cost}
  </button>;
}
