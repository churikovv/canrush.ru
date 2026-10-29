-- «Банкомат» (гача), этап 1: крышки за активность, крутки за крышки, карточки напитков в альбоме.
-- Крышки нельзя купить: только журнал начислений за действия на сайте, как опыт. Шансы и гарант — в коде
-- (`gacha-fields.ts`), здесь — журнал, крутки и коллекция.

-- Журнал крышек: начисление (+) за действие и списание (−) за крутку. Ключ источника уникален, поэтому удалить отзыв и
-- написать снова, отметить ту же банку или переопубликовать тирлист второй раз не платят. Баланс — сумма.
create table "capLedger" (
  "userId" text not null references "user"(id) on delete cascade,
  reason text not null check (reason in ('welcome','drink-day','review','tierlist','swipes','streak','pull')),
  "sourceKey" text not null check (char_length("sourceKey") between 1 and 300),
  amount integer not null check (amount <> 0 and amount between -1000 and 1000),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", reason, "sourceKey")
);
create index cap_ledger_user_day on "capLedger"("userId", reason, "createdAt" desc);

-- Каждая выпавшая банка — строка: журнал и аудит. Пачка ×10 — десять строк с одним `batch`. Бесплатная крутка дня
-- помечена днём по Москве: уникальный индекс не даёт взять две.
create table "gachaPull" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  batch uuid not null,
  banner text not null default 'main' check (char_length(banner) between 1 and 40),
  brand text not null check (char_length(brand) between 1 and 120),
  flavor text not null check (char_length(flavor) between 1 and 120),
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  pity boolean not null default false,
  "freeDay" date,
  "createdAt" timestamptz not null default now()
);
create index gacha_pull_user on "gachaPull"("userId", "createdAt" desc);
create unique index gacha_pull_free_day on "gachaPull"("userId", "freeDay") where "freeDay" is not null;

-- Альбом: одна строка на участника и напиток. Редкость — лучшая из выпавших, зафиксирована в момент крутки: если
-- напиток потом появится в магазинах, легенда легендой и останется.
create table "gachaCard" (
  "userId" text not null references "user"(id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 120),
  flavor text not null check (char_length(flavor) between 1 and 120),
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  count integer not null default 1 check (count > 0),
  "firstAt" timestamptz not null default now(),
  "lastAt" timestamptz not null default now(),
  primary key ("userId", brand, flavor)
);
create index gacha_card_drink on "gachaCard"(brand, flavor);

-- Начисление: сериализуется по участнику (как опыт), заблокированным не платит, `daily` ограничивает число
-- начислений этой причины за московские сутки.
create function award_caps(actor text, category text, source_key text, reward integer, daily integer) returns void language plpgsql as $$
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  if daily is not null and (select count(*) from "capLedger" where "userId" = actor and reason = category
      and ("createdAt" at time zone 'Europe/Moscow')::date = (now() at time zone 'Europe/Moscow')::date) >= daily then return; end if;
  insert into "capLedger"("userId", reason, "sourceKey", amount) values (actor, category, source_key, reward) on conflict do nothing;
end $$;

-- Банка в трекере: +3 за день (ключ — день банки, поэтому вторая банка того же дня не платит).
create function caps_drink_day() returns trigger language plpgsql as $$
begin
  perform award_caps(new."userId", 'drink-day', new.day::text, 3, null);
  return new;
end $$;
create trigger drink_log_caps after insert on "drinkLog" for each row execute function caps_drink_day();

-- Отзыв: +10 за напиток, до трёх в сутки.
create function caps_review() returns trigger language plpgsql as $$
begin
  perform award_caps(new."userId", 'review', jsonb_build_array(new.brand, new.flavor)::text, 10, 3);
  return new;
end $$;
create trigger review_caps after insert on review for each row execute function caps_review();

-- Опубликованный тирлист: +15, один в сутки.
create function caps_tierlist() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform award_caps(new."userId", 'tierlist', new.id::text, 15, 1);
  end if;
  return new;
end $$;
create trigger tier_list_caps after insert or update of status on "tierList" for each row execute function caps_tierlist();

-- Десять свайпов в дейтинге за московские сутки: +2 (ключ — день).
create function caps_swipes() returns trigger language plpgsql as $$
declare today date := (now() at time zone 'Europe/Moscow')::date;
begin
  if (select count(*) from "drinkSwipe" where "userId" = new."userId" and ("createdAt" at time zone 'Europe/Moscow')::date = today) >= 10 then
    perform award_caps(new."userId", 'swipes', today::text, 2, null);
  end if;
  return new;
end $$;
create trigger drink_swipe_caps after insert on "drinkSwipe" for each row execute function caps_swipes();

-- Вехи серии трекера (их платит опыт `drink-streak`, ключ `<первый день>:<веха>`): 7 и 14 дней — +20, от 30 — +60.
create function caps_streak() returns trigger language plpgsql as $$
declare milestone integer := nullif(split_part(new."sourceKey", ':', 2), '')::integer;
begin
  if milestone >= 30 then perform award_caps(new."userId", 'streak', new."sourceKey", 60, null);
  elsif milestone >= 7 then perform award_caps(new."userId", 'streak', new."sourceKey", 20, null);
  end if;
  return new;
end $$;
create trigger streak_caps after insert on "profileExperience" for each row
  when (new.reason = 'drink-streak') execute function caps_streak();

-- Склейка напитков переносит и карточки: у кого были обе — счётчики складываются, остаётся лучшая редкость.
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

  update "gachaCard" b set count = b.count + a.count, "firstAt" = least(a."firstAt", b."firstAt"), "lastAt" = greatest(a."lastAt", b."lastAt"),
      rarity = case when array_position(array['common','rare','epic','legendary'], a.rarity) > array_position(array['common','rare','epic','legendary'], b.rarity) then a.rarity else b.rarity end
    from "gachaCard" a where a.brand = fb and a.flavor = ff and b."userId" = a."userId" and b.brand = tb and b.flavor = tf;
  delete from "gachaCard" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "gachaCard" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update "gachaCard" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "gachaPull" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  perform set_config('canrush.identity_move', 'off', true);
end $$;
