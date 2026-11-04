import { getPool } from '@/db/pool';
import { buildSuggestIndex, suggest, type SuggestIndex, type Suggestion } from '@/lib/search-suggest-fields';
import { storeDrinkOptions } from '@/lib/store-catalog';

/** The catalog and its popularity change slowly: one index per process, rebuilt every 10 minutes. */
const TTL_MS = 10 * 60 * 1000;
let kept: { at: number; index: Promise<SuggestIndex> } | null = null;

async function readIndex(): Promise<SuggestIndex> {
  const [drinks, popular] = await Promise.all([
    storeDrinkOptions(),
    // Views of the drink page in a month and reviews ever: what people look at comes first among equal matches.
    getPool().query<{ brand: string; flavor: string; n: number }>(`
      select brand, flavor, sum(n)::int as n from (
        select brand, flavor, count(*) as n from "catalogEvent" where kind = 'view' and "createdAt" > now() - interval '30 days' group by 1, 2
        union all select brand, flavor, 3 * count(*) from review group by 1, 2
      ) x group by 1, 2`).then(result => result.rows).catch(() => []),
  ]);
  return buildSuggestIndex(drinks, new Map(popular.map(row => [JSON.stringify([row.brand, row.flavor]), row.n])));
}

function index(): Promise<SuggestIndex> {
  if (!kept || Date.now() - kept.at > TTL_MS) {
    const built = readIndex();
    kept = { at: Date.now(), index: built };
    built.catch(() => { if (kept?.index === built) kept = null; });
  }
  return kept.index;
}

/** Подсказки поиска каталога к набранному (`search-suggest-fields.ts`). */
export async function searchSuggestions(query: string): Promise<Suggestion[]> {
  return suggest(await index(), query);
}
