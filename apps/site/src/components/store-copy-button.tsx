'use client';
import { useState } from 'react';
import Link from '@/components/navigation-progress';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { copyStoreItems, saveStoreClipboard } from '@/lib/store-clipboard';
import type { StoreItem } from '@/lib/store-fields';

/** «Скопировать ассортимент» на странице магазина: вставляется в форме другого магазина, на шаге «Напитки и цены». */
export function StoreCopyButton({ store, items, own }: { store: { id: string; name: string }; items: StoreItem[]; own: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const count = items.length;
  return <div className="store-copy">
    <button type="button" className="community-button community-button-secondary" onClick={() => setState(saveStoreClipboard(copyStoreItems(store, items, own)) ? 'copied' : 'failed')}>Скопировать ассортимент</button>
    {state === 'copied' && <p className="store-note" role="status">
      Скопировано: {count} {pluralRu(count, 'напиток', 'напитка', 'напитков')}{own ? '' : ' без цен'}. Вставить можно на шаге «Напитки и цены» в <Link href="/market/stores/new">новом магазине</Link> или при правке своего.
    </p>}
    {state === 'failed' && <p className="store-note" role="status">Браузер не дал сохранить список. Проверьте, что сайт может хранить данные на устройстве.</p>}
  </div>;
}
