alter table "user" add column "username" text;
alter table "user" add column "telegramChannel" text;

create unique index "user_username_uidx" on "user" (lower("username")) where "username" is not null;

create table "favorite" (
  "userId" text not null references "user" ("id") on delete cascade,
  "brand" text not null,
  "flavor" text not null,
  "createdAt" timestamptz default current_timestamp not null,
  primary key ("userId", "brand", "flavor")
);

create index "favorite_userId_createdAt_idx" on "favorite" ("userId", "createdAt" desc);
