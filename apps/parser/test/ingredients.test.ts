import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractIngredients, htmlDocument, sourceForUrl, type IngredientSource } from '../src/ingredients/core.js';
import { IngredientClient } from '../src/ingredients/client.js';

vi.mock('../src/http.js', () => ({ delay: vi.fn().mockResolvedValue(undefined) }));
const sources: IngredientSource[] = [{ id: 'test', name: 'Test', host: 'example.com', market: 'RU', strategy: 'http', paths: ['/product/'], priority: 1, evidence: '', notes: '', examples: [] }];
afterEach(() => vi.restoreAllMocks());

describe('ingredient evidence', () => {
  it('extracts a labelled paragraph without nutrition and recommendations', () => {
    const doc = htmlDocument('<h1>Burn</h1><div>Состав</div><div>Вода, сахар, таурин, кофеин, регулятор кислотности.</div><div>На 100 грамм</div><div>14</div><footer>Состав: другое</footer>');
    expect(doc.title).toBe('Burn');
    expect(extractIngredients(doc.text).ingredients).toBe('Вода, сахар, таурин, кофеин, регулятор кислотности.');
  });
  it('supports ingredients embedded in an OKOLO description', () => {
    expect(extractIngredients('Описание\nНапиток со вкусом гуавы. Состав: Вода, сахар, таурин, кофеин, ароматизаторы.\nХарактеристики\n123').ingredients).toBe('Вода, сахар, таурин, кофеин, ароматизаторы.');
  });
  it('does not invent ingredients from marketing or an empty section', () => {
    expect(extractIngredients('В состав входят кофеин и таурин.').ingredients).toBeNull();
    expect(extractIngredients('#### Состав\n\n#### Характеристики\nБренд').ingredients).toBeNull();
  });
  it('flags truncated search fragments and sugar conflicts', () => {
    const result = extractIngredients('Состав: Вода, сахар, таурин, натуральные ароматизаторы,', 'Напиток без сахара');
    expect(result.warnings).toContain('possibly_truncated');
    expect(result.warnings).toContain('possible_sugar_conflict');
  });
  it.each(['Red Bull Sugarfree', 'Red Bull Sugar Free', 'Adrenaline Zero Sugar'])('rejects a sugar-containing excerpt for %s', (title) => {
    expect(extractIngredients('Состав: Газированная вода, сахароза, глюкоза, таурин, кофеин.', title).warnings).toContain('possible_sugar_conflict');
    expect(extractIngredients('Состав: Вода, таурин, кофеин, сукралоза, краситель сахарный колер.', title).warnings).not.toContain('possible_sugar_conflict');
  });
  it('preserves upper bounds and original units', () => {
    const text = 'Вода, сахар, таурин, кофеин (не более 30 мг / 100 мл).';
    expect(extractIngredients(`## Состав\n\n${text}\n\n## Отзывы`).ingredients).toBe(text);
  });
  it('does not mistake neighbouring sugar-free variants for the selected product', () => {
    const result = extractIngredients('Без сахара\nСостав: Вода, сахар, таурин, кофеин, ароматизаторы.', 'Burn тропический микс');
    expect(result.warnings).not.toContain('possible_sugar_conflict');
  });
  it('ignores script contents and decodes HTML entities', () => {
    expect(htmlDocument('<script>Состав: сахар</script><div>Вода&nbsp;&amp; сахар</div>').text).toBe('Вода & сахар');
  });
});

describe('source boundaries', () => {
  it.each(['http://example.com/product/1', 'https://example.com.evil.com/product/1', 'https://example.com@evil.com/product/1', 'https://127.0.0.1/product/1', 'https://example.com:8443/product/1', 'https://example.com/search'])('rejects %s', (url) => {
    expect(sourceForUrl(url, sources)).toBeUndefined();
  });
  it('accepts only registered product URLs', () => {
    expect(sourceForUrl('https://example.com/product/1', sources)?.id).toBe('test');
    expect(sourceForUrl('https://www.example.com/product/1', sources)?.id).toBe('test');
  });
});

describe('Tavily and robots', () => {
  it('honours robots before both direct and remote extraction', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: 'User-agent: *\nDisallow: /product/' });
    const post = vi.spyOn(axios, 'post');
    const client = new IngredientClient(sources, 'secret', 2);
    await expect(client.page('https://example.com/product/1')).rejects.toThrow('robots_or_source_unavailable');
    await expect(client.extract('https://example.com/product/1')).rejects.toThrow('robots_or_source_unavailable');
    expect(get).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });
  it('fails closed when robots cannot be fetched', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('timeout'));
    expect(await new IngredientClient(sources, undefined, 0).allowed('https://example.com/product/1')).toBe(false);
  });
  it('reserves budget on failure and strips secret-bearing exceptions', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('Bearer tvly-secret'));
    const client = new IngredientClient(sources, 'tvly-secret', 1);
    await expect(client.search('Burn')).rejects.toThrow('tavily_request_failed');
    await expect(client.search('Burn')).rejects.toThrow('tavily_budget_exhausted');
    expect(post).toHaveBeenCalledTimes(1);
    expect(client.creditsReserved).toBe(1);
  });
  it('filters unknown domains and uses search only for discovery', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { results: [{ url: 'https://example.com/product/1' }, { url: 'https://evil.com/product/1' }], usage: { credits: 1 } } });
    const client = new IngredientClient(sources, 'secret', 2);
    expect(await client.search('Burn')).toEqual(['https://example.com/product/1']);
    expect(post.mock.calls[0]?.[1]).toMatchObject({ include_answer: false, include_raw_content: false, search_depth: 'basic', include_domains_mode: 'restrict' });
    expect(client.creditsReported).toBe(1);
  });
  it('does not follow redirects or spend money without a key', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ status: 404, data: '' }).mockResolvedValueOnce({ status: 302, data: '' });
    const client = new IngredientClient(sources, undefined, 1);
    await expect(client.page('https://example.com/product/1')).rejects.toThrow('http_302');
    await expect(client.search('Burn')).rejects.toThrow('tavily_key_missing');
    expect(client.creditsReserved).toBe(0);
  });
});
