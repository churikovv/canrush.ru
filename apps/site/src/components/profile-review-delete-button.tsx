'use client';
import { useState, useTransition } from 'react';
import { deleteReviewAction } from '@/app/catalog/review-actions';

export function ProfileReviewDeleteButton({ brand, flavor }: { brand: string; flavor: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  return <div className="profile-review-delete">
    <button className="community-button community-button-secondary" disabled={pending} onClick={() => {
      if (!window.confirm('Удалить отзыв? Вернуть его после удаления не получится.')) return;
      setError('');
      startTransition(async () => {
        const form = new FormData(); form.set('brand', brand); form.set('flavor', flavor);
        try { await deleteReviewAction(form); } catch { setError('Не удалось удалить отзыв. Попробуйте ещё раз.'); }
      });
    }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg>{pending ? 'Удаляем…' : 'Удалить отзыв'}</button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
