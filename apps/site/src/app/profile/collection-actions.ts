'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { addCollectionPhotos, deleteCollectionPhoto } from '@/lib/collection-photos';
import { CollectionPhotoError, MAX_COLLECTION_UPLOAD, parseCollectionCaption } from '@/lib/collection-photo-fields';
import { frozenMessage, isFrozenError } from '@/lib/moderation';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';
import { encodeStillPhoto } from '@/lib/review-photos';

export interface CollectionPhotoState { error?: string; saved?: number }

/** The owner's profile under any address: `/profile/<ник>` and the «Профиль» tab. */
function refresh() {
  revalidatePath('/profile/[username]', 'page');
  revalidatePath('/profile');
}

/** Photos of the member's can collection, each with an optional caption (`caption` in the same order as `photos`). */
export async function addCollectionPhotosAction(_state: CollectionPhotoState, form: FormData): Promise<CollectionPhotoState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы добавить фото.' };
  const frozen = await frozenMessage(session.user.id);
  if (frozen) return { error: frozen };
  const files = form.getAll('photos');
  const captions = form.getAll('caption');
  if (files.some(file => typeof file === 'string')) return { error: 'Некорректные фото.' };
  const photos = (files as File[]).filter(file => file.size > 0);
  if (!photos.length) return { error: 'Выберите хотя бы одно фото.' };
  if (photos.length > MAX_COLLECTION_UPLOAD) return { error: `За раз — до ${MAX_COLLECTION_UPLOAD} фото.` };
  if (photos.some(file => file.size > MAX_REVIEW_PHOTO_BYTES)) return { error: 'Каждое фото — до 5 МБ.' };
  if (photos.some(file => !REVIEW_PHOTO_TYPES.includes(file.type))) return { error: 'Выберите фото в формате JPG, PNG или WebP.' };
  try {
    const prepared = [];
    // One by one: decoding several large photos at once would spike the memory.
    for (const [index, file] of photos.entries()) {
      const caption = parseCollectionCaption(captions[index]);
      try { prepared.push({ photo: await encodeStillPhoto(Buffer.from(await file.arrayBuffer())), caption }); }
      catch { return { error: 'Не удалось прочитать фото. Используйте обычное изображение JPG, PNG или WebP до 40 мегапикселей.' }; }
    }
    await addCollectionPhotos(session.user.id, prepared);
  } catch (error) {
    if (error instanceof CollectionPhotoError) return { error: error.message };
    if (isFrozenError(error)) return { error: await frozenMessage(session.user.id) ?? 'Аккаунт заморожен.' };
    throw error;
  }
  refresh();
  return { saved: Date.now() };
}

export async function deleteCollectionPhotoAction(id: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт.' };
  if (!await deleteCollectionPhoto(session.user.id, id)) return { error: 'Фото уже удалено.' };
  refresh();
  return {};
}
