import { describe, expect, it } from 'vitest';
import { CAN_AURAS, CAN_FOILS, CAN_FRAMES, CAN_LIGHTS, CAN_MOTIFS, CAN_ORNAMENTS, CAN_PARTICLES, CAN_WORLDS, canSkin, flavorWords, skinLine, skinSummary, skinTraits } from '../src/lib/can-skin';

const keys = (items: readonly { key: string }[]) => items.map(item => item.key);

describe('a can card look', () => {
  it('is the same every time for one can, on the server and in the browser', () => {
    expect(canSkin('Monster', 'monster_mango_loco')).toEqual(canSkin('Monster', 'monster_mango_loco'));
    expect(canSkin('MONSTER', 'Monster_Mango_Loco').seed).toBe(canSkin('Monster', 'monster_mango_loco').seed);
  });

  it('takes colours and the sign from the flavour, the frame colour from the brand', () => {
    expect(canSkin('Tornado', 'mango')).toMatchObject({ a: '#ffa31a', rim: '#0091d5', motif: 'leaf' });
    expect(canSkin('Burn', 'blend:lime+mint')).toMatchObject({ a: '#7cc61f', b: '#3ddc97', motif: 'citrus', rim: '#ff5a00' });
    expect(canSkin('Red Bull', 'original')).toMatchObject({ a: '#1f3f8f', motif: 'bolt' });
    expect(canSkin('Свой бренд', 'Вишня с колой').motif).toBe('cherry');
    expect(canSkin('Monster', 'monster_reserve_white_pineapple').motif).toBe('crown');
  });

  it('lets ice fall as snow, fire give embers, flowers drop petals, herbs leaves and the sea drops', () => {
    expect(canSkin('Burn', 'ice').particles).toBe('snow');
    expect(canSkin('Свой бренд', 'Корица и перец').particles).toBe('embers');
    expect(canSkin('Свой бренд', 'Сакура').particles).toBe('petals');
    expect(canSkin('Свой бренд', 'Мохито с мятой').particles).toBe('leaves');
    expect(canSkin('Свой бренд', 'Морской бриз').particles).toBe('drops');
    for (const flavor of ['mango', 'watermelon', 'original', 'cola']) expect(['fizz', 'sparks', 'fireflies', 'stardust', 'diamond']).toContain(canSkin('Tornado', flavor).particles);
  });

  it('keeps the sea, space and the mountains for their flavours', () => {
    expect(canSkin('Свой бренд', 'Морской бриз').world).toBe('sea');
    expect(canSkin('Monster', 'cosmic').world).toBe('space');
    expect(canSkin('Burn', 'ice').world).toBe('mountains');
  });

  it('reads flavour words from keys and members’ names', () => {
    expect(flavorWords('blend:mango+pineapple:sugarfree')).toEqual(['mango', 'pineapple']);
    expect(flavorWords('monster_mango_loco')).toEqual(['mango']);
    expect(flavorWords('passion_fruit')).toEqual(['passion']);
    expect(flavorWords('Юдзу и клубника')).toEqual(['yuzu', 'strawberry']);
    expect(flavorWords('Сливочный')).toEqual([]);
    expect(flavorWords('original')).toEqual([]);
  });

  it('keeps every trait in range and gives flavours of one brand their own look', () => {
    const flavors = ['original', 'mango', 'cherry', 'lime', 'watermelon', 'blueberry', 'cola', 'sugarfree', 'monster_the_doctor', 'monster_nitro'];
    const looks = flavors.map(flavor => canSkin('Monster', flavor));
    for (const skin of looks) {
      expect(keys(CAN_ORNAMENTS)).toContain(skin.ornament);
      expect(keys(CAN_FRAMES)).toContain(skin.frame);
      expect(keys(CAN_LIGHTS)).toContain(skin.light);
      expect(keys(CAN_PARTICLES)).toContain(skin.particles);
      expect(keys(CAN_WORLDS)).toContain(skin.world);
      expect(keys(CAN_AURAS)).toContain(skin.aura);
      expect(keys(CAN_FOILS)).toContain(skin.foil);
      expect(CAN_MOTIFS).toContain(skin.motif);
      expect(skin.angle % 15).toBe(0);
      for (const dot of [...skin.marks, ...skin.dots]) expect(dot.x >= 0 && dot.x <= 100 && dot.y >= 0 && dot.y <= 100).toBe(true);
    }
    const fingerprints = new Set(looks.map(skin => [skin.a, skin.b, skin.ornament, skin.frame, skin.light, skin.angle].join('|')));
    expect(fingerprints.size).toBe(flavors.length);
  });

  it('makes rare traits about six times rarer than ordinary ones', () => {
    const looks = Array.from({ length: 4000 }, (_, index) => canSkin(`Бренд ${index % 40}`, `вкус ${index}`));
    const share = (items: readonly { key: string; rare?: true }[], key: 'ornament' | 'frame' | 'light') => {
      const rare = new Set(items.filter(item => item.rare).map(item => item.key));
      return looks.filter(look => rare.has(look[key])).length / looks.length;
    };
    // Ornaments: 6 rare of 28 at weight 1 against 22 at weight 6 → about 4.3 %; frames 6.5 %, lights 5.3 %.
    expect(share(CAN_ORNAMENTS, 'ornament')).toBeGreaterThan(.02);
    expect(share(CAN_ORNAMENTS, 'ornament')).toBeLessThan(.06);
    expect(share(CAN_FRAMES, 'frame')).toBeLessThan(.09);
    expect(share(CAN_LIGHTS, 'light')).toBeLessThan(.09);
    const rareKeys = new Set([...CAN_ORNAMENTS, ...CAN_FRAMES, ...CAN_LIGHTS].filter(item => item.rare).map(item => item.key));
    const anyRare = looks.filter(look => [look.ornament, look.frame, look.light].some(key => rareKeys.has(key))).length / looks.length;
    expect(anyRare).toBeGreaterThan(.1);
    expect(anyRare).toBeLessThan(.2);
  });

  it('names the look by rarity: the effect from rare up, particles from epic up, the foil on legendary cards', () => {
    const skin = canSkin('Tornado', 'mango');
    expect(skinTraits(skin, 'common').map(item => item.kind)).toEqual(['Рамка', 'Орнамент', 'Свет', 'Мир']);
    expect(skinTraits(skin, 'rare').map(item => item.kind)).toEqual(['Рамка', 'Орнамент', 'Свет', 'Мир', 'Эффект']);
    expect(skinTraits(skin, 'epic').map(item => item.kind)).toEqual(['Рамка', 'Орнамент', 'Свет', 'Мир', 'Эффект', 'Частицы']);
    expect(skinTraits(skin, 'legendary').map(item => item.kind)).toEqual(['Рамка', 'Орнамент', 'Свет', 'Мир', 'Эффект', 'Частицы', 'Фольга']);
    expect(skinLine([{ kind: 'Рамка', name: 'Ар-деко', rare: true }, { kind: 'Свет', name: 'Глянец', rare: false }])).toBe('Облик: Ар-деко ✦ · Глянец');
    expect(skinSummary('Tornado', 'mango', 'legendary').line.startsWith('Облик: ')).toBe(true);
  });
});
