'use client';

import { useActionState } from 'react';
import { removeFavoriteAction } from '@/app/catalog/actions';

export function RemoveFavoriteButton({ brand, flavor }: { brand: string; flavor: string }) {
  const [error, action, pending] = useActionState(removeFavoriteAction, '');
  return <form action={action}>
    <input type="hidden" name="brand" value={brand} />
    <input type="hidden" name="flavor" value={flavor} />
    <button className="community-button community-button-secondary" disabled={pending} aria-label={`Удалить ${brand}, ${flavor} из избранного`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg>
      {pending ? 'Удаляем…' : 'Удалить'}
    </button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </form>;
}
