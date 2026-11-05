import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));
const { PickSlide, PicksCover } = await import('../src/components/picks-story');
import type { PicksProfile, StoryRecommendation } from '../src/lib/story-digest';

const item = (patch: Partial<StoryRecommendation> = {}): StoryRecommendation => ({
  brand: 'Burn', flavor: 'orange', name: 'Апельсин', href: '/catalog/burn-orange', cover: '/images/products/burn-orange.jpg',
  reason: { kind: 'brand', brand: 'Burn' }, match: 83, price: 129.99, stores: 3, sugarfree: false, fans: [],
  because: [{ label: 'Burn Манго', flavor: 'Манго', cover: null }, { label: 'Burn Тропический', flavor: 'Тропический', cover: null }, { label: 'Burn Гуава', flavor: 'Гуава', cover: null }],
  ...patch,
});
const profile: PicksProfile = { title: 'Тропический', lead: 'Тянет к тропикам', loves: ['Манго'], brand: 'Burn', sugarfree: false, reviews: 5, favorites: 2, swipes: 6 };
const slide = (pick: StoryRecommendation) => renderToStaticMarkup(<PickSlide item={pick} basis="similar" index={2} total={5} decision={undefined} onFavorite={() => {}} onNope={() => {}} />);

it('shows how well a pick fits, where it sells and the viewer’s own drinks behind it', () => {
  const html = slide(item());
  expect(html).toContain('83%');
  expect(html).toContain('Для тебя · 2 из 5');
  expect(html).toContain('от 129,99 ₽');
  expect(html).toContain('3 магазина');
  expect(html).toContain('Почему тебе');
  expect(html).toContain('Твои любимые от Burn: Манго, Тропический и ещё 1');
  expect(html).toContain('/api/can-cutouts?src=');
  expect(html).toContain('href="/catalog/burn-orange"');
});

it('names the people behind a pick only for a similar taste, and keeps the community picks without a match', () => {
  const html = slide(item({ reason: { kind: 'similar', fans: 4, match: 70 }, fans: [{ username: 'kate', avatarId: null }, { username: 'max', avatarId: null }] }));
  expect(html).toContain('@kate, @max');
  expect(html).toContain('и ещё 2 людям');
  expect(html).toContain('У вас общие любимые: Burn Манго, Burn Тропический и ещё 1');
  const community = renderToStaticMarkup(<PickSlide item={item({ reason: { kind: 'community', taste: 8.6, reviews: 12 }, match: null, because: [], price: null, stores: 0 })} basis="community" index={1} total={5} decision={undefined} onFavorite={() => {}} onNope={() => {}} />);
  expect(community).not.toContain('совпадение');
  expect(community).toContain('Сейчас нет в продаже');
  expect(community).toContain('8,6 из 10');
});

it('opens with what the picks know about the viewer and closes with all of them', () => {
  const intro = renderToStaticMarkup(<PicksCover page="intro" picks={{ basis: 'similar', profile, items: [item()], username: 'newbie' }} />);
  expect(intro).toContain('@newbie');
  expect(intro).toContain('Тропический');
  expect(intro).toContain('Любимый бренд — Burn');
  expect(intro).toContain('Собрано по 5 оценкам, 2 избранным и 6 свайпам');
  const cold = renderToStaticMarkup(<PicksCover page="intro" picks={{ basis: 'community', profile: { ...profile, title: null, lead: null, loves: [], brand: null, reviews: 1, favorites: 0, swipes: 0 }, items: [item()], username: null }} />);
  expect(cold).toContain('Начнём с любимого сообщества');
  expect(cold).toContain('Собрано по 1 оценке');
  const outro = renderToStaticMarkup(<PicksCover page="outro" picks={{ basis: 'similar', profile, items: [item(), item({ href: '/catalog/burn-mango', match: 71 })], username: null }} />);
  expect(outro).toContain('Завтра — новая');
  expect(outro).toContain('71%');
  expect(outro).toContain('href="/community?type=dating"');
});
