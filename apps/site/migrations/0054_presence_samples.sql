-- Who was active in each 5-minute window: the admin online chart. Written by the presence heartbeat
-- only for members who show their status; rows older than 8 days are pruned by the analytics query.
create table "presenceSample" (
  "bucket" timestamptz not null,
  "userId" text not null references "user" ("id") on delete cascade,
  primary key ("bucket", "userId")
);
create index "presenceSample_user_idx" on "presenceSample" ("userId");
