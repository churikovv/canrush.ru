import { Skeleton, SkeletonPage, SkeletonRows, SkeletonSectionTitle, SkeletonShelf } from '@/components/skeleton';

export default function HomeLoading() {
  return <SkeletonPage active="home" surfaceClassName="catalog-surface home-surface">
    <Skeleton className="skeleton-hero" height="auto" />
    <section className="skeleton-text"><SkeletonSectionTitle /><Skeleton height={150} radius={16} /><SkeletonRows count={3} /></section>
    <section className="skeleton-text"><SkeletonSectionTitle /><div className="skeleton-shelf">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={320} radius={20} />)}</div></section>
    <section className="skeleton-text"><SkeletonSectionTitle /><SkeletonShelf /></section>
  </SkeletonPage>;
}
