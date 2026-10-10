export const TIER_KEYS = ['SS', 'S', 'A', 'B', 'C', 'D'] as const;

export type TierKey = (typeof TIER_KEYS)[number];
export type TierListStatus = 'draft' | 'published';

export interface TierListProduct {
  id: string;
  brand: string;
  flavor: string;
  flavorLabel: string;
  imageUrl?: string;
  retailerCount: number;
  reviewCount: number;
  score?: number;
  price?: number;
}

export interface TierListPlacement {
  brand: string;
  flavor: string;
  tier: TierKey;
  position: number;
}

export interface TierListAuthor {
  username: string;
  name: string;
  telegramChannel: string | null;
}

export interface TierListData {
  id: string;
  userId: string;
  slug: string;
  title: string;
  status: TierListStatus;
  author: TierListAuthor;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  tiers: TierKey[];
  reactionsEnabled: boolean;
  commentsEnabled: boolean;
  items: TierListPlacement[];
}

export interface TierListSummary extends Omit<TierListData, 'items'> {
  likes: number;
  comments: number;
  itemCount: number;
  preview: TierListPlacement[];
}
