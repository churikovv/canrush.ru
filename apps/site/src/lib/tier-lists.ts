import type { CatalogGroup } from '@canrush/shared';
import type { QueryResultRow } from 'pg';
import { getPool } from '@/db/pool';
import { catalogGroupSlug, catalogRetailerCount, flavorName } from '@/lib/catalog-query';
import { getReviewSummaries, type ReviewSummary } from '@/lib/reviews';
import {
  TIER_KEYS,
  type TierKey,
  type TierListData,
  type TierListPlacement,
  type TierListProduct,
  type TierListStatus,
  type TierListSummary,
} from '@/lib/tier-list-types';

const MIN_OFFICIAL_REVIEW_COUNT = 3;
const MIN_OFFICIAL_RETAILER_COUNT = 4;

interface TierListRow extends QueryResultRow {
  id: string;
  userId: string;
  slug: string;
  title: string;
  status: TierListStatus;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  username: string;
  name: string;
  telegramChannel: string | null;
}

interface TierListSummaryRow extends TierListRow {
  itemCount: number;
}

interface TierListItemRow extends QueryResultRow {
  tierListId: string;
  brand: string;
  flavor: string;
  tier: TierKey;
  position: number;
}

export interface PublishedTierListSitemapEntry extends QueryResultRow {
  slug: string;
  updatedAt: Date;
}

const TIER_LIST_SELECT = `
  select tl."id", tl."userId", tl."slug", tl."title", tl."status",
         tl."createdAt", tl."updatedAt", tl."publishedAt",
         u."username", u."name", u."telegramChannel"
  from "tierList" tl
  join "user" u on u."id" = tl."userId"
`;

function productKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

function toPlacement(row: TierListItemRow): TierListPlacement {
  return {
    brand: row.brand,
    flavor: row.flavor,
    tier: row.tier,
    position: Number(row.position),
  };
}

