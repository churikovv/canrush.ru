import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 2, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { upsertReview, getUserReview, deleteReview, getReviewsForUser } = await import('../src/lib/reviews');
const { GET } = await import('../src/app/api/review-photos/[id]/route');
const userId = `photos-${randomUUID()}`;
const otherId = `photos-${randomUUID()}`;
const input = { design: 4, taste: 5, composition: 3, text: 'Photo test' };
const photo = { data: Buffer.from('test image'), thumbnail: Buffer.from('test thumbnail') };
afterAll(async () => {
  await pool.query('delete from "user" where "id" = any($1::text[])', [[userId, otherId]]);
  await pool.end();
});
describe.sequential('review photo storage', () => {
  it('saves and reads photos atomically with a review', async () => {
    for (const id of [userId, otherId]) await pool.query('insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values ($1, \'Photo test\', $2, true, now(), now())', [id, `${id}@example.com`]);
    const ids = await upsertReview(userId, 'Photo test', 'original', input, { retained: [], photos: [photo, photo] });
    expect(ids).toHaveLength(2);
    const review = await getUserReview(userId, 'Photo test', 'original');
    expect(review?.photos).toEqual(ids);
    const response = await GET(new Request('http://localhost/api/review-photos/test?size=thumbnail'), { params: Promise.resolve({ id: ids[0]! }) });
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(await response.text()).toBe('test thumbnail');
  });
  it('rejects another review’s photo and rolls back the text update', async () => {
    const foreign = await upsertReview(otherId, 'Photo test', 'original', input, { retained: [], photos: [photo] });
    await expect(upsertReview(userId, 'Photo test', 'original', { ...input, text: 'Should roll back' }, { retained: foreign, photos: [] })).rejects.toThrow('does not belong');
    expect((await getUserReview(userId, 'Photo test', 'original'))?.text).toBe(input.text);
  });
  it('keeps selected images, removes others and frees slots for new photos', async () => {
    const before = (await getUserReview(userId, 'Photo test', 'original'))!.photos;
    const after = await upsertReview(userId, 'Photo test', 'original', input, { retained: [before[1]!], photos: [photo] });
    expect(after).toHaveLength(2);
    expect(after).toContain(before[1]);
    expect(after).not.toContain(before[0]);
    expect((await GET(new Request('http://localhost'), { params: Promise.resolve({ id: before[0]! }) })).status).toBe(404);
  });
  it('cannot add images when the author is blocked', async () => {
    await pool.query('insert into "userBlock" ("userId") values ($1)', [otherId]);
    await expect(upsertReview(otherId, 'Photo test', 'original', input, { retained: [], photos: [photo] })).rejects.toMatchObject({ code: '42501' });
  });
  it('lists only the requested author’s reviews and respects pagination', async () => {
    const own = await getReviewsForUser(userId);
    const other = await getReviewsForUser(otherId);
    expect(own).toHaveLength(1);
    expect(other).toHaveLength(1);
    expect(own[0]?.id).not.toBe(other[0]?.id);
    expect(own[0]?.photos).toHaveLength(2);
    expect(await getReviewsForUser(userId, 2)).toEqual([]);
  });
  it('deleting a review removes all associated bytes and public URLs', async () => {
    const ids = (await getUserReview(userId, 'Photo test', 'original'))!.photos;
    await deleteReview(userId, 'Photo test', 'original');
    const result = await pool.query('select "id" from "reviewPhoto" where "id" = any($1::uuid[])', [ids]);
    expect(result.rowCount).toBe(0);
    expect((await GET(new Request('http://localhost'), { params: Promise.resolve({ id: ids[0]! }) })).status).toBe(404);
  });
});
