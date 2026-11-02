/**
 * The look («облик») of one can's card in the Bankomat, on top of its rarity, made of named traits like a collectible
 * card's: a frame, an ornament (the background pattern), a light (the surface), a world (the scene behind it all) and,
 * from rare cards up, an effect behind the can; epic and legendary cards add particles — some traits are rare and drawn
 * more richly. Colours come from the flavour (mango orange, cherry red), the
 * frame's colour from the brand, the flavour sign from the flavour. Everything follows from the brand and flavour, so a
 * can looks the same everywhere and for everyone: the look belongs to the drink, not to a pulled copy, so it adds no luck
 * to a pull. Pure: no database, safe for the browser.
 */

/** A trait's variants: the key the styles use, its Russian name and whether it is rare (comes six times less often). */
type Trait<Key extends string> = readonly { key: Key; name: string; rare?: true }[];
const trait = <Key extends string>(items: Trait<Key>) => items;

export const CAN_ORNAMENTS = trait([
  { key: 'stripes', name: 'Полосы' }, { key: 'dots', name: 'Горошек' }, { key: 'grid', name: 'Сетка' }, { key: 'waves', name: 'Волны' },
  { key: 'zigzag', name: 'Зигзаг' }, { key: 'rays', name: 'Лучи' }, { key: 'bubbles', name: 'Пузыри' }, { key: 'diamonds', name: 'Ромбы' },
  { key: 'checker', name: 'Шахматы' }, { key: 'plaid', name: 'Шотландка' }, { key: 'ripples', name: 'Круги на воде' }, { key: 'scales', name: 'Чешуя' },
  { key: 'triangles', name: 'Треугольники' }, { key: 'lattice', name: 'Плетёнка' }, { key: 'halftone', name: 'Полутон' }, { key: 'bands', name: 'Ленты' },
  { key: 'pinstripe', name: 'Тонкая полоска' }, { key: 'clouds', name: 'Облака' }, { key: 'topo', name: 'Изолинии' }, { key: 'rings', name: 'Кольца' },
  { key: 'sparkle', name: 'Искорки' }, { key: 'fans', name: 'Веер' },
  { key: 'confetti', name: 'Конфетти', rare: true }, { key: 'stars', name: 'Звёздное небо', rare: true }, { key: 'sunburst', name: 'Солнце', rare: true },
  { key: 'mosaic', name: 'Мозаика', rare: true }, { key: 'circuit', name: 'Схема', rare: true }, { key: 'kaleido', name: 'Калейдоскоп', rare: true },
]);
/** Frames are graceful (lines, scrolls, pearls) or monstrous (a heavy band, spikes, claws, teeth); the rare ones are the richest. */
export const CAN_FRAMES = trait([
  { key: 'filigree', name: 'Филигрань' }, { key: 'deco', name: 'Ар-деко' }, { key: 'vine', name: 'Лоза' }, { key: 'pearl', name: 'Жемчуг' },
  { key: 'arch', name: 'Арка' }, { key: 'columns', name: 'Колонны' }, { key: 'gems', name: 'Самоцветы' },
  { key: 'armor', name: 'Броня' }, { key: 'spikes', name: 'Шипы' }, { key: 'claws', name: 'Когти' }, { key: 'chain', name: 'Цепь' }, { key: 'maw', name: 'Пасть' },
  { key: 'gilded', name: 'Позолота', rare: true }, { key: 'royal', name: 'Корона', rare: true }, { key: 'facets', name: 'Грани', rare: true },
  { key: 'chrome', name: 'Хром', rare: true }, { key: 'neon', name: 'Неон', rare: true }, { key: 'dragon', name: 'Дракон', rare: true },
]);
export const CAN_LIGHTS = trait([
  { key: 'matte', name: 'Матовый' }, { key: 'gloss', name: 'Глянец' }, { key: 'brushed', name: 'Шлифовка' }, { key: 'glitter', name: 'Блёстки' },
  { key: 'iris', name: 'Перламутр' }, { key: 'satin', name: 'Сатин' }, { key: 'velvet', name: 'Бархат' }, { key: 'frost', name: 'Иней' },
  { key: 'mirror', name: 'Зеркало' },
  { key: 'holo', name: 'Голограмма', rare: true }, { key: 'aurora', name: 'Сияние', rare: true }, { key: 'prism', name: 'Призма', rare: true },
]);
/** The scene behind the whole card: the time of day, the weather or a place, in the can's colours. */
export const CAN_WORLDS = trait([
  { key: 'day', name: 'Ясный день' }, { key: 'dusk', name: 'Закат' }, { key: 'dawn', name: 'Рассвет' }, { key: 'night', name: 'Ночь' },
  { key: 'fog', name: 'Туман' }, { key: 'city', name: 'Город' }, { key: 'mountains', name: 'Горы' }, { key: 'sea', name: 'Море' },
  { key: 'storm', name: 'Гроза', rare: true }, { key: 'space', name: 'Космос', rare: true },
]);
/** What glows behind the can itself, from rare cards up. */
export const CAN_AURAS = trait([
  { key: 'halo', name: 'Ореол' }, { key: 'rays', name: 'Лучи' }, { key: 'rings', name: 'Круги' }, { key: 'flare', name: 'Блик' },
  { key: 'orbit', name: 'Орбита' },
  { key: 'portal', name: 'Портал', rare: true }, { key: 'bolts', name: 'Разряды', rare: true },
]);
export const CAN_PARTICLES = trait([
  { key: 'fizz', name: 'Пузырьки' }, { key: 'sparks', name: 'Искры' }, { key: 'snow', name: 'Снегопад' }, { key: 'embers', name: 'Угольки' },
  { key: 'fireflies', name: 'Светлячки' }, { key: 'leaves', name: 'Листья' }, { key: 'drops', name: 'Капли' },
  { key: 'stardust', name: 'Звёздная пыль', rare: true }, { key: 'petals', name: 'Лепестки', rare: true }, { key: 'diamond', name: 'Алмазная пыль', rare: true },
]);
/** Snow, embers, petals, leaves and drops belong to their flavours; the rest choose among the free ones. */
const THEMED_PARTICLES: Partial<Record<string, CanParticles>> = { snow: 'snow', flame: 'embers', flower: 'petals', wave: 'drops' };
const HERBS = new Set(['mint', 'tarragon', 'matcha', 'aloe', 'cactus', 'feijoa', 'tea']);
const FREE_PARTICLES = CAN_PARTICLES.filter(item => ['fizz', 'sparks', 'fireflies', 'stardust', 'diamond'].includes(item.key));
/** Ice and the sea, the night sky: a few flavours keep their own world. */
const THEMED_WORLDS: Partial<Record<string, CanWorld>> = { wave: 'sea', star: 'space', snow: 'mountains' };
/** How a legendary card's foil moves. */
export const CAN_FOILS = trait([
  { key: 'spin', name: 'Вихрь' }, { key: 'sweep', name: 'Волна света' }, { key: 'pulse', name: 'Пульс' }, { key: 'scan', name: 'Сканер' },
  { key: 'shimmer', name: 'Мерцание' },
]);
export const CAN_MOTIFS = ['citrus', 'berry', 'cherry', 'leaf', 'apple', 'drop', 'bean', 'bubble', 'snow', 'flame', 'flower', 'wave', 'crown', 'star', 'gem', 'bolt'] as const;

