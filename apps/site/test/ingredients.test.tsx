import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { type PublishedIngredients } from '@canrush/shared';
import { selectIngredients } from '@/lib/ingredients';
import { CatalogProductIngredients } from '@/components/catalog-product-ingredients';

const record: PublishedIngredients = { brand: 'Burn', flavor: 'tropical', productTitle: 'Burn тропический микс, 449 мл', volumeMl: 449, market: 'BY', ingredients: 'Вода, сахар, таурин, кофеин (не более 30 мг/100 мл).', sourceName: 'Едоставка', sourceUrl: 'https://edostavka.by/product/1810707', fetchedAt: '2026-09-24T05:00:00Z', status: 'source_reported' };
const snapshot = { version: 1, products: [record] };

describe('site compositions', () => {
  it('matches exact brand and flavor, does not borrow a nearby flavor', () => {
    expect(selectIngredients(snapshot, 'Burn', 'tropical')).toEqual(record);
    expect(selectIngredients(snapshot, 'Burn', 'guava')).toBeNull();
    expect(selectIngredients(snapshot, 'Gorilla', 'tropical')).toBeNull();
  });
  it('fails safely on corrupt, duplicate, unreviewed or unsafe records', () => {
    expect(selectIngredients(null, 'Burn', 'tropical')).toBeNull();
    expect(selectIngredients({ version: 1, products: [record, record] }, 'Burn', 'tropical')).toBeNull();
    for (const change of [{ sourceUrl: 'javascript:alert(1)' }, { status: 'needs_review' }, { fetchedAt: 'invalid' }]) {
      expect(selectIngredients({ version: 1, products: [{ ...record, ...change }] }, 'Burn', 'tropical')).toBeNull();
    }
  });
  it('renders the ingredients card and label reminder without source metadata', () => {
    const html = renderToStaticMarkup(createElement(CatalogProductIngredients, { data: record }));
    expect(html).toContain('catalog-ingredients-card');
    expect(html).toContain('не более 30 мг/100 мл');
    expect(html).toContain('Сверяйте состав с этикеткой вашей банки.');
    for (const text of [record.sourceUrl, record.sourceName, record.productTitle, 'не подтверждён', 'Пищевая ценность', 'Беларуси']) expect(html).not.toContain(text);
  });
  it('keeps preliminary record validation without displaying internal notes', () => {
    const preliminary: PublishedIngredients = { ...record, status: 'unverified', reviewNote: 'В источнике указан только общий перечень компонентов.' };
    expect(selectIngredients({ version: 1, products: [preliminary] }, 'Burn', 'tropical')).toEqual(preliminary);
    const html = renderToStaticMarkup(createElement(CatalogProductIngredients, { data: preliminary }));
    expect(html).toContain(record.ingredients);
    expect(html).not.toContain(preliminary.reviewNote);
    for (const reviewNote of [undefined, '', ' ', 42]) {
      expect(selectIngredients({ version: 1, products: [{ ...preliminary, reviewNote }] }, 'Burn', 'tropical')).toBeNull();
    }
  });
  it('renders a useful empty state and escapes source text', () => {
    expect(renderToStaticMarkup(createElement(CatalogProductIngredients, { data: null }))).toContain('пока не добавлен');
    expect(renderToStaticMarkup(createElement(CatalogProductIngredients, { data: { ...record, ingredients: '<script>unsafe</script>' } }))).not.toContain('<script>');
  });
});
