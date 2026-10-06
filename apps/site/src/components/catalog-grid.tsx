'use client';

import Link from '@/components/navigation-progress';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useTransition } from 'react';

interface CatalogGridProps {
  children: ReactNode;
  nextHref?: string;
  autoLoad: boolean;
  visibleCount: number;
  totalCount: number;
}

export function CatalogGrid({ children, nextHref, autoLoad, visibleCount, totalCount }: CatalogGridProps) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const navigatingRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    navigatingRef.current = false;
  }, [nextHref]);

  useEffect(() => {
    if (!nextHref || !autoLoad) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || navigatingRef.current) return;
        navigatingRef.current = true;
        startTransition(() => router.replace(nextHref, { scroll: false }));
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [autoLoad, nextHref, router]);

  return (
    <>
      <p className="sr-only" aria-live="polite">
        Показано товаров: {visibleCount} из {totalCount}
      </p>
      <div id="catalog-results" className="catalog-grid">{children}</div>
      {nextHref ? (
        <div ref={autoLoad ? sentinelRef : undefined} className="catalog-load-more-zone" aria-busy={isPending}>
          {autoLoad ? (
            isPending ? (
              <>
                <span className="catalog-load-more-spinner" aria-hidden="true" />
                <span className="sr-only" role="status">
                  Загружаем товары
                </span>
              </>
            ) : null
          ) : (
            <Link className="catalog-load-more" href={nextHref} scroll={false}>
              Показать ещё
            </Link>
          )}
        </div>
      ) : null}
    </>
  );
}
