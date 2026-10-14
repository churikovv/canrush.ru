import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonProductGrid, SkeletonTabs } from '@/components/skeleton';

export default function CatalogLoading() {
  return <SkeletonPage active="catalog" surfaceClassName="catalog-surface">
    <SkeletonHeading />
    <Skeleton height={52} radius={14} />
    <SkeletonTabs count={4} />
    <SkeletonProductGrid count={12} />
  </SkeletonPage>;
}
