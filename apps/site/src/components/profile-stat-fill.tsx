'use client';

import { useEffect, useRef } from 'react';

/** The final value is rendered on the server; motion only enhances its reveal. */
export function ProfileStatFill({ value, delay = 0, axis = 'x' }: { value: number; delay?: number; axis?: 'x' | 'y' }) {
  const scale = axis === 'x' ? 'scaleX' : 'scaleY';
  const ratio = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const fill = useRef<HTMLSpanElement>(null);
  const revealed = useRef(false);
  const previous = useRef(ratio);

  useEffect(() => {
    const element = fill.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: Animation | undefined;
    const from = previous.current;
    previous.current = ratio;
    function play(initial: boolean) {
      revealed.current = true;
      if (reduced.matches) return;
      animation = element!.animate([
        { transform: `${scale}(${initial ? 0 : from})` },
        { transform: `${scale}(${ratio})` },
      ], { duration: initial ? 650 : 350, delay: initial ? delay : 0, easing: 'cubic-bezier(0.22, 0, 0.2, 1)', fill: 'backwards' });
    }
    const onPreference = () => { if (reduced.matches) animation?.cancel(); };
    reduced.addEventListener('change', onPreference);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { play(true); observer.disconnect(); }
    }, { threshold: 0.5 });
    if (revealed.current) play(false);
    else observer.observe(element.parentElement ?? element);
    return () => { observer.disconnect(); animation?.cancel(); reduced.removeEventListener('change', onPreference); };
  }, [ratio, delay, scale]);

  return <span ref={fill} className="profile-stat-fill" data-axis={axis} style={{ transform: `${scale}(${ratio})` }} aria-hidden="true" />;
}
