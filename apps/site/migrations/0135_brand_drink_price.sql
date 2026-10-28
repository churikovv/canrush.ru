-- A brand's recommended price ceiling for its drink: «до N ₽» per can volume. The drink page shows it next to shop
-- prices and marks offers above it; the cabinet shows how many offers break it. One ceiling per company, drink and
-- volume; only an approved company with the drink approved for it writes here.
create table "brandDrinkPrice" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text references "user"(id) on delete set null,
  brand text not null,
  flavor text not null,
  "volumeMl" integer not null check ("volumeMl" between 100 and 2000),
  "maxPrice" numeric(10, 2) not null check ("maxPrice" > 0 and "maxPrice" < 100000),
  "updatedAt" timestamptz not null default now(),
  unique ("businessId", brand, flavor, "volumeMl")
);
create index brand_drink_price_drink on "brandDrinkPrice"(brand, flavor);
