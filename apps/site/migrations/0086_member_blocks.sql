-- Блокировка участников друг другом (требование Google Play к пользовательскому контенту).
-- Не путать с "userBlock" — это бан аккаунта администратором.
create table "memberBlock" (
  "blockerId" text not null references "user"(id) on delete cascade,
  "blockedId" text not null references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("blockerId", "blockedId"),
  check ("blockerId" <> "blockedId")
);
create index "memberBlock_blocked" on "memberBlock" ("blockedId");

-- Общение взаимно закрыто, кто бы ни заблокировал: ни комментариев, ни ответов, ни записей на стене,
-- ни подписок, ни заказов и сообщений. Приложение узнаёт ошибку по коду CR001 (member-blocks.ts).
create function members_blocked(a text, b text) returns boolean language sql stable as $$
  select a is not null and b is not null and a <> b and exists(
    select 1 from "memberBlock" where ("blockerId" = a and "blockedId" = b) or ("blockerId" = b and "blockedId" = a))
$$;

create function prevent_blocked_interaction() returns trigger language plpgsql as $$
declare
  actor text;
  others text[];
begin
  case tg_table_name
    when 'profileComment' then actor := new."userId"; others := array[new."profileId"];
    when 'reviewComment' then actor := new."userId"; others := array[(select "userId" from review where id = new."reviewId"), new."replyToUserId"];
    when 'tierListComment' then actor := new."userId"; others := array[(select "userId" from "tierList" where id = new."tierListId"), new."replyToUserId"];
    when 'wallReply' then actor := new."userId";
      others := (select array[p."userId", p."profileId", new."replyToUserId"] from "profileComment" p where p.id = new."wallPostId");
    when 'userFollow' then actor := new."userId"; others := array[new."targetId"];
    when 'marketOrder' then actor := new."buyerId"; others := array[(select "sellerId" from "marketListing" where id = new."listingId")];
    when 'marketMessage' then actor := new."senderId";
      others := (select array[o."buyerId", l."sellerId"] from "marketOrder" o join "marketListing" l on l.id = o."listingId" where o.id = new."orderId");
  end case;
  if exists (select 1 from unnest(coalesce(others, '{}')) other where members_blocked(actor, other)) then
    raise exception 'member blocked' using errcode = 'CR001';
  end if;
  return new;
end $$;

create trigger "profileComment_member_block" before insert on "profileComment" for each row execute function prevent_blocked_interaction();
create trigger "reviewComment_member_block" before insert on "reviewComment" for each row execute function prevent_blocked_interaction();
create trigger "tierListComment_member_block" before insert on "tierListComment" for each row execute function prevent_blocked_interaction();
create trigger "wallReply_member_block" before insert on "wallReply" for each row execute function prevent_blocked_interaction();
create trigger "userFollow_member_block" before insert on "userFollow" for each row execute function prevent_blocked_interaction();
create trigger "marketOrder_member_block" before insert on "marketOrder" for each row execute function prevent_blocked_interaction();
create trigger "marketMessage_member_block" before insert on "marketMessage" for each row execute function prevent_blocked_interaction();

-- Уведомления от заблокированного (лайки, упоминания, ответы) не создаются — значит, не уходят ни в push, ни в Telegram.
create function skip_blocked_notification() returns trigger language plpgsql as $$
begin
  if members_blocked(new."userId", new."actorId") then return null; end if;
  return new;
end $$;
create trigger "notification_member_block" before insert on notification for each row execute function skip_blocked_notification();
