import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), blocked: vi.fn(), create: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('../src/lib/moderation', () => ({ isUserBlocked: mocks.blocked }));
vi.mock('../src/lib/profile-reports', () => ({ createProfileReport: mocks.create }));
import { reportProfileAction } from '../src/app/profile/report-actions';
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'real-user' } }); mocks.blocked.mockResolvedValue(false); mocks.create.mockResolvedValue('sent'); });
it('requires login and refuses blocked reporters', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await reportProfileAction({},new FormData())).error).toBeTruthy();
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.session.mockResolvedValue({ user: { id: 'real-user' } }); mocks.blocked.mockResolvedValue(true);
  expect((await reportProfileAction({},new FormData())).error).toBeTruthy();
  expect(mocks.create).not.toHaveBeenCalled();
});
it('gets the reporter from the session, not submitted fields', async () => {
  const form = new FormData(); form.set('userId','forged'); form.set('targetId','target'); form.set('reason','spam'); form.set('comment','Details');
  expect((await reportProfileAction({},form)).success).toBeTruthy();
  expect(mocks.create).toHaveBeenCalledWith('real-user','target','spam','Details');
});
it('returns a recoverable error on storage failure', async () => {
  mocks.create.mockRejectedValue(new Error('db'));
  expect((await reportProfileAction({},new FormData())).error).toBeTruthy();
});
