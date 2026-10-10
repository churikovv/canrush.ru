alter table "user" add column "lastTierCommentAt" timestamptz;
create table "tierListReaction" (
  "tierListId" uuid not null references "tierList"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key ("tierListId", "userId")
);
create table "tierListComment" (
  id uuid primary key default gen_random_uuid(),
  "tierListId" uuid not null references "tierList"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  "createdAt" timestamptz not null default now()
);
create index "tierListComment_thread_idx" on "tierListComment" ("tierListId", "createdAt" desc, id desc);
create index "tierListComment_user_idx" on "tierListComment" ("userId");
create trigger tier_reaction_guard before insert or update on "tierListReaction"
  for each row execute function prevent_blocked_contribution();
create trigger tier_comment_guard before insert or update on "tierListComment"
  for each row execute function prevent_blocked_contribution();
