'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireSiteAdmin } from '@/lib/admin';
import { isUserBlocked } from '@/lib/moderation';
import {
  SupportError, getOwnSupportThread, getSupportThread, readOwnSupport, readSupportAsStaff, replySupport, sendSupportMessage,
  setSupportStatus, supportMessages, type SupportMessage, type SupportThread,
} from '@/lib/support';

export type SupportLoad = { thread: SupportThread | null; items: SupportMessage[]; hasMore: boolean } | { error: string };

const message = (error: unknown, fallback: string) => error instanceof SupportError ? error.message : fallback;
async function member() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new SupportError('Войдите в аккаунт и повторите.');
  return session.user;
}

/** The chat's polling: the member's own thread, or (`threadId`) a thread the team opened. */
export async function loadSupportAction(threadId?: string, before?: string): Promise<SupportLoad> {
  try {
    if (threadId) {
      await requireSiteAdmin();
      const thread = await getSupportThread(threadId);
      if (!thread) return { error: 'Обращение не найдено.' };
      return { thread, ...await supportMessages(thread.id, before) };
    }
    const thread = await getOwnSupportThread((await member()).id);
    return thread ? { thread, ...await supportMessages(thread.id, before) } : { thread: null, items: [], hasMore: false };
  } catch (error) { return { error: message(error, 'Не удалось загрузить переписку.') }; }
}

export async function sendSupportAction(text: string): Promise<{ error?: string }> {
  try {
    const user = await member();
    if (await isUserBlocked(user.id)) return { error: 'Сообщения для этого аккаунта ограничены. Напишите на hello@canrush.ru.' };
    await sendSupportMessage(user.id, text);
  } catch (error) { return { error: message(error, 'Сообщение не отправлено. Текст остался в поле.') }; }
  revalidatePath('/admin/support');
  return {};
}

/** The member saw the thread: replies read, their notifications too. */
export async function readSupportAction(): Promise<void> {
  try { await readOwnSupport((await member()).id); } catch { /* reading marks never fail the chat */ }
}

export async function replySupportAction(threadId: string, text: string): Promise<{ error?: string }> {
  try {
    const admin = await requireSiteAdmin();
    await replySupport(admin.userId, threadId, text);
  } catch (error) { return { error: message(error, 'Ответ не отправлен. Текст остался в поле.') }; }
  revalidatePath('/admin/support');
  return {};
}

export async function readSupportStaffAction(threadId: string): Promise<void> {
  try { const admin = await requireSiteAdmin(); await readSupportAsStaff(admin.userId, threadId); } catch { /* best effort */ }
}

export async function setSupportStatusAction(threadId: string, status: 'open' | 'closed'): Promise<{ error?: string }> {
  try {
    const admin = await requireSiteAdmin();
    if (status !== 'open' && status !== 'closed') return { error: 'Неизвестное действие.' };
    await setSupportStatus(admin.userId, threadId, status);
  } catch (error) { return { error: message(error, 'Не удалось изменить статус.') }; }
  revalidatePath('/admin/support');
  return {};
}
