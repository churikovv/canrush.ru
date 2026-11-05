import { getPool } from '@/db/pool';
import { tasteNeighbourhood } from '@/lib/story-digest';
import { opinions, similarity } from '@/lib/story-recommendations';
import { flavorFamilies, tasteCard, type TasteCard, type TasteSignal } from '@/lib/taste-card-fields';
import { drinkCatalog } from '@/lib/wall-drinks';

/** Above this similarity a member is offered as someone with a similar taste (as for «Тебе понравится»). */
const MIN_SIMILARITY = 0.15;
/** Both rated it at least this well: a drink they share a liking for. */
const LIKES = 0.3;

export interface TasteMatch {
  id: string; username: string; name: string; avatarId: string | null;
  /** Drinks both like, and up to three of them to show. */
  shared: number; drinks: { label: string; cover?: string }[];
}

/** Карточка и её любимые банки: до трёх понравившихся напитков с обложкой, сначала из любимых вкусов, потом свежие. */
export type TasteCardView = TasteCard & { drinks: { label: string; cover: string }[] };
const CARD_DRINKS = 3;

/** «Твой вкус» участника по его свайпам, избранному и оценкам вкуса (`taste-card-fields.ts`). */
export async function getTasteCard(userId: string): Promise<TasteCardView | null> {
  const { rows } = await getPool().query<TasteSignal & { at: Date }>(`
    select brand, flavor, liked, 'swipe' as source, "createdAt" as at from "drinkSwipe" where "userId" = $1
    union all select brand, flavor, true, 'favorite', "createdAt" from favorite where "userId" = $1
    union all select brand, flavor, taste >= 7, 'review', "createdAt" from review where "userId" = $1 and (taste >= 7 or taste <= 4)
    order by at desc`, [userId]);
  const card = tasteCard(rows);
  if (!card) return null;
  const loved = new Set(card.loves.map(item => item.key));
  const catalog = await drinkCatalog();
  const seen = new Set<string>();
  const drinks = rows.filter(row => row.liked)
    .map((row, order) => ({ row, order, fits: flavorFamilies(row.brand, row.flavor).some(key => loved.has(key)) }))
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.order - b.order)
    .flatMap(({ row }) => {
      const option = catalog.get(JSON.stringify([row.brand, row.flavor]));
      if (!option?.cover || seen.has(option.label)) return [];
      seen.add(option.label);
      return [{ label: option.label, cover: option.cover }];
    }).slice(0, CARD_DRINKS);
  return { ...card, drinks };
}

/**
 * Один участник с похожим вкусом, на которого зритель ещё не подписан: ник есть, не заблокирован сайтом и не в
 * блокировке друг у друга. Сходство — то же, что у «Тебе понравится», по участникам с общими напитками.
 */
/** Members with a taste like the viewer's, closest first, with the drinks both like (no account checks here). */
export async function rankTasteMatches(userId: string): Promise<{ id: string; weight: number; shared: { brand: string; flavor: string }[] }[]> {
  const { viewer, members } = await tasteNeighbourhood(userId);
  const mine = opinions(viewer);
  return members.map(member => {
    const theirs = opinions(member);
    const shared = [...mine].filter(([key, item]) => item.score > LIKES && (theirs.get(key)?.score ?? 0) > LIKES).map(([, item]) => item.item);
    return { id: member.userId!, weight: similarity(mine, theirs), shared };
  }).filter(item => item.id && item.weight > MIN_SIMILARITY && item.shared.length > 0).sort((a, b) => b.weight - a.weight || b.shared.length - a.shared.length);
}

export async function getTasteMatch(userId: string): Promise<TasteMatch | null> {
  const ranked = await rankTasteMatches(userId);
  if (!ranked.length) return null;
  const { rows } = await getPool().query<{ id: string; username: string; name: string; avatarId: string | null }>(`
    select u.id, u.username, u.name, (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar') as "avatarId"
    from "user" u where u.id = any($2::text[]) and u.id <> $1 and u.username is not null
      and not exists(select 1 from "userBlock" b where b."userId" = u.id)
      and not exists(select 1 from "memberBlock" m where (m."blockerId" = $1 and m."blockedId" = u.id) or (m."blockerId" = u.id and m."blockedId" = $1))
      and not exists(select 1 from "userFollow" f where f."userId" = $1 and f."targetId" = u.id)`, [userId, ranked.map(item => item.id)]);
  const allowed = new Map(rows.map(row => [row.id, row]));
  const best = ranked.find(item => allowed.has(item.id));
  if (!best) return null;
  const catalog = await drinkCatalog();
  const drinks = best.shared.flatMap(item => { const option = catalog.get(JSON.stringify([item.brand, item.flavor])); return option ? [{ label: option.label, ...(option.cover ? { cover: option.cover } : {}) }] : []; }).slice(0, 3);
  return { ...allowed.get(best.id)!, shared: best.shared.length, drinks };
}
