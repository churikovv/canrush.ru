import { cache } from 'react';
import type { CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { applyCardEdits, cardKey, type CardEdit } from '@/lib/catalog-card-edit-fields';
import type { PreparedReviewPhoto } from '@/lib/review-photos';

/**
 * The team's edits of the parser's catalog cards (migration 0140): merge into another card, hide, full name, our own
 * cover. The parser keeps rewriting its files, so the edits live in the database and are laid over every catalog load.
 */
export class CatalogCardError extends Error {}

const ADMIN = 'exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $1)';

/** All edits, one cheap query per request (no photo bytes). */
export const cardEdits = cache(async (): Promise<CardEdit[]> => (await getPool().query<{ id: string; brand: string; flavor: string; mergedIntoBrand: string | null; mergedIntoFlavor: string | null; hidden: boolean; fullName: string | null; photoVersion: Date | null; updatedBy: string | null; volumes: number[] }>(
  `select id, brand, flavor, "mergedIntoBrand", "mergedIntoFlavor", hidden, "fullName", case when photo is not null then "updatedAt" end as "photoVersion", "updatedBy", volumes from "catalogCardEdit"`)).rows
  .map(row => ({ id: row.id, brand: row.brand, flavor: row.flavor, hidden: row.hidden, fullName: row.fullName, updatedBy: row.updatedBy, volumes: row.volumes,
    mergedInto: row.mergedIntoBrand && row.mergedIntoFlavor ? { brand: row.mergedIntoBrand, flavor: row.mergedIntoFlavor } : null,
    photoVersion: row.photoVersion ? row.photoVersion.getTime() : null })));

/** The groups with the team's edits; the database being away leaves them as the parser wrote them. */
export async function withCardEdits(groups: CatalogGroup[]): Promise<CatalogGroup[]> {
  const edits = await cardEdits().catch(() => [] as CardEdit[]);
  return applyCardEdits(groups, edits);
}

async function audit(db: { query: ReturnType<typeof getPool>['query'] }, email: string, action: string, brand: string, flavor: string) {
  await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [email, action, 'catalog-card', `${brand} · ${flavor}`]);
}

