'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { parseTradeCards } from '@/lib/card-trade-fields';
import { answerTrade, cancelTrade, proposeTrade, TradeError } from '@/lib/card-trades';

async function member() {
  return (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;
}

const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
const refusal = (error: unknown, fallback: string, log: string) => {
  if (error instanceof TradeError) return { error: error.message };
  console.error(log, error);
  return { error: fallback };
};
/** A trade changes both collections and the trades screen. */
function refresh() {
  revalidatePath('/gacha/trades');
  revalidatePath('/profile/[username]/cards', 'page');
}

/** A new offer: the cards are checked on the server again, the client only picks them. */
export async function proposeTradeAction(partnerId: unknown, give: unknown, take: unknown): Promise<{ error: string } | { id: string }> {
  const id = await member();
  if (!id) return { error: 'Войдите, чтобы меняться карточками.' };
  const gives = parseTradeCards(give);
  const takes = parseTradeCards(take);
  if (typeof partnerId !== 'string' || !partnerId || !gives || !takes) return { error: 'Выберите карточки с обеих сторон.' };
  try {
    const result = await proposeTrade(id, partnerId, gives, takes);
    refresh();
    return result;
  } catch (error) { return refusal(error, 'Не удалось отправить предложение. Попробуйте ещё раз.', 'card trade propose failed'); }
}

export async function answerTradeAction(tradeId: unknown, accept: unknown): Promise<{ error?: string }> {
  const id = await member();
  if (!id) return { error: 'Войдите, чтобы ответить на обмен.' };
  if (!isId(tradeId) || typeof accept !== 'boolean') return { error: 'Такого предложения нет.' };
  try {
    await answerTrade(id, tradeId, accept);
    refresh();
    return {};
  } catch (error) { return refusal(error, 'Не удалось ответить на обмен. Попробуйте ещё раз.', 'card trade answer failed'); }
}

export async function cancelTradeAction(tradeId: unknown): Promise<{ error?: string }> {
  const id = await member();
  if (!id || !isId(tradeId)) return { error: 'Такого предложения нет.' };
  try {
    await cancelTrade(id, tradeId);
    refresh();
    return {};
  } catch (error) { return refusal(error, 'Не удалось отменить предложение. Попробуйте ещё раз.', 'card trade cancel failed'); }
}
