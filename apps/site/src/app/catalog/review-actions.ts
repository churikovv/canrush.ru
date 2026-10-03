'use server';

import { isResolvedFlavor } from '@canrush/shared';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getProfileCommunity } from '@/lib/profile-community';
import { getCatalogGroup } from '@/lib/catalog';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { isUserBlocked } from '@/lib/moderation';
import { validateReviewInput } from '@/lib/review-fields';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { deleteReview, upsertReview } from '@/lib/reviews';
import type { ReviewFieldErrors } from '@/lib/review-fields';

export interface ReviewFormState {
  status?: 'success' | 'error';
  message?: string;
  fieldErrors?: ReviewFieldErrors;
  photos?: string[];
}

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  return session.user;
}

export async function submitReviewAction(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const user = await requireUser();

  if (await isUserBlocked(user.id)) {
    return { status: 'error', message: 'Ваш аккаунт заблокирован для публикации отзывов.' };
  }

  const brand = formData.get('brand');
  const flavor = formData.get('flavor');
  if (typeof brand !== 'string' || typeof flavor !== 'string') {
    return { status: 'error', message: 'Некорректные данные.' };
  }
  if (brand.length > 120 || flavor.length > 80) {
    return { status: 'error', message: 'Некорректные данные.' };
  }

  if (!isResolvedFlavor(flavor)) return { status: 'error', message: 'Сначала нужно уточнить вкус напитка. Отзыв к смешанной карточке добавить нельзя.' };
  const group = await getCatalogGroup(brand, flavor);
  if (!group) return { status: 'error', message: 'Товар не найден.' };

  if (formData.get('ratingScale') !== '10') return { status: 'error', message: 'Шкала оценок обновилась. Перезагрузите страницу перед сохранением отзыва.' };

  const validation = validateReviewInput({
    design: String(formData.get('design') ?? ''),
    taste: String(formData.get('taste') ?? ''),
    text: String(formData.get('text') ?? ''),
  });

  if (validation.errors) {
    return { status: 'error', message: 'Проверьте оценки и текст.', fieldErrors: validation.errors };
  }

  let photos: string[];
  try {
    const attachments = await prepareReviewPhotos(formData);
    photos = await upsertReview(user.id, brand, flavor, validation.data, attachments);
  } catch (error) {
    if (error instanceof ReviewPhotoError) return { status: 'error', message: error.message };
    return { status: 'error', message: 'Не удалось сохранить отзыв. Попробуйте ещё раз.' };
  }

  await getProfileCommunity(user.id);

  const slug = catalogGroupSlug(brand, flavor);
  revalidatePath(`/catalog/${slug}`);
  revalidatePath('/catalog');
  revalidatePath('/profile');
  return { status: 'success', message: 'Отзыв сохранён.', photos };
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const brand = formData.get('brand');
  const flavor = formData.get('flavor');
  if (typeof brand !== 'string' || typeof flavor !== 'string') return;

  await deleteReview(user.id, brand, flavor);

  const slug = catalogGroupSlug(brand, flavor);
  revalidatePath(`/catalog/${slug}`);
  revalidatePath('/catalog');
  revalidatePath('/profile');
}
