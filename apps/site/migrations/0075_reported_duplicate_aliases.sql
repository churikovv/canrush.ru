-- Duplicate cards reported by members, checked against their covers; the same pairs are in REVIEWED_PRODUCT_ALIASES.
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

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
alter table favorite enable trigger favorite_experience;