export type CanOrnament = typeof CAN_ORNAMENTS[number]['key'];
export type CanFrame = typeof CAN_FRAMES[number]['key'];
export type CanLight = typeof CAN_LIGHTS[number]['key'];
export type CanParticles = typeof CAN_PARTICLES[number]['key'];
export type CanWorld = typeof CAN_WORLDS[number]['key'];
export type CanAura = typeof CAN_AURAS[number]['key'];
export type CanFoil = typeof CAN_FOILS[number]['key'];
export type CanMotif = typeof CAN_MOTIFS[number];

/** Where a flavour sign sits on the card (in a 100 × 100 box) and how it turns. */
export interface CanMark { x: number; y: number; size: number; turn: number }
/** One particle of an epic or legendary card: where it starts, how big, and when its loop starts. */
export interface CanParticle { x: number; y: number; size: number; delay: number; duration: number }
export interface CanSkin {
  a: string; b: string; rim: string; angle: number;
  ornament: CanOrnament; frame: CanFrame; light: CanLight; world: CanWorld; aura: CanAura; particles: CanParticles; foil: CanFoil; motif: CanMotif;
  marks: CanMark[]; dots: CanParticle[]; seed: number;
}

/** Flavour words in a flavour key (`blend:mango+pineapple:sugarfree`, `monster_mango_loco`) and in members' own names. */
const FLAVORS: Record<string, { color: string; motif: CanMotif }> = {
  lemon: { color: '#f5d300', motif: 'citrus' }, lime: { color: '#7cc61f', motif: 'citrus' }, orange: { color: '#ff8a00', motif: 'citrus' },
  grapefruit: { color: '#ff6b5a', motif: 'citrus' }, citrus: { color: '#ffb000', motif: 'citrus' }, yuzu: { color: '#e9c400', motif: 'citrus' },
  calamansi: { color: '#a8c41a', motif: 'citrus' }, mandarin: { color: '#ff9a1f', motif: 'citrus' }, pomelo: { color: '#ffc46b', motif: 'citrus' },
  bergamot: { color: '#c9d84a', motif: 'citrus' }, tangerine: { color: '#ff9a1f', motif: 'citrus' },
  cherry: { color: '#c8102e', motif: 'cherry' }, barberry: { color: '#c7254e', motif: 'cherry' }, plum: { color: '#7b2d6b', motif: 'cherry' },
  berry: { color: '#8e3fbf', motif: 'berry' }, blueberry: { color: '#3f51c5', motif: 'berry' }, raspberry: { color: '#e3256b', motif: 'berry' },
  strawberry: { color: '#ff3b5c', motif: 'berry' }, cranberry: { color: '#b3123b', motif: 'berry' }, blackcurrant: { color: '#5b1f63', motif: 'berry' },
  pomegranate: { color: '#b0123b', motif: 'berry' }, grape: { color: '#6a2c91', motif: 'berry' }, irga: { color: '#4a3a8c', motif: 'berry' },
  currant: { color: '#5b1f63', motif: 'berry' }, blackberry: { color: '#3b1f4f', motif: 'berry' }, lingonberry: { color: '#d3213f', motif: 'berry' },
  buckthorn: { color: '#ff9f1c', motif: 'berry' }, acai: { color: '#4b2a5e', motif: 'berry' },
  mango: { color: '#ffa31a', motif: 'leaf' }, pineapple: { color: '#ffd23f', motif: 'leaf' }, guava: { color: '#ff7f9e', motif: 'leaf' },
  passion: { color: '#a24bd1', motif: 'leaf' }, coconut: { color: '#d9c7a6', motif: 'leaf' }, lychee: { color: '#f7a1b5', motif: 'leaf' },
  tropical: { color: '#ff7a3d', motif: 'leaf' }, papaya: { color: '#ff8f4d', motif: 'leaf' }, banana: { color: '#ffe066', motif: 'leaf' },
  feijoa: { color: '#7fb33a', motif: 'leaf' }, mint: { color: '#3ddc97', motif: 'leaf' }, tarragon: { color: '#2fbf5f', motif: 'leaf' },
  matcha: { color: '#6ea83a', motif: 'leaf' }, aloe: { color: '#7fd18b', motif: 'leaf' }, cactus: { color: '#4caf50', motif: 'leaf' },
  peach: { color: '#ff9e7a', motif: 'drop' }, apricot: { color: '#ffae5c', motif: 'drop' }, melon: { color: '#f2d36b', motif: 'drop' },
  watermelon: { color: '#ff5a6e', motif: 'drop' }, cucumber: { color: '#6cc070', motif: 'drop' }, kiwi: { color: '#8fbf2f', motif: 'drop' },
  apple: { color: '#7cc84a', motif: 'apple' }, pear: { color: '#c8d65a', motif: 'apple' }, quince: { color: '#e3c25a', motif: 'apple' },
  cola: { color: '#7a2e1f', motif: 'bean' }, coffee: { color: '#6f4e37', motif: 'bean' }, tea: { color: '#a47a3c', motif: 'bean' },
  ginger: { color: '#d9a441', motif: 'bean' }, chocolate: { color: '#5a3825', motif: 'bean' }, caramel: { color: '#c6863b', motif: 'bean' },
  vanilla: { color: '#f3e3b0', motif: 'bean' }, honey: { color: '#f2b62f', motif: 'bean' }, pistachio: { color: '#a3c46b', motif: 'bean' },
  bubblegum: { color: '#ff7ac8', motif: 'bubble' }, gum: { color: '#ff7ac8', motif: 'bubble' }, marshmallow: { color: '#ffc2e0', motif: 'bubble' },
  cotton: { color: '#ffb3e6', motif: 'bubble' }, candy: { color: '#ff6fb5', motif: 'bubble' },
  ice: { color: '#7fd3ff', motif: 'snow' }, frost: { color: '#7fd3ff', motif: 'snow' }, cool: { color: '#6ec6ff', motif: 'snow' }, arctic: { color: '#9fe0ff', motif: 'snow' },
  cinnamon: { color: '#b5582a', motif: 'flame' }, chili: { color: '#e0301e', motif: 'flame' }, hot: { color: '#ff4b1f', motif: 'flame' }, fire: { color: '#ff5a1f', motif: 'flame' },
  rose: { color: '#ff6f91', motif: 'flower' }, sakura: { color: '#ffb7c5', motif: 'flower' }, hibiscus: { color: '#d81b60', motif: 'flower' },
  elderflower: { color: '#f1eec9', motif: 'flower' }, lavender: { color: '#a98bd8', motif: 'flower' }, jasmine: { color: '#f5f0d0', motif: 'flower' },
  sea: { color: '#1e88e5', motif: 'wave' }, ocean: { color: '#1565c0', motif: 'wave' }, aqua: { color: '#26c6da', motif: 'wave' }, blue: { color: '#2f6bff', motif: 'wave' },
  gold: { color: '#d4a017', motif: 'crown' }, golden: { color: '#d4a017', motif: 'crown' }, royal: { color: '#6a1b9a', motif: 'crown' }, reserve: { color: '#b8860b', motif: 'crown' },
  cosmic: { color: '#5e35b1', motif: 'star' }, galaxy: { color: '#4527a0', motif: 'star' }, space: { color: '#283593', motif: 'star' }, edition: { color: '#9575cd', motif: 'star' },
  crystal: { color: '#9fe7ff', motif: 'gem' }, diamond: { color: '#b3e5fc', motif: 'gem' },
};
/** Russian spellings members type in their own flavour names. */
const RUSSIAN: [RegExp, string][] = [
  [/лимон/u, 'lemon'], [/лайм/u, 'lime'], [/апельсин/u, 'orange'], [/грейпфрут/u, 'grapefruit'], [/цитрус/u, 'citrus'], [/юдзу|юзу/u, 'yuzu'], [/мандарин/u, 'mandarin'], [/бергамот/u, 'bergamot'],
  [/вишн|черешн/u, 'cherry'], [/ягод/u, 'berry'], [/черник|голубик/u, 'blueberry'], [/малин/u, 'raspberry'], [/клубник|земляник/u, 'strawberry'], [/клюкв/u, 'cranberry'],
  [/смородин/u, 'blackcurrant'], [/барбарис/u, 'barberry'], [/гранат/u, 'pomegranate'], [/виноград/u, 'grape'], [/ирг/u, 'irga'], [/ежевик/u, 'blackberry'], [/брусник/u, 'lingonberry'],
  [/облепих/u, 'buckthorn'], [/слив(?!оч)/u, 'plum'], [/асаи/u, 'acai'],
  [/манго/u, 'mango'], [/ананас/u, 'pineapple'], [/гуав/u, 'guava'], [/маракуй/u, 'passion'], [/кокос/u, 'coconut'], [/личи/u, 'lychee'], [/тропи/u, 'tropical'], [/банан/u, 'banana'],
  [/фейхоа/u, 'feijoa'], [/мят/u, 'mint'], [/тархун/u, 'tarragon'], [/матча/u, 'matcha'], [/алоэ/u, 'aloe'], [/кактус/u, 'cactus'],
  [/персик/u, 'peach'], [/абрикос/u, 'apricot'], [/яблок/u, 'apple'], [/груш|дюшес/u, 'pear'], [/айв/u, 'quince'], [/киви/u, 'kiwi'], [/арбуз/u, 'watermelon'], [/дын/u, 'melon'], [/огур/u, 'cucumber'],
  [/кол[аы]/u, 'cola'], [/коф/u, 'coffee'], [/ча[йя]/u, 'tea'], [/имбир/u, 'ginger'], [/шоколад/u, 'chocolate'], [/карамел/u, 'caramel'], [/ванил/u, 'vanilla'], [/мёд|медов/u, 'honey'], [/фисташ/u, 'pistachio'],
  [/жвач|бабл/u, 'bubblegum'], [/зефир|маршмел/u, 'marshmallow'], [/сахарн.. ват/u, 'cotton'], [/конфет|леденц/u, 'candy'], [/лёд|лед|ледян|холод/u, 'ice'],
  [/кориц/u, 'cinnamon'], [/перец|чили/u, 'chili'], [/огн|огон/u, 'fire'],
  [/роз[аы]/u, 'rose'], [/сакур/u, 'sakura'], [/гибискус|каркаде/u, 'hibiscus'], [/бузин/u, 'elderflower'], [/лаванд/u, 'lavender'], [/жасмин/u, 'jasmine'],
  [/морск|море/u, 'sea'], [/океан/u, 'ocean'], [/золот/u, 'gold'], [/королев|царск/u, 'royal'], [/космо|галакт/u, 'cosmic'], [/кристалл/u, 'crystal'], [/алмаз|бриллиант/u, 'diamond'],
];
/** Brand accents for the frame; any other brand gets a hue of its own from its name. */
const BRANDS: Record<string, string> = {
  'red bull': '#1f3f8f', monster: '#43b02a', burn: '#ff5a00', 'flash up': '#f2c500', 'adrenaline rush': '#c9a227', gorilla: '#e30613',
  tornado: '#0091d5', 'lit energy': '#ff2d87', 'drive me': '#e4002b', 'volt energy': '#00a3e0', ashkudi: '#7b2cbf', jaguar: '#d4a017',
  'black monster': '#2b2b2b', 'e-on': '#00c2a8', 'my rules': '#ff4f9a', 'x-turbo': '#ff6a00', juster: '#00b26b', '100 kwt': '#00aeef',
  pulseup: '#ff3d00', 'doma by guf': '#111111', 'by баста': '#e10600', 'ninja star': '#d32f2f', wow: '#ff1f8f', "piranha's": '#00b8d4',
  'энергия руки вверх': '#ff0050', rockstar: '#f5b700', reign: '#e91e63', ghost: '#7e57c2', hell: '#c62828', bullit: '#1565c0',
  vulkan: '#ff3d00', 'fitness food factory': '#43a047', 'dr.drinks': '#00897b', arizona: '#00a5a8', bizon: '#795548', hype: '#212121',
};

