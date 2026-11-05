'use server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { claimDaily, wearDailyItem, type DailyClaimResult } from '@/lib/daily-rewards';

/**
 * «Забрать» in the «Лунный цикл» window. No `revalidatePath`: it would redraw the home page under the open window and
 * its reveal; the window keeps its own state and the page refreshes when it closes.
 */
export async function claimDailyAction(): Promise<DailyClaimResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: 'Войдите, чтобы забирать ежедневные награды.' };
  try { return await claimDaily(session.user.id); } catch (error) {
    console.error('daily claim failed', error);
    return { ok: false, error: 'Не удалось забрать награду. Проверьте интернет и попробуйте ещё раз.' };
  }
}

/** «Надеть» on the reveal of a tag, background or frame from the path when its place was taken. */
export async function wearDailyAction(key: unknown): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы надеть награду.' };
  if (typeof key !== 'string' || key.length > 40) return { error: 'Такой награды нет.' };
  try { return await wearDailyItem(session.user.id, key) ? {} : { error: 'Сначала заберите эту награду.' }; } catch (error) {
    console.error('daily wear failed', error);
    return { error: 'Не удалось надеть. Попробуйте ещё раз или выберите в настройках профиля.' };
  }
}
