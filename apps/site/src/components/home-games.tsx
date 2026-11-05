'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The games row of the home page: Банкомат, Битва банок. On a phone it is a swipe row — one banner a screen, the next
 * one peeking in — with dots telling where you are; from 900px the banners stand side by side and the dots go away.
 * The dots only show the place (swiping is the way to move), so they are not buttons.
 */
export function HomeGames({ children }: { children: ReactNode }) {
  const row = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  const slides = Children.toArray(children);
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    // The slide whose middle is nearest the row's middle; read on scroll, written once a frame.
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = element.getBoundingClientRect(), middle = box.left + box.width / 2;
        let best = 0, distance = Infinity;
        Array.from(element.children).forEach((child, index) => {
          const rect = child.getBoundingClientRect(), gap = Math.abs(rect.left + rect.width / 2 - middle);
          if (gap < distance) { distance = gap; best = index; }
        });
        setAt(best);
      });
    };
    element.addEventListener('scroll', read, { passive: true });
    return () => { element.removeEventListener('scroll', read); cancelAnimationFrame(frame); };
  }, []);
  return <section className="home-games" aria-label="Игры">
    <ul className="home-games-row" ref={row}>{slides.map((slide, index) => <li key={index}>{slide}</li>)}</ul>
    {slides.length > 1 && <span className="home-games-dots" aria-hidden="true">{slides.map((_, index) => <i key={index} data-on={index === at || undefined} />)}</span>}
  </section>;
}
