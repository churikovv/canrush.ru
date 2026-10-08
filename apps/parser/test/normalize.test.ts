import { describe, expect, it } from 'vitest';
import {
  canonicalizeBrand,
  canonicalizeFlavor,
  dedupeProducts,
  detectBrand,
  detectFlavor,
  extractVolumeMl,
  normalizeProduct,
} from '../src/normalize.js';
import { loadProductsConfig } from '../src/config.js';

describe('extractVolumeMl', () => {
  it('извлекает объём в литрах и переводит в мл', () => {
    expect(extractVolumeMl('Энергетик Adrenaline Rush 0.449л')).toBe(449);
    expect(extractVolumeMl('Напиток 0,5 л')).toBe(500);
  });

  it('извлекает объём в мл напрямую', () => {
    expect(extractVolumeMl('Red Bull 355 мл')).toBe(355);
  });

  it('возвращает undefined, если объём не найден', () => {
    expect(extractVolumeMl('Энергетический напиток без объёма')).toBeUndefined();
  });
});

describe('detectBrand', () => {
  it('находит бренд без учёта регистра', () => {
    expect(detectBrand('red bull энергетик 355мл', ['Red Bull', 'Burn'])).toBe('Red Bull');
  });

  it('находит кириллический и альтернативный вариант и возвращает канонический бренд', () => {
    const aliases = {
      'Red Bull': ['Ред Булл'],
      'Adrenaline Rush': ['Adrenalin Rush', 'Адреналин Раш'],
      'M-150': ['М-150'],
    };
    const brands = ['Red Bull', 'Adrenaline Rush', 'M-150'];
    expect(detectBrand('Энергетик Ред Булл 355 мл', brands, aliases)).toBe('Red Bull');
    expect(detectBrand('Adrenalin Rush 0,449 л', brands, aliases)).toBe('Adrenaline Rush');
    expect(detectBrand('Напиток М-150, 150 мл', brands, aliases)).toBe('M-150');
  });

  it('предпочитает более длинное название бренда', () => {
    expect(detectBrand('Adrenaline Rush 449 мл', ['Adrenaline', 'Adrenaline Rush'])).toBe('Adrenaline Rush');
  });

  it('возвращает undefined, если бренд не из списка', () => {
    expect(detectBrand('Неизвестный напиток', ['Red Bull', 'Burn'])).toBeUndefined();
  });
});

describe('canonicalizeBrand', () => {
  it('нормализует название от API через алиасы, а неизвестное сохраняет', () => {
    expect(canonicalizeBrand('Monster Energy', ['Monster'], { Monster: ['Monster Energy'] })).toBe('Monster');
    expect(canonicalizeBrand('Bizon', ['Monster'], { Monster: ['Monster Energy'] })).toBe('Bizon');
  });
});

describe('detectFlavor', () => {
  const flavors = ['original', 'apple', 'kiwi', 'tropical', 'watermelon'];
  const aliases = {
    original: ['оригинальный', 'классический'],
    apple: ['яблоко', 'яблочный'],
    kiwi: ['киви'],
    tropical: ['тропический'],
    watermelon: ['арбуз'],
  };

  it('находит вкус без учёта регистра', () => {
    expect(detectFlavor('Red Bull Kiwi 0.355л', flavors, aliases)).toBe('kiwi');
  });

  it('находит кириллический алиас и возвращает канонический вкус', () => {
    expect(detectFlavor('Энергетик со вкусом киви 0.45л', flavors, aliases)).toBe('kiwi');
    expect(detectFlavor('Напиток яблоко 0.33л', flavors, aliases)).toBe('apple');
  });

  it('предпочитает более длинный алиас', () => {
    expect(detectFlavor('Burn Tropical Edition', flavors, aliases)).toBe('tropical');
  });

  it('возвращает undefined, если вкус не найден', () => {
    expect(detectFlavor('Red Bull Energy Drink 0.25л', flavors, aliases)).toBeUndefined();
  });
});

describe('configured flavor detection', () => {
  const config = loadProductsConfig();
  const aliases = config.flavorAliases ?? {};

  it('определяет новые вкусы и русские падежные формы', () => {
    expect(detectFlavor('Burn со вкусом Гуавы 449мл', config.flavors, aliases)).toBe('guava');
    expect(detectFlavor('Lit Energy Raspberry со вкусом малины 450мл', config.flavors, aliases)).toBe('raspberry');
    expect(detectFlavor('Red Bull Черника 355мл', config.flavors, aliases)).toBe('blueberry');
  });

  it('предпочитает конкретный вкус словам Original и Classic', () => {
    expect(detectFlavor('Ninja Star Original Cherry со вкусом вишни', config.flavors, aliases)).toBe('cherry');
    expect(detectFlavor('Red Bull классический/персик 473 мл', config.flavors, aliases)).toBe('peach');
    expect(detectFlavor('Lit Energy Classic со вкусом клюквы и барбариса', config.flavors, aliases)).toBe('blend:barberry+cranberry');
  });
});

