'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { addDrink, deleteDrink, restoreStreak } from '@/lib/drink-calendar';
import { DrinkCalendarError, moscowDay, parseDrinkForm } from '@/lib/drink-calendar-fields';
import { profileTagLabel } from '@/lib/profile-achievements';
import { isUserBlocked } from '@/lib/moderation';
import { ensureOwnProfile } from '@/lib/profile';

export interface DrinkActionState { error?: string; success?: { streak: number; xp: number; tags: { key: string; label: string }[] }; at?: number }

export async function addDrinkAction(_state: DrinkActionState, form: FormData): Promise<DrinkActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт и повторите действие.' };
  try {
    if (await isUserBlocked(session.user.id)) return { error: 'Записи для этого аккаунта ограничены.' };
    await ensureOwnProfile(session.user);
    const result = await addDrink(session.user.id, parseDrinkForm(form, moscowDay()));
    revalidatePath('/profile', 'layout');
    revalidatePath('/calendar'); // the tab bar's calendar renders the same screen
    return { success: { ...result, tags: result.tags.map(key => ({ key, label: profileTagLabel(key) ?? key })) }, at: Date.now() };
  } catch (error) {
    return { error: error instanceof DrinkCalendarError ? error.message : 'Не удалось сохранить запись. Попробуйте ещё раз.', at: Date.now() };
  }
}

export async function deleteDrinkAction(id: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт и повторите действие.' };
  try {
    await deleteDrink(session.user.id, typeof id === 'string' ? id : '');
    revalidatePath('/profile', 'layout');
    revalidatePath('/calendar'); // the tab bar's calendar renders the same screen
    return {};
  } catch (error) {
    return { error: error instanceof DrinkCalendarError ? error.message : 'Не удалось удалить запись.' };
  }
}

/** «Вернуть огонёк»: fills the missed day the calendar offers, once per 15 days. */
export async function restoreStreakAction(): Promise<{ error?: string; length?: number; xp?: number }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт и повторите действие.' };
  try {
    if (await isUserBlocked(session.user.id)) return { error: 'Записи для этого аккаунта ограничены.' };
    const result = await restoreStreak(session.user.id);
    revalidatePath('/profile', 'layout');
    revalidatePath('/calendar');
    revalidatePath('/leaderboard');
    return { length: result.length, xp: result.xp };
  } catch (error) {
    return { error: error instanceof DrinkCalendarError ? error.message : 'Не удалось вернуть огонёк. Попробуйте ещё раз.' };
  }
}
