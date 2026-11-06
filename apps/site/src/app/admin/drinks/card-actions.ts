'use server';
import { revalidatePath } from 'next/cache';
import { requireSiteAdmin } from '@/lib/admin';
import { CatalogCardDuplicate, CatalogCardError, mergeCatalogCard, renameCatalogCard, setCardDiscontinued, setCardFullName, setCardHidden, setCardPhoto } from '@/lib/catalog-card-edits';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { readAllCatalogGroups } from '@/lib/catalog-files';
import { BASIC_FLAVORS, catalogGroupSlug } from '@/lib/catalog-query';
import { CatalogDrinkError, parseIdentity } from '@/lib/catalog-drink-fields';
import { drinkIdentity } from '@/lib/catalog-drinks';
import { parseCardFullName } from '@/lib/catalog-card-edit-fields';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { dismissCardCheck } from '@/lib/catalog-card-check';
import { storeDrinkOptions } from '@/lib/store-catalog';

/** «Карточки каталога» in /admin/drinks: the team's edits of the parser's cards (`catalogCardEdit`). */
export interface CardActionState { error?: string; saved?: boolean; /** A rename onto a name the catalog has: the card to merge into instead. */ duplicate?: { brand: string; flavor: string; label: string; href: string } }
const KNOWN_FLAVORS = new Set(BASIC_FLAVORS.map(flavor => flavor.key));
const lower = (value: string) => value.toLocaleLowerCase('ru-RU');
type Card = { brand: string; flavor: string };

function revalidateCatalog() {
  revalidatePath('/admin/drinks');
  revalidatePath('/catalog', 'layout');
  revalidatePath('/');
}
const message = (error: unknown, fallback: string) => error instanceof CatalogCardError || error instanceof ReviewPhotoError ? error.message
  : error instanceof Error && error.message.startsWith('Полное название') ? error.message : fallback;

/** Merge into a card the catalog shows (picked from the same search as a member drink's merge). */
export async function mergeCatalogCardAction(card: Card, _previous: CardActionState, form: FormData): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  const target = { brand: String(form.get('targetBrand') ?? ''), flavor: String(form.get('targetFlavor') ?? '') };
  try {
    if (!(await storeDrinkOptions()).some(option => option.brand === target.brand && option.flavor === target.flavor)) throw new CatalogCardError('Такой карточки нет в каталоге. Выберите её из подсказок.');
    await mergeCatalogCard(admin.userId, admin.email, card, target);
    revalidateCatalog();
    return { saved: true };
  } catch (error) { return { error: message(error, 'Не удалось склеить карточки. Попробуйте ещё раз.') }; }
}

/**
 * «Переименовать»: the same brand, flavour, sugar and juice inputs as a member drink. The brand keeps the catalog's
 * spelling, the flavour its canonical key; a name the catalog already shows comes back as `duplicate` to merge into.
 */
export async function renameCatalogCardAction(card: Card, _previous: CardActionState, form: FormData): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    const typed = parseIdentity(form, KNOWN_FLAVORS);
    const [files, shown] = await Promise.all([readAllCatalogGroups(), loadAllCatalogGroups()]);
    const brand = [...shown, ...files].find(group => lower(group.brand) === lower(typed.brand))?.brand ?? typed.brand;
    await renameCatalogCard(admin.userId, admin.email, card, drinkIdentity(brand, typed.flavor), files, shown);
    revalidateCatalog();
    revalidatePath('/profile', 'layout');
    revalidatePath('/business/cabinet');
    return { saved: true };
  } catch (error) {
    if (error instanceof CatalogCardDuplicate) return { error: error.message, duplicate: { ...error.target, href: `/catalog/${catalogGroupSlug(error.target.brand, error.target.flavor)}` } };
    if (error instanceof CatalogDrinkError) return { error: error.message };
    return { error: message(error, 'Не удалось переименовать карточку. Попробуйте ещё раз.') };
  }
}

/** A new cover (one still photo), or `restore` back to the parser's. */
export async function setCardPhotoAction(card: Card, _previous: CardActionState, form: FormData): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    // Not «reset»: a field of that name hides the form's reset() from React.
    if (form.get('restore') === '1') await setCardPhoto(admin.userId, admin.email, card, null);
    else {
      const { photos } = await prepareReviewPhotos(form);
      if (photos.length !== 1) return { error: 'Выберите одно фото банки.' };
      await setCardPhoto(admin.userId, admin.email, card, photos[0]!);
    }
    revalidateCatalog();
    return { saved: true };
  } catch (error) { return { error: message(error, 'Не удалось сохранить фото. Попробуйте ещё раз.') }; }
}

export async function setCardNameAction(card: Card, _previous: CardActionState, form: FormData): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    await setCardFullName(admin.userId, admin.email, card, parseCardFullName(form.get('fullName')));
    revalidateCatalog();
    return { saved: true };
  } catch (error) { return { error: message(error, 'Не удалось сохранить название. Попробуйте ещё раз.') }; }
}

export async function setCardHiddenAction(card: Card, hidden: boolean): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    await setCardHidden(admin.userId, admin.email, card, hidden);
    revalidateCatalog();
    return { saved: true };
  } catch (error) { return { error: message(error, 'Не удалось сохранить. Попробуйте ещё раз.') }; }
}

/** «Снят с производства» on a parser card, or back in production. */
export async function setCardDiscontinuedAction(card: Card, discontinued: boolean): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    await setCardDiscontinued(admin.userId, admin.email, card, discontinued);
    revalidateCatalog();
    revalidatePath('/profile', 'layout');
    return { saved: true };
  } catch (error) { return { error: message(error, 'Не удалось сохранить. Попробуйте ещё раз.') }; }
}

/** «Не дубль» / «Вкус верный»: the card leaves the neural network's queue. */
export async function dismissCardCheckAction(card: Card): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    await dismissCardCheck(admin.userId, admin.email, card);
    revalidatePath('/admin/drinks');
    return { saved: true };
  } catch { return { error: 'Не удалось сохранить. Попробуйте ещё раз.' }; }
}
