'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { SwipeError, recordSwipe, undoSwipe } from '@/lib/drink-swipes';

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
