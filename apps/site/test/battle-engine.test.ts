import { describe, expect, it } from 'vitest';
import { applyAction, battleView, botAction, canAttack, createBattle, parseBattleAction, type BattleState, type HandCard, type Side } from '../src/lib/battle-engine';
import { BOARD_SIZE, DECK_SIZE, FIRST_HAND, HERO_HEALTH, MAX_MANA, SECOND_BONUS_HEALTH, SECOND_HAND, STARTER_CARDS, type BattleCardDef, type BattleKeyword } from '../src/lib/battle-fields';

const deck = [...STARTER_CARDS];
const battle = (seed = 1) => createBattle(seed, deck, deck);

const def = (cost: number, attack: number, health: number, keyword: BattleKeyword | null = null): BattleCardDef => ({ id: `t${cost}${attack}${health}`, brand: 'B', flavor: 'f', title: 'B', name: 'f', cover: '/c.jpg', rarity: 'common', cost, attack, health, keyword });

/** Бой с первым ходом участника, рукой на выбор и полной маной. */
function scene(hand: BattleCardDef[], mana = 8) {
  let seed = 0, state: BattleState;
  do { state = createBattle(seed++, deck, deck); } while (state.first !== 'me');
  state.me.mana = state.me.maxMana = mana;
  state.me.hand = hand.map((card, index) => ({ ...card, uid: `h${index}` })) as HandCard[];
  return state;
}
const play = (state: BattleState, side: Side, card: string) => applyAction(state, side, { kind: 'play', card });
function board(state: BattleState, side: Side, card: BattleCardDef) {
  const uid = `b${state[side].board.length}${side}`;
  const active = state.active;
  state.active = side;
  state[side].mana = 99;
  state[side].hand.push({ ...card, uid });
  play(state, side, uid);
  state.active = active;
  const unit = state[side].board.at(-1)!;
  unit.sleeping = false;
  unit.rushing = false;
  return unit;
}

describe('start of a battle', () => {
  it('is the same for the same seed', () => {
    expect(battle(42)).toEqual(battle(42));
  });

  it('gives the second player a card, the coin and health', () => {
    const state = battle(3);
    const first = state[state.first], second = state[state.first === 'me' ? 'rival' : 'me'];
    expect(first.hand).toHaveLength(FIRST_HAND + 1);
    expect(second.hand).toHaveLength(SECOND_HAND);
    expect(second.coin).toBe(true);
    expect(first.coin).toBe(false);
    expect(first.health).toBe(HERO_HEALTH);
    expect(second.health).toBe(HERO_HEALTH + SECOND_BONUS_HEALTH);
    expect(first.mana).toBe(1);
  });

  it('refuses a deck of the wrong size', () => {
    expect(() => createBattle(1, deck.slice(1), deck)).toThrow('15 карт');
  });
});

