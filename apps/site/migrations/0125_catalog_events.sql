-- Drink card analytics for business cabinets: one anonymous row per view of a drink's page and per tap on a store
-- offer — no member, session or address, only the drink, what happened, the retailer (for taps) and when.
create table "catalogEvent" (
  id bigserial primary key,
  brand text not null check (char_length(brand) between 1 and 120),
  flavor text not null check (char_length(flavor) between 1 and 160),
  kind text not null check (kind in ('view', 'store')),
  retailer text check (retailer is null or char_length(retailer) <= 80),
  "createdAt" timestamptz not null default now()
);
create index catalog_event_drink on "catalogEvent"(brand, flavor, "createdAt");
create index catalog_event_created on "catalogEvent"("createdAt");
