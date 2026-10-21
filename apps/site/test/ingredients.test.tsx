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
  it('shows label numbers as caffeine and taurine tiles plus a nutrition row, and rejects implausible ones', () => {
    const nutrition = { per: '100g' as const, energyKcal: 60, protein: 0.2, carbs: 14, taurineMg: 230, caffeineMg: 30, method: 'gigachat' as const, model: 'GigaChat-2-Pro', extractedAt: '2026-10-21T00:00:00Z' };
    const withNutrition: PublishedIngredients = { ...record, nutrition };
    expect(selectIngredients({ version: 1, products: [withNutrition] }, 'Burn', 'tropical')).toEqual(withNutrition);
    for (const change of [{ caffeineMg: 300 }, { per: '250ml' }, { method: 'guess' }, { taurineMg: '230' }, { extra: 1 }]) {
      expect(selectIngredients({ version: 1, products: [{ ...withNutrition, nutrition: { ...nutrition, ...change } }] }, 'Burn', 'tropical')).toBeNull();
    }
    expect(selectIngredients({ version: 1, products: [{ ...withNutrition, nutrition: { per: '100ml', method: 'gigachat', model: 'm', extractedAt: nutrition.extractedAt } }] }, 'Burn', 'tropical')).toBeNull();
    const html = renderToStaticMarkup(createElement(CatalogProductIngredients, { data: withNutrition }));
    expect(html).toContain('Пищевая ценность <span>на 100 г</span>');
    expect(html).toMatch(/Кофеин <span>на 100 мл<\/span><\/dt><dd>30<span> мг/);
    expect(html).toContain('≈ 135 мг в банке 449 мл');
    expect(html).toMatch(/Таурин <span>на 100 мл<\/span><\/dt><dd>230<span> мг/);
    expect(html).toContain('≈ 1033 мг в банке 449 мл');
    expect(html).toMatch(/Белки<\/dt><dd>0,2<span> г/);
    expect(html).not.toContain('Жиры');
    expect(html).toContain('распознаны автоматически');
    expect(html).toContain('Сверяйте состав и пищевую ценность с этикеткой вашей банки.');
  });
  it('accepts store card numbers without a model and labels them as the shop card', () => {
    const nutrition = { per: '100g' as const, energyKcal: 46, taurineMg: 400, method: 'store' as const, extractedAt: '2026-10-21T00:00:00Z' };
    const lavka: PublishedIngredients = { ...record, status: 'unverified', reviewNote: 'Из карточки Яндекс Лавки, ещё не сверено.', nutrition };
    expect(selectIngredients({ version: 1, products: [lavka] }, 'Burn', 'tropical')).toEqual(lavka);
    expect(selectIngredients({ version: 1, products: [{ ...lavka, nutrition: { ...nutrition, model: 'GigaChat-2-Pro' } }] }, 'Burn', 'tropical')).toBeNull();
    expect(selectIngredients({ version: 1, products: [{ ...lavka, nutrition: { ...nutrition, method: 'gigachat' } }] }, 'Burn', 'tropical')).toBeNull();
    const html = renderToStaticMarkup(createElement(CatalogProductIngredients, { data: lavka }));
    expect(html).toContain('Данные из карточки товара в магазине.');
    expect(html).not.toContain('распознаны автоматически');
    expect(html).not.toContain(lavka.reviewNote);
  });
  it('marks a model-written composition with the «ИИ» chip and keeps it apart from sourced records', () => {
    const nutrition = { per: '100ml' as const, energyKcal: 38, caffeineMg: 32, method: 'ai' as const, model: 'GigaChat-2-Pro', extractedAt: '2026-10-21T00:00:00Z' };
    const { sourceUrl: _sourceUrl, ...withoutSource } = record;
    const ai: PublishedIngredients = { ...withoutSource, sourceName: 'GigaChat', status: 'ai_generated', model: 'GigaChat-2-Pro', nutrition };
    expect(selectIngredients({ version: 1, products: [ai] }, 'Burn', 'tropical')).toEqual(ai);
    for (const change of [{ sourceUrl: record.sourceUrl }, { model: undefined }, { nutrition: { ...nutrition, method: 'store', model: undefined } }]) {
      expect(selectIngredients({ version: 1, products: [{ ...ai, ...change }] }, 'Burn', 'tropical')).toBeNull();
    }
    // A sourced record can never carry model-written numbers or a model name.
    expect(selectIngredients({ version: 1, products: [{ ...record, nutrition }] }, 'Burn', 'tropical')).toBeNull();
    expect(selectIngredients({ version: 1, products: [{ ...record, model: 'GigaChat-2-Pro' }] }, 'Burn', 'tropical')).toBeNull();
    const html = renderToStaticMarkup(createElement(CatalogProductIngredients, { data: ai }));
    expect(html).toContain('catalog-ai-chip');
    expect(html).toContain('Сгенерировано ИИ');
    expect(html).toContain('Числа сгенерированы ИИ');
    expect(html).not.toContain('GigaChat');
    expect(html).not.toContain('Сверяйте состав');
    expect(renderToStaticMarkup(createElement(CatalogProductIngredients, { data: record }))).not.toContain('catalog-ai-chip');
  });
});
