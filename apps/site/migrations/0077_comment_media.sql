-- Photos, GIFs and videos in review, tier list and wall comments, by the same rules as wall records (0056):
-- up to 5 per comment, one video, GIFs stored as animated WebP, videos as MP4/WebM with a re-encoded poster.
create table "commentMedia" (
  id uuid primary key default gen_random_uuid(),
  "reviewCommentId" uuid references "reviewComment"(id) on delete cascade,
  "tierListCommentId" uuid references "tierListComment"(id) on delete cascade,
  "wallReplyId" uuid references "wallReply"(id) on delete cascade,
  position integer not null check (position between 0 and 4),
  kind text not null check (kind in ('image', 'gif', 'video')),
  mime text not null check (mime in ('image/webp', 'video/mp4', 'video/webm')),
  data bytea not null,
  thumbnail bytea not null,
  "createdAt" timestamptz not null default now(),
  -- Exactly one discussion owns the attachment.
  check (num_nonnulls("reviewCommentId", "tierListCommentId", "wallReplyId") = 1),
  check ((kind = 'video') = (mime like 'video/%')),
  check (octet_length(data) >= 1 and octet_length(thumbnail) >= 1 and case kind
    when 'image' then octet_length(data) <= 2097152 and octet_length(thumbnail) <= 262144
    when 'gif' then octet_length(data) <= 8388608 and octet_length(thumbnail) <= 2097152
    else octet_length(data) <= 20971520 and octet_length(thumbnail) <= 262144 end)
);
create unique index "commentMedia_review_position_idx" on "commentMedia" ("reviewCommentId", position) where "reviewCommentId" is not null;
create unique index "commentMedia_tier_position_idx" on "commentMedia" ("tierListCommentId", position) where "tierListCommentId" is not null;
create unique index "commentMedia_wall_position_idx" on "commentMedia" ("wallReplyId", position) where "wallReplyId" is not null;
create unique index "commentMedia_review_video_idx" on "commentMedia" ("reviewCommentId") where kind = 'video' and "reviewCommentId" is not null;
create unique index "commentMedia_tier_video_idx" on "commentMedia" ("tierListCommentId") where kind = 'video' and "tierListCommentId" is not null;
create unique index "commentMedia_wall_video_idx" on "commentMedia" ("wallReplyId") where kind = 'video' and "wallReplyId" is not null;
-- Videos are streamed by byte ranges; uncompressed TOAST lets substring() read only the requested slice.
alter table "commentMedia" alter column data set storage external;
