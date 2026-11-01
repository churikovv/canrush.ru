import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_DRAFT_DAYS, clearAllReviewDrafts, clearReviewDraft, readReviewDraft, writeReviewDraft } from '../src/lib/review-draft';

const memory = new Map<string, string>();
const storage = Object.assign(Object.create({
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); storage[key] = value; },
  removeItem: (key: string) => { memory.delete(key); delete storage[key]; },
}) as Record<string, unknown>, {}) as Storage & Record<string, unknown>;
vi.stubGlobal('localStorage', storage);

const draft = { text: 'Вкусно', design: 7, taste: 8, country: 'RU', photos: 2 };
const NOW = 1_800_000_000_000;

describe('review draft', () => {
  beforeEach(() => { clearAllReviewDrafts(); memory.clear(); });

  it('comes back for its own drink only', () => {
    writeReviewDraft('Burn', 'original', draft, NOW);
    expect(readReviewDraft('Burn', 'original', NOW + 1000)).toEqual({ ...draft, savedAt: NOW });
    expect(readReviewDraft('Burn', 'mango', NOW)).toBeNull();
  });

  it('expires and removes itself', () => {
    writeReviewDraft('Burn', 'original', draft, NOW);
    expect(readReviewDraft('Burn', 'original', NOW + REVIEW_DRAFT_DAYS * 86_400_000)).toBeNull();
    expect(memory.size).toBe(0);
  });

  it('ignores a broken record and survives a closed storage', () => {
    memory.set('canrush-review-draft:["Burn","original"]', '{broken');
    expect(readReviewDraft('Burn', 'original')).toBeNull();
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
    expect(() => writeReviewDraft('Burn', 'original', draft)).not.toThrow();
    expect(readReviewDraft('Burn', 'original')).toBeNull();
    expect(() => clearReviewDraft('Burn', 'original')).not.toThrow();
    vi.stubGlobal('localStorage', storage);
  });

  it('leaves nothing for the next member after signing out', () => {
    writeReviewDraft('Burn', 'original', draft, NOW);
    writeReviewDraft('Burn', 'mango', draft, NOW);
    clearAllReviewDrafts();
    expect(memory.size).toBe(0);
  });
});
