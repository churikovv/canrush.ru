import { SkeletonHeading, SkeletonPage, SkeletonRows, SkeletonTabs } from '@/components/skeleton';

export default function MessagesLoading() {
  return <SkeletonPage active="market">
    <SkeletonTabs />
    <SkeletonHeading subtitle={false} />
    <SkeletonRows count={6} />
  </SkeletonPage>;
}
