import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@/app/first-steps-actions', () => ({ hideFirstStepsAction: async () => {}, claimFirstStepAction: async () => ({ ok: true, equipped: true }), wearFirstStepAction: async () => ({}) }));
vi.mock('@/app/community/dating-actions', () => ({ peopleCardAction: async () => ({ people: [] }), personDecisionAction: async () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));
vi.mock('@/db/pool', () => ({ getPool: () => { throw new Error('no database here'); } }));
const { firstSteps, FIRST_SWIPES } = await import('../src/lib/first-steps');
const { FirstSteps } = await import('../src/components/first-steps');
const { WELCOME_CAPS } = await import('../src/lib/gacha-fields');

const state = { pulled: true, welcomed: true, swipes: 2, followed: false, claimedTag: false, claimedFrame: false };
const card = (steps = firstSteps(state), person: Parameters<typeof FirstSteps>[0]['card']['person'] = null) => renderToStaticMarkup(<FirstSteps card={{ steps, person, avatarId: null, username: 'newbie' }} />);

it('lays out three short steps: the pull, five swipes and a follow, with the tag and the frame as rewards', () => {
  expect(firstSteps(state).map(step => step.key)).toEqual(['gacha', 'swipes', 'follow']);
  const html = card();
  expect(html).toContain('1 из 3');
  expect(html).toContain('data-tag="first-charge"');
  expect(html).toContain('avatar-frame-charge');
  expect(html).toContain('Скрыть');
  expect(html).toContain(' — готово');
});

it('acts on the step in progress right in its row: the swipe count and the way to the deck', () => {
  const html = card();
  expect(html).toContain(`aria-valuenow="2"`);
  expect(html).toContain(`2 из ${FIRST_SWIPES}`);
  expect(html).toContain('href="/community?type=dating"');
  expect(html).not.toContain('href="/gacha"');
});

it('offers a person to follow on the spot once the follow step is next', () => {
  const steps = firstSteps({ ...state, swipes: FIRST_SWIPES, claimedTag: true });
  const html = card(steps, { id: 'p1', username: 'berry_fan', name: 'Berry', avatarId: null, bannerId: null, frame: 'none', level: 3, bio: null, tag: null, verified: false, reviews: 4, followers: 2, reason: { kind: 'taste', shared: 3, drinks: [] } });
  expect(html).toContain('@berry_fan');
  expect(html).toContain('3 общих лайка с вами');
  expect(html).toContain('Подписаться');
  expect(html).not.toContain('href="/community?type=people"');
});

it('turns a done step into a reward waiting for its button, and the card counts it only once taken', () => {
  const steps = firstSteps({ ...state, swipes: 7 });
  expect(steps.find(step => step.key === 'swipes')).toMatchObject({ done: true, claimable: true, progress: { value: FIRST_SWIPES, goal: FIRST_SWIPES } });
  const html = card(steps);
  expect(html).toContain('Забрать тег');
  expect(html).toContain('1 из 3');
  expect(firstSteps({ ...state, swipes: 7, claimedTag: true }).find(step => step.key === 'swipes')?.claimable).toBe(false);
  expect(firstSteps({ ...state, followed: true }).find(step => step.key === 'follow')).toMatchObject({ done: true, claimable: true });
});

it('names the welcome caps only until they are paid, otherwise the card itself', () => {
  expect(firstSteps({ ...state, pulled: false, welcomed: false })[0]?.reward).toEqual({ kind: 'caps', caps: WELCOME_CAPS });
  expect(firstSteps({ ...state, pulled: false })[0]?.reward).toEqual({ kind: 'card' });
  expect(firstSteps(state)[0]?.claimable).toBe(false);
});
