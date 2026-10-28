-- «Где купить» from the brand: a company lists, for each of its approved drinks, where the drink is sold — a store on
-- the CanRush map, a retail chain, or a store of its own (a name with a link and/or an address). No moderation: only an
-- approved company with the drink approved for it writes here, and the drink page shows the list only while both hold.
create table "brandDrinkStore" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text references "user"(id) on delete set null,
  brand text not null,
  flavor text not null,
  kind text not null check (kind in ('store', 'retailer', 'custom')),
  "storeId" uuid references "marketStore"(id) on delete cascade,
  retailer text check (retailer is null or char_length(retailer) between 1 and 80),
  name text check (name is null or char_length(name) between 1 and 80),
  url text check (url is null or (char_length(url) <= 300 and url ~ '^https?://')),
  address text check (address is null or char_length(address) between 1 and 200),
  city text check (city is null or char_length(city) between 1 and 60),
  "createdAt" timestamptz not null default now(),
  constraint brand_drink_store_kind check (
    (kind = 'store' and "storeId" is not null and retailer is null and name is null)
    or (kind = 'retailer' and retailer is not null and "storeId" is null and name is null)
    or (kind = 'custom' and name is not null and "storeId" is null and retailer is null and (url is not null or address is not null))
  )
);
create unique index brand_drink_store_store on "brandDrinkStore"("businessId", brand, flavor, "storeId") where "storeId" is not null;
create unique index brand_drink_store_retailer on "brandDrinkStore"("businessId", brand, flavor, lower(retailer)) where retailer is not null;
create index brand_drink_store_drink on "brandDrinkStore"(brand, flavor);
