import { isAssortmentFlavor, isExcludedEnergyBrand, isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { cardEdits, mergeCatalogCardAutomatically, NETWORK_ACTOR } from '@/lib/catalog-card-edits';
import { cardKey, cardPhotoUrl, mergeTarget } from '@/lib/catalog-card-edit-fields';
import { readAllCatalogGroups } from '@/lib/catalog-files';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { catalogCandidates, judgeDrink } from '@/lib/drink-duplicate-check';
import { cardInputs, CONFIDENT_VOTES, drinkLabel, DUPLICATE_CHECK_VERSION, DUPLICATE_HINTS, offerTitles, type DuplicateCandidate } from '@/lib/drink-duplicate-fields';
import type { ChatMessage } from '@/lib/gigachat';

/**
 * The neural network checks the parser's catalog cards for duplicates (migration 0141), once per card. Sure (all
 * `CONFIDENT_VOTES` answers name the same card with the same sugar and juice marks) — the cards are merged at once, the
 * one in shops kept over an archived one; a likely duplicate, or a card whose flavour the parser could not read, waits
 * for a moderator in «Карточки каталога». Members' drinks are never merged this way: they have authors and XP.
 */
interface Chat { chat(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<string> }

export type CardCheckVerdict = 'duplicate' | 'unsure' | 'new' | 'failed' | 'unknown' | 'merged';
export interface CardCheck {
  brand: string; flavor: string; verdict: CardCheckVerdict; match: { brand: string; flavor: string; label: string; href: string } | null;
  reason: string; title: string | null; checkedAt: Date; dismissed: boolean;
}

const UNKNOWN = /^(?:unknown|unresolved)(?::|$)/u;
const isQuotaError = (error: unknown) => error instanceof Error && /gigachat_chat_(?:402|429)/u.test(error.message);

async function save(card: { brand: string; flavor: string }, verdict: CardCheckVerdict, match: { brand: string; flavor: string } | null, reason: string, title: string | null = null, inputs: string | null = null) {
  await getPool().query(`insert into "catalogCardCheck"(brand, flavor, verdict, "matchBrand", "matchFlavor", "matchLabel", reason, title, version, inputs) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    on conflict (brand, flavor) do update set verdict = excluded.verdict, "matchBrand" = excluded."matchBrand", "matchFlavor" = excluded."matchFlavor",
      "matchLabel" = excluded."matchLabel", reason = excluded.reason, title = excluded.title, version = excluded.version, inputs = excluded.inputs,
      "checkedAt" = now(), "dismissedAt" = null, "dismissedBy" = null`,
  [card.brand, card.flavor, verdict, match?.brand ?? null, match?.flavor ?? null, match ? drinkLabel(match) : null, reason.slice(0, 300), title, DUPLICATE_CHECK_VERSION, inputs]);
}

/** What the model sees of a parser card: its shop names, cover and offers. */
const toCheck = (group: CatalogGroup) => ({ brand: group.brand, flavor: group.flavor, ...(group.fullName ? { fullName: group.fullName } : {}),
  titles: offerTitles(group.variants), offers: group.variants.length, ...(group.coverImageUrl ? { cover: group.coverImageUrl } : {}) });

/**
 * Cards not checked yet, at most `limit` model checks per pass, first-time ones first; then «failed» ones after a day,
 * and «new» ones the model should look at again: written by an older `DUPLICATE_CHECK_VERSION`, or whose shop names,
 * cover or presence in shops changed since (`cardInputs`). The first check of a card also asks again the cards of its
 * brand it has a hint with (same photo, flavour in a mix) — the twin may be caught from that side; only a first check
 * does it, so two cards never keep sending each other back. Cards the team merged or hid are skipped; a card with an
 * unread flavour goes to the queue as `unknown` without the model.
 */
export async function runCardChecks(client: Chat, limit = 20, pause = 1500): Promise<{ checked: number; merged: number; failed: number }> {
  const [groups, edits, done] = await Promise.all([readAllCatalogGroups(), cardEdits(), getPool().query<{ brand: string; flavor: string; verdict: string; stale: boolean; version: number; inputs: string | null }>(
    `select brand, flavor, verdict, "checkedAt" < now() - interval '1 day' as stale, version, inputs from "catalogCardCheck"`)]);
  const edited = new Map(edits.map(edit => [cardKey(edit.brand, edit.flavor), edit]));
  const checked = new Map(done.rows.map(row => [cardKey(row.brand, row.flavor), row]));
  const due = groups.filter(group => {
    const key = cardKey(group.brand, group.flavor);
    const edit = edited.get(key), previous = checked.get(key);
    if (edit?.mergedInto || edit?.hidden || isExcludedEnergyBrand(group.brand) || isAssortmentFlavor(group.flavor) || !group.brand.trim() || group.brand.toLowerCase() === 'unknown') return false;
    if (!previous) return true;
    if (previous.verdict === 'failed') return previous.stale || previous.version < DUPLICATE_CHECK_VERSION;
    return previous.verdict === 'new' && !UNKNOWN.test(group.flavor)
      && (previous.version < DUPLICATE_CHECK_VERSION || (DUPLICATE_HINTS && previous.inputs !== null && previous.inputs !== cardInputs(toCheck(group))));
  }).sort((a, b) => Number(checked.has(cardKey(a.brand, a.flavor))) - Number(checked.has(cardKey(b.brand, b.flavor))));
  for (const group of due.filter(group => UNKNOWN.test(group.flavor) && group.variants.length)) {
    await save(group, 'unknown', null, 'Парсер не распознал вкус. Здесь может быть несколько разных товаров — проверьте названия из магазинов.', offerTitles(group.variants, 5).join(' · ') || null);
  }
  const queue = due.filter(group => !UNKNOWN.test(group.flavor)).slice(0, limit);
  if (!queue.length) return { checked: 0, merged: 0, failed: 0 };
  let candidates: DuplicateCandidate[] = await catalogCandidates();
  const gone = new Set<string>();
  let count = 0, merged = 0, failed = 0;
  for (const group of queue) {
    if (gone.has(cardKey(group.brand, group.flavor))) continue;
    try {
      const item = toCheck(group);
      const first = !checked.has(cardKey(group.brand, group.flavor));
      const result = await judgeDrink(client, item, candidates, { votes: CONFIDENT_VOTES });
      count++;
      // Another look from the other side of each hinted pair: their «new» is marked as written by no version, so they
      // come up as due; the row stays, so their own re-check is not a first one and sends nothing back.
      const mates = result.hinted.filter(mate => mate.kind !== 'member');
      if (first && mates.length) await getPool().query(`update "catalogCardCheck" c set version = 0 from unnest($1::text[], $2::text[]) m(brand, flavor)
        where c.brand = m.brand and c.flavor = m.flavor and c.verdict = 'new'`, [mates.map(mate => mate.brand), mates.map(mate => mate.flavor)]);
      if (result.confident && result.match && result.match.kind !== 'member') {
        // The card in shops stays: an archived twin joins it rather than the other way round.
        const [from, into] = group.variants.length && result.match.kind === 'archive' ? [result.match, group] : [group, result.match];
        await mergeCatalogCardAutomatically(from, into);
        await save(group, 'merged', result.match, `Склеено автоматически: «${drinkLabel(from)}» → «${drinkLabel(into)}». ${result.reason}`.trim());
        gone.add(cardKey(from.brand, from.flavor));
        candidates = candidates.filter(candidate => !(candidate.brand === from.brand && candidate.flavor === from.flavor));
        merged++;
      } else {
        await save(group, result.verdict, result.match, result.reason, null, cardInputs(item));
        if (result.verdict === 'failed') failed++;
      }
    } catch (error) { failed++; if (isQuotaError(error)) break; }
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
  }
  return { checked: count, merged, failed };
}

/** The checks of the cards the admin list shows, by card. */
export async function getCardChecks(): Promise<Map<string, CardCheck>> {
  const { rows } = await getPool().query<{ brand: string; flavor: string; verdict: CardCheckVerdict; matchBrand: string | null; matchFlavor: string | null; matchLabel: string | null; reason: string; title: string | null; checkedAt: Date; dismissed: boolean }>(
    `select brand, flavor, verdict, "matchBrand", "matchFlavor", "matchLabel", reason, title, "checkedAt", "dismissedAt" is not null as dismissed from "catalogCardCheck"`);
  return new Map(rows.map(row => [cardKey(row.brand, row.flavor), {
    brand: row.brand, flavor: row.flavor, verdict: row.verdict, reason: row.reason, title: row.title, checkedAt: row.checkedAt, dismissed: row.dismissed,
    match: row.matchBrand && row.matchFlavor ? { brand: row.matchBrand, flavor: row.matchFlavor, label: row.matchLabel ?? `${row.matchBrand} · ${row.matchFlavor}`, href: `/catalog/${catalogGroupSlug(row.matchBrand, row.matchFlavor)}` } : null,
  }]));
}

/** What waits for a moderator: likely duplicates and unread flavours, not cleared, of cards still in the catalog. */
export const CARD_QUEUE = `c.verdict in ('duplicate', 'unsure', 'unknown') and c."dismissedAt" is null
  and not exists(select 1 from "catalogCardEdit" e where e.brand = c.brand and e.flavor = c.flavor and (e."mergedIntoBrand" is not null or e.hidden))`;
export async function countCardQueue(): Promise<number> {
  return (await getPool().query<{ n: number }>(`select count(*)::int as n from "catalogCardCheck" c where ${CARD_QUEUE}`)).rows[0]?.n ?? 0;
}

/** «Не дубль» / «Вкус верный»: the team clears a card from the queue. */
export async function dismissCardCheck(staffId: string, staffEmail: string, card: { brand: string; flavor: string }): Promise<void> {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const updated = await db.query(`update "catalogCardCheck" set "dismissedAt" = now(), "dismissedBy" = $4 where brand = $2 and flavor = $3
      and exists(select 1 from "user" u join "siteAdmin" a on lower(u.email) = a.email where u.id = $1)`, [staffId, card.brand, card.flavor, staffEmail]);
    if (updated.rowCount) await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [staffEmail, 'catalog-card-check-dismiss', 'catalog-card', `${card.brand} · ${card.flavor}`]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

export interface AdminCatalogCard {
  brand: string; flavor: string; name: string; fullName: string | null; cover: string | null; offers: number;
  hidden: boolean; mergedInto: { brand: string; flavor: string; label: string } | null; ownPhoto: boolean;
  /** Merged by the neural network on its own, not by the team. */
  byNetwork: boolean;
  check: CardCheck | null;
}
export type CardView = 'all' | 'queue' | 'auto';

/**
 * The parser's cards for «Карточки каталога» in /admin/drinks, as the files have them (merged and hidden ones too, so
 * the team sees what it did), with the edits and the network's check marked; by brand and flavour, filtered by brand,
 * flavour, name or key. `queue` — what waits for a moderator (unread flavours included), `auto` — the network's merges.
 */
export async function listCatalogCards(query: string, page: number, size: number, view: CardView = 'all'): Promise<{ items: AdminCatalogCard[]; total: number }> {
  const [edits, checks] = await Promise.all([cardEdits(), getCardChecks()]);
  const byKey = new Map(edits.map(item => [cardKey(item.brand, item.flavor), item]));
  const typed = query.trim().toLowerCase().replace(/ё/gu, 'е');
  const cards = (await readAllCatalogGroups()).filter(group => (view === 'queue' || isResolvedFlavor(group.flavor)) && group.brand.trim() && group.brand.toLowerCase() !== 'unknown')
    .map((group): AdminCatalogCard => {
      const item = byKey.get(cardKey(group.brand, group.flavor));
      const target = item?.mergedInto ? mergeTarget(byKey, group.brand, group.flavor) : null;
      return {
        brand: group.brand, flavor: group.flavor, name: flavorName(group.flavor), fullName: item?.fullName ?? null, offers: group.variants.length,
        cover: item?.photoVersion != null ? cardPhotoUrl(item.id, item.photoVersion) : group.coverImageUrl ?? null, ownPhoto: item?.photoVersion != null,
        hidden: item?.hidden ?? false, mergedInto: target ? { ...target, label: `${target.brand} · ${flavorName(target.flavor)}` } : null,
        byNetwork: !!item?.mergedInto && item.updatedBy === NETWORK_ACTOR, check: checks.get(cardKey(group.brand, group.flavor)) ?? null,
      };
    })
    .filter(card => view === 'all' || (view === 'auto' ? card.byNetwork
      : !!card.check && ['duplicate', 'unsure', 'unknown'].includes(card.check.verdict) && !card.check.dismissed && !card.hidden && !card.mergedInto))
    .filter(card => !typed || `${card.brand} ${card.name} ${card.flavor} ${card.fullName ?? ''}`.toLowerCase().replace(/ё/gu, 'е').includes(typed))
    .sort((a, b) => a.brand.localeCompare(b.brand, 'ru') || a.name.localeCompare(b.name, 'ru'));
  return { items: cards.slice((page - 1) * size, page * size), total: cards.length };
}
