'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { ensureOwnProfile } from '@/lib/profile';
import { isUserBlocked } from '@/lib/moderation';
import { CommunityError, addProfileComment, deleteProfileComment, getPresence, setFollowing, setPresenceVisibility, setProfileTags, touchPresence } from '@/lib/profile-community';

export interface CommunityActionState { error?: string; success?: string }

export async function updateCommunityAction(_state: CommunityActionState, form: FormData): Promise<CommunityActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт и повторите действие.' };
  const operation = form.get('operation');
  const userId = session.user.id;
  try {
    if ((operation === 'follow' || operation === 'comment') && await isUserBlocked(userId)) return { error: 'Публикации и подписки для этого аккаунта ограничены.' };
    switch (operation) {
      case 'follow':
      case 'unfollow':
        await ensureOwnProfile(session.user);
        await setFollowing(userId, String(form.get('targetId') ?? ''), operation === 'follow');
        break;
      case 'tags':
        await setProfileTags(userId, form.getAll('tags'));
        break;
      case 'comment':
        await ensureOwnProfile(session.user);
        await addProfileComment(userId, String(form.get('targetId') ?? ''), form.get('text'));
        break;
      case 'delete-comment':
        await deleteProfileComment(userId, String(form.get('commentId') ?? ''));
        break;
      case 'visibility':
        await setPresenceVisibility(userId, form.get('visible') === 'true');
        break;
      default: return { error: 'Неизвестное действие.' };
    }
    revalidatePath('/profile', 'layout');
    if (operation === 'tags') revalidatePath('/catalog', 'layout');
    return { success: operation === 'comment' ? 'Комментарий опубликован.' : operation === 'delete-comment' ? 'Комментарий удалён.' : 'Сохранено.' };
  } catch (error) {
    return { error: error instanceof CommunityError ? error.message : 'Не удалось сохранить изменения. Попробуйте ещё раз.' };
  }
}

export async function heartbeatAction(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) await touchPresence(session.user.id);
}

export async function readPresenceAction(userId: string): Promise<'online' | 'offline' | 'hidden'> {
  if (typeof userId !== 'string' || userId.length > 200) return 'hidden';
  return getPresence(userId);
}
