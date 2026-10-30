-- «Награды» в профиле компании: дипломы и сертификаты картинкой или PDF. Картинка перекодирована в WebP и хранится с
-- миниатюрой, у PDF миниатюры нет. Раздел можно выключить в настройках профиля, как остальные.
alter table business drop constraint "business_profileHidden_check";
alter table business add constraint "business_profileHidden_check" check ("profileHidden" <@ array['store', 'presentations', 'drinks', 'listings', 'awards']::text[]);

create table "businessAward" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "authorId" text references "user"(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  issuer text check (char_length(issuer) between 1 and 120),
  year integer check (year between 1900 and 2100),
  kind text not null check (kind in ('image', 'pdf')),
  "fileName" text check (char_length("fileName") between 1 and 120),
  "fileSize" integer not null check ("fileSize" > 0),
  data bytea not null,
  thumbnail bytea,
  "createdAt" timestamptz not null default now(),
  constraint business_award_file check ((kind = 'pdf') = ("fileName" is not null) and (kind = 'image') = (thumbnail is not null))
);
alter table "businessAward" alter column data set storage external;
create index business_award_list on "businessAward"("businessId", "createdAt" desc);
create trigger "businessAward_freeze" before insert on "businessAward" for each row execute function prevent_frozen_posting('authorId');

alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story','article','business-post','business-award'
));
