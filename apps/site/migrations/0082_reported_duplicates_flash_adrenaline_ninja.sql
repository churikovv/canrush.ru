-- Duplicate cards reported by members (October 2026), checked against retailer titles; the same pairs are in REVIEWED_PRODUCT_ALIASES.
-- Flash Up «Манго» is the old design of mango + pineapple, the Game Fuel mango can is now sold as Adrenaline Rush Vitamin Power
-- mango, and Ninja peach/cherry are Ninja Star cans that Edadeal listed under the brand «Ninja».
lock table review, "reviewComment", "reviewReaction", "reviewPhoto", favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table "reviewComment" disable trigger review_comment_guard;
alter table "reviewReaction" disable trigger review_reaction_guard;
alter table favorite disable trigger favorite_experience;

-- A member who reviewed both cards of a pair keeps the review on the card that stays; the duplicate's comments, likes and
-- photos move to it (photos up to the five-photo limit), then the duplicate is deleted, so the merge below meets no conflict.
do $$
declare r record;
begin
  for r in select a.id as dup, b.id as kept
    from (values ('Flash Up','mango','Flash Up','blend:mango+pineapple'),
      ('Adrenaline Game Fuel','mango','Adrenaline Rush','mango'),
      ('Ninja','peach','Ninja Star','peach'),
      ('Ninja','cherry','Ninja Star','cherry')) as p(fb, ff, tb, tf)
    join review a on a.brand = p.fb and a.flavor = p.ff
    join review b on b.brand = p.tb and b.flavor = p.tf and b."userId" = a."userId"
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
end $$;

-- Flash Up: mango -> Flash Up: blend:mango+pineapple
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='mango' and b.brand='Flash Up' and b.flavor='blend:mango+pineapple') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:mango+pineapple' where brand='Flash Up' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:mango+pineapple',"createdAt" from favorite where brand='Flash Up' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:mango+pineapple',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:mango+pineapple',tier,position from "tierListItem" where brand='Flash Up' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='mango';
update "drinkLog" set brand='Flash Up', flavor='blend:mango+pineapple' where brand='Flash Up' and flavor='mango';

-- Adrenaline Game Fuel: mango -> Adrenaline Rush: mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Game Fuel' and a.flavor='mango' and b.brand='Adrenaline Rush' and b.flavor='mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='mango' where brand='Adrenaline Game Fuel' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','mango',"createdAt" from favorite where brand='Adrenaline Game Fuel' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Game Fuel' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Adrenaline Game Fuel' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','mango',tier,position from "tierListItem" where brand='Adrenaline Game Fuel' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Game Fuel' and flavor='mango';
update "drinkLog" set brand='Adrenaline Rush', flavor='mango' where brand='Adrenaline Game Fuel' and flavor='mango';

-- Ninja: peach -> Ninja Star: peach
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Ninja' and a.flavor='peach' and b.brand='Ninja Star' and b.flavor='peach') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Ninja Star', flavor='peach' where brand='Ninja' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Ninja Star','peach',"createdAt" from favorite where brand='Ninja' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Ninja Star','peach',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Ninja' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Ninja' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Ninja Star','peach',tier,position from "tierListItem" where brand='Ninja' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Ninja' and flavor='peach';
update "drinkLog" set brand='Ninja Star', flavor='peach' where brand='Ninja' and flavor='peach';

-- Ninja: cherry -> Ninja Star: cherry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Ninja' and a.flavor='cherry' and b.brand='Ninja Star' and b.flavor='cherry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Ninja Star', flavor='cherry' where brand='Ninja' and flavor='cherry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Ninja Star','cherry',"createdAt" from favorite where brand='Ninja' and flavor='cherry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Ninja Star','cherry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Ninja' and flavor='cherry' on conflict do nothing;
delete from favorite where brand='Ninja' and flavor='cherry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Ninja Star','cherry',tier,position from "tierListItem" where brand='Ninja' and flavor='cherry' on conflict do nothing;
delete from "tierListItem" where brand='Ninja' and flavor='cherry';
update "drinkLog" set brand='Ninja Star', flavor='cherry' where brand='Ninja' and flavor='cherry';

alter table review enable trigger review_prevent_blocked_contribution;
alter table "reviewComment" enable trigger review_comment_guard;
alter table "reviewReaction" enable trigger review_reaction_guard;
alter table favorite enable trigger favorite_experience;
