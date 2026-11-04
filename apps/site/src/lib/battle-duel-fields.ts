/**
 * Битва банок с другом: правила без базы. Тот же движок, что у боя с Совой; хозяин вызова играет `me`, гость — `rival`.
 * На ход даётся `TURN_SECONDS`; кто не уложился, за того ход заканчивает сервер, а `MISSED_LIMIT` пропусков подряд —
 * поражение, иначе ушедший соперник держал бы второго за столом бесконечно.
 */
import { applyAction, otherSide, type BattleEvent, type BattleState, type Side } from '@/lib/battle-engine';

export const TURN_SECONDS = 75;
export const TURN_MS = TURN_SECONDS * 1000;
/** Пропущенных подряд ходов до поражения. */
export const MISSED_LIMIT = 2;
/** Сколько живёт вызов, который никто не принял. */
export const INVITE_HOURS = 24;
/** Скольких друзей можно позвать в один вызов. */
export const INVITES_PER_DUEL = 10;
/** Сколько событий боя хранит строка: клиент, который отстал сильнее, просто получает стол целиком. */
export const LOG_SIZE = 40;

export type DuelRole = 'host' | 'guest';
export type DuelEndReason = 'hero' | 'surrender' | 'timeout';
export const roleSide = (role: DuelRole): Side => (role === 'host' ? 'me' : 'rival');
export const sideRole = (side: Side): DuelRole => (side === 'me' ? 'host' : 'guest');

/** Cookie гостя, который открыл вызов без входа: после входа `/profile` ведёт обратно к вызову. */
export const DUEL_COOKIE = 'canrush-duel';

/** Код ссылки вызова: 12 символов base64url. */
export const DUEL_CODE_PATTERN = /^[A-Za-z0-9_-]{12}$/;
export const isDuelCode = (value: unknown): value is string => typeof value === 'string' && DUEL_CODE_PATTERN.test(value);

/** Событие журнала дуэли: ход движка или конец боя не за столом. Стороны записаны глазами хозяина. */
export type DuelEvent = BattleEvent | { kind: 'surrender'; side: Side } | { kind: 'timeout'; side: Side };
export interface DuelLogEntry { seq: number; event: DuelEvent }

export interface DuelClock { turnEndsAt: number; missed: Record<Side, number> }

/**
 * Догоняет часы: пока срок хода прошёл, ход за опоздавшего заканчивается, а пропуск записывается ему. Срок следующего
 * хода считается от прошлого срока, а не от «сейчас», поэтому вернувшийся через десять минут видит честную цепочку.
 * Меняет `state` и `clock` на месте и возвращает события по порядку.
 */
export function settleClock(state: BattleState, clock: DuelClock, now: number): { events: DuelEvent[]; timedOut: Side | null } {
  const events: DuelEvent[] = [];
  let timedOut: Side | null = null;
  for (let step = 0; step < 2 * MISSED_LIMIT + 2 && !state.winner && now >= clock.turnEndsAt; step++) {
    const side = state.active;
    clock.missed[side]++;
    if (clock.missed[side] >= MISSED_LIMIT) {
      state.winner = otherSide(side);
      timedOut = side;
      events.push({ kind: 'timeout', side });
      break;
    }
    events.push(applyAction(state, side, { kind: 'end' }));
    clock.turnEndsAt += TURN_MS;
  }
  return { events, timedOut };
}

/** Новые записи журнала после `after`; `null`, если клиент отстал дальше, чем помнит журнал. */
export function entriesAfter(log: readonly DuelLogEntry[], after: number): DuelLogEntry[] | null {
  if (!log.length) return [];
  if (after < log[0]!.seq - 1) return null;
  return log.filter(entry => entry.seq > after);
}

/** Как закончился бой — словами для итогового окна, глазами того, кто его читает. */
export function duelEndText(won: boolean, reason: DuelEndReason | null, rival: string): string {
  if (reason === 'surrender') return won ? `${rival} сдаётся.` : 'Вы сдались.';
  if (reason === 'timeout') return won ? `${rival} пропускает ${MISSED_LIMIT} хода подряд.` : `Вы пропустили ${MISSED_LIMIT} хода подряд.`;
  return won ? `Здоровье ${rival} закончилось.` : 'Ваше здоровье закончилось.';
}
