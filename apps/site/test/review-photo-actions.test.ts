import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), blocked: vi.fn(), product: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('SIGN_IN_REQUIRED'); } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('../src/lib/moderation', () => ({ isUserBlocked: mocks.blocked }));
vi.mock('../src/lib/catalog', () => ({ getCatalogGroup: mocks.product }));
vi.mock('../src/lib/reviews', () => ({ upsertReview: mocks.save, deleteReview: vi.fn() }));
import { submitReviewAction } from '../src/app/catalog/review-actions';
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ brand: 'Burn', flavor: 'original', design: '4', taste: '4', composition: '4', text: 'Мне понравился этот напиток' })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'owner' } }); mocks.blocked.mockResolvedValue(false); mocks.product.mockResolvedValue({ brand: 'Burn' }); mocks.save.mockResolvedValue([]);
});
describe('review attachment action boundary', () => {
  it('requires a signed-in user before accepting uploads', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(submitReviewAction({}, form())).rejects.toThrow('SIGN_IN_REQUIRED');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not save a blocked user’s photos', async () => {
    mocks.blocked.mockResolvedValue(true);
    expect((await submitReviewAction({}, form())).status).toBe('error');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('returns a readable error and never writes corrupt images', async () => {
    const data = form(); data.append('photos', new File(['corrupt'], 'x.jpg', { type: 'image/jpeg' }));
    expect((await submitReviewAction({}, data)).message).toContain('Не удалось прочитать');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('saves a text-only review and returns retained photo IDs to the editor', async () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const data = form(); data.append('retainedPhoto', id); mocks.save.mockResolvedValue([id]);
    expect(await submitReviewAction({}, data)).toMatchObject({ status: 'success', photos: [id] });
    expect(mocks.save).toHaveBeenCalledWith('owner', 'Burn', 'original', expect.any(Object), { retained: [id], photos: [] });
  });
});
