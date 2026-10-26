import { describe, expect, it } from 'vitest';
import { ArticleError, articleReadiness, parseArticleChannel, articleSummary, inlineText, parseArticleBlocks, readingMinutes, safeHref, sanitizeInline } from '@/lib/article-fields';

describe('sanitizeInline', () => {
  it('keeps the whitelist and rebuilds tags without attributes', () => {
    expect(sanitizeInline('<b style="x">bold</b> <strong>s</strong> <em>i</em> <del>d</del> <code>c</code>')).toBe('<b>bold</b> <b>s</b> <i>i</i> <s>d</s> <code>c</code>');
  });
  it('drops scripts, events and unknown tags but keeps their text escaped', () => {
    expect(sanitizeInline('<img src=x onerror=alert(1)>hi<script>alert(1)</script><span onclick="x">t</span>')).toBe('hialert(1)t');
    expect(sanitizeInline('a < b & c')).toBe('a  b &amp; c');
    expect(sanitizeInline('5 &lt; 6 &amp; ok &nbsp;')).toBe('5 &lt; 6 &amp; ok &nbsp;');
  });
  it('allows only safe links', () => {
    expect(sanitizeInline('<a href="https://canrush.ru/catalog" target="_blank">x</a>')).toBe('<a href="https://canrush.ru/catalog">x</a>');
    expect(sanitizeInline('<a href="/catalog/burn">x</a>')).toBe('<a href="/catalog/burn">x</a>');
    expect(sanitizeInline('<a href="javascript:alert(1)">x</a>')).toBe('x');
    expect(sanitizeInline('<a href="//evil.example">x</a>')).toBe('x');
    expect(safeHref('https://a.ru/"onmouseover=1')).toBeNull();
  });
  it('keeps the editor colours only', () => {
    expect(sanitizeInline('<font color="#8a8f98">тихо</font> и <span style="color: rgb(0, 110, 255)" data-color="brand">синий</span>')).toBe('<span data-color="muted">тихо</span> и <span data-color="brand">синий</span>');
    expect(sanitizeInline('<font color="#123456">свой <b>цвет</b></font>!')).toBe('свой <b>цвет</b>!');
    expect(sanitizeInline('<span data-color="red" onclick="x">a</span>')).toBe('<span data-color="red">a</span>');
  });
  it('balances tags and turns divs into line breaks', () => {
    expect(sanitizeInline('<b><i>x</b>y</i>')).toBe('<b><i>x</i></b>y');
    expect(sanitizeInline('one<div>two</div><div>three</div>')).toBe('one<br>two<br>three');
    expect(inlineText('a<br>b &amp; c')).toBe('a\nb & c');
  });
});

describe('parseArticleBlocks', () => {
  it('keeps known blocks and drops broken ones', () => {
    const blocks = parseArticleBlocks([
      { id: 'abcd1234', type: 'heading1', text: '<b>Title</b>' },
      { type: 'todo', text: 'x', checked: true },
      { type: 'image', imageId: 'nope' },
      { type: 'image', imageId: '0f6a2b5c-1d2e-4f3a-8b9c-0d1e2f3a4b5c', caption: '  a   b ' },
      { type: 'drink', brand: 'Burn', flavor: 'orange' },
      { type: 'html', text: '<script>' },
      { type: 'divider' },
    ]);
    expect(blocks.map(block => block.type)).toEqual(['heading1', 'todo', 'image', 'drink', 'divider']);
    expect(blocks[0]).toMatchObject({ id: 'abcd1234', text: '<b>Title</b>' });
    expect(blocks[2]).toMatchObject({ caption: 'a b' });
  });
  it('refuses huge documents', () => {
    expect(() => parseArticleBlocks(Array.from({ length: 301 }, () => ({ type: 'divider' })))).toThrow(ArticleError);
    expect(() => parseArticleBlocks([{ type: 'paragraph', text: 'x'.repeat(4001) }])).toThrow(ArticleError);
    expect(() => parseArticleBlocks('nope')).toThrow(ArticleError);
  });
});

describe('parseArticleChannel', () => {
  it('takes a link, @name or a bare name', () => {
    expect(parseArticleChannel('https://t.me/canrush_news/')).toBe('canrush_news');
    expect(parseArticleChannel('@canrush')).toBe('canrush');
    expect(parseArticleChannel('  ')).toBeNull();
    expect(() => parseArticleChannel('ab')).toThrow(ArticleError);
    expect(() => parseArticleChannel('javascript:alert(1)')).toThrow(ArticleError);
  });
});

describe('article helpers', () => {
  const text = 'Слово '.repeat(400);
  const blocks = parseArticleBlocks([{ type: 'paragraph', text }]);
  it('checks readiness', () => {
    expect(articleReadiness('', blocks)).toBe('Добавьте заголовок.');
    expect(articleReadiness('Обзор', parseArticleBlocks([{ type: 'paragraph', text: 'коротко' }]))).toMatch(/50 символов/);
    expect(articleReadiness('Обзор', blocks)).toBeNull();
  });
  it('summarises and estimates reading time', () => {
    expect(articleSummary(blocks).length).toBeLessThanOrEqual(181);
    expect(articleSummary(blocks).endsWith('…')).toBe(true);
    expect(readingMinutes(blocks)).toBe(2);
  });
});
