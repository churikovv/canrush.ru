'use client';
import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { RatingStars } from '@/components/rating-stars';

const PARAM = 'tab';
const VALUE = 'reviews';
/** Marks the history entry the sheet adds; the address itself stays the same. */
const MARK = 'canrushReviewsSheet';
const marked = () => (window.history.state as Record<string, unknown> | null)?.[MARK] === true;

/** What reviews praise and complain about (the drink's review summary), shown under the score without its source. */
export interface ReviewHighlights { praise: string[]; complaints: string[] }

const THUMB = 'M7 10.5v9.5H4v-9.5zM7 10.5l3.6-6.6c1.5 0 2.5 1.2 2.2 2.6l-.6 3.5h6.1a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.1 20H7';
const HIGHLIGHTS = [
  { key: 'praise', title: 'Хвалят', tone: 'good', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={THUMB} /></svg> },
  { key: 'complaints', title: 'Жалуются', tone: 'bad', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d={THUMB} /></svg> },
] as const;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function reviewsWord(count: number) {
  const ones = count % 10, tens = count % 100;
  if (ones === 1 && tens !== 11) return 'отзыв';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'отзыва';
  return 'отзывов';
}

/** The page address without `?tab=reviews` and its `#review-…`, other parameters kept. */
function addressWithout() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

/**
 * The drink page's rating card — score, stars, how many reviews, and under them what reviews praise and complain
 * about — that opens the reviews as a sheet over the page (the whole card is the target: the head link stretches
 * over it)
 * (a modal `dialog`, like a day of the drink calendar). Opening adds a history entry with the same address and a mark
 * in its state, so the system back gesture closes the sheet. Not a `?tab=reviews` push: a server action inside (a
 * saved review) made Next push its own entry over it, and back reopened the sheet. Arriving with `?tab=reviews`
 * (a notification, a feed link, `#review-<id>`) opens the sheet at once and scrolls to that review; closing it drops
 * the parameter. The reviews themselves are server-rendered children.
 */
export function CatalogReviewsSheet({ overall, count, title, initiallyOpen, highlights, children }: { overall: number; count: number; title: string; initiallyOpen: boolean; highlights?: ReviewHighlights | null; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Set while our `history.back()` is on its way: the arrow and the `close` event both ask to leave, and a second
  // back would leave the drink page itself.
  const leaving = useRef(false);
  // A tap on the card while that back is still on its way: the sheet opens once it lands (opened earlier, the late
  // back would close it again at once — the «tap does nothing» it looked like).
  const reopen = useRef(false);

  const show = useCallback(() => {
    const sheet = dialog.current;
    if (!sheet || sheet.open) return;
    sheet.showModal();
    sheet.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (!initiallyOpen) return;
    show();
    const target = window.location.hash.slice(1);
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
  }, [initiallyOpen, show]);

  // Back (or forward) moves the sheet with the address.
  useEffect(() => {
    const sync = () => {
      leaving.current = false;
      const sheet = dialog.current;
      if (!sheet) return;
      if (reopen.current) {
        reopen.current = false;
        if (!marked()) window.history.pushState({ ...(window.history.state as object | null), [MARK]: true }, '');
        show();
      } else if (marked()) show();
      else if (sheet.open) sheet.close();
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [show]);

  // The card is a link to `?tab=reviews`, so a tap before the page hydrates still opens the reviews (a full load with
  // the sheet open); after hydration it opens the sheet in place. Standing on our own entry already (a stale one, or
  // forward), it does not add another: two entries made back land on the first and reopen the sheet.
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (leaving.current) { reopen.current = true; return; }
    if (!marked()) window.history.pushState({ ...(window.history.state as object | null), [MARK]: true }, '');
    show();
  }

  // Leaving the sheet puts the history back the way it was before it: back over our own entry, else the arrival
  // parameter is dropped from the address. Safe to call twice.
  function leave() {
    if (leaving.current) return;
    if (marked()) { leaving.current = true; window.history.back(); return; }
    if (new URL(window.location.href).searchParams.get(PARAM) === VALUE) window.history.replaceState(window.history.state, '', addressWithout());
  }
  // Every way out goes through here — the arrow, the backdrop, Escape (`cancel`) and back (`popstate`); there is no
  // `close` handler: that event sometimes came late, after the sheet had been opened again, and closed the new one.
  function dismiss() { leave(); dialog.current?.close(); }

  const hasReviews = count > 0;
  return <>
    <div className="catalog-rating-card">
    <a href="?tab=reviews" className="catalog-rating-card-head" aria-haspopup="dialog" onClick={open}>
      {hasReviews ? <>
        <span className="catalog-rating-card-score">
          <strong>{overall.toFixed(1)}<small>/10</small></strong>
          <RatingStars value={overall} size={16} label={`Общий рейтинг ${overall.toFixed(1)} из 10`} />
        </span>
        <span className="catalog-rating-card-count">{count} {reviewsWord(count)}</span>
      </> : <>
        <span className="catalog-rating-card-score"><strong className="catalog-rating-card-empty">Отзывов пока нет</strong></span>
        <span className="catalog-rating-card-count">Оцените первым — вкус и дизайн</span>
      </>}
      <svg className="catalog-rating-card-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </a>
    {highlights && (highlights.praise.length > 0 || highlights.complaints.length > 0) && <div className="catalog-rating-highlights">
      {HIGHLIGHTS.map(({ key, title, tone, icon }) => highlights[key].length > 0 && <section key={key} data-tone={tone}>
        <h3><span aria-hidden="true">{icon}</span>{title}</h3>
        <ul>{highlights[key].map(item => <li key={item}>{capitalize(item)}</li>)}</ul>
      </section>)}
    </div>}
    </div>

    <dialog ref={dialog} className="catalog-reviews-sheet" aria-labelledby="catalog-reviews-title" onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <header className="catalog-reviews-sheet-head">
        <button type="button" className="catalog-reviews-sheet-back" aria-label="Назад к напитку" onClick={dismiss}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <h2 id="catalog-reviews-title">Отзывы{hasReviews ? ` · ${count}` : ''}</h2>
          <p>{title}</p>
        </div>
      </header>
      <div className="catalog-reviews-sheet-body">{children}</div>
    </dialog>
  </>;
}
