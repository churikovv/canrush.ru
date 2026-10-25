import { getPool } from '@/db/pool';
import { CatalogDrinkError } from '@/lib/catalog-drink-fields';
import { brandSearchTerms } from '@/lib/search-aliases';
import { searchMatches } from '@/lib/search-match';
import { storeDrinkOptions, type StoreDrinkOption } from '@/lib/store-catalog';

const ADMIN = 'exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $1)';
const SEARCH_LIMIT = 20;

/** Catalog cards a member drink can be merged into, by brand, flavour or full name (Russian brand spellings too). */
export async function searchMergeTargets(query: string, exclude?: { brand: string; flavor: string }): Promise<StoreDrinkOption[]> {
  const typed = query.trim().slice(0, 80);
  if (!typed) return [];
  return (await storeDrinkOptions())
    .filter(option => !(exclude && option.brand === exclude.brand && option.flavor === exclude.flavor))
    .filter(option => searchMatches(`${option.label} ${option.fullName ?? ''} ${brandSearchTerms(option.brand).join(' ')}`, typed))
    .slice(0, SEARCH_LIMIT);
}

export interface MergeResult { moved: boolean; revokedXp: number }

/**
 * Merges a member's drink into a card the catalog already has, as migrations 0101 and 0102 did by hand: for a published
 * drink everything tied to its identity moves to the target (`move_drink_identity`) and the old address redirects
 * (`catalogDrinkRename`); the drink itself is deleted. `revokeXp` takes back the 50 XP paid for it, which also frees a
 * place in the 50-drink limit; the «Сэнсэй» tag stays, as tags are never taken back. The author is told what happened.
 */
export async function mergeCatalogDrink(adminId: string, adminEmail: string, id: string, version: string, target: { brand: string; flavor: string }, revokeXp: boolean): Promise<MergeResult> {
  const known = (await storeDrinkOptions()).find(option => option.brand === target.brand && option.flavor === target.flavor);
  if (!known) throw new CatalogDrinkError('Такой карточки нет в каталоге. Выберите её из подсказок.');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const drink = (await db.query<{ brand: string; flavor: string; status: string; ownerId: string }>(`select d.brand, d.flavor, d.status, d."ownerId" from "catalogDrink" d
      where d.id = $2 and date_trunc('milliseconds', d."updatedAt") = $3::timestamptz and ${ADMIN} for update`, [adminId, id, version])).rows[0];
    if (!drink) throw new CatalogDrinkError('Напиток изменился или удалён. Обновите страницу.');
    if (drink.brand === known.brand && drink.flavor === known.flavor) throw new CatalogDrinkError('Это та же карточка. Выберите другую.');
    const published = drink.status === 'published';
    if (published) {
      await db.query('select move_drink_identity($1, $2, $3, $4)', [drink.brand, drink.flavor, known.brand, known.flavor]);
      await db.query('update "catalogDrinkRename" set "toBrand" = $3, "toFlavor" = $4 where "toBrand" = $1 and "toFlavor" = $2', [drink.brand, drink.flavor, known.brand, known.flavor]);
      await db.query('insert into "catalogDrinkRename"("drinkId", "fromBrand", "fromFlavor", "toBrand", "toFlavor") values ($1, $2, $3, $4, $5)', [id, drink.brand, drink.flavor, known.brand, known.flavor]);
    }
    await db.query('delete from "catalogDrink" where id = $1', [id]);
    const revokedXp = revokeXp ? (await db.query<{ points: number }>(`delete from "profileExperience" where "userId" = $1 and reason = 'catalog-drink' and "sourceKey" = $2 returning points`, [drink.ownerId, id])).rows.reduce((sum, row) => sum + row.points, 0) : 0;
    await db.query(`insert into notification ("userId", kind, "eventKey", payload) values ($1, 'drink-merged', $2, $3) on conflict ("userId", "eventKey") do nothing`,
      [drink.ownerId, `drink-merged:${id}`, { brand: drink.brand, flavor: drink.flavor, targetBrand: known.brand, targetFlavor: known.flavor, published, xp: revokedXp }]);
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [adminEmail, revokedXp ? 'catalog-drink-merge-revoke-xp' : 'catalog-drink-merge', 'catalog-drink', id]);
    await db.query('commit');
    return { moved: published, revokedXp };
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally { db.release(); }
}
