'use client';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

/** The most the card leans under the mouse, in degrees, across and along. */
const TILT_X = 12, TILT_Y = 16;

/**
 * The stage of a card dropped from the Bankomat in the feed. The first time it comes into view the card falls in with a
 * flash (`data-reveal`); then it sways a little, and a mouse over it leans it towards the pointer with a glare. On a
 * phone a tap opens the big view (`CardInspector`), where the card is turned with a finger. The point is measured on the
 * stage, which does not move, so leaning the card does not move it under the pointer.
 */
export function FeedDrop({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    const node = stage.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const seen = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      node.dataset.reveal = 'play';
      seen.disconnect();
    }, { threshold: .35 });
    seen.observe(node);
    return () => { seen.disconnect(); cancelAnimationFrame(frame.current); };
  }, []);

  function lean(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      node.dataset.tilting = '';
      node.style.setProperty('--tilt-x', `${((.5 - y) * 2 * TILT_X).toFixed(2)}deg`);
      node.style.setProperty('--tilt-y', `${((x - .5) * 2 * TILT_Y).toFixed(2)}deg`);
      node.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      node.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  }
  function rest(event: ReactPointerEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    cancelAnimationFrame(frame.current);
    delete node.dataset.tilting;
    node.style.removeProperty('--tilt-x');
    node.style.removeProperty('--tilt-y');
  }

  return <div ref={stage} className="feed-drop-stage" onPointerMove={lean} onPointerLeave={rest}>{children}</div>;
}
