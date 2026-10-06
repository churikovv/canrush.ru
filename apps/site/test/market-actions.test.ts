import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), blocked: vi.fn(), create: vi.fn(), close: vi.fn(), start: vi.fn(), status: vi.fn(), send: vi.fn(), order: vi.fn(), messages: vi.fn(), read: vi.fn(), photos: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('../src/lib/profile', () => ({ ensureOwnProfile: vi.fn() }));
vi.mock('../src/lib/moderation', () => ({ isUserBlocked: mocks.blocked }));
vi.mock('../src/lib/market', () => ({ createListing: mocks.create, closeListing: mocks.close, startOrder: mocks.start, changeOrderStatus: mocks.status, sendMarketMessage: mocks.send, getOrder: mocks.order, getMessages: mocks.messages, markMessagesRead: mocks.read }));
vi.mock('../src/lib/review-photos', () => ({ prepareReviewPhotos: mocks.photos, ReviewPhotoError: class extends Error {} }));
import { createListingAction, listingAction, orderStatusAction, sendMessageAction, loadMessagesAction, readMessagesAction } from '../src/app/market/actions';
const form = () => { const data = new FormData(); for (const [key, value] of Object.entries({ title: 'Test', description: 'Test', city: 'Москва', price: '100', quantity: '6', delivery: 'pickup', text: 'Hello', userId: 'spoofed' })) data.set(key, value); return data; };
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'authenticated' } }); mocks.blocked.mockResolvedValue(false);
  mocks.photos.mockResolvedValue({ photos: [], retained: [] }); mocks.order.mockResolvedValue({ id: 'order' });
});
it('rejects anonymous actions before photo processing or writes', async () => {
  mocks.session.mockResolvedValue(null);
  for (const result of [await createListingAction(form()), await listingAction('id', 'order'), await orderStatusAction('id', 'confirmed'), await sendMessageAction('id', form())]) expect(result.error).toContain('Войдите');
  expect(mocks.photos).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled();
  expect(await loadMessagesAction('id')).toHaveProperty('error');
  await readMessagesAction('id', 'message'); expect(mocks.read).not.toHaveBeenCalled();
});
it('uses session identity, never the submitted user ID', async () => {
  await createListingAction(form()); expect(mocks.create).toHaveBeenCalledWith('authenticated', expect.objectContaining({ price: 10000 }), []);
  await listingAction('id', 'order'); expect(mocks.start).toHaveBeenCalledWith('authenticated', 'id', 1);
  await sendMessageAction('id', form()); expect(mocks.send).toHaveBeenCalledWith('authenticated', 'id', 'Hello', []);
  await orderStatusAction('id', 'confirmed'); expect(mocks.status).toHaveBeenCalledWith('authenticated', 'id', 'confirmed');
});
it('checks blocks and conversation membership before decoding attachments', async () => {
  mocks.blocked.mockResolvedValue(true);
  expect((await sendMessageAction('id', form())).error).toContain('ограничены');
  expect((await createListingAction(form())).error).toContain('ограничены');
  expect(mocks.photos).not.toHaveBeenCalled();
  mocks.blocked.mockResolvedValue(false); mocks.order.mockResolvedValue(null);
  expect((await sendMessageAction('id', form())).error).toContain('недоступна');
  expect(mocks.photos).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
