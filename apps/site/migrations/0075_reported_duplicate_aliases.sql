-- Duplicate cards reported by members, checked against their covers; the same pairs are in REVIEWED_PRODUCT_ALIASES.
lock table review, "reviewComment", "reviewReaction", "reviewPhoto", favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table "reviewComment" disable trigger review_comment_guard;
alter table "reviewReaction" disable trigger review_reaction_guard;
alter table favorite disable trigger favorite_experience;

-- A member who reviewed both cards of a pair (on production: en4rgy, the same 7/6 review on Lit «Ягодный» and
-- «Оригинальный») keeps the review on the card that stays. The duplicate's comments, likes and photos move to it
-- (photos up to the five-photo limit), then the duplicate is deleted, so the merge below meets no conflict.
do $$
declare r record;
begin
  for r in select a.id as dup, b.id as kept
    from (values ('Lit Energy','berry','Lit Energy','original'), ('Flash Up','barberry','Flash Up','ultra'),
      ('Pulseup','unresolved:9427ce79d3fe662f3f4cd6a6','Pulseup','pulse_your'), ('Pulse Up','berry','Pulseup','berry')) as p(fb, ff, tb, tf)
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

-- Lit Energy: berry -> Lit Energy: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='berry' and b.brand='Lit Energy' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='original' where brand='Lit Energy' and flavor='berry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','original',"createdAt" from favorite where brand='Lit Energy' and flavor='berry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='berry' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='berry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','original',tier,position from "tierListItem" where brand='Lit Energy' and flavor='berry' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='berry';
update "drinkLog" set brand='Lit Energy', flavor='original' where brand='Lit Energy' and flavor='berry';

-- Flash Up: barberry -> Flash Up: ultra
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='barberry' and b.brand='Flash Up' and b.flavor='ultra') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='ultra' where brand='Flash Up' and flavor='barberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','ultra',"createdAt" from favorite where brand='Flash Up' and flavor='barberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','ultra',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='barberry' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='barberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','ultra',tier,position from "tierListItem" where brand='Flash Up' and flavor='barberry' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='barberry';
update "drinkLog" set brand='Flash Up', flavor='ultra' where brand='Flash Up' and flavor='barberry';

-- Pulseup: unresolved:9427ce79d3fe662f3f4cd6a6 -> Pulseup: pulse_your
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Pulseup' and a.flavor='unresolved:9427ce79d3fe662f3f4cd6a6' and b.brand='Pulseup' and b.flavor='pulse_your') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Pulseup', flavor='pulse_your' where brand='Pulseup' and flavor='unresolved:9427ce79d3fe662f3f4cd6a6';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Pulseup','pulse_your',"createdAt" from favorite where brand='Pulseup' and flavor='unresolved:9427ce79d3fe662f3f4cd6a6' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Pulseup','pulse_your',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Pulseup' and flavor='unresolved:9427ce79d3fe662f3f4cd6a6' on conflict do nothing;
delete from favorite where brand='Pulseup' and flavor='unresolved:9427ce79d3fe662f3f4cd6a6';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Pulseup','pulse_your',tier,position from "tierListItem" where brand='Pulseup' and flavor='unresolved:9427ce79d3fe662f3f4cd6a6' on conflict do nothing;
delete from "tierListItem" where brand='Pulseup' and flavor='unresolved:9427ce79d3fe662f3f4cd6a6';
update "drinkLog" set brand='Pulseup', flavor='pulse_your' where brand='Pulseup' and flavor='unresolved:9427ce79d3fe662f3f4cd6a6';

-- Pulse Up: berry -> Pulseup: berry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Pulse Up' and a.flavor='berry' and b.brand='Pulseup' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Pulseup', flavor='berry' where brand='Pulse Up' and flavor='berry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Pulseup','berry',"createdAt" from favorite where brand='Pulse Up' and flavor='berry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Pulseup','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Pulse Up' and flavor='berry' on conflict do nothing;
delete from favorite where brand='Pulse Up' and flavor='berry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Pulseup','berry',tier,position from "tierListItem" where brand='Pulse Up' and flavor='berry' on conflict do nothing;
delete from "tierListItem" where brand='Pulse Up' and flavor='berry';
update "drinkLog" set brand='Pulseup', flavor='berry' where brand='Pulse Up' and flavor='berry';

alter table review enable trigger review_prevent_blocked_contribution;
alter table "reviewComment" enable trigger review_comment_guard;
alter table "reviewReaction" enable trigger review_reaction_guard;
alter table favorite enable trigger favorite_experience;