/** FNV-1a: the same can always lands on the same look. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) { value ^= text.charCodeAt(index); value = Math.imul(value, 0x01000193); }
  return value >>> 0;
}
/** A sequence of numbers from one seed (mulberry32), so each choice is independent of the others. */
function stream(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hue = (seed: number, saturation = 72, lightness = 52) => `hsl(${seed % 360} ${saturation}% ${lightness}%)`;
/** A variant by weight: a rare one comes six times less often than an ordinary one, so about one can in seven has a rare trait. */
function pick<Key extends string>(items: Trait<Key>, roll: number): Key {
  const weights = items.map(item => (item.rare ? 1 : 6));
  let left = roll * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [index, item] of items.entries()) { left -= weights[index]!; if (left < 0) return item.key; }
  return items[items.length - 1]!.key;
}

/** Flavour words of a key or a member's name, in their order: `blend:mango+pineapple` → mango, pineapple. */
export function flavorWords(flavor: string): string[] {
  const lower = flavor.toLocaleLowerCase('ru-RU');
  const latin = lower.replace('passion_fruit', 'passion').replace('sea_buckthorn', 'buckthorn').split(/[^a-z]+/u).filter(word => Object.hasOwn(FLAVORS, word));
  const russian = RUSSIAN.flatMap(([pattern, word]) => {
    const found = pattern.exec(lower);
    return found ? [{ word, at: found.index }] : [];
  }).sort((left, right) => left.at - right.at).map(item => item.word);
  return [...new Set([...latin, ...russian])];
}