describe('canonicalizeFlavor', () => {
  it('нормализует вкус через алиасы, неизвестный — сохраняет', () => {
    expect(canonicalizeFlavor('яблочный', ['apple'], { apple: ['яблоко', 'яблочный'] })).toBe('apple');
    expect(canonicalizeFlavor('dragonfruit', ['apple'], { apple: ['яблоко'] })).toBe('dragonfruit');
  });
});

describe('normalizeProduct', () => {
  it('собирает Product с объёмом и брендом', () => {
    const product = normalizeProduct(
      'wildberries',
      {
        sourceId: '123',
        name: 'Red Bull Энергетический напиток 0.355л',
        price: 129,
        oldPrice: 149,
        url: 'https://www.wildberries.ru/catalog/123/detail.aspx',
      },
      ['Red Bull'],
      '2026-08-11T00:00:00.000Z',
    );

    expect(product).toMatchObject({
      source: 'wildberries',
      sourceId: '123',
      brand: 'Red Bull',
      volumeMl: 355,
      price: 129,
      oldPrice: 149,
      currency: 'RUB',
      fetchedAt: '2026-08-11T00:00:00.000Z',
    });
  });

  it('извлекает вкус из названия, если переданы knownFlavors', () => {
    const product = normalizeProduct(
      'wildberries',
      {
        sourceId: '456',
        name: 'Red Bull Энергетик со вкусом киви 0.355л',
        price: 139,
        url: 'https://www.wildberries.ru/catalog/456/detail.aspx',
      },
      ['Red Bull'],
      '2026-08-11T00:00:00.000Z',
      {},
      ['kiwi', 'apple'],
      { kiwi: ['киви'] },
    );

    expect(product.flavor).toBe('kiwi');
  });

  it('не определяет вкус, если knownFlavors пуст', () => {
    const product = normalizeProduct(
      'wildberries',
      {
        sourceId: '789',
        name: 'Red Bull Энергетик 0.355л',
        price: 129,
        url: 'https://www.wildberries.ru/catalog/789/detail.aspx',
      },
      ['Red Bull'],
    );

    expect(product.flavor).toBeUndefined();
  });
});

describe('dedupeProducts', () => {
  it('оставляет последнюю запись по паре source+sourceId', () => {
    const base = {
      source: 'wildberries' as const,
      sourceId: '1',
      name: 'Товар',
      currency: 'RUB' as const,
      url: 'https://example.com',
      fetchedAt: '2026-08-11T00:00:00.000Z',
    };
    const result = dedupeProducts([
      { ...base, price: 100 },
      { ...base, price: 120 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.price).toBe(120);
  });
});

it('normalizes verified Burn Peach Zero and omitted zero aliases', () => {
  const config = loadProductsConfig();
  for (const name of ['Burn Peach Zero 449мл', 'Burn Персик-манго 449мл', 'Burn Zero Персик манго без сахара 449мл']) {
    const product = normalizeProduct('edadeal', { sourceId: 'burn', name, price: 100, url: 'https://example.com/burn' },
      config.brands, '2026-10-05', config.brandAliases, config.flavors, config.flavorAliases);
    expect(product.flavor).toBe('blend:mango+peach:sugarfree');
  }
});

it('normalizes shortened Volt blueberry as blueberry-pomegranate', () => {
  const config = loadProductsConfig();
  const product = normalizeProduct('edadeal', { sourceId: 'volt', name: 'Энергетический напиток Вольт голубика 0.45 л ж б', price: 95, url: 'https://example.com/volt' }, config.brands, '2026-10-08', config.brandAliases, config.flavors, config.flavorAliases);
  expect(product.flavor).toBe('blend:blueberry+pomegranate');
});
it('does not publish a multi-edition Burn flyer as a single juicy zero product', async () => {
  const { groupByFlavor } = await import('../src/storage.js');
  const config = loadProductsConfig();
  const names = ['Напиток энергетический Бёрн 449мл Оригинальный; Тропический Микс; Сочная Энергия; Яблоко/Киви; Гуава; Без сахара Персик/Манго', 'Burn Сочная энергия 449мл', 'Burn Zero Персик манго без сахара 449мл'];
  const products = names.map((name, i) => normalizeProduct('edadeal', { sourceId: String(i), name, price: 100, url: 'https://example.com/' + i }, config.brands, '2026-10-08', config.brandAliases, config.flavors, config.flavorAliases));
  expect(groupByFlavor(products).map(g => g.flavor)).toEqual(['burn_juicy', 'blend:mango+peach:sugarfree']);
});
