-- @mentions in review, tier list and wall comments and in wall/feed posts notify the mentioned member.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention'));

-- Same handle rule as the site (src/lib/mentions.ts): "@" not glued to a word, an e-mail or a link, then a username.
-- The event key holds the comment and the member, so editing a text in only notifies newly mentioned members.
create function notify_mentions() returns trigger language plpgsql as $$
declare place jsonb; skip text[] := array[new."userId"]; owner text;
begin
  if TG_OP = 'UPDATE' and new.text is not distinct from old.text then return new; end if;
  if TG_TABLE_NAME = 'reviewComment' then
    -- The review author already gets review-comment, the answered member comment-reply.
    select "userId" into owner from review where id = new."reviewId";
    skip := skip || owner || new."replyToUserId";
    place := jsonb_build_object('target', 'review', 'reviewId', new."reviewId");
  elsif TG_TABLE_NAME = 'tierListComment' then
    skip := skip || new."replyToUserId";
    place := jsonb_build_object('target', 'tierlist', 'tierListId', new."tierListId");
  elsif TG_TABLE_NAME = 'wallReply' then
    skip := skip || new."replyToUserId";
    place := jsonb_build_object('target', 'wall', 'wallId', new."wallPostId");
  else
    -- A record on someone's wall already notifies the wall owner (wall-comment).
    skip := skip || new."profileId";
    place := jsonb_build_object('target', 'wall', 'wallId', new.id);
  end if;
  insert into notification ("userId", "actorId", kind, "eventKey", payload)
  select u.id, new."userId", 'mention', 'mention:' || TG_TABLE_NAME || ':' || new.id || ':' || u.id,
    place || jsonb_build_object('commentId', new.id, 'text', left(new.text, 160))
  from (select distinct lower(m[1]) as username from regexp_matches(new.text, '(?:^|[^A-Za-z0-9_.@/])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])', 'g') as m limit 10) handles
  join "user" u on u.username = handles.username
  -- Skipped ids may be null (no reply target): drop them, or "<> all" would hide every recipient.
  where u.id <> all(array_remove(skip, null)) and not exists(select 1 from "userBlock" b where b."userId" = new."userId")
  on conflict do nothing;
  return new;
end $$;
create trigger notification_review_comment_mention after insert or update of text on "reviewComment" for each row execute function notify_mentions();
create trigger notification_tier_comment_mention after insert or update of text on "tierListComment" for each row execute function notify_mentions();
create trigger notification_wall_reply_mention after insert or update of text on "wallReply" for each row execute function notify_mentions();
create trigger notification_wall_post_mention after insert or update of text on "profileComment" for each row execute function notify_mentions();
