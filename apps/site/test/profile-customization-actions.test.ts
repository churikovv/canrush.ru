import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), prepare: vi.fn(), save: vi.fn(), profile: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('../src/lib/profile', () => ({ getProfileByUserId: mocks.profile, isUniqueViolation: (error: { code?: string }) => error.code === '23505' }));
vi.mock('../src/lib/profile-images', () => ({ ProfileImageError: class extends Error {}, prepareProfileImages: mocks.prepare, saveProfileCustomization: mocks.save }));
import { updateProfileAction } from '../src/app/profile/actions';
const form = () => { const data = new FormData(); data.set('username', 'updated'); data.set('name', 'Updated'); data.set('telegramChannel', ''); data.set('userId', 'victim'); return data; };
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'actor' } }); mocks.prepare.mockResolvedValue({ avatar: Buffer.from('image') }); mocks.save.mockResolvedValue(undefined); mocks.profile.mockResolvedValue({ username: 'before' }); });
it('requires authentication before decoding or saving images', async () => {
  mocks.session.mockResolvedValue(null);
  await expect(updateProfileAction({}, form())).rejects.toThrow('REDIRECT:/sign-in');
  expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
});
it('saves only the session owner and refreshes old usernames and review pages', async () => {
  await expect(updateProfileAction({}, form())).rejects.toThrow('REDIRECT:/profile');
  expect(mocks.save).toHaveBeenCalledWith('actor', { username: 'updated', name: 'Updated', telegramChannel: null }, { avatar: Buffer.from('image') }, undefined);
  expect(mocks.revalidate).toHaveBeenCalledWith('/profile/before');
  expect(mocks.revalidate).toHaveBeenCalledWith('/catalog', 'layout');
});
it('returns validation or duplicate-name errors without losing an existing image', async () => {
  const invalid = form(); invalid.set('username', 'no');
  expect((await updateProfileAction({}, invalid)).fieldErrors?.username).toBeTruthy(); expect(mocks.save).not.toHaveBeenCalled();
  mocks.save.mockRejectedValueOnce({ code: '23505' });
  expect((await updateProfileAction({}, form())).message).toContain('занят');
});

it('rejects invalid profile layouts before saving', async () => {
  const data = form(); data.set('profileLayout', JSON.stringify({ order: ['wall'], hidden: [] }));
  expect((await updateProfileAction({}, data)).message).toContain('блоков');
  expect(mocks.save).not.toHaveBeenCalled();
});
