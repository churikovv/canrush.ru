'use client';
import { useEffect, useState } from 'react';
import { CatalogReviewForm } from '@/components/catalog-review-form';
import { REVIEW_EDIT_EVENT } from '@/components/review-edit-shortcut';
import type { ReviewData } from '@/lib/reviews';

/**
 * The review form on a drink's page, folded behind «Написать отзыв» / «Изменить отзыв». The form stays mounted while
 * hidden: the edit and delete icons on the author's own review card talk to it through window events, and the delete
 * confirmation must work with the panel closed. A save, a cancel or a delete folds it back.
 */
export function ReviewFormPanel({ brand, flavor, existing, authenticated }: { brand: string; flavor: string; existing: ReviewData | null; authenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasReview, setHasReview] = useState(Boolean(existing));
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(REVIEW_EDIT_EVENT, show);
    return () => window.removeEventListener(REVIEW_EDIT_EVENT, show);
  }, []);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    // An existing review opens straight into editing (the form unlocks itself on this event).
    if (hasReview) window.dispatchEvent(new Event(REVIEW_EDIT_EVENT));
  };
  if (!authenticated) return <>
    <div className="review-form-heading"><h2>Оценить напиток</h2></div>
    <CatalogReviewForm brand={brand} flavor={flavor} existing={existing} authenticated={false} />
  </>;
  return <>
    <div className="review-form-heading review-form-toggle-row">
      <div>
        <h2>{hasReview ? 'Ваш отзыв' : 'Оценить напиток'}</h2>
      </div>
      <button type="button" className={`community-button${open ? ' community-button-secondary' : ''} review-form-toggle`} aria-expanded={open} aria-controls="review-form-panel" onClick={toggle}>
        {open ? 'Свернуть' : hasReview ? 'Изменить отзыв' : 'Написать отзыв'}
      </button>
    </div>
    <div id="review-form-panel" hidden={!open}>
      <CatalogReviewForm brand={brand} flavor={flavor} existing={existing} authenticated stepped onSettled={has => { setHasReview(has); setOpen(false); }} />
    </div>
  </>;
}
