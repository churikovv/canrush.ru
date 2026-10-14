import { SkeletonHeading, SkeletonPage, SkeletonRows, SkeletonText } from '@/components/skeleton';

/** Fallback for routes without their own skeleton (legal pages, admin, sign-in): no tab bar, as on those pages. */
export default function Loading() {
  return <SkeletonPage navigation={false}>
    <SkeletonHeading />
    <SkeletonText lines={4} />
    <SkeletonRows count={4} avatar={false} />
  </SkeletonPage>;
}
