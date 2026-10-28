'use server';
import { revalidatePath } from 'next/cache';
import { requireSiteAdmin } from '@/lib/admin';
import { CatalogCardError, mergeCatalogCard, setCardFullName, setCardHidden, setCardPhoto } from '@/lib/catalog-card-edits';
import { parseCardFullName } from '@/lib/catalog-card-edit-fields';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { dismissCardCheck } from '@/lib/catalog-card-check';
import { storeDrinkOptions } from '@/lib/store-catalog';

/** «Карточки каталога» in /admin/drinks: the team's edits of the parser's cards (`catalogCardEdit`). */
export interface CardActionState { error?: string; saved?: boolean }
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
  } catch (error) { return { error: message(error, 'Не удалось склеить карточки.') }; }
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
  } catch (error) { return { error: message(error, 'Не удалось сохранить фото.') }; }
}

export async function setCardNameAction(card: Card, _previous: CardActionState, form: FormData): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    await setCardFullName(admin.userId, admin.email, card, parseCardFullName(form.get('fullName')));
    revalidateCatalog();
    return { saved: true };
  } catch (error) { return { error: message(error, 'Не удалось сохранить название.') }; }
}

export async function setCardHiddenAction(card: Card, hidden: boolean): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    await setCardHidden(admin.userId, admin.email, card, hidden);
    revalidateCatalog();
    return { saved: true };
  } catch (error) { return { error: message(error, 'Не удалось сохранить.') }; }
}

/** «Не дубль» / «Вкус верный»: the card leaves the neural network's queue. */
export async function dismissCardCheckAction(card: Card): Promise<CardActionState> {
  const admin = await requireSiteAdmin();
  try {
    await dismissCardCheck(admin.userId, admin.email, card);
    revalidatePath('/admin/drinks');
    return { saved: true };
  } catch { return { error: 'Не удалось сохранить.' }; }
}
