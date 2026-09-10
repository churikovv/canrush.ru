create table "review" (
  "id" uuid primary key default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  "brand" text not null,
  "flavor" text not null,
  "design" smallint not null check ("design" between 1 and 5),
  "taste" smallint not null check ("taste" between 1 and 5),
  "composition" smallint not null check ("composition" between 1 and 5),
  "text" text not null check (char_length("text") between 1 and 1000),
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null,
  unique ("userId", "brand", "flavor")
);

create index "review_brand_flavor_idx" on "review" ("brand", "flavor");
create index "review_userId_idx" on "review" ("userId");
