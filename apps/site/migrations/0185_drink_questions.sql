-- Вопросы и ответы на странице напитка: участник спрашивает («есть ли в 0,25?», «сколько кофеина?»), другие отвечают, а
-- ответ команды компании напитка помечается её названием. Вопрос виден в ленте событием. Автор вопроса узнаёт об ответе
-- уведомлением `question-answer` (выключается в настройках), один раз на каждого ответившего. Замороженный не пишет,
-- заблокировавшие друг друга не отвечают друг другу, посторонние жалуются, команда удаляет на месте. Склейка напитков
-- переносит вопросы вместе с отзывами.
create table "drinkQuestion" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  brand text not null,
  flavor text not null,
  text text not null check (char_length(text) between 5 and 500),
  "createdAt" timestamptz not null default now()
);
create index drink_question_drink on "drinkQuestion"(brand, flavor, "createdAt" desc);
create index drink_question_user on "drinkQuestion"("userId", "createdAt" desc);
create index drink_question_recent on "drinkQuestion"("createdAt" desc);

create table "drinkAnswer" (
  id uuid primary key default gen_random_uuid(),
  "questionId" uuid not null references "drinkQuestion"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  "createdAt" timestamptz not null default now()
);
create index drink_answer_question on "drinkAnswer"("questionId", "createdAt");
create index drink_answer_user on "drinkAnswer"("userId", "createdAt" desc);

create trigger "drinkQuestion_freeze" before insert on "drinkQuestion" for each row execute function prevent_frozen_posting('userId');
create trigger "drinkAnswer_freeze" before insert on "drinkAnswer" for each row execute function prevent_frozen_posting('userId');

-- The shared prevent_blocked_interaction lists its tables in a case; an answer gets its own small guard instead.
create function prevent_blocked_answer() returns trigger language plpgsql as $$
begin
  if members_blocked(new."userId", (select "userId" from "drinkQuestion" where id = new."questionId")) then
    raise exception 'member blocked' using errcode = 'CR001';
  end if;
  return new;
end $$;
create trigger "drinkAnswer_member_block" before insert on "drinkAnswer" for each row execute function prevent_blocked_answer();

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus','drink-bonus','hunt-order','store-moderation','question-answer'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review','business-reply','company-post','reminder','question-answer'));

create function notify_question_answer() returns trigger language plpgsql as $$
begin
  insert into notification("userId", "actorId", kind, "eventKey", payload)
  select q."userId", new."userId", 'question-answer', 'question-answer:' || q.id || ':' || new."userId",
    jsonb_build_object('brand', q.brand, 'flavor', q.flavor, 'questionId', q.id, 'text', left(new.text, 160))
  from "drinkQuestion" q where q.id = new."questionId" and q."userId" <> new."userId"
  on conflict ("userId", "eventKey") do nothing;
  return null;
exception when foreign_key_violation then return null;
end $$;
create trigger drink_answer_notify after insert on "drinkAnswer" for each row execute function notify_question_answer();

alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story','article','business-post','business-award','store-preset','collection-photo','drink-question','drink-answer'
));

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

  update "gachaCard" b set count = b.count + a.count, "firstAt" = least(a."firstAt", b."firstAt"), "lastAt" = greatest(a."lastAt", b."lastAt"),
      rarity = case when array_position(array['common','rare','epic','legendary'], a.rarity) > array_position(array['common','rare','epic','legendary'], b.rarity) then a.rarity else b.rarity end
    from "gachaCard" a where a.brand = fb and a.flavor = ff and b."userId" = a."userId" and b.brand = tb and b.flavor = tf;
  delete from "gachaCard" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "gachaCard" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update "gachaCard" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "gachaPull" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  perform set_config('canrush.identity_move', 'off', true);
end $$;
