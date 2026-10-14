import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonRows, SkeletonTabs } from '@/components/skeleton';

export default function PricesLoading() {
  return <SkeletonPage active="prices" surfaceClassName="price-analytics-surface">
    <SkeletonTabs />
    <SkeletonHeading />
    <div className="skeleton-detail-stats">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={88} radius={16} />)}</div>
    <SkeletonRows count={8} />
  </SkeletonPage>;
}
