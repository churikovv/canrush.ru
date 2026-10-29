import { describe, expect, it } from 'vitest';
import { drinkJsonLd } from '../src/lib/drink-json-ld';

const offer = (price: number) => ({ source: 'edadeal' as const, price, url: 'https://example.com', fetchedAt: '2026-10-29T00:00:00.000Z' });

describe('drink JSON-LD', () => {
  it('describes the drink with its rating out of 10 and the city prices as one aggregate offer', () => {
    const data = JSON.parse(drinkJsonLd({ brand: 'Tornado', flavor: 'mango', variants: [offer(89.99), offer(119), offer(0)], coverImageUrl: '/images/products/a.jpg' }, { count: 12, overall: 7.4166 })!);
    expect(data).toMatchObject({
      '@type': 'Product', brand: { '@type': 'Brand', name: 'Tornado' }, image: ['https://canrush.ru/images/products/a.jpg'],
      aggregateRating: { ratingValue: 7.4, bestRating: 10, worstRating: 1, ratingCount: 12 },
      offers: { '@type': 'AggregateOffer', priceCurrency: 'RUB', lowPrice: 89.99, highPrice: 119, offerCount: 2 },
    });
    expect(data.url).toMatch(/^https:\/\/canrush\.ru\/catalog\//u);
  });

  it('leaves out what is missing, and gives nothing without a rating or prices', () => {
    const rated = JSON.parse(drinkJsonLd({ brand: 'Burn', flavor: 'apple', variants: [] }, { count: 3, overall: 8 }, 'Описание')!);
    expect(rated.offers).toBeUndefined();
    expect(rated.image).toBeUndefined();
    expect(rated.description).toBe('Описание');
    expect(drinkJsonLd({ brand: 'Burn', flavor: 'apple', variants: [] }, { count: 0, overall: 0 })).toBeNull();
  });

  it('prefers the full name and escapes markup', () => {
    const raw = drinkJsonLd({ brand: 'Monster', flavor: 'peach:sugarfree', variants: [offer(150)], fullName: 'Monster Ultra Peachy Keen</script>' }, { count: 0, overall: 0 })!;
    expect(raw).not.toContain('</script>');
    expect(JSON.parse(raw).name).toBe('Monster Ultra Peachy Keen</script>');
  });
});
