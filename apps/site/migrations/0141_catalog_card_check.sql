-- The neural network's duplicate check of the parser's catalog cards. A card it is sure about (three answers name the
-- same card) is merged automatically (`merged`, the team sees it under «Склеено нейросетью»); a likely duplicate
-- (`duplicate`, `unsure`) or a card whose flavour the parser could not read (`unknown`) waits for a moderator in
-- «Карточки каталога» until merged, hidden or cleared (`dismissedAt`). One row per card, checked once; `failed` retries.
create table "catalogCardCheck" (
  brand text not null,
  flavor text not null,
  verdict text not null check (verdict in ('duplicate', 'unsure', 'new', 'failed', 'unknown', 'merged')),
  "matchBrand" text,
  "matchFlavor" text,
  "matchLabel" text,
  reason text not null default '',
  title text,
  "checkedAt" timestamptz not null default now(),
  "dismissedAt" timestamptz,
  "dismissedBy" text,
  primary key (brand, flavor)
);
create index catalog_card_check_queue on "catalogCardCheck"(verdict) where "dismissedAt" is null;
