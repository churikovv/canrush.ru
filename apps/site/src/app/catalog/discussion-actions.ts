'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
import { addReviewComment, deleteReviewComment, editReviewComment, getReviewComments, getReviewInteractions, ReviewDiscussionError, reviewId, setReviewReaction } from '@/lib/review-discussions';

export async function reviewDiscussionAction(id: string, action: 'read' | 'vote' | 'comment' | 'delete' | 'edit', value?: string | number | { commentId: string; text: string } | { text: string; replyToId: string }) {
  try {
    reviewId(id);
    const session = await auth.api.getSession({ headers: await headers() });
    const viewer = session?.user.id ?? null;
    if (!['read','vote','comment','delete','edit'].includes(action)) throw new ReviewDiscussionError('Неизвестное действие.');
    let edited: { id: string; text: string; editedAt: string } | undefined;
    if (action !== 'read') {
      if (!viewer) return { error: 'Войдите, чтобы участвовать в обсуждении.', signIn: true };
      if (await isUserBlocked(viewer)) return { error: 'Ваш аккаунт заблокирован для публикаций.' };
      if (action === 'vote') {
        if (typeof value !== 'number') throw new ReviewDiscussionError('Некорректная реакция.');
        await setReviewReaction(viewer, id, value);
      } else if (action === 'comment') {
        if (typeof value === 'string') await addReviewComment(viewer, id, value);
        else if (value && typeof value === 'object' && 'replyToId' in value && typeof value.text === 'string' && typeof value.replyToId === 'string') await addReviewComment(viewer, id, value.text, value.replyToId);
        else throw new ReviewDiscussionError('Напишите комментарий.');
      } else if (action === 'edit') {
        if (!value || typeof value !== 'object' || !('commentId' in value) || typeof value.commentId !== 'string' || typeof value.text !== 'string') throw new ReviewDiscussionError('Комментарий не найден.');
        edited = await editReviewComment(viewer, id, value.commentId, value.text);
      } else {
        if (typeof value !== 'string') throw new ReviewDiscussionError('Комментарий не найден.');
        await deleteReviewComment(viewer, id, value);
      }
      revalidatePath('/catalog', 'layout'); revalidatePath('/profile', 'layout'); revalidatePath('/admin');
    }
    const interaction = (await getReviewInteractions([id], viewer)).get(id);
    if (!interaction) return { error: 'Отзыв уже удалён.' };
    const thread = action === 'vote' || action === 'edit' ? undefined : await getReviewComments(id, viewer, action === 'read' && typeof value === 'string' ? value : undefined);
    return { interaction, thread, edited };
  } catch(error) {
    return { error: error instanceof ReviewDiscussionError ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.' };
  }
}
