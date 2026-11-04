import { describe, expect, it } from 'vitest';
import { flavorFamilies, tasteCard, TASTE_CARD_MIN, type TasteSignal } from '../src/lib/taste-card-fields.js';

const swipe = (brand: string, flavor: string, liked: boolean): TasteSignal => ({ brand, flavor, liked, source: 'swipe' });

describe('«Твой вкус»', () => {
  it('needs enough decisions to say anything', () => {
    expect(tasteCard(Array.from({ length: TASTE_CARD_MIN - 1 }, (_, at) => swipe('Burn', `f${at}`, true)))).toBeNull();
  });

  it('reads the flavour families from the key', () => {
    expect(flavorFamilies('Burn', 'blend:mango+peach:sugarfree')).toEqual(['mango', 'peach']);
    expect(flavorFamilies('Monster', 'monster_mango_loco')).toEqual(['mango']);
    expect(flavorFamilies('Volt', 'passion_fruit')).toEqual(['passion_fruit']);
  });

  it('names the berry lover, what they love and avoid, and their brand', () => {
    const signals = [
      swipe('Monster', 'blueberry', true), swipe('Burn', 'blueberry', true), swipe('Volt', 'raspberry', true), swipe('Monster', 'cherry', true),
      swipe('Monster', 'raspberry', true), swipe('Burn', 'watermelon', false), swipe('Volt', 'watermelon', false), swipe('Lit', 'watermelon', false),
      swipe('Lit', 'cola', false), swipe('Gorilla', 'original', false), swipe('Tornado', 'original', false), swipe('Adrenaline Rush', 'original', true),
    ];
    const card = tasteCard(signals)!;
    expect(card).toMatchObject({ decisions: 12, likes: 6, title: 'Ягодный', brand: { name: 'Monster', likes: 3 } });
    expect(card.loves.map(item => item.label)).toEqual(['Черника', 'Малина']);
    expect(card.avoids.map(item => item.label)).toEqual(['Арбуз']);
  });

  it('lets a rating outweigh a swipe on the same drink', () => {
    const base = Array.from({ length: 10 }, (_, at) => swipe('Burn', `x${at}`, at < 5));
    const card = tasteCard([...base, swipe('Gorilla', 'mango', false), { brand: 'Gorilla', flavor: 'mango', liked: true, source: 'review' }])!;
    expect(card.decisions).toBe(11);
    expect(card.likes).toBe(6);
  });

  it('calls someone who rarely likes picky, and notices sugar-free', () => {
    const rare = Array.from({ length: 12 }, (_, at) => swipe('Burn', `f${at}`, at === 0));
    expect(tasteCard(rare)?.title).toBe('Придирчивый');
    const zero = [...Array.from({ length: 8 }, (_, at) => swipe('Burn', `f${at}`, at % 2 === 0)), ...['a', 'b', 'c'].map(name => swipe('Monster', `${name}:sugarfree`, true))];
    expect(tasteCard(zero)?.sugarfree).toBe('loves');
  });
});