function toTierList(row: TierListRow, items: TierListPlacement[]): TierListData {
  return {
    id: row.id,
    userId: row.userId,
    slug: row.slug,
    title: row.title,
    status: row.status,
    author: {
      username: row.username,
      name: row.name,
      telegramChannel: row.telegramChannel,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    items,
  };
}

async function getItemsForLists(ids: string[]): Promise<Map<string, TierListPlacement[]>> {
  const byList = new Map<string, TierListPlacement[]>();
  if (ids.length === 0) return byList;

  const result = await getPool().query<TierListItemRow>(
    `select "tierListId", "brand", "flavor", "tier", "position"
     from "tierListItem"
     where "tierListId" = any($1::uuid[])
     order by array_position($2::text[], "tier"), "position", "brand", "flavor"`,
    [ids, TIER_KEYS],
  );

  for (const row of result.rows) {
    const items = byList.get(row.tierListId) ?? [];
    items.push(toPlacement(row));
    byList.set(row.tierListId, items);
  }
  return byList;
}

export async function getTierListBySlug(slug: string): Promise<TierListData | null> {
  if (!/^[a-z0-9-]{8,100}$/u.test(slug)) return null;

  const result = await getPool().query<TierListRow>(`${TIER_LIST_SELECT} where tl."slug" = $1 limit 1`, [slug]);
  const row = result.rows[0];
  if (!row) return null;

  const items = await getItemsForLists([row.id]);
  return toTierList(row, items.get(row.id) ?? []);
}

async function getTierListSummaries(where: string, values: unknown[], limit: number): Promise<TierListSummary[]> {
  const result = await getPool().query<TierListSummaryRow>(
    `select tl."id", tl."userId", tl."slug", tl."title", tl."status",
            tl."createdAt", tl."updatedAt", tl."publishedAt",
            u."username", u."name", u."telegramChannel",
            count(tli."tierListId")::int as "itemCount"
     from "tierList" tl
     join "user" u on u."id" = tl."userId"
     left join "tierListItem" tli on tli."tierListId" = tl."id"
     ${where}
     group by tl."id", u."id"
     order by coalesce(tl."publishedAt", tl."updatedAt") desc
     limit $${values.length + 1}`,
    [...values, limit],
  );
  const itemsByList = await getItemsForLists(result.rows.map((row) => row.id));

  return result.rows.map((row) => ({
    ...toTierList(row, []),
    itemCount: Number(row.itemCount),
    preview: (itemsByList.get(row.id) ?? []).slice(0, 8),
  }));
}

export function getCommunityTierLists(limit = 12): Promise<TierListSummary[]> {
  return getTierListSummaries('where tl."status" = \'published\'', [], Math.min(Math.max(limit, 1), 48));
}

export async function getPublishedTierListSitemapEntries(): Promise<PublishedTierListSitemapEntry[]> {
  const result = await getPool().query<PublishedTierListSitemapEntry>(
    `select "slug", "updatedAt"
     from "tierList"
     where "status" = 'published'
     order by "updatedAt" desc
     limit 50000`,
  );
  return result.rows;
}

export function getTierListsForOwner(userId: string, limit = 48): Promise<TierListSummary[]> {
  return getTierListSummaries('where tl."userId" = $1', [userId], Math.min(Math.max(limit, 1), 100));
}

export function getPublishedTierListsForUser(userId: string, limit = 48): Promise<TierListSummary[]> {
  return getTierListSummaries(
    'where tl."userId" = $1 and tl."status" = \'published\'',
    [userId],
    Math.min(Math.max(limit, 1), 100),
  );
}

export function catalogGroupsToTierProducts(
  groups: CatalogGroup[],
  summaries: Map<string, ReviewSummary> = new Map(),
): TierListProduct[] {
  return groups.map((group) => {
    const summary = summaries.get(productKey(group.brand, group.flavor));
    return {
      id: catalogGroupSlug(group.brand, group.flavor),
      brand: group.brand,
      flavor: group.flavor,
      flavorLabel: flavorName(group.flavor),
      imageUrl: group.coverImageUrl,
      retailerCount: catalogRetailerCount(group),
      price: group.minPrice > 0 ? group.minPrice : undefined,
      reviewCount: summary?.count ?? 0,
      score: summary && summary.count > 0 ? summary.overall : undefined,
    };
  });
}

function tierForScore(score: number): TierKey {
  if (score >= 4.5) return 'S';
  if (score >= 4) return 'A';
  if (score >= 3.5) return 'B';
  if (score >= 3) return 'C';
  return 'D';
}

export interface OfficialTierList {
  products: TierListProduct[];
  placements: TierListPlacement[];
  eligibleCount: number;
  ratedCount: number;
}

export async function buildOfficialTierList(groups: CatalogGroup[]): Promise<OfficialTierList> {
  const eligible = groups.filter((group) => catalogRetailerCount(group) >= MIN_OFFICIAL_RETAILER_COUNT);
  const summaries = await getReviewSummaries(eligible.map(({ brand, flavor }) => ({ brand, flavor })));
  const products = catalogGroupsToTierProducts(eligible, summaries)
    .filter((product) => product.reviewCount >= MIN_OFFICIAL_REVIEW_COUNT && product.score !== undefined)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.brand.localeCompare(right.brand, 'ru-RU'));
  const positions = new Map<TierKey, number>(TIER_KEYS.map((tier) => [tier, 0]));
  const placements = products.map((product) => {
    const tier = tierForScore(product.score ?? 0);
    const position = positions.get(tier) ?? 0;
    positions.set(tier, position + 1);
    return { brand: product.brand, flavor: product.flavor, tier, position };
  });

  return {
    products,
    placements,
    eligibleCount: eligible.length,
    ratedCount: products.length,
  };
}

export function tierListProductsForPlacements(
  groups: CatalogGroup[],
  placements: TierListPlacement[],
): TierListProduct[] {
  const byKey = new Map(catalogGroupsToTierProducts(groups).map((product) => [productKey(product.brand, product.flavor), product]));
  return placements.map((placement) => {
    const product = byKey.get(productKey(placement.brand, placement.flavor));
    return product ?? {
      id: catalogGroupSlug(placement.brand, placement.flavor),
      brand: placement.brand,
      flavor: placement.flavor,
      flavorLabel: flavorName(placement.flavor),
      retailerCount: 0,
      reviewCount: 0,
    };
  });
}
