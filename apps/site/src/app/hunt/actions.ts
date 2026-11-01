'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { claimHunt, createHuntOrder, getHunt, type HuntView } from '@/lib/hunt';
import { HuntError, type HuntOrderInput } from '@/lib/hunt-fields';

export type HuntState = { error: string } | { hunt: HuntView; amount?: number };

async function act(run: (userId: string) => Promise<{ amount?: number } | void>): Promise<HuntState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы участвовать.' };
  try {
    const result = await run(session.user.id);
    revalidatePath('/hunt');
    return { hunt: await getHunt(session.user.id), ...result };
  } catch (error) {
    if (error instanceof HuntError) return { error: error.message };
    console.error('price tag hunt failed', error);
    return { error: 'Не получилось. Попробуйте ещё раз.' };
  }
}

/** «Забрать»: что начислено, считает сервер. */
export async function claimHuntAction(): Promise<HuntState> {
  return act(userId => claimHunt(userId));
}

export async function orderHuntAction(input: HuntOrderInput): Promise<HuntState> {
  return act(userId => createHuntOrder(userId, input));
}
