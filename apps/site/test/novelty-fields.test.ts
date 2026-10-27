import { describe, expect, it } from 'vitest';
import { firstSeenDays, noveltyKey } from '../src/lib/novelty-fields';

describe('firstSeenDays', () => {
  const a = noveltyKey('Burn', 'mango'), b = noveltyKey('Monster', 'peach'), c = noveltyKey('Gorilla', 'mojito');
  it('dates identities that appeared after the baseline days of history', () => {
    const days = firstSeenDays([
      { date: '2026-10-10', keys: [a, b] },
      { date: '2026-10-02', keys: [a] },
      { date: '2026-10-04', keys: [b] },
      { date: '2026-10-05', keys: [c] },
    ], 3);
    // History starts on Oct 2, so Oct 2–4 is the baseline: Burn and Monster were already on sale.
    expect([...days]).toEqual([[c, '2026-10-05']]);
  });
  it('is empty without snapshots', () => expect(firstSeenDays([]).size).toBe(0));
});
