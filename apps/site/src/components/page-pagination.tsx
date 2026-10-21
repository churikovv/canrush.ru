import Link from '@/components/navigation-progress';
import { pageWindow } from '@/lib/pagination';

interface PagePaginationProps {
  page: number;
  pages: number;
  href: (page: number) => string;
  label: string;
  previousLabel?: string;
  nextLabel?: string;
}

const arrow = (direction: 'left' | 'right') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d={direction === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
</svg>;

/** Numbered pager: previous/next buttons around page numbers with gaps (pageWindow). */
export function PagePagination({ page, pages, href, label, previousLabel = 'Назад', nextLabel = 'Вперёд' }: PagePaginationProps) {
  if (pages <= 1) return null;
  const previous = page > 1 ? page - 1 : null;
  const next = page < pages ? page + 1 : null;
  return <nav className="page-pagination" aria-label={label}>
    {previous ? <Link className="page-pagination-step" href={href(previous)} rel="prev">{arrow('left')}<span>{previousLabel}</span></Link>
      : <span className="page-pagination-step" aria-disabled="true">{arrow('left')}<span>{previousLabel}</span></span>}
    <ol className="page-pagination-pages">
      {pageWindow(page, pages).map((slot, index) => <li key={slot === 'gap' ? `gap-${index}` : slot}>
        {slot === 'gap' ? <span className="page-pagination-gap" aria-hidden="true">…</span>
          : slot === page ? <span className="page-pagination-page" aria-current="page">{slot}</span>
          : <Link className="page-pagination-page" href={href(slot)} aria-label={`Страница ${slot}`}>{slot}</Link>}
      </li>)}
    </ol>
    {next ? <Link className="page-pagination-step" href={href(next)} rel="next"><span>{nextLabel}</span>{arrow('right')}</Link>
      : <span className="page-pagination-step" aria-disabled="true"><span>{nextLabel}</span>{arrow('right')}</span>}
  </nav>;
}
