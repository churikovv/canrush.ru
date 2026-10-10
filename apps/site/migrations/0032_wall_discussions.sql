alter table "user" add column "lastWallReplyAt" timestamptz;
create table "wallReaction" (
  "wallPostId" uuid not null references "profileComment"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key ("wallPostId", "userId")
);
create table "wallReply" (
  id uuid primary key default gen_random_uuid(),
  "wallPostId" uuid not null references "profileComment"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  "createdAt" timestamptz not null default now()
);
create index "wallReply_thread_idx" on "wallReply" ("wallPostId", "createdAt" desc, id desc);
create index "wallReply_user_idx" on "wallReply" ("userId");
create trigger wall_reaction_guard before insert or update on "wallReaction"
  for each row execute function prevent_blocked_contribution();
create trigger wall_reply_guard before insert or update on "wallReply"
  for each row execute function prevent_blocked_contribution();
