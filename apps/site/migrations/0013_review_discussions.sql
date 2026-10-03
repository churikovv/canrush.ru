alter table "user" add column "lastReviewCommentAt" timestamptz;
create table "reviewReaction" (
  "reviewId" uuid not null references review(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key ("reviewId", "userId")
);
create table "reviewComment" (
  id uuid primary key default gen_random_uuid(),
  "reviewId" uuid not null references review(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  "createdAt" timestamptz not null default now()
);
create index "reviewComment_thread_idx" on "reviewComment" ("reviewId", "createdAt" desc, id desc);
create index "reviewComment_user_idx" on "reviewComment" ("userId");
create trigger review_reaction_guard before insert or update on "reviewReaction"
  for each row execute function prevent_blocked_contribution();
create trigger review_comment_guard before insert or update on "reviewComment"
  for each row execute function prevent_blocked_contribution();
