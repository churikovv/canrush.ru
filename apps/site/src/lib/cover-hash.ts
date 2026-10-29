import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getPool } from '@/db/pool';

/**
 * Photo fingerprints for the duplicate check (migration 0144): a difference hash of each cover — the picture shrunk
 * to 9×8 grey pixels, one bit per pair of neighbours — so the same can photo gives nearly the same 64 bits however it
 * was resized or re-encoded. Only our own covers are read: files under public/ and photos kept in the database; other
 * sites' addresses are never fetched.
 */
const ID = /^[0-9a-f-]{36}$/u;

async function coverBytes(cover: string): Promise<Buffer | null> {
  if (/^\/(?:images|brand)\/[\w./-]+\.(?:jpe?g|png|webp)$/iu.test(cover) && !cover.includes('..')) {
    try { return await readFile(path.join(process.cwd(), 'public', cover)); } catch { return null; }
  }
  const match = cover.match(/^\/api\/(catalog-drinks|catalog-card-photos|brand-drink-photos)\/([^/?]+)/u);
  if (!match || !ID.test(match[2]!)) return null;
  const table = match[1] === 'catalog-drinks' ? '"catalogDrink"' : match[1] === 'catalog-card-photos' ? '"catalogCardEdit"' : '"brandDrinkProfile"';
  return (await getPool().query<{ thumbnail: Buffer | null }>(`select thumbnail from ${table} where id = $1`, [match[2]])).rows[0]?.thumbnail ?? null;
}

/** The 64-bit difference hash of an image, as 16 hex digits. */
export async function differenceHash(bytes: Buffer): Promise<string> {
  const pixels = await sharp(bytes, { limitInputPixels: 40_000_000 }).flatten({ background: '#ffffff' }).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let hex = '';
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) byte = (byte << 1) | (pixels[row * 9 + col]! > pixels[row * 9 + col + 1]! ? 1 : 0);
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Fingerprints of the given covers: cached ones from the table, the rest computed (at most `budget` per call, so a
 * first pass over the whole catalog is spread out) and stored. Covers that cannot be read are left out.
 */
export async function coverHashes(covers: string[], budget = 200): Promise<Map<string, string>> {
  const unique = [...new Set(covers.filter(Boolean))];
  if (!unique.length) return new Map();
  const known = new Map((await getPool().query<{ cover: string; hash: string }>('select cover, hash from "coverHash" where cover = any($1::text[])', [unique])).rows.map(row => [row.cover, row.hash]));
  for (const cover of unique.filter(item => !known.has(item)).slice(0, budget)) {
    const bytes = await coverBytes(cover).catch(() => null);
    if (!bytes) continue;
    try {
      const hash = await differenceHash(bytes);
      await getPool().query('insert into "coverHash"(cover, hash) values ($1, $2) on conflict (cover) do update set hash = excluded.hash, "computedAt" = now()', [cover, hash]);
      known.set(cover, hash);
    } catch { /* not an image */ }
  }
  return known;
}