export function canSkin(brand: string, flavor: string): CanSkin {
  const seed = hash(`${brand.toLocaleLowerCase('ru-RU')}|${flavor.toLocaleLowerCase('ru-RU')}`);
  const next = stream(seed);
  const rim = BRANDS[brand.toLocaleLowerCase('ru-RU')] ?? hue(hash(brand.toLocaleLowerCase('ru-RU')), 70, 46);
  const words = flavorWords(flavor);
  const first = words[0] ? FLAVORS[words[0]] : undefined;
  const second = words[1] ? FLAVORS[words[1]] : undefined;
  // «Оригинальный» and editions have no fruit: the brand's own colour leads, with a hue of the flavour beside it.
  const a = first?.color ?? (flavor.includes('sugarfree') || /zero|ultra/u.test(flavor) ? '#b8c2cf' : rim);
  const b = second?.color ?? hue(seed >>> 7, 68, 58);
  const marks = Array.from({ length: 2 + Math.floor(next() * 2) }, (_, index) => {
    // Low on the sides: the cover sits on top of the card and would hide the rest, the frame's corners take the corners.
    const corner = (Math.floor(next() * 4) + index) % 4;
    return { x: Math.round((corner % 2 ? 84 : 4) + next() * 12), y: Math.round((corner > 1 ? 66 : 50) + next() * 12), size: Math.round(14 + next() * 10), turn: Math.round(next() * 360) };
  });
  const motif = first?.motif ?? (/ice|frost|cool/u.test(flavor) ? 'snow' : 'bolt');
  return {
    a, b, rim, motif, marks,
    angle: Math.round(next() * 12) * 15,
    ornament: pick(CAN_ORNAMENTS, next()),
    frame: pick(CAN_FRAMES, next()),
    light: pick(CAN_LIGHTS, next()),
    particles: THEMED_PARTICLES[motif] ?? (words.some(word => HERBS.has(word)) ? 'leaves' : pick(FREE_PARTICLES, next())),
    foil: pick(CAN_FOILS, next()),
    dots: Array.from({ length: 6 }, () => ({ x: Math.round(6 + next() * 88), y: Math.round(8 + next() * 84), size: Math.round(3 + next() * 4), delay: Math.round(next() * 40) / 10, duration: Math.round(30 + next() * 25) / 10 })),
    // Drawn last, so the traits above keep their rolls.
    world: THEMED_WORLDS[motif] ?? pick(CAN_WORLDS, next()),
    aura: pick(CAN_AURAS, next()),
    seed,
  };
}

