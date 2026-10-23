'use client';
import { useState, type ReactNode } from 'react';

/**
 * The rest of a day's reviews in a feed event. Closed, they are a stack: the edges of one or two cards peek out under
 * the shown review; the stack or «Посмотреть больше» opens them in place, «Свернуть» gathers them back. The rows are
 * rendered on the server with the card and only shown here.
 */
export function FeedReviewsMore({ hidden, children }: { hidden: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    {open ? children : <li className="feed-reviews-stack" data-layers={Math.min(hidden, 2)} aria-hidden="true" onClick={() => setOpen(true)}><span /><span /></li>}
    <li className="feed-reviews-toggle">
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {open ? 'Свернуть' : <>Посмотреть больше <span>· ещё {hidden}</span></>}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </li>
  </>;
}
