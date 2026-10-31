'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { BattleError, craftSpin, getBattleHome, moveBattle, startBattle, type BattleHome, type BattleMove, type BattleOpen } from '@/lib/battle';
import { BattleRuleError, parseBattleAction } from '@/lib/battle-engine';
import type { GachaState } from '@/lib/gacha';
import { auth } from '@/lib/auth';

async function member() {
  return (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;
}

const refusal = (error: unknown, fallback: string, log: string) => {
  if (error instanceof BattleError || error instanceof BattleRuleError) return { error: error.message };
  console.error(log, error);
  return { error: fallback };
};

/**
 * Свежее состояние при открытии экрана. Клиентский кэш переходов держит страницу 30 с, и без этого возврат из Банкомата
 * показывал бы старый стол или стартовый экран, хотя бой идёт.
 */
export async function battleResumeAction(): Promise<BattleHome | null> {
  const id = await member();
  return id ? getBattleHome(id) : null;
}

export type BattleStartState = { error: string } | BattleOpen;

export async function startBattleAction(): Promise<BattleStartState> {
  const id = await member();
  if (!id) return { error: 'Войдите, чтобы играть.' };
  try {
    const open = await startBattle(id);
    revalidatePath('/gacha');
    return open;
  } catch (error) { return refusal(error, 'Не удалось начать бой. Попробуйте ещё раз.', 'battle start failed'); }
}

export type BattleMoveState = { error: string } | BattleMove;

/** Один ход: что можно, а что нельзя, решает сервер. */
export async function battleMoveAction(battleId: unknown, value: unknown): Promise<BattleMoveState> {
  const id = await member();
  if (!id) return { error: 'Войдите снова.' };
  if (typeof battleId !== 'string' || !/^[0-9a-f-]{36}$/.test(battleId)) return { error: 'Такого боя нет.' };
  const action = value === 'surrender' ? { kind: 'surrender' as const } : parseBattleAction(value);
  if (!action) return { error: 'Такого хода нет.' };
  try {
    const move = await moveBattle(id, battleId, action);
    if (move.reward) revalidatePath('/gacha');
    return move;
  } catch (error) { return refusal(error, 'Ход не прошёл. Попробуйте ещё раз.', 'battle move failed'); }
}

export type SpinCraftState = { error: string } | { state: GachaState };

/** Собрать подарочную крутку из колечек. */
export async function craftSpinAction(): Promise<SpinCraftState> {
  const id = await member();
  if (!id) return { error: 'Войдите, чтобы собрать крутку.' };
  try {
    const state = await craftSpin(id);
    revalidatePath('/gacha');
    return { state };
  } catch (error) { return refusal(error, 'Не удалось собрать крутку. Попробуйте ещё раз.', 'spin craft failed'); }
}
