-- Админ может поменять бренд и вкус уже опубликованного напитка участника. Всё, что привязано к старой идентичности
-- (отзывы, избранное, слежка за ценой, тирлисты, календарь, свайпы), переезжает на новую одним запросом, как в 0096,
-- а старый адрес карточки ведёт на новый по таблице переименований.

-- Перенос не публикует ничего нового от имени автора, поэтому защита от заблокированных его пропускает; флаг живёт только
-- до конца транзакции переноса (set_config(..., true)).
create or replace function prevent_blocked_contribution() returns trigger language plpgsql as $$
begin
  if current_setting('canrush.identity_move', true) = 'on' then
    return new;
  end if;
  if exists (select 1 from "userBlock" where "userId" = new."userId") then
    raise exception 'blocked users cannot create or update public contributions'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Строки переезжают update-ом, без повторной вставки, так что триггеры опыта не платят ещё раз. Если у участника уже
-- есть новая карточка, дубль уходит; отзыв на новой карточке остаётся, а комментарии, лайки и фото дубля переходят к нему
-- (фото — до пяти).
create function move_drink_identity(fb text, ff text, tb text, tf text) returns void language plpgsql as $$
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
  perform set_config('canrush.identity_move', 'off', true);
end $$;

-- Старые адреса переименованных напитков: страница карточки, не найдя напиток, ищет его здесь и ведёт на новый адрес.
create table "catalogDrinkRename" (
  id bigint generated always as identity primary key,
  "drinkId" uuid references "catalogDrink"(id) on delete set null,
  "fromBrand" text not null,
  "fromFlavor" text not null,
  "toBrand" text not null,
  "toFlavor" text not null,
  "createdAt" timestamptz not null default now()
);
create index catalog_drink_rename_from on "catalogDrinkRename"(lower("fromBrand"), lower("fromFlavor"));
