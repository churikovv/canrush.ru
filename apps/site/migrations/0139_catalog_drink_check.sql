-- The neural network's duplicate check of a member's drink: one row per drink with the latest verdict — the catalog
-- card it looks like and why. It is a hint for moderators (the request's card in /admin/drinks, «Возможные дубли» for
-- published drinks), never a decision. `checkedVersion` is the drink's `updatedAt` that was checked: an edit makes the
-- worker check it again. `dismissedAt` — the team said «не дубль» for this match.
create table "catalogDrinkCheck" (
  "drinkId" uuid primary key references "catalogDrink"(id) on delete cascade,
  verdict text not null check (verdict in ('duplicate', 'unsure', 'new', 'failed')),
  "matchBrand" text,
  "matchFlavor" text,
  "matchLabel" text,
  reason text not null default '',
  "checkedVersion" timestamptz not null,
  "checkedAt" timestamptz not null default now(),
  "dismissedAt" timestamptz,
  "dismissedBy" text
);
create index catalog_drink_check_suspects on "catalogDrinkCheck"(verdict) where "dismissedAt" is null;
