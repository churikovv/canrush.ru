import type { CatalogGroup } from '@canrush/shared';

/**
 * The team's edits of the parser's catalog cards (`catalogCardEdit`, migration 0140) and how they change a list of
 * catalog groups — without the database, so tests and every catalog load share one rule.
 */
export interface CardEdit {
  id: string; brand: string; flavor: string;
  mergedInto: { brand: string; flavor: string } | null;
  /** The edge `mergedInto` is a rename by the team (migration 0206): the card lives on under the new name. */
  renamed?: boolean;
  hidden: boolean; fullName: string | null;
  /** `updatedAt` of a card with our own photo, for the photo's address; null without one. */
  photoVersion: number | null;
  /** Who made the edit: a moderator's email or «нейросеть» for an automatic merge. */
  updatedBy?: string | null;
  /** Can volumes the card comes in besides those shops sell (a merged request for another can), ml. */
  volumes?: number[];
  /** «Снят с производства» (migration 0202): the drink page says so, brand collections don't require it. */
  discontinued?: boolean;
}

export const MAX_CARD_FULL_NAME = 80;
export const cardKey = (brand: string, flavor: string) => `${brand}\u0000${flavor}`;
/** Our own cover: the version in the path busts the year-long cache when the photo changes. */
export const cardPhotoUrl = (id: string, version: number) => `/api/catalog-card-photos/${id}/${version}`;

/** Where a card ends up: the target of its merge, followed through earlier merges (a chain is cut after ten steps). */
export function mergeTarget(edits: Map<string, CardEdit>, brand: string, flavor: string): { brand: string; flavor: string } {
  let current = { brand, flavor };
  for (let step = 0; step < 10; step++) {
    const next = edits.get(cardKey(current.brand, current.flavor))?.mergedInto;
    if (!next) break;
    current = next;
  }
  return current;
}

/**
 * The name a card has now: its renames followed, merges not (a chain is cut after ten steps). The admin lists a renamed
 * card under it, with what it was called before.
 */
export function renameTarget(edits: Map<string, CardEdit>, brand: string, flavor: string): { brand: string; flavor: string } {
  let current = { brand, flavor };
  for (let step = 0; step < 10; step++) {
    const edit = edits.get(cardKey(current.brand, current.flavor));
    if (!edit?.mergedInto || !edit.renamed) break;
    current = edit.mergedInto;
  }
  return current;
}

const lower = (value: string) => value.toLocaleLowerCase('ru-RU');
/** The same identity, whatever the case: «Burn · Mango» and «burn · mango» are one drink for duplicates. */
export const sameIdentity = (a: { brand: string; flavor: string }, b: { brand: string; flavor: string }) => lower(a.brand) === lower(b.brand) && lower(a.flavor) === lower(b.flavor);

/**
 * What a rename of the card `card` to `next` would clash with, as the catalog stands: a card already showing under that
 * name (a parser card, a renamed one, a member drink), or an old name of another card (it leads there). Renaming back to
 * a name that leads to this very card is not a clash. `shown` — the identities the catalog shows now.
 */
export function renameClash(edits: Map<string, CardEdit>, shown: readonly { brand: string; flavor: string }[], card: { brand: string; flavor: string }, next: { brand: string; flavor: string }): { brand: string; flavor: string } | null {
  if (sameIdentity(card, next)) return null;
  const exact = shown.find(item => sameIdentity(item, next)) ?? next;
  const end = mergeTarget(edits, exact.brand, exact.flavor);
  if (sameIdentity(end, card)) return null;
  if (!sameIdentity(end, exact)) return end;
  return shown.some(item => sameIdentity(item, next)) ? exact : null;
}

const offerKey = (offer: CatalogGroup['variants'][number]) => JSON.stringify([offer.source, offer.retailer, offer.volumeMl, offer.url]);

/**
 * The groups with the edits applied: a merged card's offers join its target (the target keeps its own cover and name,
 * or takes the merged card's when the list lacks it), hidden cards leave, and the full name and our own cover replace
 * the parser's. Groups are matched by exact identity, as the catalog stores them.
 */
export function applyCardEdits(groups: CatalogGroup[], list: CardEdit[]): CatalogGroup[] {
  if (!list.length) return groups;
  const edits = new Map(list.map(edit => [cardKey(edit.brand, edit.flavor), edit]));
  const merged = new Map<string, { group: CatalogGroup; own: boolean }>();
  for (const group of groups) {
    const target = mergeTarget(edits, group.brand, group.flavor);
    const own = target.brand === group.brand && target.flavor === group.flavor;
    const key = cardKey(target.brand, target.flavor);
    const moved = own ? group : { ...group, brand: target.brand, flavor: target.flavor };
    const existing = merged.get(key);
    if (!existing) { merged.set(key, { group: moved, own }); continue; }
    const base = existing.own || !own ? existing.group : moved;
    const variants = [...new Map([...existing.group.variants, ...moved.variants].map(offer => [offerKey(offer), offer])).values()];
    merged.set(key, {
      group: { ...base, variants, minPrice: variants.length ? Math.min(...variants.map(offer => offer.price)) : base.minPrice, coverImageUrl: base.coverImageUrl ?? existing.group.coverImageUrl ?? moved.coverImageUrl },
      own: existing.own || own,
    });
  }
  return [...merged.values()].flatMap(({ group }) => {
    const edit = edits.get(cardKey(group.brand, group.flavor));
    if (!edit) return [group];
    if (edit.hidden) return [];
    return [{
      ...group,
      ...(edit.fullName ? { fullName: edit.fullName } : {}),
      ...(edit.photoVersion !== null ? { coverImageUrl: cardPhotoUrl(edit.id, edit.photoVersion) } : {}),
      ...(edit.volumes?.length ? { volumes: joinVolumes(group.volumes ?? [], edit.volumes) } : {}),
      ...(edit.discontinued ? { discontinued: true } : {}),
    }];
  });
}

/** The full name a moderator typed: spaces collapsed, '' clears it. */
export function parseCardFullName(value: unknown): string {
  const name = String(value ?? '').replace(/\s+/gu, ' ').trim();
  if (name && (name.length < 2 || name.length > MAX_CARD_FULL_NAME)) throw new Error(`Полное название — от 2 до ${MAX_CARD_FULL_NAME} символов.`);
  return name;
}

/** Two lists of can volumes as one, sorted, without repeats. */
export function joinVolumes(a: readonly number[], b: readonly number[]): number[] {
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}

/** The card's volumes that shops do not sell: those a merge added, minus any an offer has (±10 ml, as prices match). */
export function volumesWithoutOffers(group: Pick<CatalogGroup, 'variants' | 'volumes'>): number[] {
  return (group.volumes ?? []).filter(volume => !group.variants.some(offer => offer.volumeMl && Math.abs(offer.volumeMl - volume) <= 10));
}
