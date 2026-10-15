-- Likes on comments under wall records (one per person, never on one's own comment).
create table "wallReplyLike" (
  "replyId" uuid not null references "wallReply"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("replyId", "userId")
);
create index "wallReplyLike_user_idx" on "wallReplyLike" ("userId");
create trigger wall_reply_like_guard before insert or update on "wallReplyLike"
  for each row execute function prevent_blocked_contribution();
