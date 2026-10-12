create table "marketStore" (
  id uuid primary key default gen_random_uuid(),
  "ownerId" text not null references "user"(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 120),
  city text not null,
  address text not null check(char_length(address) between 1 and 300),
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  metro text,
  description text not null default '' check(char_length(description)<=1500),
  catalog jsonb not null default '[]' check(jsonb_typeof(catalog)='array' and jsonb_array_length(catalog)<=50),
  status text not null default 'pending' check(status in ('pending','published','rejected')),
  "moderationNote" text not null default '' check(char_length("moderationNote")<=500),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "reviewedAt" timestamptz,
  "reviewedBy" text references "user"(id) on delete set null
);
create index market_store_city_status on "marketStore"(city,status,"updatedAt" desc);
create index market_store_owner on "marketStore"("ownerId");
create unique index market_store_address on "marketStore"(city,lower(btrim(name)),lower(btrim(address))) where status<>'rejected';
