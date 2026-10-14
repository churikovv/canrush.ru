import { SkeletonChat, SkeletonPage } from '@/components/skeleton';

export default function ConversationLoading() {
  return <SkeletonPage active="market"><SkeletonChat /></SkeletonPage>;
}
