import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
const { DecorMotionSettings } = await import('@/components/decor-motion-settings');
const { decorMotionChoice } = await import('@/lib/decor-motion');

describe('animation of tags and frames', () => {
  it('follows the device unless the member chose', () => {
    expect(decorMotionChoice(undefined)).toBeNull();
    expect(decorMotionChoice('true')).toBeNull();
    expect(decorMotionChoice('on')).toBe('on');
    expect(decorMotionChoice('off')).toBe('off');
  });

  it('is one switch in the settings and a way back to the device default', () => {
    // The server does not know the device: the automatic switch renders still and says it follows the device.
    const auto = renderToStaticMarkup(createElement(DecorMotionSettings, { choice: null }));
    expect(auto).toContain('role="switch"');
    expect(auto).not.toContain('checked=""');
    expect(auto).toContain('Автоматически');
    expect(auto).not.toContain('Как на устройстве');
    const on = renderToStaticMarkup(createElement(DecorMotionSettings, { choice: 'on' }));
    expect(on).toContain('checked=""');
    expect(on).toContain('Включено вами');
    expect(on).toContain('Как на устройстве');
    expect(renderToStaticMarkup(createElement(DecorMotionSettings, { choice: 'off' }))).toContain('Выключено вами');
  });
});
