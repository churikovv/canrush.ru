import { describe, expect, it } from 'vitest';
import { parseListing, canTransitionOrder } from '@/lib/market-fields';

function form() {
  const value = new FormData();
  for (const [key, text] of Object.entries({ title: 'Monster Japan', description: 'Набор из трёх банок', city: 'Москва', price: '1200,50', quantity: '6', delivery: 'pickup' })) value.append(key, text);
  return value;
}
describe('market validation', () => {
  it('stores money as integer kopecks', () => { expect(parseListing(form()).price).toBe(120050); });
  it('rejects missing delivery, unsupported delivery and invalid prices', () => {
    for (const price of ['-1', '0', '1.001', 'Infinity', '1e3', '10000001']) { const data = form(); data.set('price', price); expect(() => parseListing(data)).toThrow(); }
    const data = form(); data.delete('delivery'); expect(() => parseListing(data)).toThrow();
    data.set('delivery', 'unknown'); expect(() => parseListing(data)).toThrow();
  });
  it('requires an integer stock from 1 to 100000', () => {
    expect(parseListing(form()).quantity).toBe(6);
    for (const quantity of ['', '0', '-1', '1.5', '1e2', '100001', 'Infinity']) {
      const data = form(); data.set('quantity', quantity); expect(() => parseListing(data)).toThrow();
    }
  });
  it('enforces roles and terminal states', () => {
    expect(canTransitionOrder('new', 'confirmed', 'seller')).toBe(true);
    expect(canTransitionOrder('new', 'confirmed', 'buyer')).toBe(false);
    expect(canTransitionOrder('confirmed', 'completed', 'buyer')).toBe(true);
    expect(canTransitionOrder('confirmed', 'completed', 'seller')).toBe(false);
    expect(canTransitionOrder('new', 'completed', 'buyer')).toBe(false);
    expect(canTransitionOrder('new', 'cancelled', 'buyer')).toBe(true);
    expect(canTransitionOrder('confirmed', 'cancelled', 'seller')).toBe(true);
    expect(canTransitionOrder('completed', 'cancelled', 'buyer')).toBe(false);
    expect(canTransitionOrder('cancelled', 'confirmed', 'seller')).toBe(false);
  });
});
