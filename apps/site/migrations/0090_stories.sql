-- Истории на главной: фото, GIF или видео с подписью, видны 24 часа (фильтр в запросах, старые строки
-- удаляются при публикации новых). Медиа — по правилам вложений стены (`prepareWallMedia`), одно на историю.
create table "story" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  kind text not null check (kind in ('image', 'gif', 'video')),
  mime text not null check (mime in ('image/webp', 'video/mp4', 'video/webm')),
  data bytea not null,
  thumbnail bytea not null,
  caption text not null default '' check (char_length(caption) <= 200),
  "createdAt" timestamptz not null default now()
);
-- Видео читается кусками (Range), как у вложений стены.
alter table "story" alter column data set storage external;
create index story_recent on "story"("createdAt" desc);
create index story_user on "story"("userId", "createdAt" desc);

-- Кто какую историю видел: кольцо вокруг аватарки гаснет, когда все истории автора просмотрены.
create table "storyView" (
  "storyId" uuid not null references "story"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  "viewedAt" timestamptz not null default now(),
  primary key ("storyId", "userId")
);

-- Жалоба на историю — та же очередь, что у остального контента.
alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story'
));
