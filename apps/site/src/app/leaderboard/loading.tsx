import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonRows } from '@/components/skeleton';

export default function LeaderboardLoading() {
  return <SkeletonPage active="profile" surfaceClassName="profile-surface">
    <SkeletonHeading subtitle={false} />
    <Skeleton height={260} radius={16} />
    <SkeletonRows count={8} />
  </SkeletonPage>;
}
