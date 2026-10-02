alter table "user" add column "lastSeenAt" timestamptz;
alter table "user" add column "showOnline" boolean not null default true;
alter table "user" add column "profileTags" text[] not null default '{}' check (cardinality("profileTags") <= 3);
alter table "user" add column "lastWallPostAt" timestamptz;

create table "userFollow" (
  "userId" text not null references "user" ("id") on delete cascade,
  "targetId" text not null references "user" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("userId", "targetId"),
  check ("userId" <> "targetId")
);
create index "userFollow_target_idx" on "userFollow" ("targetId", "createdAt" desc);
create trigger "userFollow_prevent_blocked_contribution"
before insert or update on "userFollow"
for each row execute function prevent_blocked_contribution();

create table "profileAchievement" (
  "userId" text not null references "user" ("id") on delete cascade,
  "key" text not null,
  "earnedAt" timestamptz not null default now(),
  primary key ("userId", "key")
);

create table "profileComment" (
  "id" uuid primary key default gen_random_uuid(),
  "profileId" text not null references "user" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "text" text not null check (char_length(btrim("text")) between 1 and 1000),
  "createdAt" timestamptz not null default now()
);
create index "profileComment_profile_idx" on "profileComment" ("profileId", "createdAt" desc, "id" desc);
create trigger "profileComment_prevent_blocked_contribution"
before insert or update on "profileComment"
for each row execute function prevent_blocked_contribution();