export interface SkinTrait { kind: string; name: string; rare: boolean }
const traitOf = <Key extends string>(kind: string, items: Trait<Key>, key: Key): SkinTrait => {
  const item = items.find(entry => entry.key === key)!;
  return { kind, name: item.name, rare: Boolean(item.rare) };
};
/** Does a card of this rarity show the effect behind the can? From rare up: the look grows with the rarity. */
export const hasAura = (rarity: 'common' | 'rare' | 'epic' | 'legendary') => rarity !== 'common';
/**
 * The card's look as words, in the order a collector reads it: frame, ornament, light, world, then what only rarer cards
 * show — the effect behind the can from rare up, particles from epic up, the foil's motion on legendary ones.
 */
export function skinTraits(skin: CanSkin, rarity: 'common' | 'rare' | 'epic' | 'legendary'): SkinTrait[] {
  return [
    traitOf('Рамка', CAN_FRAMES, skin.frame),
    traitOf('Орнамент', CAN_ORNAMENTS, skin.ornament),
    traitOf('Свет', CAN_LIGHTS, skin.light),
    traitOf('Мир', CAN_WORLDS, skin.world),
    ...(hasAura(rarity) ? [traitOf('Эффект', CAN_AURAS, skin.aura)] : []),
    ...(rarity === 'epic' || rarity === 'legendary' ? [traitOf('Частицы', CAN_PARTICLES, skin.particles)] : []),
    ...(rarity === 'legendary' ? [traitOf('Фольга', CAN_FOILS, skin.foil)] : []),
  ];
}
/** «Облик: Ар-деко ✦ · Чешуя · Перламутр» — for a tooltip or a line under the card. */
export const skinLine = (traits: SkinTrait[]) => `Облик: ${traits.map(item => `${item.name}${item.rare ? ' ✦' : ''}`).join(' · ')}`;
/** The look of a can at a rarity in words, and how many of its traits are rare (a «редкий облик» from one up). */
export function skinSummary(brand: string, flavor: string, rarity: 'common' | 'rare' | 'epic' | 'legendary') {
  const traits = skinTraits(canSkin(brand, flavor), rarity);
  return { traits, line: skinLine(traits), rare: traits.filter(item => item.rare).length };
}
