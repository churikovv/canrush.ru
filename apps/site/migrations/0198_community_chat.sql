-- Общий чат сообщества: круглая кнопка над страницами открывает одну общую переписку. Сообщение — текст до 1000 символов,
-- до пяти фото, GIF или одно видео (те же правила, что у записей стены) и, по желанию, энергетик из каталога; можно ответить
-- на сообщение (цитата над ним) и поставить реакцию из короткого набора эмодзи. Замороженный и забаненный не пишут,
-- заблокировавшие друг друга не отвечают друг другу и не реагируют, посторонние жалуются, команда удаляет на месте.
-- Упоминание `@ник` и ответ уведомляют адресата (виды `mention` и `comment-reply`, payload `target: chat`).
create table "chatMessage" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  text text not null default '' check (char_length(text) <= 1000),
  -- The quoted message may be deleted later: the reply keeps whom it answered and shows «сообщение удалено».
  "replyToId" uuid references "chatMessage"(id) on delete set null,
  "replyToUserId" text references "user"(id) on delete set null,
  "drinkBrand" text,
  "drinkFlavor" text,
  "createdAt" timestamptz not null default now(),
  check (("drinkBrand" is null) = ("drinkFlavor" is null)
    and char_length(coalesce("drinkBrand", '')) <= 60 and char_length(coalesce("drinkFlavor", '')) <= 160)
);
create index chat_message_recent on "chatMessage"("createdAt" desc, id desc);
create index chat_message_user on "chatMessage"("userId", "createdAt" desc);
create index chat_message_reply on "chatMessage"("replyToId") where "replyToId" is not null;

create table "chatMedia" (
  id uuid primary key default gen_random_uuid(),
  "messageId" uuid not null references "chatMessage"(id) on delete cascade,
  position integer not null check (position between 0 and 4),
  kind text not null check (kind in ('image', 'gif', 'video')),
  mime text not null check (mime in ('image/webp', 'video/mp4', 'video/webm')),
  data bytea not null,
  thumbnail bytea not null,
  "createdAt" timestamptz not null default now(),
  unique ("messageId", position),
  check ((kind = 'video') = (mime like 'video/%')),
  check (octet_length(data) >= 1 and octet_length(thumbnail) >= 1 and case kind
    when 'image' then octet_length(data) <= 2097152 and octet_length(thumbnail) <= 262144
    when 'gif' then octet_length(data) <= 8388608 and octet_length(thumbnail) <= 2097152
    else octet_length(data) <= 20971520 and octet_length(thumbnail) <= 262144 end)
);
create unique index chat_media_video on "chatMedia"("messageId") where kind = 'video';
-- Videos are streamed by byte ranges; uncompressed TOAST lets substring() read only the requested slice.
alter table "chatMedia" alter column data set storage external;

-- The emoji set lives in community-chat-fields.ts (CHAT_REACTIONS) too: change both.
create table "chatReaction" (
  "messageId" uuid not null references "chatMessage"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '🔥', '😂', '😮', '😢', '⚡', '👎')),
  "createdAt" timestamptz not null default now(),
  primary key ("messageId", "userId", emoji)
);
create index chat_reaction_user on "chatReaction"("userId");

-- Who has the chat open: the panel's polling touches the row, the header shows those seen in the last half minute.
create table "chatPresence" (
  "userId" text primary key references "user"(id) on delete cascade,
  "seenAt" timestamptz not null default now()
);
create index chat_presence_seen on "chatPresence"("seenAt" desc);

create trigger "chatMessage_freeze" before insert on "chatMessage" for each row execute function prevent_frozen_posting('userId');

-- An answer to a member one of them blocked, or a reaction to their message, is refused (CR001, like everywhere else).
create function prevent_blocked_chat() returns trigger language plpgsql as $$
declare other text;
begin
  if TG_TABLE_NAME = 'chatMessage' then other := new."replyToUserId";
  else select "userId" into other from "chatMessage" where id = new."messageId";
  end if;
  if members_blocked(new."userId", other) then raise exception 'member blocked' using errcode = 'CR001'; end if;
  return new;
end $$;
create trigger "chatMessage_member_block" before insert on "chatMessage" for each row execute function prevent_blocked_chat();
create trigger "chatReaction_member_block" before insert on "chatReaction" for each row execute function prevent_blocked_chat();

-- Attachments are inserted after their message in the same transaction, so «text, attachment or drink» is checked at commit.
create function require_chat_content() returns trigger language plpgsql as $$
begin
  if btrim(new.text) <> '' or new."drinkBrand" is not null then return null; end if;
  -- The row may already be gone (deleted later in the same transaction).
  if not exists(select 1 from "chatMessage" where id = new.id) then return null; end if;
  if not exists(select 1 from "chatMedia" where "messageId" = new.id) then
    raise exception 'A chat message needs text, an attachment or a drink' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger chat_message_content after insert on "chatMessage" deferrable initially deferred
  for each row execute function require_chat_content();

