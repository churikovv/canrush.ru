import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), blocked: vi.fn(), follow: vi.fn(), tags: vi.fn(), comment: vi.fn(), remove: vi.fn(), touch: vi.fn(), visibility: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('../src/lib/profile', () => ({ ensureOwnProfile: vi.fn() }));
vi.mock('../src/lib/moderation', () => ({ isUserBlocked: mocks.blocked }));
vi.mock('../src/lib/profile-community', () => ({ CommunityError: class extends Error {}, setFollowing: mocks.follow, setProfileTags: mocks.tags, addProfileComment: mocks.comment, deleteProfileComment: mocks.remove, touchPresence: mocks.touch, getPresence: vi.fn(), setPresenceVisibility: mocks.visibility }));
import { updateCommunityAction, heartbeatAction } from '../src/app/profile/community-actions';
const form = (operation: string) => { const data = new FormData(); data.set('operation', operation); data.set('userId', 'spoofed'); data.set('targetId', 'target'); data.set('text', 'hello'); return data; };
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'authenticated', email: 'test@example.com' } }); mocks.blocked.mockResolvedValue(false); });
it('rejects anonymous mutations', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await updateCommunityAction({}, form('follow'))).error).toContain('Войдите');
  await heartbeatAction(); expect(mocks.follow).not.toHaveBeenCalled(); expect(mocks.touch).not.toHaveBeenCalled();
});
it('uses only the authenticated actor for follows, comments and presence', async () => {
  await updateCommunityAction({}, form('follow')); expect(mocks.follow).toHaveBeenCalledWith('authenticated', 'target', true);
  await updateCommunityAction({}, form('comment')); expect(mocks.comment).toHaveBeenCalledWith('authenticated', 'target', 'hello', []);
  await heartbeatAction(); expect(mocks.touch).toHaveBeenCalledWith('authenticated');
});
it('blocks publishing for moderated users but permits unfollowing', async () => {
  mocks.blocked.mockResolvedValue(true);
  expect((await updateCommunityAction({}, form('comment'))).error).toContain('ограничены');
  expect(mocks.comment).not.toHaveBeenCalled();
  await updateCommunityAction({}, form('unfollow')); expect(mocks.follow).toHaveBeenCalledWith('authenticated', 'target', false);
});

it('rejects malformed wall attachments without publishing', async () => {
  const data = form('comment'); data.append('photos', 'not a file');
  expect((await updateCommunityAction({}, data)).error).toContain('фотографии');
  expect(mocks.comment).not.toHaveBeenCalled();
});
