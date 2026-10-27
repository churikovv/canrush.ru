'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireSiteAdmin } from '@/lib/admin';
import { auth } from '@/lib/auth';
import sharp from 'sharp';
import { answerBusinessInvite, inviteBusinessMember, leaveBusiness, moderateBusiness, moderateBusinessDrink, removeBusinessDrink, removeBusinessLogo, removeBusinessMember, requestBusinessDrink, saveBusiness, setBusinessLogo } from '@/lib/business';
import { getPool } from '@/db/pool';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';
import { encodeStillPhoto } from '@/lib/review-photos';
import { BusinessError, parseBusinessInput } from '@/lib/business-fields';
import { isFrozenError } from '@/lib/moderation';
import { ensureOwnProfile } from '@/lib/profile';

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
    await saveBusiness(user.id, parseBusinessInput(form));
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
  try { via = await inviteBusinessMember((await member()).id, String(form.get('target') ?? '')); }
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
