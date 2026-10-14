import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonProductGrid, SkeletonTabs } from '@/components/skeleton';

export default function MarketLoading() {
  return <SkeletonPage active="market">
    <SkeletonTabs />
    <SkeletonHeading action />
    <Skeleton height={52} radius={14} />
    <SkeletonProductGrid count={8} />
  </SkeletonPage>;
}
