-- «Фото коллекции» в профиле: необязательный блок, где участник показывает свою коллекцию банок. Фото перекодировано в
-- WebP и хранится с миниатюрой, подпись необязательна. Удаляются вместе с аккаунтом; замороженный участник новых не добавляет,
-- посторонние жалуются, команда удаляет на месте.
create table "collectionPhoto" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  caption text check (char_length(caption) between 1 and 80),
  data bytea not null,
  thumbnail bytea not null,
  "createdAt" timestamptz not null default now()
);
alter table "collectionPhoto" alter column data set storage external;
create index collection_photo_user on "collectionPhoto"("userId", "createdAt" desc);
create trigger "collectionPhoto_freeze" before insert on "collectionPhoto" for each row execute function prevent_frozen_posting('userId');

alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story','article','business-post','business-award','store-preset','collection-photo'
));
