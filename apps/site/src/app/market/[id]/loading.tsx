import { Skeleton, SkeletonDetail, SkeletonPage } from '@/components/skeleton';

export default function ListingLoading() {
  return <SkeletonPage active="market">
    <Skeleton width={160} height={16} />
    <SkeletonDetail />
  </SkeletonPage>;
}
