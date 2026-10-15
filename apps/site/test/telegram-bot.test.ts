import { describe, expect, it } from 'vitest';
import { bestPromos, promoKey, type BotPromo } from '../src/lib/telegram-bot/catalog.js';
import { escapeHtml, marketText, productSummary, promoAlertText } from '../src/lib/telegram-bot/format.js';
import { moscowClock, TELEGRAM_JOBS } from '../src/lib/telegram-bot/jobs.js';

const promo = (overrides: Partial<BotPromo>): BotPromo => ({
  brand: 'Burn', flavor: 'original', retailer: 'Пятёрочка', volumeMl: 449, price: 99, promoEndsAt: '2026-10-20T21:00:00.000Z', ...overrides,
});

describe('Telegram bot formatting', () => {
  it('escapes HTML from user content', () => {
    expect(escapeHtml('<b>Tom & Jerry</b>')).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
    expect(marketText('message', 'Банки <script>', 'Аня', 'привет <i>')).toContain('Банки &lt;script&gt;');
    expect(marketText('message', 'x', 'Аня', 'привет <i>')).toContain('привет &lt;i&gt;');
  });

  it('describes prices, ratings and promotions', () => {
    expect(productSummary({ brand: 'Burn', flavor: 'original', cheapest: { price: 89.9, retailer: 'Магнит', volumeMl: 449 }, rating: { overall: 8.25, count: 12 } }))
      .toBe('от 89,9 ₽ в «Магнит», 449 мл · ★ 8.3 (12)');
    expect(productSummary({ brand: 'Burn', flavor: 'original' })).toBe('нет в продаже в вашем городе');
    const text = promoAlertText([promo({ oldPrice: 129 })], 'Москва');
    expect(text).toContain('Энергетик из избранного по акции');
    expect(text).toContain('<s>129 ₽</s>');
    expect(text).toContain('до 21 октября');
  });
});

describe('Telegram promotions', () => {
  it('keeps one best deal per drink, biggest discount first', () => {
    const best = bestPromos([
      promo({ price: 90 }),
      promo({ price: 80, retailer: 'Магнит' }),
      promo({ brand: 'Adrenaline', price: 100, oldPrice: 200 }),
    ], 5);
    expect(best.map(item => `${item.brand}:${item.price}`)).toEqual(['Adrenaline:100', 'Burn:80']);
  });

  it('identifies a promotion by drink, retailer, volume and end date', () => {
    expect(promoKey(promo({ price: 70 }))).toBe(promoKey(promo({ price: 99 })));
    expect(promoKey(promo({ promoEndsAt: '2026-10-27T21:00:00.000Z' }))).not.toBe(promoKey(promo({})));
  });
});

describe('Telegram schedule', () => {
  it('reads the Moscow clock', () => {
    expect(moscowClock(new Date('2026-10-18T22:30:00Z'))).toEqual({ date: '2026-10-19', hour: 1, weekday: 1 });
  });

  it('runs daily jobs after their hour and the digest on Monday only', () => {
    const due = (iso: string) => TELEGRAM_JOBS.filter(job => job.due(moscowClock(new Date(iso)))).map(job => job.name);
    expect(due('2026-10-19T05:00:00Z')).toEqual(['prune']);
    expect(due('2026-10-19T08:30:00Z')).toEqual(['prune', 'admin-summary', 'promo-alerts', 'weekly-digest']);
    expect(due('2026-10-20T08:30:00Z')).toEqual(['prune', 'admin-summary', 'promo-alerts']);
  });
});
