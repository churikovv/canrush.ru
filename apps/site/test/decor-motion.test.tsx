import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
const { DecorMotionSettings } = await import('@/components/decor-motion-settings');
const { decorMotionOn } = await import('@/lib/decor-motion');

describe('animation of tags and frames', () => {
  it('is off unless the cookie says «on»', () => {
    expect(decorMotionOn(undefined)).toBe(false);
    expect(decorMotionOn('off')).toBe(false);
    expect(decorMotionOn('true')).toBe(false);
    expect(decorMotionOn('on')).toBe(true);
  });

  it('is one switch in the settings, showing what is chosen', () => {
    const off = renderToStaticMarkup(createElement(DecorMotionSettings, { on: false }));
    expect(off).toContain('role="switch"');
    expect(off).not.toContain('checked=""');
    expect(off).toContain('Выключено');
    expect(renderToStaticMarkup(createElement(DecorMotionSettings, { on: true }))).toContain('checked=""');
  });
});
