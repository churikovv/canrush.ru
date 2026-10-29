import { isAssortmentFlavor, isExcludedEnergyBrand } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { readAllCatalogGroups } from '@/lib/catalog-files';
import { withCardEdits } from '@/lib/catalog-card-edits';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { coverHashes } from '@/lib/cover-hash';
import type { ChatMessage } from '@/lib/gigachat';
import {
  combineDuplicateResults, drinkLabel, DUPLICATE_CHECK_VERSION, DUPLICATE_HINTS, hammingDistance, isConfidentDuplicate, isFlavorInMix, isThinCard, mergeDuplicateVotes, offerTitles, PHOTO_TWIN_DISTANCE,
  DUPLICATE_SYSTEM, duplicatePrompt, parseDuplicateAnswer, shortlistCandidates,
  type DrinkToCheck, type DuplicateCandidate, type DuplicateResult, type DuplicateVerdict,
} from '@/lib/drink-duplicate-fields';

/**
 * The neural network checks members' drinks for duplicates (migration 0139): a request right after it is sent, then the
 * worker (`drink-check-worker.ts`) catches up with requests it missed, edited drinks and the published ones. The answer
 * is a hint in /admin/drinks — the moderator decides. Only drink names and label text go to the model.
 */
interface Chat { chat(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<string> }

export interface DrinkCheck { verdict: DuplicateVerdict; matchLabel: string | null; matchHref: string | null; reason: string; checkedAt: Date }

/** Every card the drink could repeat: the parser's (in shops or archived) and published member drinks, by brand. */
export async function catalogCandidates(): Promise<DuplicateCandidate[]> {
  const files = (await withCardEdits(await readAllCatalogGroups())).filter(group => !isExcludedEnergyBrand(group.brand) && !/^(?:unknown|unresolved)(?::|$)/u.test(group.flavor) && !isAssortmentFlavor(group.flavor))
    .map((group): DuplicateCandidate => ({ brand: group.brand, flavor: group.flavor, ...(group.fullName ? { fullName: group.fullName } : {}), kind: group.variants.length ? 'shop' : 'archive',
      titles: offerTitles(group.variants), offers: group.variants.length, ...(group.coverImageUrl ? { cover: group.coverImageUrl } : {}) }));
  const known = new Set(files.map(item => `${item.brand.toLowerCase()}\u0000${item.flavor.toLowerCase()}`));
  const { rows } = await getPool().query<{ id: string; brand: string; flavor: string; fullName: string; updatedAt: Date }>(`select id, brand, flavor, "fullName", "updatedAt" from "catalogDrink" where status = 'published'`);
  const members = rows.filter(row => !known.has(`${row.brand.toLowerCase()}\u0000${row.flavor.toLowerCase()}`))
    .map((row): DuplicateCandidate => ({ brand: row.brand, flavor: row.flavor, ...(row.fullName ? { fullName: row.fullName } : {}), kind: 'member', cover: memberCover(row.id, row.updatedAt) }));
  return [...files, ...members];
}

const memberCover = (id: string, updatedAt: Date) => `/api/catalog-drinks/${id}/${updatedAt.getTime()}`;

/**
 * The drink's brand mates with hints for the model: «одинаковое фото банки» when the covers' fingerprints are within
 * `PHOTO_TWIN_DISTANCE` bits — unless three or more cards of the brand share that picture, which then is the brand's
 * stock photo, not a twin — and «вкус входит в микс» (`isFlavorInMix`). Other brands' cards are left as they are.
 */
export async function withDuplicateHints(drink: DrinkToCheck, all: DuplicateCandidate[]): Promise<DuplicateCandidate[]> {
  if (!DUPLICATE_HINTS) return all;
  const brand = drink.brand.toLowerCase();
  const mates = all.filter(candidate => candidate.brand.toLowerCase() === brand && !(candidate.brand === drink.brand && candidate.flavor === drink.flavor));
  if (!mates.length) return all;
  const hashes = await coverHashes([drink.cover ?? '', ...mates.map(mate => mate.cover ?? '')]).catch(() => new Map<string, string>());
  const own = drink.cover ? hashes.get(drink.cover) : undefined;
  const near = (cover?: string) => !!own && !!cover && hashes.has(cover) && hammingDistance(own, hashes.get(cover)!) <= PHOTO_TWIN_DISTANCE;
  const stockPhoto = mates.filter(mate => near(mate.cover)).length >= 2;
  const hinted = new Map(mates.map(mate => {
    const hints = [!stockPhoto && near(mate.cover) ? 'одинаковое фото банки' : '', isFlavorInMix(drink.flavor, mate.flavor) ? 'вкус входит в микс' : ''].filter(Boolean);
    return [mate, hints.length ? { ...mate, hint: hints.join(', ') } : mate];
  }));
  return all.map(candidate => hinted.get(candidate) ?? candidate);
}

async function ask(client: Chat, drink: DrinkToCheck, candidates: DuplicateCandidate[]): Promise<DuplicateResult | null> {
  const raw = await client.chat([{ role: 'system', content: DUPLICATE_SYSTEM }, { role: 'user', content: duplicatePrompt(drink, candidates) }], { maxTokens: 300, temperature: 0.1 });
  return parseDuplicateAnswer(raw, candidates, drink);
}

/**
 * One drink against its shortlist, asked twice (`mergeDuplicateVotes`) — or `votes` times when the answer may merge
 * cards on its own (`confident`, `isConfidentDuplicate`; asking stops at the first answer that is not the same duplicate). When the model's content filter refuses the whole list (one card's name is enough —
 * «Irish creme» did it for every Monster), the list is asked in two halves; a half that is refused again counts as
 * unanswered, and with any unanswered half a «new» is not trusted (`failed`).
 */
export async function judgeDrink(client: Chat, drink: DrinkToCheck, all: DuplicateCandidate[], { votes: count = 2 }: { votes?: number } = {}): Promise<DuplicateResult & { confident: boolean; hinted: DuplicateCandidate[] }> {
  const candidates = shortlistCandidates(drink, await withDuplicateHints(drink, all));
  // The cards with a hint (same photo, flavour in a mix): a first check of a new card asks them again (catalog-card-check.ts).
  const hinted = candidates.filter(candidate => candidate.hint);
  if (!candidates.length) return { verdict: 'new', match: null, reason: 'Других напитков этого бренда в каталоге нет.', confident: false, hinted };
  const asked: (DuplicateResult | null)[] = [];
  for (let i = 0; i < count; i++) {
    const vote = await ask(client, drink, candidates);
    asked.push(vote);
    // An automatic merge needs every answer: the first one that is not the same duplicate settles it as a hint at most.
    if (count >= 3 && !(vote?.verdict === 'duplicate' && vote.match && vote.match === asked[0]?.match)) break;
  }
  const confident = isConfidentDuplicate(asked);
  const votes = asked.filter((vote): vote is DuplicateResult => vote !== null);
  if (votes.length) {
    const result = confident ? votes[0]! : mergeDuplicateVotes(votes);
    // The model saw no twin, but the can photo is the same, or the flavour is part of the other's mix and one of the
    // two cards is barely in shops (most twins the moderators found): the moderator looks anyway. Never a merge.
    const photoTwin = candidates.find(candidate => candidate.hint?.includes('фото'));
    if (result.verdict === 'new' && photoTwin) return { verdict: 'unsure', match: photoTwin, reason: 'Нейросеть считает напиток новым, но фото банки совпадает с этой карточкой.', confident: false, hinted };
    const mix = candidates.find(candidate => candidate.hint?.includes('микс') && (isThinCard(candidate) || isThinCard({ kind: drink.offers === undefined ? undefined : drink.offers ? 'shop' : 'archive', offers: drink.offers })));
    if (result.verdict === 'new' && mix) return { verdict: 'unsure', match: mix, reason: 'Вкус входит в микс этой карточки, а одна из двух почти не встречается в магазинах.', confident: false, hinted };
    return { ...result, confident, hinted };
  }
  if (candidates.length < 2) return { verdict: 'failed', match: null, reason: 'Нейросеть не ответила по существу.', confident: false, hinted };
  const half = Math.ceil(candidates.length / 2);
  return { ...combineDuplicateResults([await ask(client, drink, candidates.slice(0, half)), await ask(client, drink, candidates.slice(half))]), confident: false, hinted };
}

/** Checks one drink and keeps the verdict; a «не дубль» the team gave stays while the match is the same card. */
export async function checkDrinkDuplicates(client: Chat, id: string, candidates?: DuplicateCandidate[]): Promise<DuplicateResult | null> {
  const drink = (await getPool().query<{ brand: string; flavor: string; fullName: string; ingredients: string; updatedAt: Date }>(
    `select brand, flavor, "fullName", ingredients, "updatedAt" from "catalogDrink" where id = $1 and status in ('pending', 'published')`, [id])).rows[0];
  if (!drink) return null;
  const result = await judgeDrink(client, { ...drink, cover: memberCover(id, drink.updatedAt) }, candidates ?? await catalogCandidates());
  await getPool().query(`insert into "catalogDrinkCheck"("drinkId", verdict, "matchBrand", "matchFlavor", "matchLabel", reason, "checkedVersion", version)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict ("drinkId") do update set verdict = excluded.verdict, "matchBrand" = excluded."matchBrand", "matchFlavor" = excluded."matchFlavor",
      "matchLabel" = excluded."matchLabel", reason = excluded.reason, "checkedVersion" = excluded."checkedVersion", version = excluded.version, "checkedAt" = now(),
      "dismissedAt" = case when "catalogDrinkCheck"."matchBrand" is not distinct from excluded."matchBrand" and "catalogDrinkCheck"."matchFlavor" is not distinct from excluded."matchFlavor" then "catalogDrinkCheck"."dismissedAt" end,
      "dismissedBy" = case when "catalogDrinkCheck"."matchBrand" is not distinct from excluded."matchBrand" and "catalogDrinkCheck"."matchFlavor" is not distinct from excluded."matchFlavor" then "catalogDrinkCheck"."dismissedBy" end`,
  [id, result.verdict, result.match?.brand ?? null, result.match?.flavor ?? null, result.match ? drinkLabel(result.match) : null, result.reason, drink.updatedAt, DUPLICATE_CHECK_VERSION]);
  return result;
}

/** A quota or rate answer from the model: the run stops and the rest waits for the next pass. */
const isQuotaError = (error: unknown) => error instanceof Error && /gigachat_chat_(?:402|429)/u.test(error.message);

/**
 * Drinks not checked yet or edited since (to the millisecond: the database keeps microseconds, the checked version came
 * through a JS Date): requests first, oldest first, then published ones. At most `limit` per pass,
 * one at a time with a pause (the model's free tier takes one request at a time). A failed drink is retried next pass.
 */
export async function runDrinkChecks(client: Chat, limit = 20, pause = 1500): Promise<{ checked: number; failed: number }> {
  const { rows } = await getPool().query<{ id: string }>(`select d.id from "catalogDrink" d left join "catalogDrinkCheck" c on c."drinkId" = d.id
    where d.status in ('pending', 'published') and (c."drinkId" is null or c."checkedVersion" < date_trunc('milliseconds', d."updatedAt")
      or (c.verdict = 'failed' and c."checkedAt" < now() - interval '1 day')
      or (c.verdict in ('new', 'failed') and c.version < $2))
    order by d.status = 'pending' desc, c."drinkId" is not null, d."createdAt" limit $1`, [limit, DUPLICATE_CHECK_VERSION]);
  if (!rows.length) return { checked: 0, failed: 0 };
  const candidates = await catalogCandidates();
  let checked = 0, failed = 0;
  for (const row of rows) {
    try { await checkDrinkDuplicates(client, row.id, candidates); checked++; }
    catch (error) { failed++; if (isQuotaError(error)) break; }
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
  }
  return { checked, failed };
}

/** The verdicts of a page of drinks, for their cards in /admin/drinks. */
export async function getDrinkChecks(ids: string[]): Promise<Map<string, DrinkCheck & { dismissed: boolean }>> {
  if (!ids.length) return new Map();
  const { rows } = await getPool().query<{ drinkId: string; verdict: DuplicateVerdict; matchBrand: string | null; matchFlavor: string | null; matchLabel: string | null; reason: string; checkedAt: Date; dismissed: boolean }>(
    `select "drinkId", verdict, "matchBrand", "matchFlavor", "matchLabel", reason, "checkedAt", "dismissedAt" is not null as dismissed
     from "catalogDrinkCheck" where "drinkId" = any($1::uuid[])`, [ids]);
  return new Map(rows.map(row => [row.drinkId, {
    verdict: row.verdict, matchLabel: row.matchLabel, reason: row.reason, checkedAt: row.checkedAt, dismissed: row.dismissed,
    matchHref: row.matchBrand && row.matchFlavor ? `/catalog/${catalogGroupSlug(row.matchBrand, row.matchFlavor)}` : null,
  }]));
}

/** «Не дубль»: the team hides this match of a published drink from «Возможные дубли». */
export async function dismissDrinkCheck(staffUserId: string, staffEmail: string, id: string): Promise<void> {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const updated = await db.query(`update "catalogDrinkCheck" set "dismissedAt" = now(), "dismissedBy" = $3 where "drinkId" = $2
      and exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $1)`, [staffUserId, id, staffEmail]);
    if (updated.rowCount) await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [staffEmail, 'catalog-drink-not-duplicate', 'catalog-drink', id]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/** How many published drinks the network suspects, for the «Возможные дубли» tab. */
export const SUSPECT = `exists(select 1 from "catalogDrinkCheck" c where c."drinkId" = d.id and c.verdict in ('duplicate', 'unsure') and c."dismissedAt" is null)`;
export async function countSuspectedDuplicates(): Promise<number> {
  return (await getPool().query<{ n: number }>(`select count(*)::int as n from "catalogDrink" d where d.status = 'published' and ${SUSPECT}`)).rows[0]?.n ?? 0;
}
