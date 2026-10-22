import type { CatalogGroup } from '@canrush/shared';
import { StoriesStrip, type DigestPage, type StoryGroupView } from '@/components/stories-strip';
import { getRecommendations, getWeeklyDigest } from '@/lib/story-digest';
import { getPool } from '@/db/pool';
import { getStoryGroups } from '@/lib/stories';

/**
 * Stories at the top of the home page: for a signed-in member their «Твоя неделя» digest and «Тебе понравится»
 * picks first (built on the fly, nothing stored), then members' own stories of the last 24 hours.
 */
export async function HomeStories({ viewerId, groups, openStory }: { viewerId: string | null; groups: CatalogGroup[]; openStory?: string }) {
  const viewer = viewerId ? (await getPool().query<{ id: string; username: string | null; avatarId: string | null }>(
    `select u.id, u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId" from "user" u where u.id = $1`, [viewerId])).rows[0] ?? null : null;
  const [stories, digest, recommendations] = await Promise.all([
    getStoryGroups(viewer?.id ?? null),
    viewer ? getWeeklyDigest(viewer.id) : null,
    viewer ? getRecommendations(viewer.id, groups) : null,
  ]);
  const system: StoryGroupView[] = [];
  // Wrapped-style: intro, cans by day, the drink of the week, progress, discoveries and a summary card.
  // An empty week is one slide that invites to log a can; the drink slide needs a drink from the catalog.
  if (digest) {
    const top = digest.favorite?.brand ? groups.find(group => group.brand === digest.favorite!.brand && group.flavor === digest.favorite!.flavor) : undefined;
    const week = { ...digest, favorite: digest.favorite && { ...digest.favorite, cover: top?.coverImageUrl ?? null } };
    const pages: DigestPage[] = !digest.cans && !digest.xp ? ['empty'] : ['intro', 'cans', ...(week.favorite ? ['drink' as const] : []), 'progress', 'discover', 'summary'];
    system.push({ key: `week:${digest.to}`, kind: 'week', title: 'Твоя неделя', slides: pages.map(page => ({ kind: 'digest', digest: week, page })) });
  }
  if (recommendations?.items.length) system.push({
    key: `picks:${digest?.to ?? ''}`, kind: 'picks', title: 'Тебе понравится',
    slides: recommendations.items.map(item => ({ kind: 'pick', item, basis: recommendations.basis })),
  });
  const people: StoryGroupView[] = stories.map(group => ({
    key: `user:${group.author.id}`, kind: 'user', title: group.own ? 'Вы' : group.author.username, author: group.author, own: group.own, seen: group.seen,
    slides: group.stories.map(story => ({ kind: 'media', story })),
  }));
  const own = people.find(group => group.own);
  const ordered = [...(own ? [own] : []), ...system, ...people.filter(group => !group.own)];
  // A shared link opens that story if it is still up; otherwise the row just shows as usual.
  const group = openStory ? ordered.findIndex(item => item.slides.some(slide => slide.kind === 'media' && slide.story.id === openStory)) : -1;
  const initial = group >= 0 ? { group, slide: ordered[group]!.slides.findIndex(slide => slide.kind === 'media' && slide.story.id === openStory) } : undefined;
  return <StoriesStrip groups={ordered} initial={initial}
    viewer={viewer ? { username: viewer.username, avatarId: viewer.avatarId } : null} />;
}
