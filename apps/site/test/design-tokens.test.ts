import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The design system's rules that CSS alone can break (DESIGN.md, «Token layers»): the guard reads every stylesheet.
 * Comments, data URIs and custom property definitions are left out — a token is defined with a raw value once.
 */
const dir = new URL('../src/', import.meta.url);
const sheets = ['app/globals.css', 'app/site-theme.css', ...readdirSync(new URL('styles/', dir)).filter(name => name.endsWith('.css')).map(name => `styles/${name}`)];
const read = (path: string) => readFileSync(new URL(path, dir), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/url\((["'])data:[\s\S]*?\1\)/g, 'url()');
const css = sheets.map(path => ({ path, text: read(path) }));
/** Declarations only, without the ones that define a custom property. */
const declarations = (text: string) => [...text.matchAll(/([^{};]+)\{([^{}]*)\}/g)]
  .flatMap(([, selector, body]) => body!.split(';').map(part => ({ selector: selector!.trim(), part: part.trim() })))
  .filter(({ part }) => part && !part.startsWith('--'));
const rootColors = [...read('app/globals.css').match(/:root \{([\s\S]*?)\n\}/)![1]!.matchAll(/(--color-[\w-]+)\s*:/g)].map(match => match[1]!);

describe('design tokens', () => {
  it('names the fixed brand blue instead of writing it', () => {
    const raw = css.flatMap(({ path, text }) => declarations(text).filter(({ part }) => /#(?:006eff|0058cc)\b/i.test(part) && !/\[[^\]]*#/.test(part)).map(({ part }) => `${path}: ${part}`));
    expect(raw).toEqual([]);
  });

  it('uses theme and colour tokens without fallbacks: they are always defined in :root', () => {
    const fallbacks = css.flatMap(({ path, text }) => [...text.matchAll(/var\((--theme-[\w-]+|--color-[\w-]+)\s*,/g)]
      .filter(([, name]) => name!.startsWith('--theme-') || rootColors.includes(name!)).map(([match]) => `${path}: ${match}`));
    expect(fallbacks).toEqual([]);
  });

  it('keeps one phone breakpoint: max-width 639px, never 640px', () => {
    expect(css.filter(({ text }) => /max-width:\s*640px\s*\)/.test(text)).map(({ path }) => path)).toEqual([]);
  });

  it('sizes text in rem, except SVG text drawn in viewBox units', () => {
    const px = css.flatMap(({ path, text }) => declarations(text)
      .filter(({ selector, part }) => /^font-size:\s*[\d.]+px/.test(part) && !/(?:^|[\s>,])text$|radar-flag$/.test(selector.split(',').at(-1)!.trim()))
      .map(({ selector, part }) => `${path}: ${selector} { ${part} }`));
    expect(px).toEqual([]);
  });
});
