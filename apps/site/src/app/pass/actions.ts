'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { SeasonPassError, claimSeasonPass, type SeasonPassView } from '@/lib/season-pass';
import type { PassRewardKind } from '@/lib/season-fields';

export type PassClaimState = { error: string } | { claimed: { kind: PassRewardKind; amount: number }[]; pass: SeasonPassView };

/** «Забрать» в сезонном пропуске: что достигнуто, считает сервер. */
export async function claimSeasonPassAction(): Promise<PassClaimState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы забрать награды.' };
  try {
    const result = await claimSeasonPass(session.user.id);
    revalidatePath('/pass');
    revalidatePath('/leaderboard');
    revalidatePath('/gacha');
    return result;
  } catch (error) {
    if (error instanceof SeasonPassError) return { error: error.message };
    console.error('season pass claim failed', error);
    return { error: 'Не получилось забрать награды. Попробуйте ещё раз.' };
  }
}
