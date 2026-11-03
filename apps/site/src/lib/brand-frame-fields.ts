import { isAssortmentFlavor } from '@canrush/shared';
import { canonicalDrink, COLLECTION_BRAND_LINES } from '@/lib/brand-collection-fields';
import { BRAND_FRAME_ITEMS, BRAND_FRAME_REVIEWS, type BrandFrameItem } from '@/lib/profile-appearance';

export interface BrandFrameProgress { key: BrandFrameItem['key']; reviewed: number }

/**
 * Distinct flavours of each frame's brand among the member's reviews. Older identities count as the
 * current drink, a product line counts for its parent brand, and the brand matches without case:
 * catalog spellings have split by case before.
 */
export function brandFrameProgress(reviews: readonly { brand: string; flavor: string }[]): BrandFrameProgress[] {
  const flavors = new Map<string, Set<string>>();
  for (const review of reviews) {
    const { brand, flavor } = canonicalDrink(review.brand, review.flavor);
    if (isAssortmentFlavor(flavor)) continue;
    const parent = (COLLECTION_BRAND_LINES[brand]?.brand ?? brand).toLocaleLowerCase('ru-RU');
    flavors.set(parent, (flavors.get(parent) ?? new Set<string>()).add(`${brand.toLocaleLowerCase('ru-RU')}\n${flavor}`));
  }
  return BRAND_FRAME_ITEMS.map(item => ({ key: item.key, reviewed: flavors.get(item.brand.toLocaleLowerCase('ru-RU'))?.size ?? 0 }));
}

export const ownedBrandFrames = (progress: readonly BrandFrameProgress[]): string[] => progress.filter(item => item.reviewed >= BRAND_FRAME_REVIEWS).map(item => item.key);

/** Why a brand frame cannot be chosen yet, or null when it is not a brand frame. */
export function lockedBrandFrameMessage(frame: string): string | null {
  const item = BRAND_FRAME_ITEMS.find(entry => entry.key === frame);
  return item ? `Рамка «${item.label}» пока закрыта: оцените ${BRAND_FRAME_REVIEWS} разных вкусов ${item.brand}.` : null;
}
