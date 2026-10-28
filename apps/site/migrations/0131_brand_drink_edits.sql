-- A company proposes corrections to the card of one of its approved drinks: the can's photo, the full name, the
-- composition from the label and a description from the brand. The team approves or rejects; an approved edit goes
-- into the drink's brand profile, which the catalog shows over the parser's and members' data.
create table "brandDrinkEdit" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text references "user"(id) on delete set null,
  brand text not null,
  flavor text not null,
  "fullName" text check ("fullName" is null or char_length("fullName") between 1 and 80),
  ingredients text check (ingredients is null or char_length(ingredients) between 35 and 1500),
  description text check (description is null or char_length(description) between 1 and 600),
  photo bytea,
  thumbnail bytea,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  "moderationNote" text check ("moderationNote" is null or char_length("moderationNote") <= 500),
  "reviewedBy" text references "user"(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "reviewedAt" timestamptz,
  constraint brand_drink_edit_something check ("fullName" is not null or ingredients is not null or description is not null or photo is not null),
  constraint brand_drink_edit_photo check ((photo is null) = (thumbnail is null))
);
alter table "brandDrinkEdit" alter column photo set storage external;
create unique index brand_drink_edit_one_pending on "brandDrinkEdit"("businessId", brand, flavor) where status = 'pending';
create index brand_drink_edit_queue on "brandDrinkEdit"(status, "createdAt");

create table "brandDrinkProfile" (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  flavor text not null,
  "businessId" uuid references business(id) on delete set null,
  "fullName" text,
  ingredients text,
  description text,
  photo bytea,
  thumbnail bytea,
  "updatedAt" timestamptz not null default now(),
  unique (brand, flavor)
);
alter table "brandDrinkProfile" alter column photo set storage external;
