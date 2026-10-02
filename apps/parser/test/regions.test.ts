import { describe, expect, it } from 'vitest';
import { CITIES, nearestCity } from '@canrush/shared';
import { parseCities, regionCacheFresh, REGION_TTL_MS } from '../src/regions.js';
import { resolveLocality } from '../src/adapters/edadeal.js';
describe('regional selection and cache boundaries', () => {
  it('maps every supported city to its own API region and coordinates', () => {
    expect(parseCities('all')).toHaveLength(16);
    expect(new Set(CITIES.map(city => city.geoId)).size).toBe(16);
    for (const city of CITIES) {
      expect(nearestCity(city.lat, city.lng)?.id).toBe(city.id);
      expect(resolveLocality(city.geoId)).toMatchObject({ geoId: city.geoId, lat: city.lat, lng: city.lng, slug: city.slug });
    }
    expect(parseCities('moscow,kazan,moscow')).toEqual(['moscow', 'kazan']);
    expect(() => parseCities('../moscow')).toThrow();
    expect(() => parseCities('')).toThrow();
  });
  it('never assigns unsupported or invalid coordinates to a distant city', () => {
    expect(nearestCity(51.5, -0.12)).toBeUndefined();
    expect(nearestCity(43.1, 131.9)).toBeUndefined();
    expect(nearestCity(NaN, 37)).toBeUndefined();
    expect(nearestCity(91, 37)).toBeUndefined();
  });
  it('expires price caches and invalidates them after configuration changes or failures', () => {
    const now = Date.parse('2026-10-02T12:00:00Z');
    const snapshot = { generatedAt: new Date(now - 1000).toISOString(), configHash: 'one', status: 'ok' as const };
    expect(regionCacheFresh(snapshot, 'one', now)).toBe(true);
    expect(regionCacheFresh(snapshot, 'two', now)).toBe(false);
    expect(regionCacheFresh({ ...snapshot, generatedAt: new Date(now - REGION_TTL_MS).toISOString() }, 'one', now)).toBe(false);
    expect(regionCacheFresh({ ...snapshot, status: 'stale' }, 'one', now)).toBe(false);
    expect(regionCacheFresh({ ...snapshot, generatedAt: new Date(now + 1).toISOString() }, 'one', now)).toBe(false);
  });
});
