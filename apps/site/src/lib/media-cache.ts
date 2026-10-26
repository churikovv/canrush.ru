/**
 * Cache headers for photos and videos served from the database. A stored file never changes under its id (a new avatar,
 * banner or photo gets a new id), so a phone may keep it: the feed and profiles stop downloading the same avatars on
 * every view, and the database stops reading them. `private` keeps them on the viewer's device only, never in a shared
 * cache, so a removed photo is not served to anyone who has not already seen it.
 */
export const IMMUTABLE_MEDIA = 'private, max-age=2592000, immutable';
/** Stories live for 24 hours and are checked on every fetch, so the device keeps one for an hour at most. */
export const STORY_MEDIA = 'private, max-age=3600';
/** Published store photos: public pages, but a store can be edited, so a day. */
export const STORE_MEDIA = 'private, max-age=86400';
/** Photos of a published article: public, but the article can go back to drafts, so a day. */
export const ARTICLE_MEDIA = 'private, max-age=86400';
/** Anything only some members may see right now (pending requests, order attachments): never stored. */
export const NO_STORE_MEDIA = 'private, no-store';
