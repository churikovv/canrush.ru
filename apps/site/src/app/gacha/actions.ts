'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { GachaError, craftCard, pullGacha, type PullResult } from '@/lib/gacha';

export type PullActionState = { error: string; signIn?: boolean } | PullResult;

/** Крутка ×1 или ×10: всё решает сервер, клиент только показывает выпавшие банки. */
export async function pullAction(times: number): Promise<PullActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы крутить Банкомат.', signIn: true };
  if (times !== 1 && times !== 10) return { error: 'Некорректная крутка.' };
  try {
    return await pullGacha(session.user.id, times);
  } catch (error) {
    if (error instanceof GachaError) return { error: error.message };
    console.error('gacha pull failed', error);
    return { error: 'Автомат заело. Попробуйте ещё раз.' };
  }
}

export type CraftActionState = { error: string } | { shards: number; href: string };

/** Собрать недостающую карточку из осколков (альбом). */
export async function craftAction(brand: string, flavor: string): Promise<CraftActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы собирать карточки.' };
  if (typeof brand !== 'string' || typeof flavor !== 'string') return { error: 'Некорректная карточка.' };
  try {
    const result = await craftCard(session.user.id, brand, flavor);
    revalidatePath('/profile/[username]/cards', 'page');
    return { shards: result.shards, href: result.card.href };
  } catch (error) {
    if (error instanceof GachaError) return { error: error.message };
    console.error('gacha craft failed', error);
    return { error: 'Не удалось собрать карточку. Попробуйте ещё раз.' };
  }
}
