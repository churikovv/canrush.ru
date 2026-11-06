import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), blocked: vi.fn(), create: vi.fn(), close: vi.fn(), start: vi.fn(), status: vi.fn(), send: vi.fn(), order: vi.fn(), messages: vi.fn(), read: vi.fn(), photos: vi.fn(), cabinet: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
// The market's mode (`MARKET_MODE`): these tests cover the member market (`open`), the last ones `business` and `closed`.
const market = vi.hoisted(() => ({ mode: 'open' as 'closed' | 'business' | 'open' }));
vi.mock('../src/lib/market-mode', () => ({ get MARKET_MODE() { return market.mode; } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('../src/lib/profile', () => ({ ensureOwnProfile: vi.fn() }));
vi.mock('../src/lib/moderation', () => ({ isUserBlocked: mocks.blocked, frozenMessage: async () => null, isFrozenError: () => false }));
vi.mock('../src/lib/market', () => ({ createListing: mocks.create, closeListing: mocks.close, startOrder: mocks.start, changeOrderStatus: mocks.status, sendMarketMessage: mocks.send, getOrder: mocks.order, getMessages: mocks.messages, markMessagesRead: mocks.read }));
vi.mock('../src/lib/business', () => ({ getCabinet: mocks.cabinet }));
vi.mock('../src/lib/review-photos', () => ({ prepareReviewPhotos: mocks.photos, ReviewPhotoError: class extends Error {} }));
import { createListingAction, listingAction, orderStatusAction, sendMessageAction, loadMessagesAction, readMessagesAction } from '../src/app/market/actions';
import { MARKET_BUSINESS_ONLY_MESSAGE, MARKET_PERSONAL_CHAT_MESSAGE } from '../src/lib/market-open';
const form = () => { const data = new FormData(); for (const [key, value] of Object.entries({ brand: 'Monster', title: 'Test', description: 'Test', city: 'Москва', price: '100', quantity: '6', delivery: 'pickup', text: 'Hello', userId: 'spoofed' })) data.set(key, value); return data; };
beforeEach(() => {
  vi.clearAllMocks(); market.mode = 'open'; mocks.session.mockResolvedValue({ user: { id: 'authenticated' } }); mocks.blocked.mockResolvedValue(false);
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
  await createListingAction(form()); expect(mocks.create).toHaveBeenCalledWith('authenticated', expect.objectContaining({ price: 10000 }), [], null);
  await listingAction('id', 'order'); expect(mocks.start).toHaveBeenCalledWith('authenticated', 'id', 1);
  await sendMessageAction('id', form()); expect(mocks.send).toHaveBeenCalledWith('authenticated', 'id', 'Hello', []);
  await orderStatusAction('id', 'confirmed'); expect(mocks.status).toHaveBeenCalledWith('authenticated', 'id', 'confirmed');
});
it('publishes for the company of the session member only', async () => {
  const company = form(); company.set('asBusiness', '1'); company.set('businessId', 'spoofed');
  mocks.cabinet.mockResolvedValue({ business: { id: 'company' }, role: 'manager' });
  await createListingAction(company); expect(mocks.create).toHaveBeenCalledWith('authenticated', expect.anything(), [], 'company');
  expect(mocks.cabinet).toHaveBeenCalledWith('authenticated');
  mocks.create.mockClear(); mocks.cabinet.mockResolvedValue(null);
  expect((await createListingAction(company)).error).toContain('Компания не найдена'); expect(mocks.create).not.toHaveBeenCalled();
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
it('refuses new listings, orders and messages while the market is closed', async () => {
  market.mode = 'closed';
  for (const result of [await createListingAction(form()), await listingAction('id', 'order'), await listingAction('id', 'reopen'), await sendMessageAction('id', form())]) expect(result.error).toBe('Маркет временно закрыт.');
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.photos).not.toHaveBeenCalled();
  // Closing a listing stays possible: it only takes something off the market.
  expect(await listingAction('id', 'close')).toEqual({ success: true });
});
it('publishes only for a company and keeps personal chats read-only while only companies sell', async () => {
  market.mode = 'business';
  // A personal listing is refused before its photos are decoded.
  expect((await createListingAction(form())).error).toBe(MARKET_BUSINESS_ONLY_MESSAGE);
  expect(mocks.photos).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  const company = form(); company.set('asBusiness', '1');
  mocks.cabinet.mockResolvedValue({ business: { id: 'company' }, role: 'manager' });
  await createListingAction(company); expect(mocks.create).toHaveBeenCalledWith('authenticated', expect.anything(), [], 'company');
  // Every member orders; which listings may be ordered is the database's check (`startOrder`).
  await listingAction('id', 'order'); expect(mocks.start).toHaveBeenCalledWith('authenticated', 'id', 1);
  mocks.order.mockResolvedValue({ id: 'order', fromCompany: false });
  expect((await sendMessageAction('id', form())).error).toBe(MARKET_PERSONAL_CHAT_MESSAGE);
  expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.photos).toHaveBeenCalledTimes(1);
  mocks.order.mockResolvedValue({ id: 'order', fromCompany: true });
  await sendMessageAction('id', form()); expect(mocks.send).toHaveBeenCalledWith('authenticated', 'id', 'Hello', []);
  expect(await listingAction('id', 'close')).toEqual({ success: true });
});
