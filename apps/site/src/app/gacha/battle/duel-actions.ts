'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { BattleError } from '@/lib/battle';
import { cancelDuel, createDuel, duelStatus, inviteToDuel, joinDuel, moveDuel, pollDuel, rematchDuel, type DuelSync } from '@/lib/battle-duel';
import { isDuelCode } from '@/lib/battle-duel-fields';
import { BattleRuleError, parseBattleAction } from '@/lib/battle-engine';

async function member() {
  return (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;
}

const refusal = (error: unknown, fallback: string, log: string) => {
  if (error instanceof BattleError || error instanceof BattleRuleError) return { error: error.message };
  console.error(log, error);
  return { error: fallback };
};

const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
const isSeq = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Вызов другу: новая ссылка или та, что уже есть. */
export async function createDuelAction(): Promise<{ error: string } | { code: string }> {
  const id = await member();
  if (!id) return { error: 'Войдите, чтобы позвать друга.' };
  try { return await createDuel(id); } catch (error) { return refusal(error, 'Не удалось создать вызов. Попробуйте ещё раз.', 'duel create failed'); }
}

export async function cancelDuelAction(code: unknown): Promise<{ error?: string }> {
  const id = await member();
  if (!id || !isDuelCode(code)) return { error: 'Такого вызова нет.' };
  await cancelDuel(id, code);
  revalidatePath('/gacha/battle');
  return {};
}

export async function joinDuelAction(code: unknown): Promise<{ error?: string }> {
  const id = await member();
  if (!id) return { error: 'Войдите, чтобы принять вызов.' };
  if (!isDuelCode(code)) return { error: 'Такого вызова нет.' };
  try { await joinDuel(id, code); return {}; } catch (error) { return refusal(error, 'Не удалось принять вызов. Попробуйте ещё раз.', 'duel join failed'); }
}

/** Комната ожидания спрашивает, принял ли кто-нибудь вызов. */
export async function duelStatusAction(code: unknown): Promise<string | null> {
  return isDuelCode(code) ? duelStatus(code) : null;
}

export async function inviteFriendAction(code: unknown, friendId: unknown): Promise<{ error?: string }> {
  const id = await member();
  if (!id || !isDuelCode(code) || typeof friendId !== 'string' || friendId.length > 64) return { error: 'Такого вызова нет.' };
  try { await inviteToDuel(id, code, friendId); return {}; } catch (error) { return refusal(error, 'Не удалось позвать друга. Попробуйте ещё раз.', 'duel invite failed'); }
}

export type DuelSyncState = { error: string } | DuelSync;

/** Ход в дуэли: что можно, решает сервер, ответ — события после `after` и стол целиком. */
export async function duelMoveAction(duelId: unknown, value: unknown, after: unknown): Promise<DuelSyncState> {
  const id = await member();
  if (!id) return { error: 'Войдите снова.' };
  if (!isId(duelId) || !isSeq(after)) return { error: 'Такого боя нет.' };
  const action = value === 'surrender' ? { kind: 'surrender' as const } : parseBattleAction(value);
  if (!action) return { error: 'Такого хода нет.' };
  try { return await moveDuel(id, duelId, action, after); } catch (error) { return refusal(error, 'Ход не прошёл. Попробуйте ещё раз.', 'duel move failed'); }
}

/** Опрос стола, пока ходит соперник. */
export async function duelPollAction(duelId: unknown, after: unknown): Promise<DuelSyncState> {
  const id = await member();
  if (!id) return { error: 'Войдите снова.' };
  if (!isId(duelId) || !isSeq(after)) return { error: 'Такого боя нет.' };
  try { return await pollDuel(id, duelId, after); } catch (error) { return refusal(error, 'Связь пропала.', 'duel poll failed'); }
}

/** Реванш: новый вызов тому же сопернику. */
export async function rematchAction(duelId: unknown): Promise<{ error: string } | { code: string }> {
  const id = await member();
  if (!id || !isId(duelId)) return { error: 'Такого боя нет.' };
  try { return await rematchDuel(id, duelId); } catch (error) { return refusal(error, 'Не удалось позвать на реванш.', 'duel rematch failed'); }
}
