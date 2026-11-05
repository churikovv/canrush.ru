'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  ChatError, chatMessages, deleteOwnChatMessage, leaveChatPresence, loadChat, sendChatMessage, toggleChatReaction,
  type ChatLoad, type ChatPage, type ChatReaction,
} from '@/lib/community-chat';
import { isChatId } from '@/lib/community-chat-fields';
import { isMemberBlockedError, MEMBER_BLOCKED_MESSAGE } from '@/lib/member-blocks';
import { frozenMessage, isFrozenError, isUserBlocked } from '@/lib/moderation';
import { ReviewPhotoError } from '@/lib/review-photos';
import { drinkFromForm } from '@/lib/wall-drink-fields';
import { prepareWallMedia } from '@/lib/wall-media';

async function sessionUser() {
  return (await auth.api.getSession({ headers: await headers() }))?.user ?? null;
}
const OFFLINE = 'Не удалось загрузить чат. Проверьте интернет — сообщения обновятся сами.';

/** «Показать предыдущие»: the page before the oldest message the panel holds. */
export async function olderChatAction(before: { id: string; createdAt: string }): Promise<ChatPage | { error: string }> {
  try {
    if (!before || !isChatId(before.id) || typeof before.createdAt !== 'string' || Number.isNaN(Date.parse(before.createdAt))) return { error: 'Не удалось загрузить сообщения. Обновите страницу.' };
    const user = await sessionUser();
    return await chatMessages(user?.id ?? null, { id: before.id, createdAt: new Date(before.createdAt).toISOString() });
  } catch (error) { return { error: error instanceof ChatError ? error.message : OFFLINE }; }
}

/**
 * A new message as a form: `text`, optional `replyToId`, attachments (`photos`, `videoPoster`) and a drink (`drinkBrand`,
 * `drinkFlavor`). Answers with the newest page too, so the panel shows the message without waiting for its next poll.
 * The polling itself is `GET /api/chat`, not an action: Next runs actions one at a time.
 */
export async function sendChatAction(form: FormData): Promise<{ error?: string; id?: string; chat?: ChatLoad; signIn?: boolean }> {
  const user = await sessionUser().catch(() => null);
  if (!user) return { error: 'Войдите, чтобы писать в чат.', signIn: true };
  try {
    if (!(form instanceof FormData)) return { error: 'Сообщение не отправлено. Попробуйте ещё раз.' };
    if (await isUserBlocked(user.id)) return { error: 'Писать в чат этому аккаунту нельзя.' };
    const frozen = await frozenMessage(user.id);
    if (frozen) return { error: frozen };
    const text = form.get('text'), replyToId = form.get('replyToId');
    if ((text !== null && typeof text !== 'string') || (replyToId !== null && typeof replyToId !== 'string')) return { error: 'Сообщение не отправлено. Попробуйте ещё раз.' };
    const id = await sendChatMessage(user.id, { text: text ?? '', replyToId: replyToId || null, media: await prepareWallMedia(form), drink: drinkFromForm(form) });
    // The message is in; a failed page only means the panel picks it up on its next poll.
    return { id, chat: await loadChat(user.id).catch(() => undefined) };
  } catch (error) {
    if (isMemberBlockedError(error)) return { error: MEMBER_BLOCKED_MESSAGE };
    if (isFrozenError(error)) return { error: await frozenMessage(user.id).catch(() => null) ?? 'Аккаунт заморожен модератором — писать пока нельзя.' };
    if (error instanceof ChatError || error instanceof ReviewPhotoError) return { error: error.message };
    return { error: 'Сообщение не отправлено. Текст остался в поле — попробуйте ещё раз.' };
  }
}

export async function deleteChatMessageAction(id: string): Promise<{ error?: string }> {
  const user = await sessionUser().catch(() => null);
  if (!user) return { error: 'Войдите, чтобы удалять свои сообщения.' };
  try {
    if (!await deleteOwnChatMessage(user.id, id)) return { error: 'Сообщение уже удалено.' };
    return {};
  } catch { return { error: 'Не удалось удалить. Попробуйте ещё раз.' }; }
}

/** A reaction pressed under a message: on, or off when it was the viewer's already. */
export async function reactChatAction(id: string, emoji: string): Promise<{ reactions?: ChatReaction[]; error?: string; signIn?: boolean }> {
  const user = await sessionUser().catch(() => null);
  if (!user) return { error: 'Войдите, чтобы ставить реакции.', signIn: true };
  try {
    if (await isUserBlocked(user.id)) return { error: 'Реакции для этого аккаунта недоступны.' };
    return { reactions: await toggleChatReaction(user.id, id, emoji) };
  } catch (error) {
    if (isMemberBlockedError(error)) return { error: MEMBER_BLOCKED_MESSAGE };
    return { error: error instanceof ChatError ? error.message : 'Реакция не сохранилась. Попробуйте ещё раз.' };
  }
}

/** The panel closed: the member leaves the header's list right away instead of in half a minute. */
export async function leaveChatAction(): Promise<void> {
  try { const user = await sessionUser(); if (user) await leaveChatPresence(user.id); } catch { /* presence is best effort */ }
}
