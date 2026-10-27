-- «CanRush для бизнеса»: a company account (one per member for now) and the catalog drinks it claims. Both go through
-- moderation: the team checks the company, then each drink it attaches; analytics only count approved drinks.
create table business (
  id uuid primary key default gen_random_uuid(),
  "ownerId" text not null unique references "user"(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  kind text not null check (kind in ('brand', 'distributor', 'shop')),
  website text check (website is null or char_length(website) <= 200),
  telegram text check (telegram is null or telegram ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$'),
  "contactEmail" text check ("contactEmail" is null or char_length("contactEmail") <= 254),
  about text check (about is null or char_length(about) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  "moderationNote" text check ("moderationNote" is null or char_length("moderationNote") <= 500),
  "reviewedBy" text references "user"(id) on delete set null,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index business_status on business(status, "createdAt");

create table "businessDrink" (
  "businessId" uuid not null references business(id) on delete cascade,
  brand text not null,
  flavor text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  "moderationNote" text check ("moderationNote" is null or char_length("moderationNote") <= 500),
  "reviewedBy" text references "user"(id) on delete set null,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  primary key ("businessId", brand, flavor)
);
create index business_drink_status on "businessDrink"(status, "createdAt");
create index business_drink_identity on "businessDrink"(brand, flavor);

create trigger business_freeze before insert on business for each row execute function prevent_frozen_posting('ownerId');
