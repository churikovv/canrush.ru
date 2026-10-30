'use server';
import { revalidatePath } from 'next/cache';
import { requireFullAdmin } from '@/lib/admin';
import { parseGiveaway } from '@/lib/spin-giveaway-fields';
import { createGiveaway, stopGiveaway } from '@/lib/spin-giveaways';

export interface GiveawayFormState { error?: string; success?: string }

const refresh = () => { revalidatePath('/admin/giveaways'); revalidatePath('/'); revalidatePath('/feed'); };

export async function createGiveawayAction(_state: GiveawayFormState, form: FormData): Promise<GiveawayFormState> {
  const admin = await requireFullAdmin();
  try {
    await createGiveaway(parseGiveaway(Object.fromEntries(form)), admin.email);
    refresh();
    return { success: 'Раздача создана. Баннер появится в ленте в указанное время.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось создать раздачу. Попробуйте снова.' };
  }
}

export async function stopGiveawayAction(form: FormData): Promise<void> {
  const admin = await requireFullAdmin();
  await stopGiveaway(String(form.get('id')), admin.email).catch(() => undefined);
  refresh();
}
