-- HQD Energy was renamed Ashkudi in 2025: the cards are the same cans (covers match), so they merge into Ashkudi.
-- «Мандариновый пуэр» is a By Баста can («by БАСТА ГУФ»): the «Гуф» in retailer titles had filed it under Doma By Guf.
-- Unresolved cards join the editions their titles and covers show. The same pairs are in REVIEWED_PRODUCT_ALIASES.
lock table review, "reviewComment", "reviewReaction", "reviewPhoto", favorite, "favoritePriceWatch", "tierListItem", "drinkLog", "drinkSwipe" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table "reviewComment" disable trigger review_comment_guard;
alter table "reviewReaction" disable trigger review_reaction_guard;

-- Rows are moved with update, never re-inserted, so no experience trigger pays again. Where a member already has the
-- card that stays, the duplicate row goes; a review keeps the kept card's text and takes the duplicate's comments,
-- likes and photos (up to the five-photo limit).
create function pg_temp.merge_drink(fb text, ff text, tb text, tf text) returns void language plpgsql as $$
declare r record;
begin
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
end $$;

select pg_temp.merge_drink(p.fb, p.ff, p.tb, p.tf) from (values
  ('HQD Energy', 'original', 'Ashkudi', 'original'),
  ('HQD Energy', 'blackcurrant', 'Ashkudi', 'blackcurrant'),
  ('HQD Energy', 'blend:lemon+raspberry', 'Ashkudi', 'blend:lemon+raspberry'),
  ('HQD Energy', 'blend:pineapple+pomelo', 'Ashkudi', 'blend:pineapple+pomelo'),
  ('HQD Energy', 'cherry', 'Ashkudi', 'cherry'),
  ('HQD Energy', 'grape', 'Ashkudi', 'grape'),
  ('HQD Energy', 'orange', 'Ashkudi', 'orange'),
  ('HQD Energy', 'pomegranate', 'Ashkudi', 'pomegranate'),
  ('HQD Energy', 'raspberry', 'Ashkudi', 'raspberry'),
  ('HQD Energy', 'unresolved:450e4fd85501e99911bd3df0', 'Ashkudi', 'ashkudi_golden_bears'),
  ('HQD Energy', 'unresolved:26bcf023d50941e56668cc7e', 'Ashkudi', 'ashkudi_golden_bears'),
  ('HQD Energy', 'unresolved:9d9d0b3f7a4bc6b815a9cf2f', 'Ashkudi', 'ashkudi_sour'),
  ('HQD Energy', 'unresolved:a1c327dbc47ee82b75900565', 'Ashkudi', 'ashkudi_sour'),
  ('HQD Energy', 'unresolved:5269426748e5bbfd9aa04f6e', 'Ashkudi', 'ashkudi_pink_lemonade'),
  ('HQD Energy', 'unresolved:e88e51ba96f265eaaac3e1c9', 'Ashkudi', 'ashkudi_belarus_apples'),
  ('HQD Energy', 'unknown', 'Ashkudi', 'ashkudi_voltage'),
  ('Ashkudi', 'unresolved:8ee5cd706b59f0c6ac18da05', 'Ashkudi', 'ashkudi_sour'),
  ('Ashkudi', 'unresolved:7652380e773a72f6d8361b9d', 'Ashkudi', 'ashkudi_dynamo:sugarfree'),
  ('Ashkudi', 'unresolved:7dee97fa9bcdf10c765323aa', 'Ashkudi', 'ashkudi_dynamo:sugarfree'),
  ('Ashkudi', 'unresolved:1fc1008675af7843b3fc0fd0', 'Ashkudi', 'blackcurrant'),
  ('Doma By Guf', 'doma_tangerine_puer', 'By Баста', 'basta_tangerine_puer'),
  ('Doma By Guf', 'unresolved:da30249c14de0adb913924fc', 'By Баста', 'basta_tangerine_puer'),
  ('Doma By Guf', 'unresolved:b9e32f17430fe6d77c37120e', 'By Баста', 'basta_tangerine_puer'),
  ('Doma By Guf', 'unknown', 'Doma By Guf', 'original'),
  ('By Баста', 'unknown', 'By Баста', 'basta_tangerine_puer'),
  ('By Баста', 'unresolved:bc2be25b394e530618946df8', 'By Баста', 'sugarfree'),
  ('By Баста', 'unresolved:f7bd5f2b797a66d9e250bbb4', 'By Баста', 'original'),
  ('By Баста', 'unresolved:6a0fe75d299110a452c24040', 'By Баста', 'original'),
  ('By Баста', 'unresolved:2217aad3f2b82eb77e4f2007', 'By Баста', 'original')
) as p(fb, ff, tb, tf);

alter table review enable trigger review_prevent_blocked_contribution;
alter table "reviewComment" enable trigger review_comment_guard;
alter table "reviewReaction" enable trigger review_reaction_guard;
