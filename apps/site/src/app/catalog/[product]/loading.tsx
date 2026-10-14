import { SkeletonPage, SkeletonProduct } from '@/components/skeleton';

export default function ProductLoading() {
  return <SkeletonPage active="catalog" surfaceClassName="catalog-detail-surface" wide><SkeletonProduct /></SkeletonPage>;
}
