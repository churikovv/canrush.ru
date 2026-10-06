create table "marketListing" (
  id uuid primary key default gen_random_uuid(),
  "sellerId" text not null references "user"(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 5000),
  city text not null check (char_length(city) between 1 and 100),
  price integer not null check (price between 1 and 1000000000),
  delivery text[] not null check (cardinality(delivery) between 1 and 6 and delivery <@ array['yandex','avito','cdek','post','x5','pickup']::text[]),
  closed boolean not null default false,
  "createdAt" timestamptz not null default now()
);
create index "marketListing_feed" on "marketListing"("createdAt" desc, id desc) where not closed;
create index "marketListing_seller" on "marketListing"("sellerId");
create table "marketOrder" (
  id uuid primary key default gen_random_uuid(),
  "listingId" uuid not null references "marketListing"(id) on delete cascade,
  "buyerId" text not null references "user"(id) on delete cascade,
  status text not null default 'new' check (status in ('new','confirmed','completed','cancelled')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "buyerReadAt" timestamptz,
  "sellerReadAt" timestamptz,
  unique ("listingId", "buyerId")
);
create index "marketOrder_buyer" on "marketOrder"("buyerId", "updatedAt" desc);
create table "marketMessage" (
  id uuid primary key default gen_random_uuid(),
  "orderId" uuid not null references "marketOrder"(id) on delete cascade,
  "senderId" text not null references "user"(id) on delete cascade,
  text text not null check (char_length(text) <= 4000),
  "createdAt" timestamptz not null default clock_timestamp()
);
create index "marketMessage_thread" on "marketMessage"("orderId", "createdAt" desc, id desc);
create table "marketPhoto" (
  id uuid primary key default gen_random_uuid(),
  "listingId" uuid references "marketListing"(id) on delete cascade,
  "messageId" uuid references "marketMessage"(id) on delete cascade,
  position smallint not null check (position between 0 and 4),
  data bytea not null check (octet_length(data) between 1 and 2097152),
  thumbnail bytea not null check (octet_length(thumbnail) between 1 and 262144),
  check (num_nonnulls("listingId", "messageId") = 1),
  unique ("listingId", position),
  unique ("messageId", position)
);
alter table "user" add column "lastMarketListingAt" timestamptz;
alter table "user" add column "lastMarketOrderAt" timestamptz;
alter table "user" add column "lastMarketMessageAt" timestamptz;