describe('rules', () => {
  it('spends mana, stops at the board limit and refuses a turn out of order', () => {
    const state = scene(Array.from({ length: BOARD_SIZE + 1 }, () => def(1, 1, 1)));
    for (let index = 0; index < BOARD_SIZE; index++) play(state, 'me', `h${index}`);
    expect(state.me.mana).toBe(8 - BOARD_SIZE);
    expect(() => play(state, 'me', `h${BOARD_SIZE}`)).toThrow('нет места');
    expect(() => applyAction(state, 'rival', { kind: 'end' })).toThrow('ход соперника');
    const poor = scene([def(5, 1, 1)], 2);
    expect(() => play(poor, 'me', 'h0')).toThrow('Не хватает маны');
  });

  it('grows mana to the limit and wakes the board each turn', () => {
    const state = scene([def(1, 2, 2)], 1);
    play(state, 'me', 'h0');
    expect(state.me.board[0]!.sleeping).toBe(true);
    expect(() => applyAction(state, 'me', { kind: 'attack', attacker: state.me.board[0]!.uid, target: 'hero' })).toThrow('следующем ходу');
    for (let turn = 0; turn < 22; turn++) {
      if (state.winner) break;
      state.me.health = state.rival.health = 99;
      applyAction(state, state.active, { kind: 'end' });
    }
    expect(state.me.maxMana).toBe(MAX_MANA);
    expect(canAttack(state.me.board[0]!) || state.active === 'rival').toBe(true);
  });

  it('makes attackers hit a discussed can first', () => {
    const state = scene([]);
    const attacker = board(state, 'me', def(2, 3, 3));
    const other = board(state, 'rival', def(2, 1, 1));
    const taunt = board(state, 'rival', def(2, 1, 5, 'taunt'));
    expect(() => applyAction(state, 'me', { kind: 'attack', attacker: attacker.uid, target: 'hero' })).toThrow('Обсуждаемую');
    expect(() => applyAction(state, 'me', { kind: 'attack', attacker: attacker.uid, target: other.uid })).toThrow('Обсуждаемую');
    applyAction(state, 'me', { kind: 'attack', attacker: attacker.uid, target: taunt.uid });
    expect(taunt.health).toBe(2);
    expect(attacker.health).toBe(2);
    expect(() => applyAction(state, 'me', { kind: 'attack', attacker: attacker.uid, target: taunt.uid })).toThrow('уже била');
  });

  it('lets an S-tier can shrug off the first blow only', () => {
    const state = scene([]);
    const attacker = board(state, 'me', def(2, 3, 3));
    const second = board(state, 'me', def(2, 3, 3));
    const shielded = board(state, 'rival', def(2, 1, 4, 'shield'));
    const blocked = applyAction(state, 'me', { kind: 'attack', attacker: attacker.uid, target: shielded.uid });
    expect(blocked.kind === 'attack' && blocked.hits[0]).toMatchObject({ amount: 0, blocked: true });
    expect(shielded.health).toBe(4);
    applyAction(state, 'me', { kind: 'attack', attacker: second.uid, target: shielded.uid });
    expect(shielded.health).toBe(1);
  });

  it('lets a light can hit cans at once but not the hero', () => {
    const state = scene([def(1, 2, 2, 'rush')]);
    const enemy = board(state, 'rival', def(1, 1, 1));
    play(state, 'me', 'h0');
    const unit = state.me.board[0]!;
    expect(canAttack(unit)).toBe(true);
    expect(() => applyAction(state, 'me', { kind: 'attack', attacker: unit.uid, target: 'hero' })).toThrow('нельзя');
    applyAction(state, 'me', { kind: 'attack', attacker: unit.uid, target: enemy.uid });
    expect(state.rival.board).toHaveLength(0);
  });

  it('leaves a 1/1 after a loyal can, even for the side that attacked', () => {
    const state = scene([]);
    const attacker = board(state, 'me', def(2, 3, 2, 'loyal'));
    const enemy = board(state, 'rival', def(2, 3, 3));
    applyAction(state, 'me', { kind: 'attack', attacker: attacker.uid, target: enemy.uid });
    expect(state.me.board).toHaveLength(1);
    expect(state.me.board[0]).toMatchObject({ attack: 1, health: 1, sleeping: true });
  });

  it('gives the strongest ally +1/+1 for a match', () => {
    const state = scene([def(1, 1, 1, 'match')]);
    const weak = board(state, 'me', def(1, 1, 1));
    const strong = board(state, 'me', def(3, 4, 2));
    const event = play(state, 'me', 'h0');
    expect(event).toMatchObject({ kind: 'play', buffed: strong.uid });
    expect(strong).toMatchObject({ attack: 5, health: 3, maxHealth: 3 });
    expect(weak.attack).toBe(1);
  });

  it('uses the hero power and the coin once', () => {
    const state = scene([]);
    state.me.coin = true;
    const health = state.rival.health;
    applyAction(state, 'me', { kind: 'power' });
    expect(state.rival.health).toBe(health - 1);
    expect(() => applyAction(state, 'me', { kind: 'power' })).toThrow('уже использована');
    applyAction(state, 'me', { kind: 'coin' });
    expect(state.me.mana).toBe(7);
    expect(() => applyAction(state, 'me', { kind: 'coin' })).toThrow('Монетки нет');
  });

  it('hurts for drawing from an empty deck, more each time, and ends the battle at zero', () => {
    const state = scene([]);
    state.rival.deck = [];
    state.rival.health = 3;
    applyAction(state, 'me', { kind: 'end' });
    expect(state.rival.health).toBe(2);
    applyAction(state, 'rival', { kind: 'end' });
    applyAction(state, 'me', { kind: 'end' });
    expect(state.rival.health).toBe(0);
    expect(state.winner).toBe('me');
    expect(() => applyAction(state, 'rival', { kind: 'end' })).toThrow('закончился');
  });
});

describe('view', () => {
  it('never shows the rival hand, the decks or the seed', () => {
    const state = battle(5);
    const view = battleView(state);
    expect(view.rival.handLeft).toBe(state.rival.hand.length);
    const text = JSON.stringify(view);
    expect(text).not.toContain('rng');
    for (const card of [...state.rival.hand, ...state.rival.deck, ...state.me.deck]) expect(text).not.toContain(`"uid":"${card.uid}"`);
    expect(view.hand).toEqual(state.me.hand);
    expect(view.me.deckLeft + view.hand.length).toBe(DECK_SIZE);
  });
});

describe('parseBattleAction', () => {
  it('passes only known actions with short ids', () => {
    expect(parseBattleAction({ kind: 'play', card: 'u1' })).toEqual({ kind: 'play', card: 'u1' });
    expect(parseBattleAction({ kind: 'attack', attacker: 'u1', target: 'hero', extra: 1 })).toEqual({ kind: 'attack', attacker: 'u1', target: 'hero' });
    expect(parseBattleAction({ kind: 'end' })).toEqual({ kind: 'end' });
    for (const bad of [null, 'end', {}, { kind: 'cheat' }, { kind: 'play' }, { kind: 'play', card: 1 }, { kind: 'attack', attacker: 'x'.repeat(21), target: 'hero' }]) expect(parseBattleAction(bad)).toBeNull();
  });
});

/** Баланс: бот играет сам с собой. Числа — те же, что в плане, и падают, если правила или формулы их сломают. */
describe('balance of the starter decks', () => {
  const games = Array.from({ length: 1500 }, (_, seed) => {
    const state = createBattle(seed + 1, deck, deck);
    let moves = 0;
    while (!state.winner && moves++ < 400) applyAction(state, state.active, botAction(state, state.active));
    return { state, moves };
  });

  it('always finishes', () => {
    for (const { state } of games) expect(state.winner).not.toBeNull();
  });

  it('stays short enough for a phone', () => {
    const turns = games.map(({ state }) => state.turn).sort((a, b) => a - b);
    const average = turns.reduce((sum, turn) => sum + turn, 0) / turns.length;
    expect(average).toBeGreaterThan(10);
    expect(average).toBeLessThan(22);
  });

  it('keeps the first move from deciding the game', () => {
    const wins = games.filter(({ state }) => state.winner === state.first).length / games.length;
    expect(wins).toBeGreaterThan(0.42);
    expect(wins).toBeLessThan(0.62);
  });
});
