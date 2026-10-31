/**
 * Движок «Битвы банок»: чистые функции над состоянием, без базы и `Math.random` — случайность идёт из зерна в самом
 * состоянии, поэтому бой можно повторить и проверить. Решает только сервер, клиент получает `battleView` без руки
 * соперника и порядка колоды.
 */
import {
  BOARD_SIZE, DECK_SIZE, FIRST_HAND, HAND_SIZE, HERO_HEALTH, HERO_POWER_COST, HERO_POWER_DAMAGE, LOYAL_TOKEN, MAX_MANA,
  SECOND_BONUS_HEALTH, SECOND_HAND, type BattleCardDef,
} from '@/lib/battle-fields';

export type Side = 'me' | 'rival';
export const otherSide = (side: Side): Side => (side === 'me' ? 'rival' : 'me');

export interface HandCard extends BattleCardDef { uid: string }
export interface Unit {
  uid: string; card: BattleCardDef; attack: number; health: number; maxHealth: number; shield: boolean;
  /** Вышла в этот ход и ещё не бьёт */ sleeping: boolean;
  /** «Лёгкая» в свой первый ход: бьёт только банки */ rushing: boolean;
  attacked: boolean;
}
export interface HeroState {
  health: number; maxHealth: number; mana: number; maxMana: number; coin: boolean; powerUsed: boolean; fatigue: number;
  hand: HandCard[]; deck: HandCard[]; board: Unit[];
}
export interface BattleState { rng: number; nextUid: number; turn: number; active: Side; first: Side; winner: Side | null; me: HeroState; rival: HeroState }

export type BattleAction =
  | { kind: 'play'; card: string }
  | { kind: 'attack'; attacker: string; target: string }
  | { kind: 'power' } | { kind: 'coin' } | { kind: 'end' };

/** `target` — uid банки или `hero:me`/`hero:rival`. */
export interface BattleHit { target: string; amount: number; blocked: boolean; dead: boolean }
export type BattleEvent =
  | { kind: 'play'; side: Side; card: BattleCardDef; uid: string; buffed: string | null }
  | { kind: 'attack'; side: Side; attacker: string; target: string; hits: BattleHit[] }
  | { kind: 'power'; side: Side; hits: BattleHit[] }
  | { kind: 'coin'; side: Side }
  | { kind: 'turn'; side: Side; drew: boolean; fatigue: number };

export class BattleRuleError extends Error {}

const HERO_TARGET = 'hero';

/** mulberry32: состояние генератора — обычное число в JSON боя. */
function random(state: BattleState, max: number) {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) % max;
}

const nextUid = (state: BattleState) => `u${state.nextUid++}`;

