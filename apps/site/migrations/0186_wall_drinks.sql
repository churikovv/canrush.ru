-- A catalog drink attached to a wall/feed record or to a comment under it: brand and flavour of the catalog group, both or
-- neither. A record or a comment may be just the drink, so it counts as content next to text and attachments.
alter table "profileComment" add column "drinkBrand" text, add column "drinkFlavor" text;
alter table "profileComment" add constraint "profileComment_drink_check" check (("drinkBrand" is null) = ("drinkFlavor" is null)
  and char_length(coalesce("drinkBrand", '')) <= 60 and char_length(coalesce("drinkFlavor", '')) <= 160);
alter table "wallReply" add column "drinkBrand" text, add column "drinkFlavor" text;
alter table "wallReply" add constraint "wallReply_drink_check" check (("drinkBrand" is null) = ("drinkFlavor" is null)
  and char_length(coalesce("drinkBrand", '')) <= 60 and char_length(coalesce("drinkFlavor", '')) <= 160);

-- Attachments are inserted after their comment in the same transaction, so "text, attachment or drink" is checked at commit.
-- Review and tier list comments have no drink column, so it is read through jsonb.
create or replace function require_text_or_media() returns trigger language plpgsql as $$
declare has_media boolean;
begin
  if btrim(new.text) <> '' then return null; end if;
  if to_jsonb(new) ->> 'drinkBrand' is not null then return null; end if;
  -- The row may already be gone (deleted later in the same transaction).
  if TG_TABLE_NAME = 'profileComment' then
    if not exists(select 1 from "profileComment" where id = new.id) then return null; end if;
    select exists(select 1 from "wallPhoto" where "commentId" = new.id) into has_media;
  else
    execute format('select exists(select 1 from %I where id = $1)', TG_TABLE_NAME) using new.id into has_media;
    if not has_media then return null; end if;
    select exists(select 1 from "commentMedia" m where case TG_TABLE_NAME
      when 'reviewComment' then m."reviewCommentId" when 'tierListComment' then m."tierListCommentId" else m."wallReplyId" end = new.id) into has_media;
  end if;
  if not has_media then raise exception 'A comment needs text or an attachment' using errcode = '23514'; end if;
  return null;
end $$;

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
  -- A drink attached to a wall record or a comment follows it too.
  update "profileComment" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;
  update "wallReply" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;

  update "gachaCard" b set count = b.count + a.count, "firstAt" = least(a."firstAt", b."firstAt"), "lastAt" = greatest(a."lastAt", b."lastAt"),
      rarity = case when array_position(array['common','rare','epic','legendary'], a.rarity) > array_position(array['common','rare','epic','legendary'], b.rarity) then a.rarity else b.rarity end
    from "gachaCard" a where a.brand = fb and a.flavor = ff and b."userId" = a."userId" and b.brand = tb and b.flavor = tf;
  delete from "gachaCard" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "gachaCard" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update "gachaCard" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "gachaPull" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  perform set_config('canrush.identity_move', 'off', true);
end $$;
