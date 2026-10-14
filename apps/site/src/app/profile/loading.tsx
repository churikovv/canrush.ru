import { SkeletonPage, SkeletonProfile } from '@/components/skeleton';

export default function ProfileLoading() {
  return <SkeletonPage active="profile" surfaceClassName="profile-surface"><SkeletonProfile /></SkeletonPage>;
}
