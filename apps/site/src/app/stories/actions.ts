'use server';
import { isFrozenError } from '@/lib/moderation';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { ensureOwnProfile } from '@/lib/profile';
import { ReviewPhotoError } from '@/lib/review-photos';
import { StoryError, deleteStory, getStoryLikers, markStoriesViewed, publishStory, setStoryLike, type StoryLiker } from '@/lib/stories';
import { prepareWallMedia } from '@/lib/wall-media';

export interface StoryActionState { error?: string; id?: string }

/** Publishes a story from the composer form: one file in `photos` (and `videoPoster` for a video), `caption`. */
export async function publishStoryAction(form: FormData): Promise<StoryActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы публиковать истории.' };
  try {
    await ensureOwnProfile(session.user);
    const caption = form.get('caption');
    const id = await publishStory(session.user.id, typeof caption === 'string' ? caption : '', await prepareWallMedia(form));
    revalidatePath('/');
    return { id };
  } catch (error) {
    return { error: error instanceof StoryError || error instanceof ReviewPhotoError || isFrozenError(error) ? error.message : 'Не удалось опубликовать историю. Попробуйте ещё раз.' };
  }
}

export async function deleteStoryAction(id: string): Promise<StoryActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт и повторите действие.' };
  try { await deleteStory(session.user.id, id); revalidatePath('/'); return {}; }
  catch (error) { return { error: error instanceof StoryError ? error.message : 'Не удалось удалить историю.' }; }
}

const STORY_ID = /^[0-9a-f-]{36}$/u;

/** The heart under someone else's story. */
export async function likeStoryAction(id: string, like: boolean): Promise<{ error?: string; signIn?: boolean; likes?: number }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы ставить лайки историям.', signIn: true };
  if (typeof id !== 'string' || !STORY_ID.test(id) || typeof like !== 'boolean') return { error: 'История недоступна.' };
  try { return { likes: await setStoryLike(session.user.id, id, like) }; }
  catch (error) { return { error: error instanceof StoryError ? error.message : 'Не удалось поставить лайк.' }; }
}

/** The author's list of who liked their story. */
export async function storyLikersAction(id: string): Promise<StoryLiker[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || typeof id !== 'string' || !STORY_ID.test(id)) return [];
  return getStoryLikers(session.user.id, id);
}

/** Called by the viewer as stories are shown; guests' views are not recorded. */
export async function viewStoriesAction(ids: string[]): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !Array.isArray(ids)) return;
  await markStoriesViewed(session.user.id, ids.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/u.test(id)));
}
