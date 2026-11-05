import { getPool } from '@/db/pool';
import { canonicalDrink } from '@/lib/brand-collection-fields';
import { flavorName } from '@/lib/catalog-query';
import type { CatalogGroup } from '@canrush/shared';
import { drinkCatalog } from '@/lib/wall-drinks';

/** A can that stands out of a profile activity card (`community-shortcut`). */
export interface ShortcutCan { key: string; label: string; cover: string }
/** How many things fan out of one card: three still read on a 80 px card of a phone. */
export const SHORTCUT_PEEK = 3;

const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);

/**
 * Cans for the «Отзывы» and «Тирлисты» cards: the drinks reviewed last, and the top of the latest published tier list
 * (S first, then by position). Only catalog drinks with a cover; an older identity of a review counts as today's drink.
 */
export async function getShortcutCans(userId: string): Promise<{ reviews: ShortcutCan[]; tierlists: ShortcutCan[] }> {
  const [reviews, tiers, catalog] = await Promise.all([
    getPool().query<{ brand: string; flavor: string }>(`select brand, flavor from review where "userId" = $1
      order by "createdAt" desc limit 12`, [userId]),
    getPool().query<{ brand: string; flavor: string }>(`select i.brand, i.flavor from "tierListItem" i
      join (select id from "tierList" where "userId" = $1 and status = 'published' order by "publishedAt" desc nulls last limit 1) t
        on t.id = i."tierListId"
      order by array_position(array['S', 'A', 'B', 'C', 'D'], i.tier), i.position limit 12`, [userId]),
    drinkCatalog(),
  ]);
  const pick = (rows: { brand: string; flavor: string }[]): ShortcutCan[] => {
    const cans: ShortcutCan[] = [];
    for (const row of rows) {
      const identity = canonicalDrink(row.brand, row.flavor);
      const option = catalog.get(key(identity.brand, identity.flavor)) ?? catalog.get(key(row.brand, row.flavor));
      if (!option?.cover || cans.some(can => can.key === key(option.brand, option.flavor))) continue;
      cans.push({ key: key(option.brand, option.flavor), label: option.label, cover: option.cover });
      if (cans.length === SHORTCUT_PEEK) break;
    }
    return cans;
  };
  return { reviews: pick(reviews.rows), tierlists: pick(tiers.rows) };
}

/** Cans for the «Избранное» card: the latest favourites that have a cover. */
export function favoriteCans(groups: CatalogGroup[]): ShortcutCan[] {
  return groups.filter(group => group.coverImageUrl).slice(0, SHORTCUT_PEEK)
    .map(group => ({ key: key(group.brand, group.flavor), label: `${group.brand} · ${flavorName(group.flavor)}`, cover: group.coverImageUrl! }));
}
