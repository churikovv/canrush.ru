'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFullAdmin } from '@/lib/admin';
import { decideHuntOrder } from '@/lib/hunt';
import { HuntError } from '@/lib/hunt-fields';

/** Решение по заявке. Ошибка возвращается в адрес: страница показывает её плашкой. */
export async function decideHuntOrderAction(form: FormData): Promise<void> {
  const admin = await requireFullAdmin();
  const status = form.get('status') === 'done' ? 'done' : 'cancelled';
  let failure = '';
  try {
    await decideHuntOrder(admin.email, String(form.get('id')), status, String(form.get('note') ?? ''));
  } catch (error) {
    if (!(error instanceof HuntError)) throw error;
    failure = error.message;
  }
  revalidatePath('/admin/hunt');
  revalidatePath('/hunt');
  redirect(failure ? `/admin/hunt?error=${encodeURIComponent(failure)}` : '/admin/hunt');
}
