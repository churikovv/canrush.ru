import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AvatarFrame } from '@/components/avatar-frame';
import { HEAVY_FRAMES } from '@/components/avatar-frame-heavy';
import { PROFILE_FRAMES, parseProfileAppearance } from '@/lib/profile-appearance';

it('draws every heavy frame with finite, rounded coordinates so hydration cannot drift', () => {
  for (const frame of HEAVY_FRAMES) {
    const html = renderToStaticMarkup(createElement(AvatarFrame, { frame }));
    expect(html).toContain(`avatar-frame-heavy avatar-frame-${frame}`);
    expect(html).not.toMatch(/NaN|Infinity/);
    // Server and browser trigonometry differ past ~12 digits; geometry is rounded to hundredths.
    expect(html).not.toMatch(/\d\.\d{3,}/);
  }
});

it('keeps gradient ids unique per avatar on the same page', () => {
  const html = renderToStaticMarkup(createElement('div', null, createElement(AvatarFrame, { frame: 'legend' }), createElement(AvatarFrame, { frame: 'legend' })));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
});

it('offers a heavy frame on each step up to Legend and accepts them as saved appearance', () => {
  expect(PROFILE_FRAMES.filter(frame => (HEAVY_FRAMES as readonly string[]).includes(frame.key)).map(frame => frame.level)).toEqual([10, 12, 15, 18, 20]);
  for (const frame of HEAVY_FRAMES) expect(parseProfileAppearance({ theme: 'default', frame })).toEqual({ theme: 'default', frame });
});
