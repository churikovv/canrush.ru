'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { staffDeleteContent, staffDeleteKind } from '@/lib/staff-moderation';

/** «Удалить» for admins and moderators in the «⋯» menu of someone else's review, comment, post, tier list or story. */
export async function staffDeleteAction(kind: string, id: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const target = staffDeleteKind(kind);
  if (!session || !target) return { error: 'Удалять чужой контент могут только администраторы и модераторы.' };
  try {
    if (!await staffDeleteContent(session.user.id, target, id)) return { error: 'Уже удалено или у вас нет прав модератора.' };
  } catch { return { error: 'Не удалось удалить. Попробуйте ещё раз.' }; }
  revalidatePath('/', 'layout');
  return {};
}
