'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSiteAdmin, isSiteStaffEmail } from '@/lib/admin';
import { ArticleError, parseArticleBlocks, parseArticleChannel, parseArticleTitle } from '@/lib/article-fields';
import { addArticleImage, deleteArticle, moderateArticle, reopenArticle, saveArticleDraft, setArticleLike, submitArticle } from '@/lib/articles';
import { auth } from '@/lib/auth';
import { isFrozenError } from '@/lib/moderation';
import { ensureOwnProfile } from '@/lib/profile';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';
import { encodeStillPhoto } from '@/lib/review-photos';

export interface ArticleSaveResult { id?: string; version?: string; error?: string }
export interface ArticleActionState { error?: string; done?: boolean }

const message = (error: unknown, fallback: string) => error instanceof ArticleError || isFrozenError(error) ? error.message : fallback;

async function member() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ArticleError('Войдите в аккаунт, чтобы писать статьи.');
  await ensureOwnProfile(session.user);
  return session.user;
}

/** Autosave of the editor; the first save creates the draft and returns its id. */
export async function saveArticleAction(id: string | null, title: string, blocks: unknown, coverId: string | null, version: string | null, channel: string | null = null): Promise<ArticleSaveResult> {
  try {
    const user = await member();
    return await saveArticleDraft(user.id, id, parseArticleTitle(title), parseArticleBlocks(blocks), coverId, version, parseArticleChannel(channel));
  } catch (error) {
    return { error: message(error, 'Не удалось сохранить статью. Проверьте соединение — правки остались в редакторе.') };
  }
}

export async function submitArticleAction(id: string): Promise<ArticleActionState> {
  try {
    const user = await member();
    await submitArticle(user.id, id);
    revalidatePath('/news');
    revalidatePath('/admin/articles');
    return { done: true };
  } catch (error) {
    return { error: message(error, 'Не удалось отправить статью. Попробуйте ещё раз.') };
  }
}

export async function reopenArticleAction(id: string): Promise<ArticleActionState> {
  try {
    const user = await member();
    await reopenArticle(user.id, id);
    revalidatePath('/news');
    revalidatePath(`/news/${id}`);
  } catch (error) {
    return { error: message(error, 'Не удалось вернуть статью в черновики.') };
  }
  redirect(`/news/${id}/edit`);
}

export async function deleteArticleAction(id: string): Promise<ArticleActionState> {
  try {
    const user = await member();
    await deleteArticle(user.id, id, await isSiteStaffEmail(user.email) ? user.email : null);
    revalidatePath('/news');
    revalidatePath('/admin/articles');
  } catch (error) {
    return { error: message(error, 'Не удалось удалить статью.') };
  }
  redirect('/news');
}

/** One photo for a block or the cover, re-encoded like review photos (the type is checked by content, not by name). */
export async function uploadArticleImageAction(articleId: string, form: FormData): Promise<{ id?: string; error?: string }> {
  try {
    const user = await member();
    const file = form.get('photo');
    if (!(file instanceof File) || !file.size) return { error: 'Выберите фото.' };
    if (file.size > MAX_REVIEW_PHOTO_BYTES) return { error: 'Фото должно быть не больше 5 МБ.' };
    if (!REVIEW_PHOTO_TYPES.includes(file.type)) return { error: 'Выберите фото в формате JPG, PNG или WebP.' };
    let photo;
    try { photo = await encodeStillPhoto(Buffer.from(await file.arrayBuffer())); }
    catch { return { error: 'Не удалось прочитать фото. Используйте обычное изображение JPG, PNG или WebP.' }; }
    return { id: await addArticleImage(user.id, articleId, photo) };
  } catch (error) {
    return { error: message(error, 'Не удалось загрузить фото. Попробуйте ещё раз.') };
  }
}

export async function moderateArticleAction(id: string, version: string, _previous: ArticleActionState, form: FormData): Promise<ArticleActionState> {
  const admin = await requireSiteAdmin();
  try {
    await moderateArticle(admin.userId, id, String(form.get('status')) as 'published' | 'rejected', String(form.get('note') ?? ''), version);
    revalidatePath('/news');
    revalidatePath(`/news/${id}`);
    revalidatePath('/admin/articles');
    return { done: true };
  } catch (error) {
    return { error: message(error, 'Не удалось сохранить решение. Попробуйте ещё раз.') };
  }
}

export async function likeArticleAction(id: string, like: boolean): Promise<{ likes?: number; liked?: boolean; error?: string }> {
  try {
    const user = await member();
    return await setArticleLike(user.id, id, like);
  } catch (error) {
    return { error: message(error, 'Не удалось поставить лайк.') };
  }
}

/** Deleting from the list of one's drafts: stays on the page (unlike the article page's delete, which leaves it). */
export async function deleteDraftAction(id: string): Promise<ArticleActionState> {
  try {
    const user = await member();
    await deleteArticle(user.id, id, null);
    revalidatePath('/news');
    return { done: true };
  } catch (error) {
    return { error: message(error, 'Не удалось удалить черновик.') };
  }
}
