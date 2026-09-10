import { TIER_KEYS, type TierListPlacement } from '@/lib/tier-list-types';

export interface TierListFieldErrors {
  title?: string;
  items?: string;
}

export interface TierListInput {
  title: string;
  items: TierListPlacement[];
}

const TIERS = new Set<string>(TIER_KEYS);

function normalizeTitle(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

export function parseTierListItems(value: string): TierListPlacement[] | null {
  if (!value || value.length > 120_000) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > 300) return null;

    const seen = new Set<string>();
    const items: TierListPlacement[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const { brand, flavor, tier, position } = record;
      if (
        typeof brand !== 'string' ||
        typeof flavor !== 'string' ||
        typeof tier !== 'string' ||
        typeof position !== 'number' ||
        brand.length === 0 ||
        brand.length > 120 ||
        flavor.length === 0 ||
        flavor.length > 80 ||
        !TIERS.has(tier) ||
        !Number.isSafeInteger(position) ||
        position < 0
      ) {
        return null;
      }

      const key = `${brand}\u0000${flavor}`;
      if (seen.has(key)) return null;
      seen.add(key);
      items.push({ brand, flavor, tier: tier as TierListPlacement['tier'], position });
    }

    return items;
  } catch {
    return null;
  }
}

export function validateTierListInput(values: { title: string; items: string }):
  | { data: TierListInput; errors?: never }
  | { data?: never; errors: TierListFieldErrors } {
  const title = normalizeTitle(values.title);
  const items = parseTierListItems(values.items);
  const errors: TierListFieldErrors = {};

  if (!title) errors.title = 'Введите название тирлиста.';
  else if (title.length > 80) errors.title = 'Название должно быть короче 80 символов.';

  if (!items) errors.items = 'Не удалось прочитать расположение товаров.';

  return Object.keys(errors).length > 0 ? { errors } : { data: { title, items: items ?? [] } };
}
