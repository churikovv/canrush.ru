create table "tierList" (
  "id" uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  "slug" text not null unique check (char_length("slug") between 8 and 100),
  "title" text not null check (char_length("title") between 1 and 80),
  "status" text not null default 'draft' check ("status" in ('draft', 'published')),
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null,
  "publishedAt" timestamptz
);

create index "tierList_userId_updatedAt_idx" on "tierList" ("userId", "updatedAt" desc);
create index "tierList_publishedAt_idx" on "tierList" ("publishedAt" desc)
  where "status" = 'published';

create table "tierListItem" (
  "tierListId" uuid not null references "tierList" ("id") on delete cascade,
  "brand" text not null,
  "flavor" text not null,
  "tier" text not null check ("tier" in ('S', 'A', 'B', 'C', 'D')),
  "position" integer not null check ("position" >= 0),
  primary key ("tierListId", "brand", "flavor")
);

create index "tierListItem_order_idx" on "tierListItem" ("tierListId", "tier", "position");
