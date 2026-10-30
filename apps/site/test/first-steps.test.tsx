import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@/app/first-steps-actions', () => ({ hideFirstStepsAction: async () => {} }));
vi.mock('@/db/pool', () => ({ getPool: () => { throw new Error('no database here'); } }));
const { firstSteps } = await import('../src/lib/first-steps');
const { FirstSteps } = await import('../src/components/first-steps');

const state = { pulled: true, swiped: false, drank: false, profiled: false, welcomed: true };

it('links undone steps to their place and keeps done ones plain, with progress and a hide button', () => {
  const html = renderToStaticMarkup(<FirstSteps steps={firstSteps(state)} />);
  expect(html).toContain('1 из 4 готово');
  expect(html).not.toContain('href="/gacha"');
  expect(html).toContain('href="/community?type=dating"');
  expect(html).toContain('href="/calendar#add-drink"');
  expect(html).toContain('href="/profile/settings?section=details"');
  expect(html).toContain('Скрыть');
  expect(html).toContain(' — готово');
});

it('shows only rewards the system pays', () => {
  const steps = firstSteps({ ...state, pulled: false, welcomed: false });
  expect(Object.fromEntries(steps.map(step => [step.key, step.reward]))).toEqual({ gacha: '+30 крышек', dating: '+2 XP за свайп', drink: '+3 крышки и 10 XP', profile: null });
  expect(firstSteps({ ...state, pulled: false }).find(step => step.key === 'gacha')?.reward).toBeNull();
});
