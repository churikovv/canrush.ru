'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
import { addWallComment, deleteWallComment, editWallComment, getWallComments, getWallInteractions, WallDiscussionError, wallPostId, setWallCommentLike, setWallReaction } from '@/lib/wall-discussions';

export async function wallDiscussionAction(id: string, action: 'read' | 'vote' | 'comment' | 'delete' | 'edit', value?: string | number | { commentId: string; text: string } | { text: string; replyToId: string }) {
  try {
    wallPostId(id);
    const session = await auth.api.getSession({ headers: await headers() });
    const viewer = session?.user.id ?? null;
    if (!['read','vote','comment','delete','edit'].includes(action)) throw new WallDiscussionError('Неизвестное действие.');
    if (!(await getWallInteractions([id], viewer)).has(id)) return { error: 'Запись недоступна.' };
    let edited: { id: string; text: string; editedAt: string } | undefined;
    if (action !== 'read') {
      if (!viewer) return { error: 'Войдите, чтобы участвовать в обсуждении.', signIn: true };
      if (await isUserBlocked(viewer)) return { error: 'Ваш аккаунт заблокирован для публикаций.' };
      if (action === 'vote') {
        if (typeof value !== 'number') throw new WallDiscussionError('Некорректная реакция.');
        await setWallReaction(viewer, id, value);
      } else if (action === 'comment') {
        if (typeof value === 'string') await addWallComment(viewer, id, value);
        else if (value && typeof value === 'object' && 'replyToId' in value && typeof value.text === 'string' && typeof value.replyToId === 'string') await addWallComment(viewer, id, value.text, value.replyToId);
        else throw new WallDiscussionError('Напишите комментарий.');
      } else if (action === 'edit') {
        if (!value || typeof value !== 'object' || !('commentId' in value) || typeof value.commentId !== 'string' || typeof value.text !== 'string') throw new WallDiscussionError('Комментарий не найден.');
        edited = await editWallComment(viewer, id, value.commentId, value.text);
      } else {
        if (typeof value !== 'string') throw new WallDiscussionError('Комментарий не найден.');
        await deleteWallComment(viewer, id, value);
      }
      revalidatePath('/profile', 'layout'); revalidatePath('/feed'); revalidatePath('/admin');
    }
    const interaction = (await getWallInteractions([id], viewer)).get(id);
    if (!interaction) return { error: 'Запись недоступна.' };
    const thread = action === 'vote' || action === 'edit' ? undefined : await getWallComments(id, viewer, action === 'read' && typeof value === 'string' ? value : undefined);
    return { interaction, thread, edited };
  } catch(error) {
    return { error: error instanceof WallDiscussionError ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.' };
  }
}

export async function wallCommentLikeAction(id: string, commentId: string, liked: boolean): Promise<{ likes?: number; liked?: boolean; error?: string; signIn?: boolean }> {
  try {
    wallPostId(id); wallPostId(commentId);
    if (typeof liked !== 'boolean') throw new WallDiscussionError('Некорректная реакция.');
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: 'Войдите, чтобы ставить лайки.', signIn: true };
    if (await isUserBlocked(session.user.id)) return { error: 'Ваш аккаунт заблокирован для публикаций.' };
    return await setWallCommentLike(session.user.id, id, commentId, liked);
  } catch (error) {
    return { error: error instanceof WallDiscussionError ? error.message : 'Не удалось поставить лайк. Попробуйте ещё раз.' };
  }
}
