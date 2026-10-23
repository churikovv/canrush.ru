'use server';
import { headers } from 'next/headers';
import { renderFeedItems } from '@/components/feed-browser';
import { auth } from '@/lib/auth';
import { profilePageNumber } from '@/lib/profile-achievements';
import { getFeed } from '@/lib/profile-community';

/** The next page of the home feed, rendered on the server: the rows to append and whether there is more. */
export async function loadFeedPageAction(page: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user.id ?? null;
  const feed = await getFeed(viewerId, 'all', profilePageNumber(page));
  return { rows: <>{await renderFeedItems(feed.items, viewerId)}</>, hasMore: feed.hasMore };
}
