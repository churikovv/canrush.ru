import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }), usePathname: () => '/profile/owl', useSearchParams: () => new URLSearchParams() }));
const { ProfileExperience } = await import('../src/components/profile-experience');

const panel = (own: boolean) => renderToStaticMarkup(<ProfileExperience username="owl" initial={{ xp: 6020, rank: 2 }} expanded own={own} achievements={{ earned: 3, total: 40 }} />);

it('shows everyone the emblem on its pedestal, the rank and the XP', () => {
  for (const html of [panel(true), panel(false)]) {
    expect(html).toContain('rank-pedestal');
    expect(html).toContain('Золото III');
    expect(html).toMatch(/6\s020/); // ru-RU groups digits with a no-break space
  }
});

it('keeps the road of ranks, the quick stats and the next rewards for the owner', () => {
  const owner = panel(true);
  expect(owner).toContain('experience-road');
  expect(owner).toContain('experience-stats');
  expect(owner).toContain('Награды за уровень');
  const visitor = panel(false);
  expect(visitor).not.toContain('experience-road');
  expect(visitor).not.toContain('experience-stats');
  expect(visitor).not.toContain('Награды за уровень');
});
