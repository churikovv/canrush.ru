import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonRows, SkeletonTabs } from '@/components/skeleton';

export default function StoresLoading() {
  return <SkeletonPage active="prices">
    <SkeletonTabs />
    <SkeletonHeading action />
    <Skeleton height={280} radius={20} />
    <SkeletonRows count={5} />
  </SkeletonPage>;
}
