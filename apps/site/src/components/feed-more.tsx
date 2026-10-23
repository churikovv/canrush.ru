'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadFeedPageAction } from '@/app/feed/actions';
import Link from '@/components/navigation-progress';

/** Pages loaded by scrolling; after that a button, so the footer (documents, contacts) can always be reached. */
const AUTO_PAGES = 5;

/**
 * The rest of the home feed: when the end comes into view, the next page renders on the server and is appended to the
 * same list. Page 1 is already on the page.
 */
export function FeedMore() {
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState(2);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const sentinel = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const auto = next <= AUTO_PAGES + 1;

  async function load() {
    if (loading.current) return;
    loading.current = true; setState('loading');
    try {
      const result = await loadFeedPageAction(next);
      setPages(current => [...current, <div key={next} className="feed-page" style={{ display: 'contents' }}>{result.rows}</div>]);
      setNext(page => page + 1);
      setState(result.hasMore ? 'idle' : 'done');
    } catch { setState('error'); }
    finally { loading.current = false; }
  }
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !auto || state !== 'idle') return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadRef.current(); }, { rootMargin: '800px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [auto, state]);

  return <>
    {pages}
    <div ref={sentinel} className="feed-more-status" aria-live="polite">
      {state === 'loading' && <span className="feed-more-loading">Загружаем ещё…</span>}
      {state === 'error' && <button type="button" className="feed-more" onClick={() => void load()}>Не удалось загрузить — повторить</button>}
      {state === 'idle' && !auto && <button type="button" className="feed-more" onClick={() => void load()}>Показать ещё</button>}
      {state === 'done' && <Link className="feed-more-end" href="/feed">Вы дошли до начала ленты</Link>}
    </div>
  </>;
}
