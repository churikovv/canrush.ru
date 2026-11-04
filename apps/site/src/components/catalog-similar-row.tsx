'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const ARROW = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;

/**
 * The row of «Похожее»: one line of cards that scrolls sideways on every screen. A finger swipes it; with a
 * mouse the arrows beside the heading move it by most of its width (they only show where there is a mouse, and grey
 * out at either end).
 */
export function CatalogSimilarRow({ head, children }: { head: ReactNode; children: ReactNode }) {
  const row = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setEnds({ start: element.scrollLeft <= 4, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4 }));
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(element);
    return () => { cancelAnimationFrame(frame); element.removeEventListener('scroll', update); resize.disconnect(); };
  }, []);

  function move(direction: 1 | -1) {
    const element = row.current;
    if (!element) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  }

  return <>
    <div className="catalog-similar-head">
      {head}
      <div className="catalog-similar-arrows">
        <button type="button" className="catalog-similar-arrow is-back" aria-label="Назад" disabled={ends.start} onClick={() => move(-1)}>{ARROW}</button>
        <button type="button" className="catalog-similar-arrow" aria-label="Дальше" disabled={ends.end} onClick={() => move(1)}>{ARROW}</button>
      </div>
    </div>
    <ul ref={row} className="catalog-similar-row">{children}</ul>
  </>;
}
