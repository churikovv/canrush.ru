'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
import { createContentReport, createProfileReport, findContentAuthor } from '@/lib/profile-reports';
import type { ReportState } from '@/lib/profile-report-fields';

export async function reportProfileAction(_previous: ReportState, form: FormData): Promise<ReportState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт, чтобы отправить жалобу.' };
  try {
    if (await isUserBlocked(session.user.id)) return { error: 'Отправка жалоб недоступна для заблокированного аккаунта.' };
    const result = await createProfileReport(session.user.id, String(form.get('targetId') ?? ''), String(form.get('reason') ?? ''), String(form.get('comment') ?? ''));
    if (result === 'invalid') return { error: 'Выберите причину. Комментарий — не более 1000 символов. На свой профиль пожаловаться нельзя.' };
    if (result === 'limited') return { error: 'Достигнут лимит жалоб за сутки. Попробуйте позже.' };
    if (result === 'duplicate') return { success: 'Ваша жалоба на этот профиль уже ожидает рассмотрения.' };
    revalidatePath('/admin');
    return { success: 'Жалоба отправлена администраторам.' };
  } catch { return { error: 'Не удалось отправить жалобу. Попробуйте ещё раз.' }; }
}

export async function reportContentAction(_previous: ReportState, form: FormData): Promise<ReportState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт, чтобы отправить жалобу.' };
  try {
    if (await isUserBlocked(session.user.id)) return { error: 'Отправка жалоб недоступна для заблокированного аккаунта.' };
    const result = await createContentReport(session.user.id, String(form.get('kind') ?? ''), String(form.get('contentId') ?? ''),
      String(form.get('reason') ?? ''), String(form.get('comment') ?? ''), String(form.get('pagePath') ?? ''));
    if (result === 'invalid') return { error: 'Выберите причину. Комментарий — не более 1000 символов. На свой контент пожаловаться нельзя.' };
    if (result === 'limited') return { error: 'Достигнут лимит жалоб за сутки. Попробуйте позже.' };
    const author = await findContentAuthor(session.user.id, String(form.get('kind') ?? ''), String(form.get('contentId') ?? '')) ?? undefined;
    if (result === 'duplicate') return { success: 'Ваша жалоба уже ожидает рассмотрения.', author };
    revalidatePath('/admin');
    return { success: 'Жалоба отправлена администраторам.', author };
  } catch { return { error: 'Не удалось отправить жалобу. Попробуйте ещё раз.' }; }
}
