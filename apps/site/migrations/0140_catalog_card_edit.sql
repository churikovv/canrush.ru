-- The team's edits of the parser's catalog cards, which live in files the parser rewrites: a merge into another card
-- (the card disappears, its offers join the target, members' reviews, favourites and the rest move there with
-- `move_drink_identity` and the old address redirects through `catalogDrinkRename`), hiding a card from the catalog,
-- the full name from the can, and a cover photo of our own. Applied on every catalog load (`withCardEdits`).
create table "catalogCardEdit" (
  id uuid not null default gen_random_uuid() unique,
  brand text not null,
  flavor text not null,
  "mergedIntoBrand" text,
  "mergedIntoFlavor" text,
  hidden boolean not null default false,
  "fullName" text check ("fullName" is null or char_length("fullName") between 2 and 80),
  photo bytea,
  thumbnail bytea,
  "updatedAt" timestamptz not null default now(),
  "updatedBy" text,
  primary key (brand, flavor),
  check (("mergedIntoBrand" is null) = ("mergedIntoFlavor" is null)),
  check ((photo is null) = (thumbnail is null))
);
alter table "catalogCardEdit" alter column photo set storage external;
