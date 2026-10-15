-- Replies inside review, tier list and wall discussions. The addressee is stored separately, so the
-- highlighted nickname survives deletion of the comment being answered.
alter table "reviewComment"
  add column "replyToId" uuid references "reviewComment"(id) on delete set null,
  add column "replyToUserId" text references "user"(id) on delete set null;
alter table "tierListComment"
  add column "replyToId" uuid references "tierListComment"(id) on delete set null,
  add column "replyToUserId" text references "user"(id) on delete set null;
alter table "wallReply"
  add column "replyToId" uuid references "wallReply"(id) on delete set null,
  add column "replyToUserId" text references "user"(id) on delete set null;

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply'));

-- payload keeps where the discussion lives; links are resolved when the inbox is read.
create function notify_comment_reply() returns trigger language plpgsql as $$
declare owner text; place jsonb;
begin
  if new."replyToUserId" is null or new."replyToUserId" = new."userId" then return new; end if;
  if TG_TABLE_NAME = 'reviewComment' then
    select "userId" into owner from review where id = new."reviewId";
    -- The review author already receives a review-comment notification for this comment.
    if owner = new."replyToUserId" then return new; end if;
    place := jsonb_build_object('target', 'review', 'reviewId', new."reviewId");
  elsif TG_TABLE_NAME = 'tierListComment' then
    place := jsonb_build_object('target', 'tierlist', 'tierListId', new."tierListId");
  else
    place := jsonb_build_object('target', 'wall', 'wallId', new."wallPostId");
  end if;
  insert into notification ("userId", "actorId", kind, "eventKey", payload)
  values (new."replyToUserId", new."userId", 'comment-reply', 'reply:' || new.id,
    place || jsonb_build_object('commentId', new.id, 'text', left(new.text, 160)))
  on conflict do nothing;
  return new;
end $$;
create trigger notification_review_comment_reply after insert on "reviewComment" for each row execute function notify_comment_reply();
create trigger notification_tier_comment_reply after insert on "tierListComment" for each row execute function notify_comment_reply();
create trigger notification_wall_comment_reply after insert on "wallReply" for each row execute function notify_comment_reply();
