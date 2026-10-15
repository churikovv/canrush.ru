'use server';
import { getPool } from '@/db/pool';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
import { addTierComment, deleteTierComment, editTierComment, getTierComments, getTierInteractions, TierDiscussionError, tierListId, setTierReaction } from '@/lib/tier-discussions';

export async function tierDiscussionAction(id: string, action: 'read' | 'vote' | 'comment' | 'delete' | 'edit', value?: string | number | { commentId: string; text: string } | { text: string; replyToId: string }) {
  try {
    tierListId(id);
    const session = await auth.api.getSession({ headers: await headers() });
    const viewer = session?.user.id ?? null;
    if (!['read','vote','comment','delete','edit'].includes(action)) throw new TierDiscussionError('Неизвестное действие.');
    if (!(await getTierInteractions([id], viewer)).has(id)) return { error: 'Тирлист недоступен.' };
    const settings = (await getPool().query<{ reactionsEnabled: boolean; commentsEnabled: boolean }>(`select "reactionsEnabled", "commentsEnabled" from "tierList" where id=$1 and status='published'`, [id])).rows[0];
    if (!settings) return { error: 'Тирлист недоступен.' };
    if (action === 'vote' && !settings.reactionsEnabled) return { error: 'Автор отключил реакции.' };
    if (action !== 'vote' && !settings.commentsEnabled) return { error: 'Автор отключил комментарии.' };
    let edited: { id: string; text: string; editedAt: string } | undefined;
    if (action !== 'read') {
      if (!viewer) return { error: 'Войдите, чтобы участвовать в обсуждении.', signIn: true };
      if (await isUserBlocked(viewer)) return { error: 'Ваш аккаунт заблокирован для публикаций.' };
      if (action === 'vote') {
        if (typeof value !== 'number') throw new TierDiscussionError('Некорректная реакция.');
        await setTierReaction(viewer, id, value);
      } else if (action === 'comment') {
        if (typeof value === 'string') await addTierComment(viewer, id, value);
        else if (value && typeof value === 'object' && 'replyToId' in value && typeof value.text === 'string' && typeof value.replyToId === 'string') await addTierComment(viewer, id, value.text, value.replyToId);
        else throw new TierDiscussionError('Напишите комментарий.');
      } else if (action === 'edit') {
        if (!value || typeof value !== 'object' || !('commentId' in value) || typeof value.commentId !== 'string' || typeof value.text !== 'string') throw new TierDiscussionError('Комментарий не найден.');
        edited = await editTierComment(viewer, id, value.commentId, value.text);
      } else {
        if (typeof value !== 'string') throw new TierDiscussionError('Комментарий не найден.');
        await deleteTierComment(viewer, id, value);
      }
      revalidatePath('/tierlists', 'layout'); revalidatePath('/profile', 'layout'); revalidatePath('/admin');
    }
    const interaction = (await getTierInteractions([id], viewer)).get(id);
    if (!interaction) return { error: 'Тирлист недоступен.' };
    const thread = action === 'vote' || action === 'edit' ? undefined : await getTierComments(id, viewer, action === 'read' && typeof value === 'string' ? value : undefined);
    return { interaction, thread, edited };
  } catch(error) {
    return { error: error instanceof TierDiscussionError ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.' };
  }
}