async function edit(staffId: string, staffEmail: string, card: { brand: string; flavor: string }, action: string, set: string, values: unknown[]): Promise<void> {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    if (!(await db.query(`select 1 where ${ADMIN}`, [staffId])).rowCount) throw new CatalogCardError('Нет доступа.');
    await db.query(`insert into "catalogCardEdit"(brand, flavor, "updatedBy") values ($1, $2, $3) on conflict (brand, flavor) do nothing`, [card.brand, card.flavor, staffEmail]);
    await db.query(`update "catalogCardEdit" set ${set}, "updatedAt" = clock_timestamp(), "updatedBy" = $3 where brand = $1 and flavor = $2`, [card.brand, card.flavor, staffEmail, ...values]);
    await audit(db, staffEmail, action, card.brand, card.flavor);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/** The full name from the can; '' clears it. */
export async function setCardFullName(staffId: string, staffEmail: string, card: { brand: string; flavor: string }, fullName: string): Promise<void> {
  await edit(staffId, staffEmail, card, 'catalog-card-name', '"fullName" = nullif($4, \'\')', [fullName]);
}

/** Hide a card that is not a drink of the catalog (a juice, a set, a mistake), or bring it back. */
export async function setCardHidden(staffId: string, staffEmail: string, card: { brand: string; flavor: string }, hidden: boolean): Promise<void> {
  await edit(staffId, staffEmail, card, hidden ? 'catalog-card-hide' : 'catalog-card-show', 'hidden = $4', [hidden]);
}

/** Our own cover over the parser's photo, or null to go back to the parser's. */
export async function setCardPhoto(staffId: string, staffEmail: string, card: { brand: string; flavor: string }, photo: PreparedReviewPhoto | null): Promise<void> {
  await edit(staffId, staffEmail, card, photo ? 'catalog-card-photo' : 'catalog-card-photo-reset', 'photo = $4, thumbnail = $5', [photo?.data ?? null, photo?.thumbnail ?? null]);
}

/**
 * Merge a parser card into another catalog card, as the alias migrations did by hand: from now on the card's offers
 * show on the target, everything members left on it moves there (`move_drink_identity`), earlier merges into it follow,
 * and its old address redirects (`catalogDrinkRename`). `target` must be a card the catalog shows (`storeDrinkOptions`).
 */
export async function mergeCatalogCard(staffId: string, staffEmail: string, card: { brand: string; flavor: string }, target: { brand: string; flavor: string }): Promise<void> {
  await mergeCards(card, target, staffEmail, 'catalog-card-merge', staffId);
}

/** The author of merges the neural network makes on its own, in `updatedBy` and the admin journal. */
export const NETWORK_ACTOR = 'нейросеть';
/** A merge the neural network is sure about (`catalog-card-check.ts`): the same as the team's, by «нейросеть». */
export async function mergeCatalogCardAutomatically(card: { brand: string; flavor: string }, target: { brand: string; flavor: string }): Promise<void> {
  await mergeCards(card, target, NETWORK_ACTOR, 'catalog-card-auto-merge');
}

async function mergeCards(card: { brand: string; flavor: string }, target: { brand: string; flavor: string }, actor: string, action: string, staffId?: string): Promise<void> {
  if (card.brand === target.brand && card.flavor === target.flavor) throw new CatalogCardError('Это та же карточка. Выберите другую.');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    if (staffId !== undefined && !(await db.query(`select 1 where ${ADMIN}`, [staffId])).rowCount) throw new CatalogCardError('Нет доступа.');
    // No loops: the target must not lead back to this card.
    const chain = (await db.query<{ brand: string; flavor: string; mergedIntoBrand: string | null; mergedIntoFlavor: string | null }>('select brand, flavor, "mergedIntoBrand", "mergedIntoFlavor" from "catalogCardEdit" where "mergedIntoBrand" is not null')).rows;
    const next = new Map(chain.map(row => [cardKey(row.brand, row.flavor), { brand: row.mergedIntoBrand!, flavor: row.mergedIntoFlavor! }]));
    let step = target;
    for (let i = 0; i < 10; i++) {
      if (step.brand === card.brand && step.flavor === card.flavor) throw new CatalogCardError('Эта карточка уже склеена с этой. Выберите другую.');
      const further = next.get(cardKey(step.brand, step.flavor));
      if (!further) break;
      step = further;
    }
    await db.query(`insert into "catalogCardEdit"(brand, flavor, "mergedIntoBrand", "mergedIntoFlavor", "updatedBy") values ($1, $2, $3, $4, $5)
      on conflict (brand, flavor) do update set "mergedIntoBrand" = excluded."mergedIntoBrand", "mergedIntoFlavor" = excluded."mergedIntoFlavor", "updatedAt" = clock_timestamp(), "updatedBy" = excluded."updatedBy"`,
    [card.brand, card.flavor, target.brand, target.flavor, actor]);
    await db.query('update "catalogCardEdit" set "mergedIntoBrand" = $3, "mergedIntoFlavor" = $4 where "mergedIntoBrand" = $1 and "mergedIntoFlavor" = $2', [card.brand, card.flavor, target.brand, target.flavor]);
    await addCardVolumes(db, target, (await db.query<{ volumes: number[] }>('select volumes from "catalogCardEdit" where brand = $1 and flavor = $2', [card.brand, card.flavor])).rows[0]?.volumes ?? [], actor);
    await db.query('select move_drink_identity($1, $2, $3, $4)', [card.brand, card.flavor, target.brand, target.flavor]);
    await db.query('update "catalogDrinkRename" set "toBrand" = $3, "toFlavor" = $4 where "toBrand" = $1 and "toFlavor" = $2', [card.brand, card.flavor, target.brand, target.flavor]);
    await db.query('insert into "catalogDrinkRename"("fromBrand", "fromFlavor", "toBrand", "toFlavor") values ($1, $2, $3, $4)', [card.brand, card.flavor, target.brand, target.flavor]);
    await audit(db, actor, action, card.brand, card.flavor);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/**
 * Adds can volumes to a catalog card inside the caller's transaction: a published member drink keeps them in its own
 * list, a parser card in its edit row (`catalogCardEdit.volumes`, laid over the files on every load).
 */
export async function addCardVolumes(db: { query: ReturnType<typeof getPool>['query'] }, card: { brand: string; flavor: string }, volumes: readonly number[], actor: string): Promise<void> {
  if (!volumes.length) return;
  const own = await db.query(`update "catalogDrink" set volumes = (select array(select distinct v from unnest(volumes || $3::int[]) v order by v))[1:12]
    where status = 'published' and lower(brand) = lower($1) and lower(flavor) = lower($2)`, [card.brand, card.flavor, volumes]);
  if (own.rowCount) return;
  await db.query(`insert into "catalogCardEdit"(brand, flavor, volumes, "updatedBy") values ($1, $2, (select array(select distinct v from unnest($3::int[]) v order by v))[1:12], $4)
    on conflict (brand, flavor) do update set volumes = (select array(select distinct v from unnest("catalogCardEdit".volumes || excluded.volumes) v order by v))[1:12], "updatedAt" = clock_timestamp(), "updatedBy" = excluded."updatedBy"`,
  [card.brand, card.flavor, volumes, actor]);
}

/** The bytes of our own cover, `thumbnail` for the small one. */
export async function getCardPhoto(id: string, size: 'full' | 'thumbnail'): Promise<Buffer | null> {
  const row = (await getPool().query<{ photo: Buffer | null }>(`select ${size === 'thumbnail' ? 'thumbnail' : 'photo'} as photo from "catalogCardEdit" where id = $1`, [id])).rows[0];
  return row?.photo ?? null;
}
