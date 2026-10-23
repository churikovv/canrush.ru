'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireSiteAdmin } from '@/lib/admin';
import { BASIC_FLAVORS } from '@/lib/catalog-query';
import { CatalogDrinkError, parseCatalogDrink, parseCatalogDrinkEdit } from '@/lib/catalog-drink-fields';
import { CatalogDrinkDuplicate, deleteCatalogDrink, moderateCatalogDrink, submitCatalogDrink, updateCatalogDrink } from '@/lib/catalog-drinks';
import { ensureOwnProfile } from '@/lib/profile';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';

export interface CatalogDrinkState { error?: string; duplicate?: string; saved?: boolean }
const KNOWN_FLAVORS = new Set(BASIC_FLAVORS.map(flavor => flavor.key));

export async function submitCatalogDrinkAction(_previous: CatalogDrinkState, form: FormData): Promise<CatalogDrinkState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт, чтобы добавить напиток.' };
  try {
    await ensureOwnProfile(session.user);
    const input = parseCatalogDrink(form, KNOWN_FLAVORS);
    const { photos } = await prepareReviewPhotos(form);
    if (photos.length > 1) return { error: 'Добавьте одно фото банки.' };
    await submitCatalogDrink(session.user.id, input, photos[0]);
    revalidatePath('/catalog/new');
    revalidatePath('/admin/drinks');
    return { saved: true };
  } catch (error) {
    if (error instanceof CatalogDrinkDuplicate) return { error: error.message, duplicate: error.href };
    return { error: error instanceof CatalogDrinkError || error instanceof ReviewPhotoError ? error.message : 'Не удалось отправить напиток. Попробуйте ещё раз.' };
  }
}

export async function moderateCatalogDrinkAction(id: string, version: string, _previous: CatalogDrinkState, form: FormData): Promise<CatalogDrinkState> {
  const admin = await requireSiteAdmin();
  try {
    await moderateCatalogDrink(admin.userId, id, String(form.get('status')) as 'published' | 'rejected', String(form.get('note') ?? ''), version);
    revalidatePath('/admin/drinks');
    revalidatePath('/catalog', 'layout');
    return { saved: true };
  } catch (error) {
    return { error: error instanceof CatalogDrinkError ? error.message : 'Не удалось сохранить решение.' };
  }
}

function revalidateDrinks() {
  revalidatePath('/admin/drinks');
  revalidatePath('/catalog', 'layout');
  revalidatePath('/catalog/new');
}

/** An admin's correction of a request or a published drink, optionally with a new can photo. */
export async function updateCatalogDrinkAction(id: string, version: string, _previous: CatalogDrinkState, form: FormData): Promise<CatalogDrinkState> {
  const admin = await requireSiteAdmin();
  try {
    const edit = parseCatalogDrinkEdit(form, KNOWN_FLAVORS);
    const { photos } = await prepareReviewPhotos(form);
    if (photos.length > 1) return { error: 'Выберите одно фото банки.' };
    await updateCatalogDrink(admin.userId, admin.email, id, version, edit, photos[0]);
    revalidateDrinks();
    return { saved: true };
  } catch (error) {
    if (error instanceof CatalogDrinkDuplicate) return { error: error.message, duplicate: error.href };
    return { error: error instanceof CatalogDrinkError || error instanceof ReviewPhotoError ? error.message : 'Не удалось сохранить напиток.' };
  }
}

export async function deleteCatalogDrinkAction(id: string, _previous: CatalogDrinkState): Promise<CatalogDrinkState> {
  const admin = await requireSiteAdmin();
  try {
    await deleteCatalogDrink(admin.userId, admin.email, id);
    revalidateDrinks();
    return { saved: true };
  } catch (error) {
    return { error: error instanceof CatalogDrinkError ? error.message : 'Не удалось удалить напиток.' };
  }
}
