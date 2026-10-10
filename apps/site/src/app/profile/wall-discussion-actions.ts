'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
import { addWallComment, deleteWallComment, getWallComments, getWallInteractions, WallDiscussionError, wallPostId, setWallReaction } from '@/lib/wall-discussions';

export async function wallDiscussionAction(id: string, action: 'read' | 'vote' | 'comment' | 'delete', value?: string | number) {
  try {
    wallPostId(id);
    const session = await auth.api.getSession({ headers: await headers() });
    const viewer = session?.user.id ?? null;
    if (!['read','vote','comment','delete'].includes(action)) throw new WallDiscussionError('Неизвестное действие.');
    if (!(await getWallInteractions([id], viewer)).has(id)) return { error: 'Запись недоступна.' };
    if (action !== 'read') {
      if (!viewer) return { error: 'Войдите, чтобы участвовать в обсуждении.', signIn: true };
      if (await isUserBlocked(viewer)) return { error: 'Ваш аккаунт заблокирован для публикаций.' };
      if (action === 'vote') {
        if (typeof value !== 'number') throw new WallDiscussionError('Некорректная реакция.');
        await setWallReaction(viewer, id, value);
      } else if (action === 'comment') {
        if (typeof value !== 'string') throw new WallDiscussionError('Напишите комментарий.');
        await addWallComment(viewer, id, value);
      } else {
        if (typeof value !== 'string') throw new WallDiscussionError('Комментарий не найден.');
        await deleteWallComment(viewer, id, value);
      }
      revalidatePath('/profile', 'layout'); revalidatePath('/admin');
    }
    const interaction = (await getWallInteractions([id], viewer)).get(id);
    if (!interaction) return { error: 'Запись недоступна.' };
    const thread = action === 'vote' ? undefined : await getWallComments(id, viewer, action === 'read' && typeof value === 'string' ? value : undefined);
    return { interaction, thread };
  } catch(error) {
    return { error: error instanceof WallDiscussionError ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.' };
  }
}
