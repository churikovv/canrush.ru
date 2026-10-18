import { ENERGY_DRINK_BRAND_ALIASES } from '@canrush/shared';

/**
 * How people type brand names in search, beyond the parser's brand aliases. Search only: the parser
 * matches ENERGY_DRINK_BRAND_ALIASES against retailer titles, so loose spellings must not go there.
 * Automatic transliteration below covers the rest; list a brand here when it reads differently
 * from its letters ("Juster" is «Джастер», not «Юстер»).
 */
export const BRAND_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  '100 Kwt': ['100 кВт', 'Сто киловатт', 'Киловатт'],
  'Actibo': ['Актибо'],
  'Adrenaline Game Fuel': ['Адреналин Гейм Фьюел', 'Гейм Фьюел', 'Game Fuel', 'Adrenaline'],
  'Adrenaline Rush': ['Адреналин', 'Adrenaline'],
  'Alligator': ['Аллигатор', 'Алигатор'],
  'Arizona': ['Аризона'],
  'Ashkudi': ['Ашкуди', 'Ашкуди Энерджи'],
  'Aziano': ['Азиано'],
  'Bacchus': ['Бахус'],
  'Bizon': ['Бизон'],
  'Black Rocket': ['Блэк Рокет', 'Блек Рокет'],
  'Buzz': ['Базз'],
  'By Баста': ['Баста', 'Бай Баста', 'By Basta', 'Basta'],
  'Carabao': ['Карабао'],
  'Cosmos': ['Космос'],
  'Dracula': ['Дракула'],
  'Dydo': ['Дайдо'],
  'Fitness Food Factory': ['Фитнес Фуд Фактори', 'FFF'],
  'FitnessShock': ['Фитнес Шок', 'Фитнесшок', 'Fitness Shock'],
  'Flash Up': ['Флэш', 'Флеш', 'Flash'],
  'Fun Up': ['Фан Ап', 'Фанап'],
  'Genesis': ['Генезис', 'Генесис'],
  'Go Champ': ['Гоу Чемп', 'Го Чемп', 'Гоу Чамп'],
  'HQD Energy': ['HQD', 'ХКД', 'Эйч Кью Ди'],
  'Juster': ['Джастер'],
  'Milano': ['Милано'],
  'My Rules': ['Май Рулз', 'Май Рулс'],
  'Neft': ['Нефть'],
  'Ninja': ['Ниндзя', 'The Ninja'],
  'Ninja Star': ['Ниндзя'],
  'Plan B': ['План Б', 'План Би'],
  'Power Torr': ['Пауэр Торр', 'Пауэр Тор', 'Повер Торр'],
  'Pulseup': ['Пульсап', 'Пульс Ап', 'Pulse Up'],
  'Quantum': ['Квантум'],
  'Rocket': ['Рокет Райд', 'Rocket Ride'],
  'Sangaria': ['Сангария'],
  'Scandalist': ['Скандалист'],
  'Sparkling': ['Спарклинг'],
  'SPAR': ['Спар'],
  'Target': ['Таргет'],
  'Tassay': ['Тассай', 'Тасай'],
  'Toxic Waste': ['Токсик Вейст', 'Токсик'],
  'Tusa': ['Туса'],
  'White Shark': ['Уайт Шарк', 'Вайт Шарк'],
  'Wk Up': ['Вейк Ап', 'Вэйк Ап', 'Wake Up', 'Вейкап'],
  'X-Turbo': ['Икс Турбо', 'Х-Турбо', 'Турбо'],
  'Байкал': ['Baikal', 'Baykal'],
  'Восторг': ['Vostorg', 'Reckful'],
};

const LATIN: ReadonlyArray<[RegExp, string]> = [
  [/shch/g, 'щ'], [/sch/g, 'ш'], [/sh/g, 'ш'], [/ch/g, 'ч'], [/zh/g, 'ж'], [/kh/g, 'х'], [/ts/g, 'ц'],
  [/ya/g, 'я'], [/yu/g, 'ю'], [/yo/g, 'ё'], [/ph/g, 'ф'], [/th/g, 'т'], [/ck/g, 'к'], [/ee/g, 'и'], [/oo/g, 'у'],
  [/c(?=[eiy])/g, 'с'], [/x/g, 'кс'], [/y(?![aeiouаеиоуыэюя])/g, 'й'],
];
const LATIN_LETTERS: Record<string, string> = { a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', y: 'ы', z: 'з' };
const CYRILLIC_LETTERS: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };

/** Rough phonetic spelling in the other script; typo tolerance in search covers the rest. */
export function transliterate(value: string): string {
  const lower = value.toLocaleLowerCase('ru-RU');
  if (/[а-яё]/u.test(lower)) return [...lower].map(char => CYRILLIC_LETTERS[char] ?? char).join('');
  let text = lower;
  for (const [pattern, replacement] of LATIN) text = text.replace(pattern, replacement);
  return [...text].map(char => LATIN_LETTERS[char] ?? char).join('');
}

/** Every spelling a brand can be found by: its name, parser and search aliases, and their transliterations. */
export function brandSearchTerms(brand: string): string[] {
  const names = [brand, ...(ENERGY_DRINK_BRAND_ALIASES[brand] ?? []), ...(BRAND_SEARCH_ALIASES[brand] ?? [])];
  return [...new Set([...names, ...names.map(transliterate)])];
}
