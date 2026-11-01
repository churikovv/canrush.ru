-- «Охота за ценниками»: вместо общего бюджета события — лимит на участника. Общей суммы больше нет: ценники начисляются каждому, пока он не
-- дойдёт до `memberLimit`. Награда, которая не помещается целиком, начисляется в размере остатка. Блокировка теперь своя у каждого участника:
-- считаем только его награды, а магазины разных участников друг другу не мешают.
-- Колонка `budget` больше ничего не значит, но остаётся: миграции идут раньше смены контейнера, и старая сборка читает её до конца выкатки.

alter table "huntEvent" add column "memberLimit" integer check ("memberLimit" > 0);
update "huntEvent" set "memberLimit" = 2000;
alter table "huntEvent" alter column "memberLimit" set not null;
alter table "huntEvent" alter column budget drop not null;

create or replace function hunt_award(current_event "huntEvent", store uuid, why text, owner text, sum_amount integer, bonus_level integer default null) returns boolean language plpgsql as $$
declare
  room integer;
begin
  room := current_event."memberLimit" - (select coalesce(sum(amount), 0) from "huntReward" where event = current_event.key and "userId" = owner);
  if room <= 0 then return false; end if;
  insert into "huntReward" ("storeId", reason, event, "userId", amount, level) values (store, why, current_event.key, owner, least(sum_amount, room), bonus_level) on conflict do nothing;
  return found;
end $$;

create or replace function hunt_store_trigger() returns trigger language plpgsql as $$
declare
  current_event "huntEvent";
  priced integer;
  counted integer;
begin
  if new.status <> 'published' or (TG_OP = 'UPDATE' and old.status = 'published') then return new; end if;
  select * into current_event from "huntEvent" where now() >= "startsAt" and now() < "reviewUntil" order by "startsAt" limit 1;
  if not found then return new; end if;
  if exists(select 1 from "userBlock" where "userId" = new."ownerId")
    or exists(select 1 from business where "storeId" = new.id)
    or exists(select 1 from "siteAdmin" a join "user" u on lower(u.email) = a.email where u.id = new."ownerId") then return new; end if;
  select count(*) into priced from jsonb_array_elements(new.catalog) item
    where coalesce((item->>'price')::numeric, 0) > 0 and item->>'availability' is distinct from 'unavailable';
  if priced < 5 or new.latitude is null or new.longitude is null or not exists(select 1 from "storePhoto" where "storeId" = new.id) then return new; end if;
  if exists(select 1 from "marketStore" s where s.status = 'published' and s.id <> new.id and s.latitude is not null and s.longitude is not null
      and hunt_km(new.latitude::double precision, new.longitude::double precision, s.latitude::double precision, s.longitude::double precision) < 0.03) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('canrush:hunt-member:' || new."ownerId"));
  if not exists(select 1 from "huntReward" where "storeId" = new.id and reason in ('full', 'upgrade')) then
    if new."createdAt" >= current_event."startsAt" then
      perform hunt_award(current_event, new.id, 'full', new."ownerId", 20);
    else
      perform hunt_award(current_event, new.id, 'upgrade', new."ownerId", 10);
    end if;
  end if;
  if priced >= 15 then
    perform hunt_award(current_event, new.id, 'big', new."ownerId", 10);
  end if;
  select count(*) into counted from "huntReward" where event = current_event.key and "userId" = new."ownerId" and reason in ('full', 'upgrade');
  if counted in (5, 10, 15, 20) then
    perform hunt_award(current_event, new.id, 'bonus', new."ownerId", case counted when 5 then 10 when 10 then 20 when 15 then 30 else 40 end, counted / 5);
  end if;
  return new;
end $$;