function shuffled<T>(state: BattleState, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = random(state, index + 1);
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

function hero(state: BattleState, deck: readonly BattleCardDef[], second: boolean): HeroState {
  const cards = shuffled(state, deck).map(card => ({ ...card, uid: nextUid(state) }));
  const health = HERO_HEALTH + (second ? SECOND_BONUS_HEALTH : 0);
  const size = second ? SECOND_HAND : FIRST_HAND;
  return { health, maxHealth: health, mana: 0, maxMana: 0, coin: second, powerUsed: false, fatigue: 0, hand: cards.slice(0, size), deck: cards.slice(size), board: [] };
}

function draw(side: HeroState): { drew: boolean; fatigue: number } {
  const card = side.deck.shift();
  if (card) {
    // A full hand burns the card, as in the original game.
    if (side.hand.length >= HAND_SIZE) return { drew: false, fatigue: 0 };
    side.hand.push(card);
    return { drew: true, fatigue: 0 };
  }
  side.fatigue++;
  side.health -= side.fatigue;
  return { drew: false, fatigue: side.fatigue };
}

function startTurn(state: BattleState, side: Side): BattleEvent {
  const me = state[side];
  state.turn++;
  state.active = side;
  me.maxMana = Math.min(MAX_MANA, me.maxMana + 1);
  me.mana = me.maxMana;
  me.powerUsed = false;
  for (const unit of me.board) { unit.sleeping = false; unit.rushing = false; unit.attacked = false; }
  const { drew, fatigue } = draw(me);
  checkWinner(state);
  return { kind: 'turn', side, drew, fatigue };
}

function checkWinner(state: BattleState) {
  if (state.winner) return;
  if (state.me.health <= 0) state.winner = 'rival';
  else if (state.rival.health <= 0) state.winner = 'me';
}

export function createBattle(seed: number, myDeck: readonly BattleCardDef[], rivalDeck: readonly BattleCardDef[]): BattleState {
  if (myDeck.length !== DECK_SIZE || rivalDeck.length !== DECK_SIZE) throw new BattleRuleError('В колоде должно быть 15 карт.');
  const state = { rng: seed | 0, nextUid: 1, turn: 0, active: 'me', first: 'me', winner: null } as unknown as BattleState;
  state.first = random(state, 2) ? 'me' : 'rival';
  state.me = hero(state, myDeck, state.first !== 'me');
  state.rival = hero(state, rivalDeck, state.first !== 'rival');
  startTurn(state, state.first);
  return state;
}

function summon(state: BattleState, side: Side, card: BattleCardDef, uid: string): Unit {
  const unit: Unit = {
    uid, card, attack: card.attack, health: card.health, maxHealth: card.health, shield: card.keyword === 'shield',
    sleeping: card.keyword !== 'rush', rushing: card.keyword === 'rush', attacked: false,
  };
  state[side].board.push(unit);
  return unit;
}

function hitUnit(unit: Unit, amount: number): BattleHit {
  if (amount > 0 && unit.shield) {
    unit.shield = false;
    return { target: unit.uid, amount: 0, blocked: true, dead: false };
  }
  unit.health -= amount;
  return { target: unit.uid, amount, blocked: false, dead: unit.health <= 0 };
}

function hitHero(state: BattleState, side: Side, amount: number): BattleHit {
  state[side].health -= amount;
  checkWinner(state);
  return { target: `hero:${side}`, amount, blocked: false, dead: state[side].health <= 0 };
}

/** Убирает погибшие банки; «Верность» оставляет на их месте банку 1/1. */
function bury(state: BattleState, side: Side) {
  const board = state[side].board;
  const dead = board.filter(unit => unit.health <= 0);
  state[side].board = board.filter(unit => unit.health > 0);
  for (const unit of dead) {
    if (unit.card.keyword === 'loyal' && state[side].board.length < BOARD_SIZE) summon(state, side, LOYAL_TOKEN, nextUid(state));
  }
}

export function canAttack(unit: Unit) { return !unit.sleeping && !unit.attacked && unit.attack > 0; }

/** Кого может бить банка: «Обсуждаемые» закрывают всех, «Лёгкая» в первый ход не достаёт героя. */
export function legalTargets(attacker: Unit, enemies: readonly Unit[]): string[] {
  const taunts = enemies.filter(unit => unit.card.keyword === 'taunt');
  if (taunts.length) return taunts.map(unit => unit.uid);
  return [...enemies.map(unit => unit.uid), ...(attacker.rushing ? [] : [HERO_TARGET])];
}

function requireActive(state: BattleState) {
  if (state.winner) throw new BattleRuleError('Бой уже закончился.');
}

/** Один ход одной стороны. Состояние меняется на месте; незаконный ход бросает ошибку с текстом для участника. */
export function applyAction(state: BattleState, side: Side, action: BattleAction): BattleEvent {
  requireActive(state);
  if (state.active !== side) throw new BattleRuleError('Сейчас ход соперника.');
  const me = state[side];
  const enemy = otherSide(side);
  switch (action.kind) {
    case 'play': {
      const index = me.hand.findIndex(card => card.uid === action.card);
      const card = me.hand[index];
      if (!card) throw new BattleRuleError('Этой карты нет в руке.');
      if (card.cost > me.mana) throw new BattleRuleError('Не хватает маны.');
      if (me.board.length >= BOARD_SIZE) throw new BattleRuleError('На столе нет места.');
      me.mana -= card.cost;
      me.hand.splice(index, 1);
      let buffed: Unit | null = null;
      if (card.keyword === 'match') {
        buffed = me.board.reduce<Unit | null>((best, unit) => (!best || unit.attack > best.attack ? unit : best), null);
        if (buffed) { buffed.attack++; buffed.health++; buffed.maxHealth++; }
      }
      const { uid, ...def } = card;
      summon(state, side, def, uid);
      return { kind: 'play', side, card: def, uid, buffed: buffed?.uid ?? null };
    }
    case 'attack': {
      const attacker = me.board.find(unit => unit.uid === action.attacker);
      if (!attacker) throw new BattleRuleError('Этой банки нет на столе.');
      if (!canAttack(attacker)) throw new BattleRuleError(attacker.sleeping ? 'Банка вступит в бой на следующем ходу.' : 'Банка уже била в этот ход.');
      if (!legalTargets(attacker, state[enemy].board).includes(action.target)) throw new BattleRuleError(state[enemy].board.some(unit => unit.card.keyword === 'taunt') ? 'Сначала нужно бить «Обсуждаемую» банку.' : 'Эту цель бить нельзя.');
      attacker.attacked = true;
      const hits: BattleHit[] = [];
      if (action.target === HERO_TARGET) hits.push(hitHero(state, enemy, attacker.attack));
      else {
        const target = state[enemy].board.find(unit => unit.uid === action.target)!;
        hits.push(hitUnit(target, attacker.attack), hitUnit(attacker, target.attack));
        bury(state, enemy);
        bury(state, side);
      }
      return { kind: 'attack', side, attacker: attacker.uid, target: action.target === HERO_TARGET ? `hero:${enemy}` : action.target, hits };
    }
    case 'power': {
      if (me.powerUsed) throw new BattleRuleError('Способность уже использована в этот ход.');
      if (me.mana < HERO_POWER_COST) throw new BattleRuleError('Не хватает маны.');
      me.mana -= HERO_POWER_COST;
      me.powerUsed = true;
      return { kind: 'power', side, hits: [hitHero(state, enemy, HERO_POWER_DAMAGE)] };
    }
    case 'coin': {
      if (!me.coin) throw new BattleRuleError('Монетки нет.');
      me.coin = false;
      me.mana++;
      return { kind: 'coin', side };
    }
    case 'end':
      return startTurn(state, enemy);
  }
}

/**
 * Следующий ход бота. Жадный: сначала самые дорогие карты, потом размены в свою пользу, остальное в героя. Этого хватает,
 * чтобы проигрывать внимательному человеку, но наказывать беспечного.
 */
export function botAction(state: BattleState, side: Side = 'rival'): BattleAction {
  const me = state[side];
  const enemy = state[otherSide(side)];
  const affordable = (mana: number) => [...me.hand].filter(card => card.cost <= mana).sort((a, b) => b.cost - a.cost)[0];
  if (me.board.length < BOARD_SIZE) {
    const card = affordable(me.mana);
    if (me.coin && affordable(me.mana + 1) && affordable(me.mana + 1)!.cost > (card?.cost ?? 0)) return { kind: 'coin' };
    if (card) return { kind: 'play', card: card.uid };
  }
  const ready = me.board.filter(canAttack);
  const reach = ready.filter(unit => !unit.rushing).reduce((sum, unit) => sum + unit.attack, 0);
  for (const unit of ready) {
    const targets = legalTargets(unit, enemy.board);
    if (!targets.length) continue;
    const units = enemy.board.filter(item => targets.includes(item.uid));
    if (!targets.includes(HERO_TARGET)) return { kind: 'attack', attacker: unit.uid, target: units.sort((a, b) => a.health - b.health)[0]!.uid };
    if (reach >= enemy.health) return { kind: 'attack', attacker: unit.uid, target: HERO_TARGET };
    const trades = units.filter(item => !item.shield && item.health <= unit.attack && (item.attack < unit.health || item.attack + item.health >= unit.attack + unit.health));
    const best = trades.sort((a, b) => b.attack + b.health - a.attack - a.health)[0];
    return { kind: 'attack', attacker: unit.uid, target: best?.uid ?? HERO_TARGET };
  }
  if (me.mana >= HERO_POWER_COST && !me.powerUsed) return { kind: 'power' };
  return { kind: 'end' };
}

export interface BattleSideView { health: number; maxHealth: number; mana: number; maxMana: number; coin: boolean; powerUsed: boolean; deckLeft: number; handLeft: number; board: Unit[] }
export interface BattleView { turn: number; active: Side; first: Side; winner: Side | null; hand: HandCard[]; me: BattleSideView; rival: BattleSideView }

const sideView = (side: HeroState): BattleSideView => ({
  health: side.health, maxHealth: side.maxHealth, mana: side.mana, maxMana: side.maxMana, coin: side.coin, powerUsed: side.powerUsed,
  deckLeft: side.deck.length, handLeft: side.hand.length, board: side.board,
});

/** Что видит участник: своя рука и общий стол. Рука соперника, порядок колод и зерно на клиент не уходят. */
export function battleView(state: BattleState): BattleView {
  return { turn: state.turn, active: state.active, first: state.first, winner: state.winner, hand: state.me.hand, me: sideView(state.me), rival: sideView(state.rival) };
}

export function parseBattleAction(value: unknown): BattleAction | null {
  if (typeof value !== 'object' || value === null) return null;
  const action = value as Record<string, unknown>;
  const id = (key: string) => (typeof action[key] === 'string' && (action[key] as string).length <= 20 ? action[key] as string : null);
  switch (action.kind) {
    case 'play': { const card = id('card'); return card ? { kind: 'play', card } : null; }
    case 'attack': { const attacker = id('attacker'), target = id('target'); return attacker && target ? { kind: 'attack', attacker, target } : null; }
    case 'power': case 'coin': case 'end': return { kind: action.kind };
    default: return null;
  }
}
