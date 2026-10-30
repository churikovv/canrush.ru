'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { BusinessError } from '@/lib/business-fields';
import sharp from 'sharp';
import { createCompanyAward, createCompanyPost, deleteCompanyAward, deleteCompanyPost, pinCompanyPresentation, saveCompanyInfo, saveCompanyProfile, setCompanyBanner, setCompanyFollow } from '@/lib/business-profile';
import { isPdf, MAX_PDF_BYTES, parseAwardInput, parseCompanyInfo, parseHiddenSections, parsePostText } from '@/lib/business-profile-fields';
import { encodeStillPhoto, prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';

export interface CompanyActionState { error?: string; saved?: boolean; at?: number }

async function userId(): Promise<string | null> {
  return (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;
}
const failure = (error: unknown, fallback: string): CompanyActionState => ({ error: error instanceof BusinessError || error instanceof ReviewPhotoError ? error.message : fallback, at: Date.now() });

/** A wall post from the company page: text and/or one PDF presentation. */
export async function createCompanyPostAction(businessId: string, _previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = await userId();
  if (!id) return { error: 'Войдите, чтобы публиковать.', at: Date.now() };
  try {
    const upload = form.get('file');
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    if (file && file.size > MAX_PDF_BYTES) return { error: 'PDF — до 20 МБ.', at: Date.now() };
    const { photos } = await prepareReviewPhotos(form);
    await createCompanyPost(id, parsePostText(form.get('text')), file ? { name: file.name, data: Buffer.from(await file.arrayBuffer()) } : null, photos);
    revalidatePath(`/company/${businessId}`);
    return { saved: true, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось опубликовать запись.'); }
}

export async function deleteCompanyPostAction(businessId: string, postId: string): Promise<CompanyActionState> {
  const id = await userId();
  if (!id) return { error: 'Войдите снова.', at: Date.now() };
  try {
    await deleteCompanyPost(id, postId);
    revalidatePath(`/company/${businessId}`);
    return { saved: true, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось удалить запись.'); }
}

/** «Закрепить как главную презентацию» on a PDF post, or unpin it (`postId` null). */
export async function pinCompanyPresentationAction(businessId: string, postId: string | null): Promise<CompanyActionState> {
  const id = await userId();
  if (!id) return { error: 'Войдите снова.', at: Date.now() };
  try {
    await pinCompanyPresentation(id, postId);
    revalidatePath(`/company/${businessId}`);
    return { saved: true, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось закрепить презентацию.'); }
}

/** A new award: PDF or picture, told by the file's content; a picture is re-encoded, so nothing else gets through. */
export async function createCompanyAwardAction(businessId: string, _previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = await userId();
  if (!id) return { error: 'Войдите, чтобы добавить награду.', at: Date.now() };
  try {
    const upload = form.get('file');
    if (!(upload instanceof File) || !upload.size) return { error: 'Выберите файл.', at: Date.now() };
    if (upload.size > MAX_PDF_BYTES) return { error: 'Файл — до 20 МБ.', at: Date.now() };
    const input = parseAwardInput(form);
    const data = Buffer.from(await upload.arrayBuffer());
    if (isPdf(data)) await createCompanyAward(id, input, { kind: 'pdf', name: upload.name, data });
    else {
      if (data.length > MAX_REVIEW_PHOTO_BYTES) return { error: 'Картинка — до 5 МБ.', at: Date.now() };
      let photo;
      try { photo = await encodeStillPhoto(data); }
      catch { return { error: 'Нужен PDF или картинка JPG, PNG, WebP.', at: Date.now() }; }
      await createCompanyAward(id, input, { kind: 'image', ...photo });
    }
    revalidatePath(`/company/${businessId}`);
    return { saved: true, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось добавить награду.'); }
}

export async function deleteCompanyAwardAction(businessId: string, awardId: string): Promise<CompanyActionState> {
  const id = await userId();
  if (!id) return { error: 'Войдите снова.', at: Date.now() };
  try {
    await deleteCompanyAward(id, awardId);
    revalidatePath(`/company/${businessId}`);
    return { saved: true, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось удалить награду.'); }
}

/** «Подписаться» / «Вы подписаны» on a company profile: returns the subscriber count after the change. */
export async function followCompanyAction(businessId: string, on: boolean): Promise<CompanyActionState & { followers?: number }> {
  const id = await userId();
  if (!id) return { error: 'Войдите, чтобы подписаться.', at: Date.now() };
  try {
    const followers = await setCompanyFollow(id, businessId, on);
    revalidatePath(`/company/${businessId}`);
    return { saved: true, followers, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось изменить подписку.'); }
}

/** The profile banner from the cabinet: a wide picture cropped to 3:1 (1500×500 WebP); `remove=1` takes it down. */
export async function companyBannerAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = await userId();
  if (!id) return { error: 'Войдите снова.', at: Date.now() };
  try {
    if (form.get('remove') === '1') await setCompanyBanner(id, null);
    else {
      const file = form.get('banner');
      if (!(file instanceof File) || !file.size) return { error: 'Выберите картинку.', at: Date.now() };
      if (file.size > MAX_REVIEW_PHOTO_BYTES || !REVIEW_PHOTO_TYPES.includes(file.type)) return { error: 'Баннер — JPG, PNG или WebP до 5 МБ.', at: Date.now() };
      let wide: Buffer;
      try { wide = await sharp((await encodeStillPhoto(Buffer.from(await file.arrayBuffer()))).data).resize(1500, 500, { fit: 'cover' }).webp({ quality: 82 }).toBuffer(); }
      catch { return { error: 'Не удалось прочитать картинку.', at: Date.now() }; }
      await setCompanyBanner(id, wide);
    }
    revalidatePath('/business/cabinet');
    revalidatePath('/company', 'layout');
    return { saved: true, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось сохранить баннер.'); }
}

/**
 * The cabinet's single «Сохранить профиль»: the brand's texts and contacts, the store the profile leads to and the
 * sections it shows, in one go. Everything in it is optional.
 */
export async function saveCompanyProfileAllAction(_previous: CompanyActionState, form: FormData): Promise<CompanyActionState> {
  const id = await userId();
  if (!id) return { error: 'Войдите снова.', at: Date.now() };
  try {
    const info = parseCompanyInfo(form);
    const store = String(form.get('storeId') ?? '');
    await saveCompanyInfo(id, info);
    await saveCompanyProfile(id, store || null, parseHiddenSections(form));
    revalidatePath('/business/cabinet');
    revalidatePath('/company', 'layout');
    return { saved: true, at: Date.now() };
  } catch (error) { return failure(error, 'Не удалось сохранить профиль.'); }
}
