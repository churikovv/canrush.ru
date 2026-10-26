-- Лайки статей и жалобы на них: лайк — одна строка на участника и статью; жалоба — та же очередь, что у остального
-- контента (0084), с видом 'article'.
create table "articleLike" (
  "articleId" uuid not null references article(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("articleId", "userId")
);
create index article_like_user on "articleLike"("userId");

alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story','article'
));
