'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isUserBlocked } from '@/lib/moderation';
import { ensureOwnProfile } from '@/lib/profile';
import { MarketError, parseListing, type OrderStatus } from '@/lib/market-fields';
import { createListing, closeListing, deleteArchivedListing, startOrder, changeOrderStatus, sendMarketMessage, getOrder, getMessages, markMessagesRead } from '@/lib/market';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';

export interface MarketActionState { error?: string; id?: string; success?: boolean }
async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new MarketError('Войдите в аккаунт, чтобы продолжить.');
  if (await isUserBlocked(session.user.id)) throw new MarketError('Действия в маркете для этого аккаунта ограничены.');
  return session.user;
}
function failure(error: unknown): MarketActionState {
  return { error: error instanceof MarketError || error instanceof ReviewPhotoError ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.' };
}
export async function createListingAction(form: FormData): Promise<MarketActionState> {
  try {
    const user = await currentUser();
    const input = parseListing(form);
    const { photos } = await prepareReviewPhotos(form);
    await ensureOwnProfile(user);
    const id = await createListing(user.id, input, photos);
    revalidatePath('/market'); return { id };
  } catch (error) { return failure(error); }
}
export async function listingAction(id: string, operation: 'order' | 'close' | 'delete', quantity = 1): Promise<MarketActionState> {
  try {
    const user = await currentUser();
    if (operation === 'order') {
      await ensureOwnProfile(user);
      const orderId = await startOrder(user.id, id, quantity);
      revalidatePath('/market', 'layout'); revalidatePath('/messages'); return { id: orderId };
    }
    if (operation === 'delete') { await deleteArchivedListing(user.id, id); revalidatePath('/market', 'layout'); return { success: true }; }
    if (operation !== 'close') throw new MarketError('Неизвестное действие.');
    await closeListing(user.id, id); revalidatePath('/market', 'layout'); return { success: true };
  } catch (error) { return failure(error); }
}
export async function orderStatusAction(id: string, status: OrderStatus): Promise<MarketActionState> {
  try {
    const user = await currentUser(); await changeOrderStatus(user.id, id, status);
    revalidatePath('/market', 'layout'); revalidatePath('/messages', 'layout'); return { success: true };
  } catch (error) { return failure(error); }
}
export async function sendMessageAction(id: string, form: FormData): Promise<MarketActionState> {
  try {
    const user = await currentUser();
    if (!await getOrder(user.id, id)) throw new MarketError('Переписка недоступна.');
    const text = form.get('text');
    if (typeof text !== 'string' || text.length > 4000) throw new MarketError('Сообщение должно быть не длиннее 4000 символов.');
    const { photos } = await prepareReviewPhotos(form);
    await sendMarketMessage(user.id, id, text, photos);
    revalidatePath('/messages'); return { success: true };
  } catch (error) { return failure(error); }
}
export async function readMessagesAction(id: string, messageId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) await markMessagesRead(session.user.id, id, messageId);
}
export async function loadMessagesAction(id: string, before?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Сессия завершилась. Войдите снова.' };
  try {
    const order = await getOrder(session.user.id, id);
    if (!order) throw new MarketError('Переписка недоступна.');
    return { order, ...await getMessages(session.user.id, id, before) };
  } catch { return { error: 'Не удалось обновить сообщения. Проверьте соединение.' }; }
}
