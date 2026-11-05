'use server';

import { headers } from 'next/headers';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { getCatalogGroup, loadAllCatalogGroups } from '@/lib/catalog';
import { readCityCatalog } from '@/lib/catalog-files';
import { SwipeError, recordSwipe, undoSwipe } from '@/lib/drink-swipes';
import { selectedCity } from '@/lib/location';
import { isMemberBlockedError, MEMBER_BLOCKED_MESSAGE } from '@/lib/member-blocks';
import { isUserBlocked } from '@/lib/moderation';
import { syncFavoritePrices } from '@/lib/notifications';
import { getPeopleSuggestions, skipPerson, unskipPerson, type PersonSuggestion } from '@/lib/people-suggestions';
import { CommunityError, getProfileCommunity, setFollowing } from '@/lib/profile-community';
import { getTasteCard, getTasteMatch, type TasteCardView, type TasteMatch } from '@/lib/taste-card';

export interface SwipeActionState { error?: string; signIn?: boolean; xp?: number; tag?: { key: string; label: string } | null }

/** Dating: right = «нравится», left = «пропустить». */
export async function swipeAction(brand: string, flavor: string, liked: boolean): Promise<SwipeActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы свайпать напитки.', signIn: true };
  if (typeof brand !== 'string' || typeof flavor !== 'string' || typeof liked !== 'boolean') return { error: 'Некорректный напиток.' };
  try {
    return await recordSwipe(session.user.id, await loadAllCatalogGroups(), brand, flavor, liked);
  } catch (error) { return { error: error instanceof SwipeError ? error.message : 'Не удалось сохранить. Попробуйте ещё раз.' }; }
}

export async function undoSwipeAction(brand: string, flavor: string): Promise<SwipeActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || typeof brand !== 'string' || typeof flavor !== 'string') return { error: 'Войдите в аккаунт и повторите действие.' };
  await undoSwipe(session.user.id, brand, flavor);
  return {};
}

export type TasteCardState = { card: TasteCardView | null; match: TasteMatch | null } | { error: string };

/** «Твой вкус» в конце колоды: карточка по решениям участника и один человек с похожим вкусом. */
export async function tasteCardAction(): Promise<TasteCardState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы увидеть свой вкус.' };
  try {
    const card = await getTasteCard(session.user.id);
    return { card, match: card ? await getTasteMatch(session.user.id).catch(() => null) : null };
  } catch (error) {
    console.error('taste card failed', error);
    return { error: 'Не удалось собрать вкус. Попробуйте ещё раз.' };
  }
}

/**
 * «В избранное» right after a swipe: sets the favourite (not a toggle — a double tap must not take it back), grants
 * the achievements that count favourites and remembers the price for the price alerts, as the drink page does.
 */
export async function favoriteSwipedAction(brand: unknown, flavor: unknown, on: unknown): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы сохранять напитки.' };
  if (typeof brand !== 'string' || typeof flavor !== 'string' || typeof on !== 'boolean' || brand.length > 120 || flavor.length > 80) return { error: 'Некорректный напиток.' };
  if (!(await getCatalogGroup(brand, flavor))) return { error: 'Такого напитка нет в каталоге.' };
  const userId = session.user.id;
  if (on) await getPool().query('insert into favorite ("userId", brand, flavor) values ($1, $2, $3) on conflict do nothing', [userId, brand, flavor]);
  else await getPool().query('delete from favorite where "userId" = $1 and brand = $2 and flavor = $3', [userId, brand, flavor]);
  await getProfileCommunity(userId).catch(() => null);
  if (on) { try { const city = await selectedCity(); await syncFavoritePrices(userId, city, await readCityCatalog(city.id)); } catch { /* Retried when notifications are polled. */ } }
  // No revalidatePath: it would refresh the dating page under the deck. The drink page and favourites are dynamic anyway.
  return {};
}

export type PeopleCardState = { people: PersonSuggestion[] } | { error: string };

/** The next person card for the deck; `shown` are the people already offered in this visit. */
export async function peopleCardAction(shown: unknown): Promise<PeopleCardState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы видеть людей с похожим вкусом.' };
  const exclude = Array.isArray(shown) ? shown.filter((id): id is string => typeof id === 'string' && id.length <= 200).slice(0, 50) : [];
  try { return { people: await getPeopleSuggestions(session.user.id, 1, exclude) }; } catch (error) {
    console.error('people suggestions failed', error);
    return { people: [] };
  }
}

const DECISIONS = ['follow', 'skip', 'unfollow', 'unskip'] as const;
type PersonDecision = (typeof DECISIONS)[number];

/** Right on a person card follows, left skips; «вернуть» takes either back. */
export async function personDecisionAction(targetId: unknown, decision: unknown): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы подписываться.' };
  if (typeof targetId !== 'string' || !targetId || targetId.length > 200 || !DECISIONS.includes(decision as PersonDecision)) return { error: 'Такого участника нет.' };
  const userId = session.user.id;
  try {
    if (decision === 'follow') {
      if (await isUserBlocked(userId)) return { error: 'Публикации и подписки для этого аккаунта ограничены.' };
      await setFollowing(userId, targetId, true);
    } else if (decision === 'unfollow') await setFollowing(userId, targetId, false);
    else if (decision === 'skip') await skipPerson(userId, targetId);
    else await unskipPerson(userId, targetId);
    return {};
  } catch (error) {
    if (isMemberBlockedError(error)) return { error: MEMBER_BLOCKED_MESSAGE };
    if (error instanceof CommunityError) return { error: error.message };
    console.error('person decision failed', error);
    return { error: 'Не удалось сохранить. Попробуйте ещё раз.' };
  }
}
