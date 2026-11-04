import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let section: string | null = null;
vi.mock('next/navigation', () => ({ usePathname: () => '/profile/settings', useSearchParams: () => new URLSearchParams(section ? { section } : {}), useRouter: () => ({ push() {}, refresh() {} }) }));
vi.mock('@/app/profile/actions', () => ({ updateProfileAction: async () => ({}), deleteAccountAction: async () => {} }));
vi.mock('@/app/profile/community-actions', () => ({ updateCommunityAction: async () => ({}) }));
vi.mock('@/app/notifications/push-actions', () => ({ unregisterPushDeviceAction: async () => {} }));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: async () => ({}) } }));

const { ProfileEditForm } = await import('../src/components/profile-edit-form');
const profile = { id: 'u1', name: 'Тест', username: 'tester', bio: '', createdAt: new Date('2026-01-01'), avatarId: null, bannerId: null, telegramChannel: null, telegramUsername: null, profileAppearance: null, profileLayout: null } as never;
const render = () => renderToStaticMarkup(createElement(ProfileEditForm, {
  profile,
  settings: [{ key: 'settings', title: 'Настройки', rows: [{ key: 'notifications', title: 'Уведомления', value: 'Включено 3 из 5', icon: null, panel: createElement('p', null, 'панель уведомлений') }] }],
  accountRows: [{ key: 'email', title: 'Почта для входа', value: 'a@b.c', icon: null, panel: createElement('p', null, 'панель почты') }],
}));

describe('profile and settings hub', () => {
  it('lists profile and settings islands, with the email row above account deletion', () => {
    section = null;
    const html = render();
    expect(html).toContain('Уведомления');
    expect(html).toContain('Включено 3 из 5');
    expect(html.indexOf('Почта для входа')).toBeLessThan(html.indexOf('Удаление аккаунта'));
    // Signing out lives in settings now, between the email row and account deletion.
    expect(html).toMatch(/<button[^>]*id="profile-section-row-sign-out"/);
    expect(html.indexOf('Почта для входа')).toBeLessThan(html.indexOf('Выйти из аккаунта'));
    expect(html.indexOf('Выйти из аккаунта')).toBeLessThan(html.indexOf('Удаление аккаунта'));
    // The look is picked on the preview: no «Внешний вид» island or tag row in the list.
    expect(html).toContain('aria-label="Внешний вид профиля"');
    expect(html).not.toContain('id="profile-section-row-appearance"');
    expect(html).not.toContain('id="profile-section-row-tags"');
    expect(html.indexOf('aria-label="Внешний вид профиля"')).toBeLessThan(html.indexOf('>Настройки<'));
  });
  it('opens a settings panel from ?section= and hides the profile preview and save bar', () => {
    section = 'notifications';
    const html = render();
    expect(html).toMatch(/id="profile-panel-notifications"[^>]*class="profile-editor-panel profile-settings-panel"/);
    expect(html).not.toMatch(/id="profile-panel-notifications"[^>]*hidden/);
    expect(html).toMatch(/class="profile-editor-preview"[^>]*hidden|hidden=""[^>]*class="profile-editor-preview"/);
    expect(html).toContain('Все разделы');
  });
  it('keeps the pencil on a missing picture a plain upload and gives a set one its list', () => {
    section = null;
    const plain = render();
    expect(plain).not.toContain('profile-edit-menu');
    const withAvatar = renderToStaticMarkup(createElement(ProfileEditForm, { profile: { ...(profile as object), avatarId: '11111111-1111-4111-8111-111111111111' } as never }));
    expect(withAvatar).toContain('profile-edit-menu-avatar');
    expect(withAvatar).not.toContain('profile-edit-menu-banner');
  });
  it('opens the matching list on the preview for old links to the removed sections', () => {
    section = 'appearance';
    const html = render();
    expect(html).not.toContain('id="profile-panel-appearance"');
    expect(html).toContain('id="profile-section-row-details"');
  });
  it('renders a link row (the admin panel) as a link to its page, without a panel', () => {
    section = null;
    const html = renderToStaticMarkup(createElement(ProfileEditForm, { profile, settings: [{ key: 'admin', title: 'Администрирование', rows: [{ key: 'admin', title: 'Админ-панель', icon: null, href: '/admin' }] }] }));
    expect(html).toMatch(/<a[^>]*id="profile-section-row-admin"[^>]*href="\/admin"|<a[^>]*href="\/admin"[^>]*id="profile-section-row-admin"/);
    expect(html).not.toContain('id="profile-panel-admin"');
  });
});
