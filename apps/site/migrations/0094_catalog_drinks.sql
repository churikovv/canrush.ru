-- Напитки, которые участники добавляют в каталог сами. Видны всем только после модерации (status = 'published'),
-- как магазины (0036). Бренд и ключ вкуса — та же идентичность, что у групп каталога из парсера: по ней к напитку
-- привязываются отзывы, избранное, календарь и тирлисты.
create table "catalogDrink" (
  id uuid primary key default gen_random_uuid(),
  "ownerId" text not null references "user"(id) on delete cascade,
  brand text not null check (char_length(brand) between 2 and 40),
  flavor text not null check (char_length(flavor) between 1 and 120),
  volumes integer[] not null check (cardinality(volumes) between 1 and 6 and 100 <= all(volumes) and 2000 >= all(volumes)),
  ingredients text not null default '' check (char_length(ingredients) <= 1500),
  photo bytea not null,
  thumbnail bytea not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  "moderationNote" text not null default '' check (char_length("moderationNote") <= 500),
  "reviewedBy" text references "user"(id) on delete set null,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default clock_timestamp()
);
alter table "catalogDrink" alter column photo set storage external;
-- One live request or published drink per identity; a rejected one may be sent again.
create unique index catalog_drink_identity on "catalogDrink"(lower(brand), lower(flavor)) where status <> 'rejected';
create index catalog_drink_status on "catalogDrink"(status, "createdAt");
create index catalog_drink_owner on "catalogDrink"("ownerId", "createdAt" desc);
