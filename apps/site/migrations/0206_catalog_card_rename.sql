-- Переименование карточки парсера (`renameCatalogCard` в `catalog-card-edits.ts`): та же строка `catalogCardEdit`, что у
-- склейки, — старое название ведёт в новое, — но с пометкой `renamed`. Склеенная карточка в админке остаётся отдельной
-- строкой «Склеено с …», а переименованная показывается под новым названием с «Было: …». Магазины могут и дальше писать
-- старое название: его цены всё равно приходят в эту карточку.
alter table "catalogCardEdit" add column renamed boolean not null default false;
alter table "catalogCardEdit" add constraint "catalogCardEdit_renamed_check" check (not renamed or "mergedIntoBrand" is not null);

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
  -- «Премия за энергию»: the nominee and its votes move to the kept drink (a member has one vote per category, so no clash).
  insert into "awardNominee"(award, category, brand, flavor, seeded, "addedBy", "createdAt")
    select award, category, tb, tf, seeded, "addedBy", "createdAt" from "awardNominee" where brand = fb and flavor = ff
    on conflict (award, category, brand, flavor) do update set seeded = "awardNominee".seeded or excluded.seeded;
  update "awardVote" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  delete from "awardNominee" where brand = fb and flavor = ff;
  -- Company data follows the drink too (migration 0206): the brand's approved drink (an approval wins over a pending
  -- request), its card edit, «Где купить», the price ceiling, review digests, card analytics, points of sale, open
  -- card trades and the month's battle stats. Before this a merge left the brand without its confirmed drink.
  update "businessDrink" t set status = 'approved', "moderationNote" = null, "reviewedAt" = a."reviewedAt", "reviewedBy" = a."reviewedBy"
    from "businessDrink" a where a."businessId" = t."businessId" and a.brand = fb and a.flavor = ff and a.status = 'approved'
      and t.brand = tb and t.flavor = tf and t.status <> 'approved';
  delete from "businessDrink" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "businessDrink" b where b."businessId" = a."businessId" and b.brand = tb and b.flavor = tf);
  update "businessDrink" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  delete from "brandDrinkProfile" a where a.brand = fb and a.flavor = ff and exists(select 1 from "brandDrinkProfile" b where b.brand = tb and b.flavor = tf);
  update "brandDrinkProfile" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  delete from "brandDrinkEdit" a where a.brand = fb and a.flavor = ff and a.status = 'pending'
    and exists(select 1 from "brandDrinkEdit" b where b."businessId" = a."businessId" and b.brand = tb and b.flavor = tf and b.status = 'pending');
  update "brandDrinkEdit" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  delete from "brandDrinkStore" a where a.brand = fb and a.flavor = ff and exists(select 1 from "brandDrinkStore" b
    where b."businessId" = a."businessId" and b.brand = tb and b.flavor = tf and (b."storeId" = a."storeId" or lower(b.retailer) = lower(a.retailer)));
  update "brandDrinkStore" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  delete from "brandDrinkPrice" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "brandDrinkPrice" b where b."businessId" = a."businessId" and b.brand = tb and b.flavor = tf and b."volumeMl" = a."volumeMl");
  update "brandDrinkPrice" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "businessReviewDigest" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "catalogEvent" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "businessPoint" set drinks = (select coalesce(jsonb_agg(distinct case when e->>'brand' = fb and e->>'flavor' = ff then jsonb_build_object('brand', tb, 'flavor', tf) else e end), '[]'::jsonb)
      from jsonb_array_elements(drinks) e)
    where drinks @> jsonb_build_array(jsonb_build_object('brand', fb, 'flavor', ff));
  delete from "cardTradeItem" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "cardTradeItem" b where b."tradeId" = a."tradeId" and b.side = a.side and b.brand = tb and b.flavor = tf);
  update "cardTradeItem" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  delete from "battleCardStat" a where a.brand = fb and a.flavor = ff and exists(select 1 from "battleCardStat" b where b.season = a.season and b.brand = tb and b.flavor = tf);
  update "battleCardStat" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  perform set_config('canrush.identity_move', 'off', true);
end $$;
