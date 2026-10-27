import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { mergeCatalogAliases, readAllCatalogGroups } from '@/lib/catalog-files';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import { firstSeenDays, NOVELTY_DAYS, noveltyKey } from '@/lib/novelty-fields';

const SYNC_EVERY_MS = 10 * 60_000;
let lastSync = 0;
let syncing: Promise<void> | null = null;

/**
 * Records identities of the catalog files the site has not seen before (`catalogFirstSeen`), at most every 10 minutes
 * per process. The very first sync marks everything as the baseline and then, in the background, dates what appeared
 * later from the price history, so «Новинки» is not empty on launch.
 */
export async function syncCatalogFirstSeen(groups?: CatalogGroup[]): Promise<void> {
  if (!groups && Date.now() - lastSync < SYNC_EVERY_MS) return;
  if (syncing) return syncing;
  syncing = (async () => {
    const identities = (groups ?? await readAllCatalogGroups()).filter(isCountedCatalogDrink);
    const { rows } = await getPool().query<{ baseline: boolean }>(
      `with fresh as (select not exists(select 1 from "catalogFirstSeen") as baseline)
       insert into "catalogFirstSeen"(brand, flavor, baseline)
       select brand, flavor, (select baseline from fresh) from unnest($1::text[], $2::text[]) as t(brand, flavor)
       on conflict do nothing returning baseline`,
      [identities.map(group => group.brand), identities.map(group => group.flavor)]);
    lastSync = Date.now();
    if (!groups && rows.some(row => row.baseline)) void dateFromHistory().catch(error => console.error('[novelties] history backfill failed', error));
  })().finally(() => { syncing = null; });
  return syncing;
}

/** One-time: baseline rows that first appeared in the daily price snapshots after their first days get that date. */
async function dateFromHistory(root = process.env.PRICE_HISTORY_DIR ?? path.resolve(process.cwd(), '../../data/regions')) {
  const snapshots: { date: string; keys: Set<string> }[] = [];
  for (const city of await readdir(root).catch(() => [] as string[])) {
    const directory = path.join(root, city, 'history');
    const files = (await readdir(directory).catch(() => [] as string[])).filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file));
    for (const file of files) {
      try {
        const data = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as { groups?: CatalogGroup[] };
        snapshots.push({ date: file.slice(0, 10), keys: new Set(mergeCatalogAliases(data.groups ?? []).map(group => noveltyKey(group.brand, group.flavor))) });
      } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    }
  }
  const days = [...firstSeenDays(snapshots)].map(([key, day]) => [...JSON.parse(key) as [string, string], day]);
  if (!days.length) return;
  await getPool().query(
    `update "catalogFirstSeen" s set "firstSeenAt" = (t.day || ' 06:00+03')::timestamptz, baseline = false
     from unnest($1::text[], $2::text[], $3::text[]) as t(brand, flavor, day) where s.brand = t.brand and s.flavor = t.flavor and s.baseline`,
    [days.map(row => row[0]), days.map(row => row[1]), days.map(row => row[2])]);
}

/** `age` — days since it appeared (fractional). */
export interface Novelty { brand: string; flavor: string; at: Date; age: number; added: boolean }

/** Drinks new to the catalog in the last NOVELTY_DAYS: first seen in shops, or members' drinks that passed moderation. */
export async function getNovelties(days = NOVELTY_DAYS, sync = true): Promise<Novelty[]> {
  if (sync) await syncCatalogFirstSeen().catch(error => console.error('[novelties] sync failed', error));
  const { rows } = await getPool().query<Novelty>(
    `select brand, flavor, max(at) as at, (extract(epoch from now() - max(at)) / 86400)::float8 as age, bool_or(added) as added from (
       select brand, flavor, "firstSeenAt" as at, false as added from "catalogFirstSeen" where not baseline and "firstSeenAt" > now() - make_interval(days => $1)
       union all
       select brand, flavor, "reviewedAt", true from "catalogDrink" where status = 'published' and "reviewedAt" > now() - make_interval(days => $1)
     ) n group by brand, flavor order by at desc`, [days]);
  return rows;
}
