/**
 * Partners' ads on the site: the campaign, its marking and where it is shown. No database: a campaign is a constant with
 * an end date, so a new one is a new entry. The law on advertising asks for three things on every placement — the word
 * «Реклама», the advertiser (name and ИНН) and the token from the ad registry (erid) in the link — `adMarking` writes
 * them one way everywhere.
 */
import type { CityId } from '@canrush/shared';

export interface PromoCode {
  code: string;
  /** The discount itself, large: «−50%». */
  value: string;
  /** For whom: «на первый заказ». The first code is the main offer, the rest are shown smaller under it. */
  who: string;
}

export interface PartnerAd {
  key: string;
  advertiser: string;
  inn: string;
  erid: string;
  href: string;
  /** The first moment the ad is no longer shown. */
  endsAt: string;
  cities: readonly CityId[];
  codes: readonly PromoCode[];
  /** The order and the cap the codes share, as the advertiser's flyer says it. */
  terms: string;
}

/**
 * Yandex Lavka's promo codes, November–December 2026, through Perfluence (`prfl.me`): the −50% and −40% ones (the owner's
 * choice; the flyer's −300 ₽ code is left out). Cities: only where our parser sees
 * Lavka's prices every night — Moscow and Saint Petersburg (`sources.lavka.cities`). Lavka may deliver elsewhere too,
 * but its pages answer our checks with a captcha, so another city is added here only when the partner confirms it.
 */
export const LAVKA_PROMO: PartnerAd = {
  key: 'lavka-2026-12',
  advertiser: 'ООО «Яндекс.Лавка»',
  inn: '9718101499',
  erid: '2RanyoAQiyi',
  href: 'https://yalavka.prfl.me/sites/abln2r?erid=2RanyoAQiyi',
  endsAt: '2027-01-01T00:00:00+03:00',
  cities: ['moscow', 'saint-petersburg'],
  codes: [
    { code: '50SUP433', value: '−50%', who: 'на первый заказ' },
    { code: '40ARU472', value: '−40%', who: 'вернувшимся' },
  ],
  terms: '−40% — если не заказывали больше года. Заказ от 700 ₽, скидка до 500 ₽',
};

/** «Скрыть» keeps the ad away from this browser for a week; the cookie names the campaign, so a new one shows again. */
export const AD_HIDE_DAYS = 7;
export const adHiddenCookie = (ad: Pick<PartnerAd, 'key'>) => `canrush-ad-hidden-${ad.key}`;

export function adMarking(ad: Pick<PartnerAd, 'advertiser' | 'inn' | 'erid'>): string {
  return `Реклама. ${ad.advertiser}, ИНН ${ad.inn}. erid: ${ad.erid}`;
}

export function adShown(ad: Pick<PartnerAd, 'endsAt' | 'cities'>, city: string, now = new Date(), hidden = false): boolean {
  return !hidden && now.getTime() < Date.parse(ad.endsAt) && (ad.cities as readonly string[]).includes(city);
}

/** «до 31 декабря» — the last day the codes work, in Moscow time. */
export function adLastDay(ad: Pick<PartnerAd, 'endsAt'>): string {
  return new Date(Date.parse(ad.endsAt) - 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
}
