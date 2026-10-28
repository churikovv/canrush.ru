'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireSiteAdmin } from '@/lib/admin';
import { auth } from '@/lib/auth';
import sharp from 'sharp';
import { answerBusinessInvite, setBusinessMemberRole, deleteReplyTemplate, deleteReviewReply, getCabinet, saveReplyTemplate, type ReplyTemplate, inviteBusinessMember, replyToReview, leaveBusiness, moderateBusiness, moderateBusinessDrink, removeBusinessDrink, removeBusinessLogo, removeBusinessMember, requestBusinessDrink, saveBusiness, setBusinessLogo } from '@/lib/business';
import { getPool } from '@/db/pool';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';
import { encodeStillPhoto } from '@/lib/review-photos';
import { BusinessError, parseBusinessInput } from '@/lib/business-fields';
import { isFrozenError } from '@/lib/moderation';
import { ensureOwnProfile } from '@/lib/profile';
import { LEGAL_DETAILS } from '@/lib/legal';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { parseDrinkEdit } from '@/lib/brand-drink-edit-fields';
import { moderateDrinkEdit, requestDrinkEdit } from '@/lib/brand-drink-edits';
import { addCompetitor, removeCompetitor } from '@/lib/business-competitors';

export interface BusinessActionState { error?: string; done?: boolean }

const message = (error: unknown, fallback: string) => error instanceof BusinessError || isFrozenError(error) ? error.message : fallback;

async function member() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new BusinessError('Войдите в аккаунт.');
  await ensureOwnProfile(session.user);
  return session.user;
}

