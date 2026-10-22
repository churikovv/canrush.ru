'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { ensureOwnProfile } from '@/lib/profile';
import { ReviewPhotoError } from '@/lib/review-photos';
import { StoryError, deleteStory, markStoriesViewed, publishStory } from '@/lib/stories';
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
    return { error: error instanceof StoryError || error instanceof ReviewPhotoError ? error.message : 'Не удалось опубликовать историю. Попробуйте ещё раз.' };
  }
}

export async function deleteStoryAction(id: string): Promise<StoryActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт и повторите действие.' };
  try { await deleteStory(session.user.id, id); revalidatePath('/'); return {}; }
  catch (error) { return { error: error instanceof StoryError ? error.message : 'Не удалось удалить историю.' }; }
}

/** Called by the viewer as stories are shown; guests' views are not recorded. */
export async function viewStoriesAction(ids: string[]): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !Array.isArray(ids)) return;
  await markStoriesViewed(session.user.id, ids.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/u.test(id)));
}
