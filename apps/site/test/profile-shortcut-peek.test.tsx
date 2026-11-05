import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ShortcutCans, ShortcutEmblems } from '../src/components/profile-shortcut-peek';
import { favoriteCans } from '../src/lib/profile-shortcut-cans';

it('fans out up to three cans, the first in the middle, our covers without their background', () => {
  const html = renderToStaticMarkup(<ShortcutCans cans={[
    { key: 'a', label: 'A', cover: '/images/products/a.jpg' },
    { key: 'b', label: 'B', cover: 'https://cdn.example/b.jpg' },
    { key: 'c', label: 'C', cover: '/images/products/c.jpg' },
  ]} />);
  expect(html.match(/data-slot="(\w+)"/g)).toEqual(['data-slot="center"', 'data-slot="left"', 'data-slot="right"']);
  expect(html).toContain('/api/can-cutouts?src=%2Fimages%2Fproducts%2Fa.jpg');
  // Another site's photo is shown as it is and keeps no cutout mark.
  expect(html).toContain('https://cdn.example/b.jpg');
  expect(html.match(/data-cutout/g)).toHaveLength(2);
  expect(html).toContain('aria-hidden="true"');
});

it('puts two things side by side and the proudest emblem in the middle of three', () => {
  expect(renderToStaticMarkup(<ShortcutCans cans={[{ key: 'a', label: 'A', cover: '/a.jpg' }, { key: 'b', label: 'B', cover: '/b.jpg' }]} />).match(/data-slot="(\w+)"/g))
    .toEqual(['data-slot="left"', 'data-slot="right"']);
  const html = renderToStaticMarkup(<ShortcutEmblems emblems={[{ key: 'streak-30', rarity: 'legendary', tier: 1, tiers: 1 }, { key: 'burner', rarity: 'epic', tier: 2, tiers: 3 }]} />);
  expect(html).toContain('data-rarity="legendary"');
  expect(html).toContain('data-kind="emblems"');
});

it('takes favourite cans only with a cover', () => {
  const groups = [{ brand: 'Burn', flavor: 'orange', coverImageUrl: '/x.jpg' }, { brand: 'Monster', flavor: 'original' }] as Parameters<typeof favoriteCans>[0];
  expect(favoriteCans(groups)).toEqual([{ key: JSON.stringify(['Burn', 'orange']), label: 'Burn · Апельсин', cover: '/x.jpg' }]);
});
