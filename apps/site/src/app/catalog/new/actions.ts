'use server';
import { isFrozenError } from '@/lib/moderation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { checkDrinkDuplicates, dismissDrinkCheck } from '@/lib/drink-duplicate-check';
import { getGigaChatMax } from '@/lib/gigachat';
import { auth } from '@/lib/auth';
import { requireSiteAdmin } from '@/lib/admin';
import { BASIC_FLAVORS } from '@/lib/catalog-query';
import { CatalogDrinkError, parseCatalogDrink, parseCatalogDrinkEdit } from '@/lib/catalog-drink-fields';
import { CatalogDrinkDuplicate, deleteCatalogDrink, moderateCatalogDrink, submitCatalogDrink, updateCatalogDrink } from '@/lib/catalog-drinks';
import { mergeCatalogDrink, searchMergeTargets } from '@/lib/catalog-drink-merge';
import { ensureOwnProfile } from '@/lib/profile';
import { getCabinet } from '@/lib/business';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';

/** `confirmable` — the duplicate is a parser card: the form offers «Всё равно отправить» (`confirmMatch`). */
export interface CatalogDrinkState { error?: string; duplicate?: string; confirmable?: boolean; saved?: boolean; /** The card's address when the drink went to the catalog without moderation (an approved company). */ published?: string }
const KNOWN_FLAVORS = new Set(BASIC_FLAVORS.map(flavor => flavor.key));

export async function submitCatalogDrinkAction(_previous: CatalogDrinkState, form: FormData): Promise<CatalogDrinkState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт, чтобы добавить напиток.' };
  try {
    await ensureOwnProfile(session.user);
    const input = parseCatalogDrink(form, KNOWN_FLAVORS);
    const { photos } = await prepareReviewPhotos(form);
    if (photos.length > 1) return { error: 'Добавьте одно фото банки.' };
    // From the business cabinet: the member's company, checked again in `submitCatalogDrink`.
    const businessId = form.get('business') === '1' ? (await getCabinet(session.user.id))?.business.id ?? null : null;
    const result = await submitCatalogDrink(session.user.id, input, photos[0], form.get('confirmMatch') === '1', businessId);
    revalidatePath('/catalog/new');
    revalidatePath('/admin/drinks');
    // The neural network's duplicate hint for moderators, after the answer; the worker retries what fails here.
    const model = getGigaChatMax();
    if (model) after(() => checkDrinkDuplicates(model, result.id).catch(() => undefined));
    if (result.published) { revalidatePath('/catalog', 'layout'); revalidatePath('/business/cabinet'); }
    return { saved: true, published: result.published ? result.href : undefined };
  } catch (error) {
    if (error instanceof CatalogDrinkDuplicate) return { error: error.message, duplicate: error.href, confirmable: error.confirmable };
    return { error: error instanceof CatalogDrinkError || error instanceof ReviewPhotoError || isFrozenError(error) ? error.message : 'Не удалось отправить напиток. Попробуйте ещё раз.' };
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

/** Catalog cards to merge a member drink into, for the «Склеить с…» dialog (staff only). */
export async function searchMergeTargetsAction(query: string, exclude: { brand: string; flavor: string }): Promise<{ brand: string; flavor: string; label: string; cover?: string }[]> {
  await requireSiteAdmin();
  return (await searchMergeTargets(query, exclude)).map(({ brand, flavor, label, cover }) => ({ brand, flavor, label, ...(cover ? { cover } : {}) }));
}

/** Merges a duplicate member drink into a catalog card; `revokeXp` takes back the 50 XP paid for it. */
export async function mergeCatalogDrinkAction(id: string, version: string, _previous: CatalogDrinkState, form: FormData): Promise<CatalogDrinkState> {
  const admin = await requireSiteAdmin();
  try {
    await mergeCatalogDrink(admin.userId, admin.email, id, version,
      { brand: String(form.get('targetBrand') ?? ''), flavor: String(form.get('targetFlavor') ?? '') }, form.get('revokeXp') === 'on');
    revalidateDrinks();
    return { saved: true };
  } catch (error) {
    return { error: error instanceof CatalogDrinkError ? error.message : 'Не удалось склеить напиток.' };
  }
}

/** «Не дубль»: the team clears the neural network's suspicion of a published drink. */
export async function dismissDrinkCheckAction(id: string): Promise<void> {
  const admin = await requireSiteAdmin();
  await dismissDrinkCheck(admin.userId, admin.email, id);
  revalidatePath('/admin/drinks');
}
