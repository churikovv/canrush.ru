'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { AwardError, voteForDrink } from '@/lib/awards';

export interface AwardVoteState { error?: string; done?: boolean }

/** A vote in «Премия за энергию» (or a changed one): a nominee, or any catalog drink the member adds this way. */
export async function voteAwardAction(category: string, brand: string, flavor: string): Promise<AwardVoteState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы проголосовать.' };
  try {
    await voteForDrink(session.user.id, category, brand, flavor);
  } catch (error) {
    if (error instanceof AwardError) return { error: error.message };
    return { error: 'Не удалось сохранить голос. Попробуйте ещё раз.' };
  }
  revalidatePath('/awards');
  return { done: true };
}