-- A reply notifies the answered member, a mention (same handle rule as src/lib/mentions.ts, at most five per message) the
-- mentioned ones. Notifications from a member one of them blocked are dropped by skip_blocked_notification (0086).
create function notify_chat_message() returns trigger language plpgsql as $$
begin
  if exists(select 1 from "userBlock" b where b."userId" = new."userId") then return null; end if;
  if new."replyToUserId" is not null and new."replyToUserId" <> new."userId" then
    insert into notification ("userId", "actorId", kind, "eventKey", payload)
    values (new."replyToUserId", new."userId", 'comment-reply', 'chat-reply:' || new.id,
      jsonb_build_object('target', 'chat', 'messageId', new.id, 'text', left(new.text, 160)))
    on conflict do nothing;
  end if;
  insert into notification ("userId", "actorId", kind, "eventKey", payload)
  select u.id, new."userId", 'mention', 'mention:chatMessage:' || new.id || ':' || u.id,
    jsonb_build_object('target', 'chat', 'messageId', new.id, 'text', left(new.text, 160))
  from (select distinct lower(m[1]) as username from regexp_matches(new.text, '(?:^|[^A-Za-z0-9_.@/])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])', 'g') as m limit 5) handles
  join "user" u on u.username = handles.username
  where u.id <> new."userId" and u.id is distinct from new."replyToUserId"
  on conflict do nothing;
  return null;
exception when foreign_key_violation then return null;
end $$;
create trigger chat_message_notify after insert on "chatMessage" for each row execute function notify_chat_message();

alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story','article','business-post','business-award','store-preset','collection-photo','drink-question','drink-answer','chat-message'
));

-- Merging drinks moves the drink attached to a chat message too (the rest as in 0186).
create or replace function move_drink_identity(fb text, ff text, tb text, tf text) returns void language plpgsql as $$
declare r record;
begin
  perform set_config('canrush.identity_move', 'on', true);
  for r in select a.id as dup, b.id as kept from review a
    join review b on b.brand = tb and b.flavor = tf and b."userId" = a."userId"
    where a.brand = fb and a.flavor = ff
  loop
    update "reviewComment" set "reviewId" = r.kept where "reviewId" = r.dup;
    update "reviewReaction" x set "reviewId" = r.kept where x."reviewId" = r.dup
      and not exists(select 1 from "reviewReaction" y where y."reviewId" = r.kept and y."userId" = x."userId");
    update "reviewPhoto" ph set "reviewId" = r.kept, position = s.pos
      from (select id, (select coalesce(max(position) + 1, 0) from "reviewPhoto" where "reviewId" = r.kept)
          + (row_number() over (order by position))::int - 1 as pos
        from "reviewPhoto" where "reviewId" = r.dup) s
      where ph.id = s.id and s.pos <= 4;
    delete from review where id = r.dup;
  end loop;
  update review set brand = tb, flavor = tf where brand = fb and flavor = ff;

  -- A price watch points at its favourite: checked at commit, so the favourite and its watches can move one after the other.
  set constraints "favoritePriceWatch_userId_brand_flavor_fkey" deferred;
  delete from favorite a where a.brand = fb and a.flavor = ff
    and exists(select 1 from favorite b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update favorite set brand = tb, flavor = tf where brand = fb and flavor = ff;

  delete from "favoritePriceWatch" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "favoritePriceWatch" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf and b.city = a.city and b.volume = a.volume);
  update "favoritePriceWatch" set brand = tb, flavor = tf where brand = fb and flavor = ff;

  delete from "tierListItem" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "tierListItem" b where b."tierListId" = a."tierListId" and b.brand = tb and b.flavor = tf);
  update "tierListItem" set brand = tb, flavor = tf where brand = fb and flavor = ff;

  delete from "drinkSwipe" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "drinkSwipe" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update "drinkSwipe" set brand = tb, flavor = tf where brand = fb and flavor = ff;

  update "drinkLog" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  -- Questions about the drink move with it; their answers hang on the question.
  update "drinkQuestion" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  -- A drink attached to a wall record, a comment or a chat message follows it too.
  update "profileComment" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;
  update "wallReply" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;
  update "chatMessage" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;

  update "gachaCard" b set count = b.count + a.count, "firstAt" = least(a."firstAt", b."firstAt"), "lastAt" = greatest(a."lastAt", b."lastAt"),
      rarity = case when array_position(array['common','rare','epic','legendary'], a.rarity) > array_position(array['common','rare','epic','legendary'], b.rarity) then a.rarity else b.rarity end
    from "gachaCard" a where a.brand = fb and a.flavor = ff and b."userId" = a."userId" and b.brand = tb and b.flavor = tf;
  delete from "gachaCard" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "gachaCard" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update "gachaCard" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "gachaPull" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  perform set_config('canrush.identity_move', 'off', true);
end $$;
