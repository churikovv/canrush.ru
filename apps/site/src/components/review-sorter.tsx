'use client';

import { Fragment, useState, type ReactNode } from 'react';

export type ReviewSort = 'new' | 'liked' | 'old';
export interface SortableReview { id: string; createdAt: string; likes: number; node: ReactNode }

const OPTIONS: ReadonlyArray<{ key: ReviewSort; label: string }> = [
  { key: 'new', label: 'Новые' },
  { key: 'liked', label: 'По лайкам' },
  { key: 'old', label: 'Старые' },
];

/** Orders the already rendered reviews of one product; ties in likes go to the newer review. */
export function sortReviews<T extends Omit<SortableReview, 'node'>>(items: readonly T[], sort: ReviewSort): T[] {
  const time = (item: T) => Date.parse(item.createdAt);
  return [...items].sort((a, b) => sort === 'old' ? time(a) - time(b)
    : sort === 'liked' ? b.likes - a.likes || time(b) - time(a)
    : time(b) - time(a));
}

export function ReviewSorter({ items }: { items: SortableReview[] }) {
  const [sort, setSort] = useState<ReviewSort>('new');
  return <>
    {items.length > 1 && <div className="review-sort" role="group" aria-label="Порядок отзывов">
      {OPTIONS.map(option => <button key={option.key} type="button" aria-pressed={sort === option.key} onClick={() => setSort(option.key)}>{option.label}</button>)}
    </div>}
    <div className="review-list">{sortReviews(items, sort).map(item => <Fragment key={item.id}>{item.node}</Fragment>)}</div>
  </>;
}
