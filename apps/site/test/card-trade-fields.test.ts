import { describe, expect, it } from 'vitest';
import { TRADE_MAX_CARDS, balanceHint, parseTradeCards, tradeBalance, tradeValue } from '../src/lib/card-trade-fields';
import { CRAFT_COST, RARITIES } from '../src/lib/gacha-fields';
import { TRADE_VALUE } from '../src/lib/card-trade-fields';

describe('card trade value', () => {
  it('weighs rarities as the craft price does', () => {
    for (const rarity of RARITIES) expect(TRADE_VALUE[rarity] * CRAFT_COST.common).toBe(CRAFT_COST[rarity]);
    expect(tradeValue(['common', 'rare', 'epic', 'legendary'])).toBe(44);
  });

  it('allows equal and almost equal sides only', () => {
    expect(tradeBalance(['rare'], ['common', 'common', 'common'])).toMatchObject({ give: 3, take: 3, fair: true });
    // Three rares for an epic: 9 against 10, a tenth apart.
    expect(tradeBalance(['rare', 'rare', 'rare'], ['epic']).fair).toBe(true);
    // A legendary for two epics: 30 against 20 is a third apart.
    expect(tradeBalance(['epic', 'epic'], ['legendary'])).toMatchObject({ fair: false, heavier: 'take', short: 4 });
    expect(tradeBalance(['legendary'], ['epic', 'epic'])).toMatchObject({ fair: false, heavier: 'give', short: 4 });
    expect(tradeBalance(['common'], ['rare'])).toMatchObject({ fair: false, heavier: 'take', short: 2 });
    expect(tradeBalance(['epic', 'epic', 'epic'], ['legendary']).fair).toBe(true);
  });

  it('needs cards on both sides and no more than the limit', () => {
    expect(tradeBalance([], ['common']).fair).toBe(false);
    expect(tradeBalance(['common'], []).fair).toBe(false);
    const many = Array.from({ length: TRADE_MAX_CARDS + 1 }, () => 'common' as const);
    expect(tradeBalance(many, many).fair).toBe(false);
    expect(tradeBalance(many.slice(1), many.slice(1)).fair).toBe(true);
  });

  it('tells the builder what to do next', () => {
    expect(balanceHint(tradeBalance([], []), 0, 0)).toMatch('Выберите, что хотите получить');
    expect(balanceHint(tradeBalance(['common'], ['rare']), 1, 1)).toBe('Вы просите больше: добавьте своих карточек ещё на 2 или попросите меньше.');
    expect(balanceHint(tradeBalance(['rare'], ['common']), 1, 1)).toBe('Вы отдаёте больше: попросите ещё на 2 или уберите карточку.');
    expect(balanceHint(tradeBalance(['rare'], ['rare']), 1, 1)).toBe('Обмен равный — можно отправлять.');
    expect(balanceHint(tradeBalance(['rare', 'rare', 'rare'], ['epic']), 3, 1)).toBe('Почти равный обмен — можно отправлять.');
  });
});

describe('parseTradeCards', () => {
  it('takes one to five distinct cards', () => {
    expect(parseTradeCards([{ brand: 'Burn', flavor: 'original' }])).toEqual([{ brand: 'Burn', flavor: 'original' }]);
    expect(parseTradeCards([])).toBeNull();
    expect(parseTradeCards([{ brand: 'Burn', flavor: 'a' }, { brand: 'Burn', flavor: 'a' }])).toBeNull();
    expect(parseTradeCards(Array.from({ length: 6 }, (_, index) => ({ brand: 'Burn', flavor: `f${index}` })))).toBeNull();
    expect(parseTradeCards([{ brand: 'Burn' }])).toBeNull();
    expect(parseTradeCards([{ brand: 'Burn', flavor: 'x'.repeat(121) }])).toBeNull();
    expect(parseTradeCards('Burn')).toBeNull();
  });
});
