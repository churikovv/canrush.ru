import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('@/app/profile/block-actions', () => ({ setMemberBlockAction: async () => ({ blocked: false }) }));
const { BlockMemberButton } = await import('../src/components/block-member-button');

it('shows a notice with a small unblock button once blocked, and a plain danger action before', () => {
  const blocked = renderToStaticMarkup(createElement(BlockMemberButton, { userId: 'u', name: '@vova', initiallyBlocked: true }));
  expect(blocked).toContain('block-member-notice');
  expect(blocked).toContain('Вы заблокировали @vova');
  expect(blocked).toContain('Разблокировать');
  const open = renderToStaticMarkup(createElement(BlockMemberButton, { userId: 'u', name: '@vova' }));
  expect(open).not.toContain('block-member-notice');
  expect(open).toContain('block-member-action');
  const compact = renderToStaticMarkup(createElement(BlockMemberButton, { userId: 'u', name: '@vova', initiallyBlocked: true, compact: true }));
  expect(compact).not.toContain('block-member-notice');
});
