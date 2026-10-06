import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteLoading } from '@/components/site-loading';
import { LOADING_BLOCK_COUNT, LOADING_GLYPHS, loadingBlockFrames } from '@/lib/loading-word';

describe('Canrush loading screen', () => {
  it('renders an accessible status and a visible initial glyph without JavaScript', () => {
    const html = renderToStaticMarkup(createElement(SiteLoading));
    expect(html).toContain('Canrush'); expect(html).toContain('role="status"'); expect(html).toContain('aria-busy="true"');
    expect(html.match(/<rect /g)).toHaveLength(LOADING_BLOCK_COUNT);
    expect(html).not.toContain('<canvas');
  });
  it('morphs seven letters and returns every block to its initial position', () => {
    expect(LOADING_GLYPHS).toHaveLength(7);
    for (let block = 0; block < LOADING_BLOCK_COUNT; block++) {
      const frames = loadingBlockFrames(block);
      expect(frames[0]?.offset).toBe(0); expect(frames.at(-1)?.offset).toBe(1);
      expect(frames[0]?.transform).toBe(frames.at(-1)?.transform);
      expect(frames.map(frame => frame.offset)).toEqual(frames.map(frame => frame.offset).sort((a, b) => Number(a) - Number(b)));
    }
  });
});
