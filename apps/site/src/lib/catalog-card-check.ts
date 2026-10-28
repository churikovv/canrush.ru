import { isAssortmentFlavor, isExcludedEnergyBrand, isResolvedFlavor } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { cardEdits, mergeCatalogCardAutomatically, NETWORK_ACTOR } from '@/lib/catalog-card-edits';
import { cardKey, cardPhotoUrl, mergeTarget } from '@/lib/catalog-card-edit-fields';
import { readAllCatalogGroups } from '@/lib/catalog-files';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { catalogCandidates, judgeDrink } from '@/lib/drink-duplicate-check';
import { CONFIDENT_VOTES, drinkLabel, type DuplicateCandidate } from '@/lib/drink-duplicate-fields';
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
/** The product name the shop gave, from the offer's search address (Едадил keeps it in `text`). */
const offerTitle = (url: string | undefined) => { try { return url ? new URL(url).searchParams.get('text')?.trim().slice(0, 120) || null : null; } catch { return null; } };
/** The parser folds every unread flavour of a brand into one card, so it may hold several products: up to five names. */
const offerTitles = (urls: string[]) => [...new Set(urls.map(offerTitle).filter((title): title is string => !!title))].slice(0, 5).join(' · ') || null;

async function save(card: { brand: string; flavor: string }, verdict: CardCheckVerdict, match: { brand: string; flavor: string } | null, reason: string, title: string | null = null) {
  await getPool().query(`insert into "catalogCardCheck"(brand, flavor, verdict, "matchBrand", "matchFlavor", "matchLabel", reason, title) values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (brand, flavor) do update set verdict = excluded.verdict, "matchBrand" = excluded."matchBrand", "matchFlavor" = excluded."matchFlavor",
      "matchLabel" = excluded."matchLabel", reason = excluded.reason, title = excluded.title, "checkedAt" = now(), "dismissedAt" = null, "dismissedBy" = null`,
  [card.brand, card.flavor, verdict, match?.brand ?? null, match?.flavor ?? null, match ? drinkLabel(match) : null, reason.slice(0, 300), title]);
}

/**
 * Cards not checked yet (and `failed` ones after a day), at most `limit` model checks per pass. Cards the team merged or
 * hid are skipped; a card with an unread flavour goes to the queue as `unknown` without the model.
 */
export async function runCardChecks(client: Chat, limit = 20, pause = 1500): Promise<{ checked: number; merged: number; failed: number }> {
  const [groups, edits, done] = await Promise.all([readAllCatalogGroups(), cardEdits(), getPool().query<{ brand: string; flavor: string; verdict: string; stale: boolean }>(
    `select brand, flavor, verdict, "checkedAt" < now() - interval '1 day' as stale from "catalogCardCheck"`)]);
  const edited = new Map(edits.map(edit => [cardKey(edit.brand, edit.flavor), edit]));
  const checked = new Map(done.rows.map(row => [cardKey(row.brand, row.flavor), row]));
  const due = groups.filter(group => {
    const key = cardKey(group.brand, group.flavor);
    const edit = edited.get(key), previous = checked.get(key);
    if (edit?.mergedInto || edit?.hidden || isExcludedEnergyBrand(group.brand) || isAssortmentFlavor(group.flavor) || !group.brand.trim() || group.brand.toLowerCase() === 'unknown') return false;
    return !previous || (previous.verdict === 'failed' && previous.stale);
  });
  for (const group of due.filter(group => UNKNOWN.test(group.flavor) && group.variants.length)) {
    await save(group, 'unknown', null, 'Парсер не распознал вкус. Здесь может быть несколько разных товаров — проверьте названия из магазинов.', offerTitles(group.variants.map(offer => offer.url)));
  }
  const queue = due.filter(group => !UNKNOWN.test(group.flavor)).slice(0, limit);
  if (!queue.length) return { checked: 0, merged: 0, failed: 0 };
  let candidates: DuplicateCandidate[] = await catalogCandidates();
  const gone = new Set<string>();
  let count = 0, merged = 0, failed = 0;
  for (const group of queue) {
    if (gone.has(cardKey(group.brand, group.flavor))) continue;
    try {
      const result = await judgeDrink(client, { brand: group.brand, flavor: group.flavor, ...(group.fullName ? { fullName: group.fullName } : {}) }, candidates, { votes: CONFIDENT_VOTES });
      count++;
      if (result.confident && result.match && result.match.kind !== 'member') {
        // The card in shops stays: an archived twin joins it rather than the other way round.
        const [from, into] = group.variants.length && result.match.kind === 'archive' ? [result.match, group] : [group, result.match];
        await mergeCatalogCardAutomatically(from, into);
        await save(group, 'merged', result.match, `Склеено автоматически: «${drinkLabel(from)}» → «${drinkLabel(into)}». ${result.reason}`.trim());
        gone.add(cardKey(from.brand, from.flavor));
        candidates = candidates.filter(candidate => !(candidate.brand === from.brand && candidate.flavor === from.flavor));
        merged++;
      } else {
        await save(group, result.verdict, result.match, result.reason);
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
