import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORE_DRAFT_DAYS, clearAllStoreDrafts, clearStoreDraft, readStoreDraft, writeStoreDraft } from '../src/lib/store-draft';

const memory = new Map<string, string>();
const storage = Object.assign(Object.create({
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); storage[key] = value; },
  removeItem: (key: string) => { memory.delete(key); delete storage[key]; },
}) as Record<string, unknown>, {}) as Storage & Record<string, unknown>;
vi.stubGlobal('localStorage', storage);

const draft = {
  version: '', name: 'Киоск', description: '', address: 'Тверская, 7', city: 'moscow', latitude: '55.75', longitude: '37.61', source: 'geocoded' as const, metro: '1.98',
  items: [{ id: 'a', name: 'Burn · Манго', price: '159', availability: 'available' as const, brand: 'Burn', flavor: 'mango' }], step: 2, photos: 1,
};
const NOW = 1_800_000_000_000;

describe('store draft', () => {
  beforeEach(() => { clearAllStoreDrafts(); memory.clear(); });

  it('keeps a new store and an edited store apart', () => {
    writeStoreDraft(null, draft, NOW);
    expect(readStoreDraft(null, '', NOW + 1000)).toEqual({ ...draft, savedAt: NOW });
    expect(readStoreDraft('store-1', '', NOW)).toBeNull();
  });

  it('expires and removes itself', () => {
    writeStoreDraft(null, draft, NOW);
    expect(readStoreDraft(null, '', NOW + STORE_DRAFT_DAYS * 86_400_000)).toBeNull();
    expect(memory.size).toBe(0);
  });

  it('drops a draft of a store that has changed since', () => {
    writeStoreDraft('store-1', { ...draft, version: '2026-11-01' }, NOW);
    expect(readStoreDraft('store-1', '2026-11-02', NOW)).toBeNull();
    expect(memory.size).toBe(0);
  });

  it.each([
    ['broken JSON', '{broken'],
    ['a drink with no name', JSON.stringify({ ...draft, savedAt: NOW, items: [{ id: 'a', price: '', availability: 'available' }] })],
    ['an unknown stock status', JSON.stringify({ ...draft, savedAt: NOW, items: [{ id: 'a', name: 'A', price: '', availability: 'maybe' }] })],
    ['an unknown point source', JSON.stringify({ ...draft, savedAt: NOW, source: 'gps' })],
  ])('ignores %s', (_name, raw) => {
    memory.set('canrush-store-draft:new', raw);
    expect(readStoreDraft(null, '', NOW)).toBeNull();
  });

  it('survives a closed storage', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
    expect(() => writeStoreDraft(null, draft)).not.toThrow();
    expect(readStoreDraft(null, '')).toBeNull();
    expect(() => clearStoreDraft(null)).not.toThrow();
    vi.stubGlobal('localStorage', storage);
  });

  it('leaves nothing for the next member after signing out', () => {
    writeStoreDraft(null, draft, NOW);
    writeStoreDraft('store-1', draft, NOW);
    clearAllStoreDrafts();
    expect(memory.size).toBe(0);
  });
});
