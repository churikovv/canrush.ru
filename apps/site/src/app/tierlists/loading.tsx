import { SkeletonHeading, SkeletonPage, SkeletonTabs, SkeletonTierBoard } from '@/components/skeleton';

export default function TierListsLoading() {
  return <SkeletonPage active="tierlists" surfaceClassName="tierlists-surface">
    <SkeletonHeading action />
    <SkeletonTabs />
    <SkeletonTierBoard />
  </SkeletonPage>;
}
