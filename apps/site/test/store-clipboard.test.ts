import { describe, expect, it } from 'vitest';
import { STORE_CATALOG_LIMIT, copyStoreItems, pasteStoreItems, readStoreClipboard } from '../src/lib/store-clipboard';
import type { StoreItem } from '../src/lib/store-fields';

const store = { id: 'store-1', name: 'Take&Go' };
const burn: StoreItem = { name: 'Burn Оригинальный', price: 15900, availability: 'unknown', brand: 'Burn', flavor: 'original' };
const own: StoreItem = { name: 'Свой напиток', price: 9900, availability: 'unavailable' };

describe('copying an assortment', () => {
  it('keeps prices and stock of the member’s own store', () => {
    expect(copyStoreItems(store, [burn, own], true)).toEqual({ storeId: 'store-1', store: 'Take&Go', withPrices: true, items: [burn, own] });
  });

  it('takes only the drinks from someone else’s store', () => {
    const copied = copyStoreItems(store, [burn, own], false);
    expect(copied.withPrices).toBe(false);
    expect(copied.items).toEqual([{ ...burn, price: null, availability: 'available' }, { ...own, price: null, availability: 'available' }]);
  });

  it('leaves extra fields of the page behind', () => {
    const shown = { ...burn, href: '/catalog/burn', cover: '/cover.webp' };
    expect(copyStoreItems(store, [shown], true).items).toEqual([burn]);
  });
});

describe('reading it back', () => {
  it('survives the round trip', () => {
    const copied = copyStoreItems(store, [burn, own], true);
    expect(readStoreClipboard(JSON.stringify(copied))).toEqual(copied);
  });

  it.each([
    ['nothing', null],
    ['broken text', '{'],
    ['no drinks', JSON.stringify({ storeId: 'a', store: 'b', items: [] })],
    ['a broken drink', JSON.stringify({ storeId: 'a', store: 'b', items: [{ name: 'x', price: 'free', availability: 'available' }] })],
    ['an unknown stock', JSON.stringify({ storeId: 'a', store: 'b', items: [{ name: 'x', price: null, availability: 'soon' }] })],
    ['a brand without a flavour', JSON.stringify({ storeId: 'a', store: 'b', items: [{ name: 'x', price: null, availability: 'available', brand: 'Burn' }] })],
  ])('ignores %s', (_title, raw) => {
    expect(readStoreClipboard(raw)).toBeNull();
  });
});

describe('pasting it', () => {
  const clipboard = copyStoreItems(store, [burn, own], true);

  it('adds only what the list does not have, whatever the case of a typed name', () => {
    expect(pasteStoreItems([{ name: 'другое имя', brand: 'Burn', flavor: 'original' }, { name: 'СВОЙ НАПИТОК' }], clipboard)).toEqual({ added: [], skipped: 2 });
    expect(pasteStoreItems([{ name: 'Burn Оригинальный', brand: 'Burn', flavor: 'original' }], clipboard)).toEqual({ added: [own], skipped: 1 });
    expect(pasteStoreItems([], clipboard)).toEqual({ added: [burn, own], skipped: 0 });
  });

  it('stops at the limit of a store', () => {
    const full = Array.from({ length: STORE_CATALOG_LIMIT - 1 }, (_, index) => ({ name: `Напиток ${index}` }));
    expect(pasteStoreItems(full, clipboard)).toEqual({ added: [burn], skipped: 1 });
  });
});
