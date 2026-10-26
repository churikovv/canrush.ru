-- Статьи участников (раздел «Новости»): блочный редактор как в Notion. Любой участник пишет черновик и отправляет его
-- на проверку, команда публикует или возвращает с причиной — как напитки участников (0094). Текст хранится блоками в
-- jsonb (правила — src/lib/article-fields.ts), фото — отдельной таблицей, как вложения стены.
create table article (
  id uuid primary key default gen_random_uuid(),
  "authorId" text not null references "user"(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  blocks jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array' and octet_length(blocks::text) <= 400000),
  "coverId" uuid,
  status text not null default 'draft' check (status in ('draft', 'pending', 'published', 'rejected')),
  "moderationNote" text not null default '' check (char_length("moderationNote") <= 500),
  "reviewedBy" text references "user"(id) on delete set null,
  "reviewedAt" timestamptz,
  "submittedAt" timestamptz,
  "publishedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default clock_timestamp()
);
create index article_published on article("publishedAt" desc) where status = 'published';
create index article_pending on article("submittedAt") where status = 'pending';
create index article_author on article("authorId", "updatedAt" desc);

-- Фото статьи: обложка и блоки «Фото». Удаляются вместе со статьёй; видны всем, только пока статья опубликована.
create table "articleImage" (
  id uuid primary key default gen_random_uuid(),
  "articleId" uuid not null references article(id) on delete cascade,
  data bytea not null,
  thumbnail bytea not null,
  "createdAt" timestamptz not null default now()
);
alter table "articleImage" alter column data set storage external;
create index article_image_article on "articleImage"("articleId");
alter table article add constraint article_cover foreign key ("coverId") references "articleImage"(id) on delete set null;

-- Замороженный участник не начинает новых статей (черновики дописывать можно, отправку закрывает сайт).
create trigger article_freeze before insert on article for each row execute function prevent_frozen_posting('authorId');
