'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { blockMember, unblockMember } from '@/lib/member-blocks';

/** Blocks or unblocks a member for the signed-in viewer; the viewer comes from the session. */
export async function setMemberBlockAction(userId: string, blocked: boolean): Promise<{ blocked?: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт.' };
  if (typeof userId !== 'string' || userId === session.user.id) return { error: 'Нельзя заблокировать себя.' };
  try {
    if (blocked) {
      if (!(await blockMember(session.user.id, userId))) return { error: 'Участник не найден.' };
    } else {
      await unblockMember(session.user.id, userId);
    }
    // Blocked members' content disappears from lists the viewer opens next.
    revalidatePath('/', 'layout');
    return { blocked };
  } catch {
    return { error: 'Не удалось сохранить. Попробуйте ещё раз.' };
  }
}
