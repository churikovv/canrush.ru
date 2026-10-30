import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push() {}, refresh() {} }) }));
const { AdminShell } = await import('../src/components/admin-shell');
const render = (role: 'admin' | 'moderator') => renderToStaticMarkup(<AdminShell active="analytics" email="staff@example.com" role={role} title="Аналитика">{null}</AdminShell>);

it('hides administrators, contests, campaigns and errors from a moderator', () => {
  const moderator = render('moderator');
  for (const label of ['>Кампании<', '>Конкурс<', '>Администраторы<', '>Ошибки<']) expect(moderator).not.toContain(label);
  for (const label of ['>Аналитика<', '>Магазины<', '>Напитки<', '>Жалобы<', '>Участники<', '>Объявления<']) expect(moderator).toContain(label);
  // Groups left without items disappear with them.
  for (const group of ['Модерация', 'Каталог']) expect(moderator).toContain(group);
  for (const group of ['Продвижение', 'Команда', 'Система']) expect(moderator).not.toContain(group);
  expect(moderator).toContain('Модератор');
  const admin = render('admin');
  for (const label of ['>Кампании<', '>Конкурс<', '>Администраторы<', '>Ошибки<', 'Продвижение', 'Команда', 'Система']) expect(admin).toContain(label);
});

it('has no sections for content deleted in place', () => {
  // Reviews, comments, wall posts and tier lists are deleted from their «⋯» menus (staff-moderation.ts).
  for (const label of ['>Отзывы<', '>Комментарии<', '>Стена<', '>Тирлисты<']) expect(render('admin')).not.toContain(label);
});