/** The company form: the first save is the application, later ones are the settings. */
export async function saveBusinessAction(_state: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  try {
    const user = await member();
    // The checkbox of the application form: the accepted edition of «Условия для бизнеса» is kept with the company.
    await saveBusiness(user.id, parseBusinessInput(form), form.get('terms') === 'on' ? LEGAL_DETAILS.businessTermsEffectiveDateIso : null);
  } catch (error) { return { error: message(error, 'Не удалось сохранить. Попробуйте ещё раз.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function requestBusinessDrinkAction(_state: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  try {
    const user = await member();
    const brand = String(form.get('brand') ?? ''), flavor = String(form.get('flavor') ?? '');
    if (!brand || !flavor) throw new BusinessError('Выберите напиток из каталога.');
    await requestBusinessDrink(user.id, brand, flavor);
  } catch (error) { return { error: message(error, 'Не удалось отправить заявку.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function removeBusinessDrinkAction(brand: string, flavor: string): Promise<BusinessActionState> {
  try { await removeBusinessDrink((await member()).id, brand, flavor); }
  catch (error) { return { error: message(error, 'Не удалось убрать напиток.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

/** The team's decision on a company; a refusal needs a reason the owner sees in the cabinet. */
export async function moderateBusinessAction(id: string, _state: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  try {
    const admin = await requireSiteAdmin();
    const status = form.get('status') === 'approved' ? 'approved' : 'rejected';
    await moderateBusiness(admin.userId, id, status, String(form.get('note') ?? ''));
  } catch (error) { return { error: message(error, 'Не удалось сохранить решение.') }; }
  revalidatePath('/admin/business');
  return { done: true };
}

export async function moderateBusinessDrinkAction(businessId: string, brand: string, flavor: string, _state: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  try {
    const admin = await requireSiteAdmin();
    const status = form.get('status') === 'approved' ? 'approved' : 'rejected';
    await moderateBusinessDrink(admin.userId, businessId, brand, flavor, status, String(form.get('note') ?? ''));
  } catch (error) { return { error: message(error, 'Не удалось сохранить решение.') }; }
  revalidatePath('/admin/business');
  return { done: true };
}

/** The company logo: any still JPEG/PNG/WebP, re-encoded to a 256×256 square. */
export async function uploadBusinessLogoAction(form: FormData): Promise<BusinessActionState> {
  try {
    const user = await member();
    const file = form.get('logo');
    if (!(file instanceof File) || !file.size) throw new BusinessError('Выберите картинку.');
    if (file.size > MAX_REVIEW_PHOTO_BYTES) throw new BusinessError('Картинка должна быть не больше 5 МБ.');
    if (!REVIEW_PHOTO_TYPES.includes(file.type)) throw new BusinessError('Выберите JPG, PNG или WebP.');
    let square: Buffer;
    try { square = await sharp((await encodeStillPhoto(Buffer.from(await file.arrayBuffer()))).data).resize(256, 256, { fit: 'cover' }).webp({ quality: 85 }).toBuffer(); }
    catch { throw new BusinessError('Не удалось прочитать картинку.'); }
    await setBusinessLogo(user.id, square);
  } catch (error) { return { error: message(error, 'Не удалось загрузить логотип.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function removeBusinessLogoAction(): Promise<BusinessActionState> {
  try { await removeBusinessLogo((await member()).id); }
  catch (error) { return { error: message(error, 'Не удалось убрать логотип.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function inviteBusinessMemberAction(_state: BusinessActionState & { via?: string }, form: FormData): Promise<BusinessActionState & { via?: string }> {
  let via: string;
  try { via = await inviteBusinessMember((await member()).id, String(form.get('target') ?? ''), undefined, form.get('role') === 'analyst' ? 'analyst' : 'manager'); }
  catch (error) { return { error: message(error, 'Не удалось пригласить.') }; }
  revalidatePath('/business/cabinet');
  return { done: true, via };
}

export async function removeBusinessMemberAction(key: string): Promise<BusinessActionState> {
  try { await removeBusinessMember((await member()).id, key); }
  catch (error) { return { error: message(error, 'Не удалось убрать участника.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function answerBusinessInviteAction(businessId: string, accept: boolean): Promise<BusinessActionState> {
  try { await answerBusinessInvite((await member()).id, businessId, accept); }
  catch (error) { return { error: message(error, 'Не удалось ответить на приглашение.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function leaveBusinessAction(): Promise<BusinessActionState> {
  try { await leaveBusiness((await member()).id); }
  catch (error) { return { error: message(error, 'Не удалось выйти из команды.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

/** «Новые отзывы на напитки компании» — the same preference table as the site's notification settings. */
export async function saveBusinessNotificationsAction(_state: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  try {
    const user = await member();
    await getPool().query(`insert into "notificationPreference"("userId", kind, enabled) values ($1, 'business-review', $2)
      on conflict ("userId", kind) do update set enabled = excluded.enabled`, [user.id, form.get('reviews') === 'on']);
  } catch (error) { return { error: message(error, 'Не удалось сохранить.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

/** A company reply to a review (replyToReview checks the company, the drink and the text); the drink page shows it. */
export async function replyReviewAction(reviewId: string, text: string): Promise<BusinessActionState> {
  try { await replyToReview((await member()).id, reviewId, text); }
  catch (error) { return { error: isFrozenError(error) ? error.message : message(error, 'Не удалось сохранить ответ.') }; }
  revalidatePath('/business/cabinet');
  revalidatePath('/catalog/[product]', 'page');
  return { done: true };
}

export async function deleteReviewReplyAction(reviewId: string): Promise<BusinessActionState> {
  try { await deleteReviewReply((await member()).id, reviewId); }
  catch (error) { return { error: message(error, 'Не удалось удалить ответ.') }; }
  revalidatePath('/business/cabinet');
  revalidatePath('/catalog/[product]', 'page');
  return { done: true };
}

/** The company of the member, approved: competitors and the like are part of the analytics. */
async function approvedCompany(userId: string) {
  const business = (await getCabinet(userId))?.business;
  if (!business || business.status !== 'approved') throw new BusinessError('Сравнение доступно подтверждённой компании.');
  return business;
}

/** «Конкуренты»: the owner or any teammate adds a catalog brand to compare with. */
export async function addCompetitorAction(_state: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  try { const user = await member(); await addCompetitor((await approvedCompany(user.id)).id, String(form.get('brand') ?? ''), user.id); }
  catch (error) { return { error: message(error, 'Не удалось добавить бренд.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function removeCompetitorAction(brand: string): Promise<BusinessActionState> {
  try { const user = await member(); await removeCompetitor((await approvedCompany(user.id)).id, brand, user.id); }
  catch (error) { return { error: message(error, 'Не удалось убрать бренд.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

/** The weekly report by email, on by default: the switch writes or removes the member's opt-out. */
export async function saveWeeklyReportAction(enabled: boolean): Promise<BusinessActionState> {
  try {
    const user = await member();
    if (enabled) await getPool().query(`delete from "businessReportOptOut" where "userId" = $1`, [user.id]);
    else await getPool().query(`insert into "businessReportOptOut"("userId") values ($1) on conflict do nothing`, [user.id]);
  } catch (error) { return { error: message(error, 'Не удалось сохранить.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

/** A reply template saved from the reply dialog, for the whole team. */
export async function saveReplyTemplateAction(title: string, text: string): Promise<BusinessActionState & { template?: ReplyTemplate }> {
  try { const template = await saveReplyTemplate((await member()).id, title, text); revalidatePath('/business/cabinet'); return { done: true, template }; }
  catch (error) { return { error: message(error, 'Не удалось сохранить шаблон.') }; }
}

export async function deleteReplyTemplateAction(id: string): Promise<BusinessActionState> {
  try { await deleteReplyTemplate((await member()).id, id); }
  catch (error) { return { error: message(error, 'Не удалось удалить шаблон.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

export async function setMemberRoleAction(key: string, role: string): Promise<BusinessActionState> {
  try { await setBusinessMemberRole((await member()).id, key, role); }
  catch (error) { return { error: message(error, 'Не удалось сменить роль.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

/** A proposed correction of a drink card: only the changed fields and an optional new photo of the can. */
export async function requestDrinkEditAction(form: FormData): Promise<BusinessActionState> {
  try {
    const user = await member();
    const { photos } = await prepareReviewPhotos(form);
    if (photos.length > 1) return { error: 'Добавьте одно фото банки.' };
    const input = parseDrinkEdit(form, photos.length > 0);
    await requestDrinkEdit(user.id, String(form.get('brand') ?? ''), String(form.get('flavor') ?? ''), input, photos[0]);
  } catch (error) { return { error: error instanceof ReviewPhotoError ? error.message : message(error, 'Не удалось отправить правку.') }; }
  revalidatePath('/business/cabinet');
  return { done: true };
}

/** The team's decision on a card edit; a refusal needs a reason the company sees. */
export async function moderateDrinkEditAction(id: string, _state: BusinessActionState, form: FormData): Promise<BusinessActionState> {
  try {
    const admin = await requireSiteAdmin();
    await moderateDrinkEdit(admin.userId, id, form.get('status') === 'approved' ? 'approved' : 'rejected', String(form.get('note') ?? ''));
  } catch (error) { return { error: message(error, 'Не удалось сохранить решение.') }; }
  revalidatePath('/admin/business'); revalidatePath('/catalog', 'layout'); revalidatePath('/business/cabinet');
  return { done: true };
}
