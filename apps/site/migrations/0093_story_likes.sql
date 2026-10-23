-- Лайки историй участников: один лайк на человека, снимается повторным нажатием, удаляется вместе с историей.
create table "storyLike" (
  "storyId" uuid not null references "story"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("storyId", "userId")
);
create index story_like_user on "storyLike"("userId");
