import { describe, expect, it } from 'vitest';
import { LAVKA_PROMO, PEREKRESTOK_PROMO, adLastDay, adMarking, adShown, pickDrinkAd } from '@/lib/partner-ads';

describe('partner ads', () => {
  it('marks the Lavka ad the way the law on advertising asks: the word, the advertiser with ИНН, the token', () => {
    expect(adMarking(LAVKA_PROMO)).toBe('Реклама. ООО «Яндекс.Лавка», ИНН 9718101499. erid: 2RanyoAQiyi');
    expect(new URL(LAVKA_PROMO.href).searchParams.get('erid')).toBe(LAVKA_PROMO.erid);
  });

  it('shows the codes only where Lavka delivers, until the last minute of 31 December in Moscow, unless hidden', () => {
    const before = new Date('2026-12-31T20:59:00Z');
    expect(adShown(LAVKA_PROMO, 'moscow', before)).toBe(true);
    expect(adShown(LAVKA_PROMO, 'saint-petersburg', before)).toBe(true);
    expect(adShown(LAVKA_PROMO, 'omsk', before)).toBe(false);
    expect(adShown(LAVKA_PROMO, 'moscow', new Date('2026-12-31T21:00:00Z'))).toBe(false);
    expect(adShown(LAVKA_PROMO, 'moscow', before, true)).toBe(false);
    expect(adLastDay(LAVKA_PROMO)).toBe('31 декабря');
  });

  it('offers the two codes the owner picked: −50% for new customers, −40% for those back after a year', () => {
    expect(LAVKA_PROMO.codes.map(item => [item.value, item.code])).toEqual([['−50%', '50SUP433'], ['−40%', '40ARU472']]);
  });

  it('marks Perekrestok with X5 Digital and its own token, everywhere and without an end date', () => {
    expect(adMarking(PEREKRESTOK_PROMO)).toBe('Реклама. ООО «ИКС 5 ДИДЖИТАЛ», ИНН 9722010808. erid: 2RanykXiLS8');
    expect(new URL(PEREKRESTOK_PROMO.href).searchParams.get('erid')).toBe(PEREKRESTOK_PROMO.erid);
    expect(adShown(PEREKRESTOK_PROMO, 'khabarovsk', new Date('2027-06-01T00:00:00Z'))).toBe(true);
    expect(adLastDay(PEREKRESTOK_PROMO)).toBeNull();
    expect(PEREKRESTOK_PROMO.codes.map(item => [item.value, item.code])).toEqual([['−40%', '1956EDXBA'], ['−99%', '197ZU63MP']]);
  });

  it('lets Lavka and Perekrestok take turns where both run, and Perekrestok’s two banners elsewhere', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const none = () => false;
    expect(pickDrinkAd('moscow', none, now, () => 0.1)).toEqual({ ad: LAVKA_PROMO, code: 0 });
    expect(pickDrinkAd('moscow', none, now, () => 0.9)).toEqual({ ad: PEREKRESTOK_PROMO, code: 1 });
    expect(pickDrinkAd('omsk', none, now, () => 0.2)).toEqual({ ad: PEREKRESTOK_PROMO, code: 0 });
    expect(pickDrinkAd('omsk', none, now, () => 0.7)).toEqual({ ad: PEREKRESTOK_PROMO, code: 1 });
    // After 31 December Lavka is gone, and a campaign hidden here never comes up.
    expect(pickDrinkAd('moscow', none, new Date('2027-01-02T00:00:00Z'), () => 0.1)?.ad).toBe(PEREKRESTOK_PROMO);
    expect(pickDrinkAd('moscow', ad => ad === PEREKRESTOK_PROMO, now, () => 0.9)?.ad).toBe(LAVKA_PROMO);
    expect(pickDrinkAd('omsk', ad => ad === PEREKRESTOK_PROMO, now)).toBeNull();
  });
});
