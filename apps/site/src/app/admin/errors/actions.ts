'use server';
import { revalidatePath } from 'next/cache';
import { requireFullAdmin } from '@/lib/admin';
import { setErrorHidden } from '@/lib/error-log';
import { isErrorGroupHash } from '@/lib/error-log-fields';

/** «Скрыть» and «Вернуть»: a hidden group keeps counting but sends no alerts. Written to the audit log. */
export async function setErrorHiddenAction(form: FormData): Promise<void> {
  const admin = await requireFullAdmin();
  const hash = form.get('hash');
  if (!isErrorGroupHash(hash)) return;
  await setErrorHidden(admin.email, hash, form.get('hidden') === '1');
  revalidatePath('/admin/errors');
}
