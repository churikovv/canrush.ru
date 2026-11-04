import { describe, expect, it } from 'vitest';
import { MISSED_LIMIT, TURN_MS, duelEndText, entriesAfter, isDuelCode, settleClock, type DuelClock } from '../src/lib/battle-duel-fields.js';
import { applyAction, battleEventFor, battleView, battleViewFor, createBattle, type BattleState } from '../src/lib/battle-engine.js';
import { STARTER_CARDS } from '../src/lib/battle-fields.js';

const deck = () => Array.from({ length: 15 }, (_, index) => STARTER_CARDS[index % STARTER_CARDS.length]!);
const battle = (): BattleState => createBattle(42, deck(), deck());

describe('the duel table, seen from either side', () => {
  it('turns the table round for the guest: their hand, their hero below, their turn', () => {
    const state = battle();
    const host = battleViewFor(state, 'me'), guest = battleViewFor(state, 'rival');
    expect(host).toEqual(battleView(state));
    expect(guest.hand).toEqual(state.rival.hand);
    expect(guest.me.health).toBe(state.rival.health);
    expect(guest.rival.handLeft).toBe(state.me.hand.length);
    expect(guest.active).toBe(state.active === 'me' ? 'rival' : 'me');
    expect(JSON.stringify(guest)).not.toContain(JSON.stringify(state.me.hand[0]));
  });

  it('turns events round too: the side and the heroes swap, the cans keep their ids', () => {
    const state = battle();
    state.me.mana = 2; state.active = 'me';
    const power = applyAction(state, 'me', { kind: 'power' });
    expect(battleEventFor(power, 'rival')).toMatchObject({ kind: 'power', side: 'rival', hits: [{ target: 'hero:me' }] });
    expect(battleEventFor(power, 'me')).toBe(power);
  });
});

describe('the turn clock', () => {
  const clock = (turnEndsAt: number): DuelClock => ({ turnEndsAt, missed: { me: 0, rival: 0 } });

  it('does nothing before the deadline', () => {
    const state = battle(), turns = state.turn;
    expect(settleClock(state, clock(1000), 999)).toEqual({ events: [], timedOut: null });
    expect(state.turn).toBe(turns);
  });

  it('ends a late turn for the player and counts it as missed', () => {
    const state = battle(), first = state.active, time = clock(1000);
    const { events, timedOut } = settleClock(state, time, 1000);
    expect(timedOut).toBeNull();
    expect(events).toMatchObject([{ kind: 'turn' }]);
    expect(state.active).not.toBe(first);
    expect(time.missed[first]).toBe(1);
    expect(time.turnEndsAt).toBe(1000 + TURN_MS);
  });

  it(`gives the fight away after ${MISSED_LIMIT} missed turns in a row, counting from the first who left`, () => {
    const state = battle(), first = state.active, time = clock(0);
    const { events, timedOut } = settleClock(state, time, 60 * TURN_MS);
    expect(timedOut).toBe(first);
    expect(state.winner).toBe(first === 'me' ? 'rival' : 'me');
    expect(events.at(-1)).toEqual({ kind: 'timeout', side: first });
  });
});

describe('the duel log and words', () => {
  it('hands out what came after the client, or nothing when it fell too far behind', () => {
    const log = [3, 4, 5].map(seq => ({ seq, event: { kind: 'coin' as const, side: 'me' as const } }));
    expect(entriesAfter(log, 4)?.map(entry => entry.seq)).toEqual([5]);
    expect(entriesAfter(log, 2)?.map(entry => entry.seq)).toEqual([3, 4, 5]);
    expect(entriesAfter(log, 1)).toBeNull();
    expect(entriesAfter([], 7)).toEqual([]);
  });

  it('checks the link code and tells how the fight ended', () => {
    expect(isDuelCode('abcDEF123_-x')).toBe(true);
    expect(isDuelCode('short')).toBe(false);
    expect(duelEndText(true, 'surrender', '@rival')).toBe('@rival сдаётся.');
    expect(duelEndText(false, 'timeout', '@rival')).toBe(`Вы пропустили ${MISSED_LIMIT} хода подряд.`);
  });
});
