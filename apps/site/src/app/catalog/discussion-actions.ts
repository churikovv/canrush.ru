'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
import { addReviewComment, deleteReviewComment, getReviewComments, getReviewInteractions, ReviewDiscussionError, reviewId, setReviewReaction } from '@/lib/review-discussions';

export async function reviewDiscussionAction(id: string, action: 'read' | 'vote' | 'comment' | 'delete', value?: string | number) {
  try {
    reviewId(id);
    const session = await auth.api.getSession({ headers: await headers() });
    const viewer = session?.user.id ?? null;
    if (!['read','vote','comment','delete'].includes(action)) throw new ReviewDiscussionError('Неизвестное действие.');
    if (action !== 'read') {
      if (!viewer) return { error: 'Войдите, чтобы участвовать в обсуждении.', signIn: true };
      if (await isUserBlocked(viewer)) return { error: 'Ваш аккаунт заблокирован для публикаций.' };
      if (action === 'vote') {
        if (typeof value !== 'number') throw new ReviewDiscussionError('Некорректная реакция.');
        await setReviewReaction(viewer, id, value);
      } else if (action === 'comment') {
        if (typeof value !== 'string') throw new ReviewDiscussionError('Напишите комментарий.');
        await addReviewComment(viewer, id, value);
      } else {
        if (typeof value !== 'string') throw new ReviewDiscussionError('Комментарий не найден.');
        await deleteReviewComment(viewer, id, value);
      }
      revalidatePath('/catalog', 'layout'); revalidatePath('/profile', 'layout'); revalidatePath('/admin');
    }
    const interaction = (await getReviewInteractions([id], viewer)).get(id);
    if (!interaction) return { error: 'Отзыв уже удалён.' };
    const thread = action === 'vote' ? undefined : await getReviewComments(id, viewer, action === 'read' && typeof value === 'string' ? value : undefined);
    return { interaction, thread };
  } catch(error) {
    return { error: error instanceof ReviewDiscussionError ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.' };
  }
}
