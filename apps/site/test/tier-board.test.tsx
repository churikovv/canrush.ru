import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { TierBoard } from '../src/components/tier-board';
it('omits missing cards but retains archived products with no retailers or image', () => {
 const html = renderToStaticMarkup(createElement(TierBoard, {
  products: [{ id: 'burn', brand: 'Burn', flavor: 'original', flavorLabel: 'Оригинальный', retailerCount: 0, reviewCount: 0 }],
  placements: [{ brand: 'Burn', flavor: 'original', tier: 'S', position: 0 }, { brand: 'Missing', flavor: 'original', tier: 'A', position: 0 }],
 }));
 expect(html).toContain('Открыть Burn');
 expect(html).not.toContain('Missing');
 expect(html.match(/class="tier-board-product"/g)).toHaveLength(1);
 expect(html).toContain('Пока пусто');
});
