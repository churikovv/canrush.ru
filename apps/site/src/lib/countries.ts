/**
 * Countries a can may come from, for the «Страна производства» select of a review. Stored as the ISO 3166-1 alpha-2
 * code (`review.country`); the list is the source of truth for both the form and the server.
 */
export interface Country { code: string; name: string }

/** Where most cans sold in Russia are made: shown first in the select. */
const FREQUENT = ['RU', 'BY', 'KZ', 'AT', 'PL', 'DE', 'CN', 'TR'];

const NAMES: Record<string, string> = {
  AE: 'ОАЭ', AM: 'Армения', AT: 'Австрия', AU: 'Австралия', AZ: 'Азербайджан', BE: 'Бельгия', BG: 'Болгария', BR: 'Бразилия',
  BY: 'Беларусь', CA: 'Канада', CH: 'Швейцария', CN: 'Китай', CZ: 'Чехия', DE: 'Германия', DK: 'Дания', EE: 'Эстония',
  ES: 'Испания', FI: 'Финляндия', FR: 'Франция', GB: 'Великобритания', GE: 'Грузия', GR: 'Греция', HU: 'Венгрия',
  ID: 'Индонезия', IE: 'Ирландия', IL: 'Израиль', IN: 'Индия', IR: 'Иран', IT: 'Италия', JP: 'Япония', KG: 'Киргизия',
  KR: 'Южная Корея', KZ: 'Казахстан', LT: 'Литва', LV: 'Латвия', MD: 'Молдова', MN: 'Монголия', MX: 'Мексика',
  MY: 'Малайзия', NL: 'Нидерланды', NO: 'Норвегия', PH: 'Филиппины', PL: 'Польша', PT: 'Португалия', RO: 'Румыния',
  RS: 'Сербия', RU: 'Россия', SE: 'Швеция', SI: 'Словения', SK: 'Словакия', TH: 'Таиланд', TJ: 'Таджикистан',
  TM: 'Туркменистан', TR: 'Турция', TW: 'Тайвань', UA: 'Украина', US: 'США', UZ: 'Узбекистан', VN: 'Вьетнам',
  ZA: 'ЮАР',
};

const byName = (a: Country, b: Country) => a.name.localeCompare(b.name, 'ru');
export const FREQUENT_COUNTRIES: Country[] = FREQUENT.map(code => ({ code, name: NAMES[code]! }));
export const OTHER_COUNTRIES: Country[] = Object.entries(NAMES)
  .filter(([code]) => !FREQUENT.includes(code)).map(([code, name]) => ({ code, name })).sort(byName);

export const isCountryCode = (value: unknown): value is string => typeof value === 'string' && Object.hasOwn(NAMES, value);
export const countryName = (code: string | null | undefined): string | null => (code && NAMES[code]) || null;

/** The flag emoji of a code: two regional indicator letters (Windows shows them as the letters themselves). */
export const countryFlag = (code: string): string => String.fromCodePoint(...[...code].map(letter => 0x1f1e6 + letter.charCodeAt(0) - 65));
