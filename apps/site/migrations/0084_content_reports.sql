-- Жалобы на контент (требование Google Play к пользовательскому контенту): та же очередь
-- "profileReport", но с конкретным объектом. "targetId" — автор контента, "excerpt" — снимок текста,
-- чтобы админ видел, на что жаловались, даже после удаления; "pagePath" — где жалобу отправили.
alter table "profileReport"
  add column "contentKind" text check ("contentKind" in (
    'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store'
  )),
  add column "contentId" uuid,
  add column excerpt text not null default '' check (char_length(excerpt) <= 300),
  add column "pagePath" text check ("pagePath" is null or (char_length("pagePath") <= 300 and "pagePath" ~ '^/[^/]')),
  add constraint profile_report_content_pair check (("contentKind" is null) = ("contentId" is null));

-- Профиль и каждый объект — отдельная открытая жалоба одного участника.
drop index profile_report_open_unique;
create unique index profile_report_open_unique on "profileReport" ("userId","targetId",coalesce("contentId"::text,'')) where status='open';
