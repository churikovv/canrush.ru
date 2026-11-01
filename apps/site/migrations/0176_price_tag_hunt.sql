-- «Охота за ценниками»: событие со сроком и бюджетом. Каждый магазин с проверяемыми данными приносит ценники, за 5, 10, 15 и 20 магазинов
-- идёт бонус к сумме. Ценники забираются кнопкой и меняются на витрине: 1 ценник = 1 ₽, а после события сгорают. Это отдельный контур: он
-- не связан ни с опытом, ни с крышками, ни с крутками, и за банки в трекере, отзывы и случайные награды ценники не начисляются.
-- Суммы повторяют `HUNT_TASKS` и `HUNT_LEVELS` в hunt-fields.ts, меняй вместе.

-- Новое событие — новая строка. `endsAt` — конец приёма, `reviewUntil` — до него команда проверяет отправленное, `burnsAt` — ценники сгорают.
create table "huntEvent" (
  key text primary key,
  "startsAt" timestamptz not null,
  "endsAt" timestamptz not null,
  "reviewUntil" timestamptz not null,
  "burnsAt" timestamptz not null,
  budget integer not null check (budget > 0),
  check ("startsAt" < "endsAt" and "endsAt" <= "reviewUntil" and "reviewUntil" <= "burnsAt")
);
insert into "huntEvent" (key, "startsAt", "endsAt", "reviewUntil", "burnsAt", budget)
  values ('2026-11', '2026-11-02 00:00:00+03', '2026-12-01 00:00:00+03', '2026-12-04 00:00:00+03', '2026-12-08 00:00:00+03', 500);

-- Награда начисляется при проверке магазина и сразу занимает бюджет события, поэтому начисленное всегда можно забрать.
-- Одна строка на магазин и причину: повторная модерация не платит второй раз, удаление магазина награду не отбирает.
-- Бонус за число магазинов — такая же строка на магазин, который до него дотянул.
create table "huntReward" (
  "storeId" uuid not null,
  reason text not null check (reason in ('full', 'upgrade', 'big', 'bonus')),
  event text not null references "huntEvent"(key),
  "userId" text not null references "user"(id) on delete cascade,
  amount integer not null check (amount > 0),
  level integer check ((reason = 'bonus') = (level is not null)),
  "createdAt" timestamptz not null default now(),
  "claimedAt" timestamptz,
  primary key ("storeId", reason)
);
create index hunt_reward_user on "huntReward"("userId", event);
create unique index hunt_reward_bonus on "huntReward"(event, "userId", level) where reason = 'bonus';

-- Журнал ценников: баланс события — сумма с его начала. Забранная награда, списание на заявку и возврат отменённой заявки.
create table "huntLedger" (
  "userId" text not null references "user"(id) on delete cascade,
  reason text not null check (reason in ('reward', 'order', 'refund')),
  "sourceKey" text not null,
  amount integer not null check (amount <> 0),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", reason, "sourceKey")
);

-- Заявка на обмен. `payout` — реквизиты, зашифрованные на стороне сайта (hunt-payout.ts): копии базы уходят за рубеж, поэтому открытого
-- текста здесь нет, а после решения по заявке поле стирается. Заявка переживает удаление аккаунта: выполненная остаётся учётом выплат.
create table "huntOrder" (
  id uuid primary key default gen_random_uuid(),
  "userId" text references "user"(id) on delete set null,
  item text not null,
  amount integer not null check (amount > 0),
  payout text,
  status text not null default 'new' check (status in ('new', 'done', 'cancelled')),
  note text not null default '' check (char_length(note) <= 300),
  "createdAt" timestamptz not null default now(),
  "decidedAt" timestamptz,
  "decidedBy" text,
  check (status = 'new' or payout is null)
);
create unique index hunt_order_one_open on "huntOrder"("userId") where status = 'new';
create index hunt_order_queue on "huntOrder"(status, "createdAt");

create function hunt_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision) returns double precision language sql immutable as $$
  select 6371 * 2 * asin(least(1, sqrt(sin(radians(lat2 - lat1) / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2)))
$$;

-- Начислить, если хватает бюджета события: когда он кончился, новые награды не начисляются, начисленные остаются.
create function hunt_award(current_event "huntEvent", store uuid, why text, owner text, sum_amount integer, bonus_level integer default null) returns boolean language plpgsql as $$
begin
  if (select coalesce(sum(amount), 0) from "huntReward" where event = current_event.key) + sum_amount > current_event.budget then return false; end if;
  insert into "huntReward" ("storeId", reason, event, "userId", amount, level) values (store, why, current_event.key, owner, sum_amount, bonus_level) on conflict do nothing;
  return found;
end $$;

-- Магазин прошёл модерацию. Полный: точка на карте, фото и 5+ напитков с ценами; 15+ цен — большой ассортимент. Рядом (до 30 м) с
-- другим магазином не платим: это почти всегда дубль. Считается событие, в окно приёма и проверки которого попала публикация.
create function hunt_store_trigger() returns trigger language plpgsql as $$
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
  perform pg_advisory_xact_lock(hashtext('canrush:hunt-budget'));
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
create trigger hunt_store after insert or update of status on "marketStore" for each row execute function hunt_store_trigger();

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus','drink-bonus','hunt-order'));
