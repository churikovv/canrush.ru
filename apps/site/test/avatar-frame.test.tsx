import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AvatarFrame } from '@/components/avatar-frame';
import { BRAND_FRAMES } from '@/components/avatar-frame-brands';
import { HEAVY_FRAMES } from '@/components/avatar-frame-heavy';
import { SHOP_FRAMES } from '@/components/avatar-frame-shop';
import { nextAppearanceUnlock, PROFILE_FRAMES, parseProfileAppearance } from '@/lib/profile-appearance';
import { SHOP_ITEMS } from '@/lib/shop-items';

it('draws every heavy frame with finite, rounded coordinates so hydration cannot drift', () => {
  for (const frame of [...HEAVY_FRAMES, ...BRAND_FRAMES]) {
    const html = renderToStaticMarkup(createElement(AvatarFrame, { frame }));
    expect(html).toMatch(new RegExp(`avatar-frame-heavy (avatar-frame-brand )?avatar-frame-${frame}`));
    expect(html).not.toMatch(/NaN|Infinity/);
    // Server and browser trigonometry differ past ~12 digits; geometry is rounded to hundredths.
    expect(html).not.toMatch(/\d\.\d{3,}/);
  }
});

it('keeps gradient ids unique per avatar on the same page', () => {
  for (const frame of ['legend', 'burn', 'redbull'] as const) {
    const html = renderToStaticMarkup(createElement('div', null, createElement(AvatarFrame, { frame }), createElement(AvatarFrame, { frame })));
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    // Every gradient a frame paints with is defined in the same avatar.
    for (const [, ref] of html.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(ref);
  }
});

it('offers every brand frame as a saved appearance outside the level rewards', () => {
  for (const frame of BRAND_FRAMES) {
    expect(parseProfileAppearance({ theme: 'default', frame })).toEqual({ theme: 'default', frame });
    expect(PROFILE_FRAMES.find(item => item.key === frame)).toMatchObject({ level: 999, brand: expect.any(String) });
  }
});

it('sells every shop frame outside the level rewards and draws it', () => {
  for (const item of SHOP_ITEMS.filter(entry => entry.kind === 'frame')) {
    expect(parseProfileAppearance({ theme: 'default', frame: item.key })).toEqual({ theme: 'default', frame: item.key });
    expect(PROFILE_FRAMES.find(entry => entry.key === item.key)).toMatchObject({ level: 999, shop: true });
    expect(nextAppearanceUnlock(1)?.frames).not.toContain(item.label);
    expect(renderToStaticMarkup(createElement(AvatarFrame, { frame: item.key as never }))).toContain(`avatar-frame-shop avatar-frame-${item.key}`);
  }
  expect(SHOP_FRAMES).toEqual(SHOP_ITEMS.filter(entry => entry.kind === 'frame').map(entry => entry.key));
});

it('offers a heavy frame on each step up to Legend and accepts them as saved appearance', () => {
  expect(PROFILE_FRAMES.filter(frame => (HEAVY_FRAMES as readonly string[]).includes(frame.key)).map(frame => frame.level)).toEqual([10, 12, 15, 18, 20]);
  for (const frame of HEAVY_FRAMES) expect(parseProfileAppearance({ theme: 'default', frame })).toEqual({ theme: 'default', frame });
});
