import { describe, expect, it } from 'vitest';
import { combineDuplicateResults, DUPLICATE_HINTS, DUPLICATE_SYSTEM, duplicatePrompt, hammingDistance, isConfidentDuplicate, isFlavorInMix, mergeDuplicateVotes, offerTitles, parseDuplicateAnswer, shortlistCandidates, type DuplicateCandidate } from '../src/lib/drink-duplicate-fields';

const card = (flavor: string, fullName?: string, brand = 'Tornado'): DuplicateCandidate => ({ brand, flavor, ...(fullName ? { fullName } : {}), kind: 'shop' });

describe('drink duplicate check rules', () => {
  it('keeps the same brand only, without the drink itself, and shortlists by shared words', () => {
    const many = [...Array.from({ length: 20 }, (_, index) => card(`flavor${index}`)), card('tornado_lemoncake', 'Tornado Energy Lemoncake'), card('apple', '', 'Burn')];
    const drink = { brand: 'Tornado', flavor: 'Лимонный пирог', fullName: 'Tornado energy lemoncake' };
    const list = shortlistCandidates(drink, many, 5);
    expect(list).toHaveLength(5);
    expect(list[0]).toMatchObject({ flavor: 'tornado_lemoncake' });
    expect(list.every(item => item.brand === 'Tornado')).toBe(true);
    expect(shortlistCandidates({ brand: 'tornado', flavor: 'apple' }, [card('apple'), card('mango')], 5).map(item => item.flavor)).toEqual(['apple', 'mango']);
    expect(shortlistCandidates({ brand: 'Tornado', flavor: 'apple' }, [card('apple'), card('mango')], 5).map(item => item.flavor)).toEqual(['mango']);
  });

  it('numbers the cards in the prompt and adds the label text', () => {
    const prompt = duplicatePrompt({ brand: 'Tornado', flavor: 'mango', ingredients: 'Вода, таурин' }, [card('apple'), card('mango', 'Tornado Max')]);
    expect(prompt).toContain('1. Tornado · ');
    expect(prompt).toContain('2. Tornado · ');
    expect(prompt).toContain('Состав с этикетки: Вода, таурин');
  });

  it('reads verdicts, refuses canned or broken answers and keeps sugar versions apart', () => {
    const list = [card('tornado_lemoncake'), card('mango:sugarfree')];
    const drink = { brand: 'Tornado', flavor: 'Лимонный пирог' };
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":1,"reason":"тот же вкус"}', list, drink)).toEqual({ verdict: 'duplicate', match: list[0], reason: 'тот же вкус' });
    expect(parseDuplicateAnswer('Ответ: {"verdict":"new","match":null,"reason":"другой"}', list, drink)).toMatchObject({ verdict: 'new', match: null });
    expect(parseDuplicateAnswer('Генеративные языковые модели не обладают собственным мнением', list, drink)).toBeNull();
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":7}', list, drink)).toBeNull();
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":null}', list, drink)).toBeNull();
    expect(parseDuplicateAnswer('{"verdict":"maybe"}', list, drink)).toBeNull();
    // A zero-sugar card is a drink of its own: the model's «duplicate» becomes «unsure».
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":"2","reason":"манго"}', list, { brand: 'Tornado', flavor: 'mango' }))
      .toMatchObject({ verdict: 'unsure', match: list[1], reason: expect.stringContaining('сахара') });
    // A plain «sugarfree» key is the zero can, not the original.
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":1}', [card('original')], { brand: 'Gorilla', flavor: 'sugarfree' })).toMatchObject({ verdict: 'unsure' });
  });

  it('combines halves of a refused list: a duplicate wins, a refused half makes «new» untrustworthy', () => {
    const dup = { verdict: 'duplicate' as const, match: card('apple'), reason: '' };
    const fresh = { verdict: 'new' as const, match: null, reason: '' };
    expect(combineDuplicateResults([null, dup])).toBe(dup);
    expect(combineDuplicateResults([fresh, fresh])).toBe(fresh);
    expect(combineDuplicateResults([fresh, null])).toMatchObject({ verdict: 'failed' });
    expect(combineDuplicateResults([null, null])).toMatchObject({ verdict: 'failed' });
  });

  it('merges two answers: agreement makes a duplicate, a split vote only «unsure»', () => {
    const apple = card('apple');
    const dup = { verdict: 'duplicate' as const, match: apple, reason: 'тот же' };
    const fresh = { verdict: 'new' as const, match: null, reason: 'другой' };
    expect(mergeDuplicateVotes([dup, dup])).toEqual(dup);
    expect(mergeDuplicateVotes([fresh, dup])).toEqual({ ...dup, verdict: 'unsure' });
    expect(mergeDuplicateVotes([dup, { ...dup, match: card('mango') }])).toMatchObject({ verdict: 'unsure', match: apple });
    expect(mergeDuplicateVotes([fresh, fresh])).toEqual(fresh);
    expect(mergeDuplicateVotes([dup])).toEqual(dup);
  });

  it('is sure only when three answers name the same card', () => {
    const apple = card('apple'), mango = card('mango');
    const dup = (match: DuplicateCandidate) => ({ verdict: 'duplicate' as const, match, reason: '' });
    expect(isConfidentDuplicate([dup(apple), dup(apple), dup(apple)])).toBe(true);
    expect(isConfidentDuplicate([dup(apple), dup(apple)])).toBe(false);
    expect(isConfidentDuplicate([dup(apple), dup(mango), dup(apple)])).toBe(false);
    expect(isConfidentDuplicate([dup(apple), { verdict: 'unsure', match: apple, reason: '' }, dup(apple)])).toBe(false);
    expect(isConfidentDuplicate([dup(apple), null, dup(apple)])).toBe(false);
  });

  it('reads shop product names, the flavour-in-a-mix pairs and photo distances', () => {
    expect(offerTitles([
      { url: 'https://edadeal.ru/moskva/search?text=Gorilla+Watermelon+%D1%81+%D0%B0%D1%80%D0%B1%D1%83%D0%B7%D0%BE%D0%BC' },
      { url: 'https://edadeal.ru/moskva/search?text=gorilla+watermelon+%D1%81+%D0%B0%D1%80%D0%B1%D1%83%D0%B7%D0%BE%D0%BC' },
      { url: 'https://lavka.yandex.ru/supermarket/good/energeticheskij-napitok-gorilla' },
      { url: 'https://www.ozon.ru/product/123' },
    ])).toEqual(['Gorilla Watermelon с арбузом', 'energeticheskij napitok gorilla']);
    expect(isFlavorInMix('watermelon', 'blend:melon+watermelon')).toBe(true);
    expect(isFlavorInMix('blend:berry+cherry', 'cherry')).toBe(true);
    expect(isFlavorInMix('watermelon:sugarfree', 'blend:melon+watermelon')).toBe(false);
    expect(isFlavorInMix('original', 'blend:original+vanilla')).toBe(false);
    expect(isFlavorInMix('mango', 'blend:melon+watermelon')).toBe(false);
    expect(hammingDistance('ffffffffffffffff', 'fffffffffffffff0')).toBe(4);
    expect(hammingDistance('0123456789abcdef', '0123456789abcdef')).toBe(0);
  });

  it('keeps hinted candidates on a short list; the model sees hints and shop names only while they are on', () => {
    const many = Array.from({ length: 20 }, (_, index) => card(`flavor${index}`));
    const hinted = { ...card('flavor19'), hint: 'одинаковое фото банки', titles: ['Tornado Black 0.45'] };
    const list = shortlistCandidates({ brand: 'Tornado', flavor: 'x' }, [...many.slice(0, 19), hinted], 5);
    expect(list[0]).toBe(hinted);
    const prompt = duplicatePrompt({ brand: 'Tornado', flavor: 'x', titles: ['Tornado Max Black'] }, list);
    if (DUPLICATE_HINTS) expect(prompt).toMatch(/в магазинах: «Tornado Max Black»[\s\S]*подсказка: одинаковое фото банки/u);
    else {
      expect(prompt).not.toMatch(/в магазинах|подсказка/u);
      expect(DUPLICATE_SYSTEM).not.toMatch(/в магазинах|Подсказка/u);
    }
  });
});
