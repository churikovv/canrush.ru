import { describe, expect, it } from 'vitest';
import { LAVKA_PROMO, adLastDay, adMarking, adShown } from '@/lib/partner-ads';

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
});
