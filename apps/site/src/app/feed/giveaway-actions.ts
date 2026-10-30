'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { GiveawayError, claimGiveaway, markGiveawaySeen } from '@/lib/spin-giveaways';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const member = async () => (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;

/** The banner came into view: starts the server's clock and says how long ago it first did, null when it is over. */
export async function seenGiveawayAction(id: string): Promise<number | null> {
  const userId = await member();
  if (!userId || typeof id !== 'string' || !UUID.test(id)) return null;
  return markGiveawaySeen(id, userId);
}

export type ClaimState = { spins: number } | { error: string; over?: boolean };

/** Takes the banner's spins. The server checks the view and the limit, the page only shows the answer. */
export async function claimGiveawayAction(id: string): Promise<ClaimState> {
  const userId = await member();
  if (!userId) return { error: 'Войдите, чтобы забрать крутки.' };
  if (typeof id !== 'string' || !UUID.test(id)) return { error: 'Такой раздачи нет.', over: true };
  try {
    const { spins } = await claimGiveaway(id, userId);
    revalidatePath('/gacha');
    return { spins };
  } catch (error) {
    if (error instanceof GiveawayError) return { error: error.message, over: error.message === 'Раздача закончилась.' };
    console.error('giveaway claim failed', error);
    return { error: 'Не получилось забрать. Попробуйте ещё раз.' };
  }
}
