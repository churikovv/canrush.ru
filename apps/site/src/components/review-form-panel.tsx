'use client';
import { useEffect, useState } from 'react';
import { CatalogReviewForm } from '@/components/catalog-review-form';
import { REVIEW_EDIT_EVENT } from '@/components/review-edit-shortcut';
import { FIRST_REVIEW_XP, REVIEW_XP } from '@/lib/review-fields';
import type { ReviewData } from '@/lib/reviews';
import { FIRST_REVIEW_SPARKS } from '@/lib/shop-items';

/**
 * The review form on a drink's page, folded behind «Написать отзыв» / «Изменить отзыв». The form stays mounted while
 * hidden: the edit and delete icons on the author's own review card talk to it through window events, and the delete
 * confirmation must work with the panel closed. A save, a cancel or a delete folds it back.
 */
export function ReviewFormPanel({ brand, flavor, existing, authenticated, firstBonus = false }: { brand: string; flavor: string; existing: ReviewData | null; authenticated: boolean; firstBonus?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasReview, setHasReview] = useState(Boolean(existing));
  const [draft, setDraft] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(REVIEW_EDIT_EVENT, show);
    // «Оценить» from the dating deck links to `?tab=reviews#write-review`: the sheet opens with the form already open.
    const timer = window.location.hash === '#write-review' ? window.setTimeout(() => {
      setOpen(true);
      window.setTimeout(() => document.getElementById('review-form-panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
    }, 0) : 0;
    return () => { window.removeEventListener(REVIEW_EDIT_EVENT, show); window.clearTimeout(timer); };
  }, []);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    // An existing review opens straight into editing (the form unlocks itself on this event).
    if (hasReview) window.dispatchEvent(new Event(REVIEW_EDIT_EVENT));
  };
  // The first review's reward, until it is paid: the usual XP plus the one-time bonus and the shop's sparks.
  const bonus = firstBonus && !hasReview ? <p className="review-first-bonus">Первый отзыв: +{REVIEW_XP + FIRST_REVIEW_XP} XP и {FIRST_REVIEW_SPARKS} искр</p> : null;
  if (!authenticated) return <>
    <div className="review-form-heading"><h2>Оценить напиток</h2>{bonus}</div>
    <CatalogReviewForm brand={brand} flavor={flavor} existing={existing} authenticated={false} />
  </>;
  return <>
    <div className="review-form-heading review-form-toggle-row">
      <div>
        <h2>{hasReview ? 'Ваш отзыв' : 'Оценить напиток'}</h2>
        {bonus}
      </div>
      <button type="button" className={`community-button${open ? ' community-button-secondary' : ''} review-form-toggle`} aria-expanded={open} aria-controls="review-form-panel" onClick={toggle}>
        {open ? 'Свернуть' : draft ? 'Продолжить отзыв' : hasReview ? 'Изменить отзыв' : 'Написать отзыв'}
      </button>
    </div>
    <div id="review-form-panel" hidden={!open}>
      <CatalogReviewForm brand={brand} flavor={flavor} existing={existing} authenticated stepped onDraft={setDraft} onSettled={has => { setHasReview(has); setOpen(false); }} />
    </div>
  </>;
}
