import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push() {}, refresh() {} }) }));
const { AdminShell } = await import('../src/components/admin-shell');
const render = (role: 'admin' | 'moderator') => renderToStaticMarkup(<AdminShell active="analytics" email="staff@example.com" role={role} title="Аналитика">{null}</AdminShell>);

it('hides administrators, contests and campaigns from a moderator', () => {
  const moderator = render('moderator');
  for (const label of ['>Кампании<', '>Конкурс<', '>Администраторы<']) expect(moderator).not.toContain(label);
  for (const label of ['>Аналитика<', '>Магазины<', '>Напитки<', '>Жалобы<', '>Участники<', '>Отзывы<']) expect(moderator).toContain(label);
  expect(moderator).toContain('Модератор');
  const admin = render('admin');
  for (const label of ['>Кампании<', '>Конкурс<', '>Администраторы<']) expect(admin).toContain(label);
});
