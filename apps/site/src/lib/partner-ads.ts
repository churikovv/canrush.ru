/**
 * Partners' ads on the site: the campaigns, their marking and where they are shown. No database: a campaign is a
 * constant, so a new one is a new entry. The law on advertising asks for three things on every placement — the word
 * «Реклама», the advertiser (name and ИНН) and the token from the ad registry (erid) — `adMarking` writes them one way
 * everywhere, and the token also goes into the link.
 */
import type { CityId } from '@canrush/shared';

export interface PromoCode {
  code: string;
  /** The discount itself, large: «−50%». */
  value: string;
  /** For whom or on what: «на первый заказ». */
  who: string;
  /** A creative's headline around the discount: «{value} с экспресс-доставкой» (Perekrestok has one per code). */
  title?: string;
  /** The order and the cap of this code: «Заказ от 1500 ₽, скидка до 600 ₽». */
  order?: string;
}

export interface PartnerAd {
  key: string;
  advertiser: string;
  inn: string;
  erid: string;
  href: string;
  /** The first moment the ad is no longer shown; null — until it is taken off here. */
  endsAt: string | null;
  cities: readonly CityId[] | 'all';
  codes: readonly PromoCode[];
  /** What the codes share, as the advertiser words it. */
  terms: string;
}

/**
 * Yandex Lavka's promo codes, November–December 2026, through Perfluence (`prfl.me`): the −50% and −40% ones (the owner's
 * choice; the flyer's −300 ₽ code is left out). Cities: only where our parser sees Lavka's prices every night — Moscow
 * and Saint Petersburg (`sources.lavka.cities`). Lavka may deliver elsewhere too, but its pages answer our checks with a
 * captcha, so another city is added here only when the partner confirms it. One banner, the first code the main offer.
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

/**
 * Perekrestok's delivery codes (X5 Digital), November 2026, through Perfluence (`prfl.me`): every city, no end date yet.
 * Two banners, one per code. Headlines are the owner's words; the cap of
 * 600 ₽ is the same for both.
 */
export const PEREKRESTOK_PROMO: PartnerAd = {
  key: 'perekrestok-2026-11',
  advertiser: 'ООО «ИКС 5 ДИДЖИТАЛ»',
  inn: '9722010808',
  erid: '2RanykXiLS8',
  href: 'https://perekrestok.prfl.me/sites/fjcpm5?erid=2RanykXiLS8',
  endsAt: null,
  cities: 'all',
  codes: [
    { code: '1956EDXBA', value: '−40%', who: 'на экспресс-доставку', title: '{value} с экспресс‑доставкой', order: 'Заказ от 1500 ₽, скидка до 600 ₽' },
    { code: '197ZU63MP', value: '−99%', who: 'на готовую еду', title: 'Закажите готовой еды к энергетику со скидкой {value}', order: 'Заказ от 1000 ₽, скидка до 600 ₽' },
  ],
  terms: 'Промокоды действуют и у тех, кто не заказывал в доставке больше года. Не суммируются с товарами со знаком «Низкая цена». Условия доставки уточняйте на сайте perekrestok.ru или в приложении «Перекрёсток Доставка»',
};

/** Campaigns that take turns at the start of a drink card. */
export const DRINK_ADS: readonly PartnerAd[] = [LAVKA_PROMO, PEREKRESTOK_PROMO];

/** «✕» keeps a campaign away from this browser for a week; the cookie names the campaign, so another one still shows. */
export const AD_HIDE_DAYS = 7;
export const adHiddenCookie = (ad: Pick<PartnerAd, 'key'>) => `canrush-ad-hidden-${ad.key}`;

export function adMarking(ad: Pick<PartnerAd, 'advertiser' | 'inn' | 'erid'>): string {
  return `Реклама. ${ad.advertiser}, ИНН ${ad.inn}. erid: ${ad.erid}`;
}

export function adShown(ad: Pick<PartnerAd, 'endsAt' | 'cities'>, city: string, now = new Date(), hidden = false): boolean {
  return !hidden && (ad.endsAt === null || now.getTime() < Date.parse(ad.endsAt))
    && (ad.cities === 'all' || (ad.cities as readonly string[]).includes(city));
}

/** «до 31 декабря» — the last day the codes work, in Moscow time; none for a campaign without an end. */
export function adLastDay(ad: Pick<PartnerAd, 'endsAt'>): string | null {
  return ad.endsAt === null ? null : new Date(Date.parse(ad.endsAt) - 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
}

/**
 * Which banner opens this drink card: one of the campaigns running in the city and not hidden here, each as likely as
 * the others, then one of its codes if every code is its own banner (Perekrestok). In Moscow and Saint Petersburg Lavka
 * and Perekrestok take turns; elsewhere it is Perekrestok's two banners. Picked anew on every view.
 */
export function pickDrinkAd(city: string, hidden: (ad: PartnerAd) => boolean, now = new Date(), random = Math.random): { ad: PartnerAd; code: number } | null {
  const running = DRINK_ADS.filter(ad => adShown(ad, city, now, hidden(ad)));
  const ad = running[Math.min(running.length - 1, Math.floor(random() * running.length))];
  if (!ad) return null;
  const perCode = ad.codes.every(code => code.title);
  return { ad, code: perCode ? Math.min(ad.codes.length - 1, Math.floor(random() * ad.codes.length)) : 0 };
}
