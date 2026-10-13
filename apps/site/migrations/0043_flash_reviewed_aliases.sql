lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;


-- Flash Up: blueberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='blueberry' and b.brand='Flash Up' and b.flavor='blueberry_donut') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blueberry_donut' where brand='Flash Up' and flavor='blueberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blueberry_donut',"createdAt" from favorite where brand='Flash Up' and flavor='blueberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blueberry_donut',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='blueberry' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='blueberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blueberry_donut',tier,position from "tierListItem" where brand='Flash Up' and flavor='blueberry' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='blueberry';

-- Flesh: blueberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flesh' and a.flavor='blueberry' and b.brand='Flash Up' and b.flavor='blueberry_donut') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blueberry_donut' where brand='Flesh' and flavor='blueberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blueberry_donut',"createdAt" from favorite where brand='Flesh' and flavor='blueberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blueberry_donut',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flesh' and flavor='blueberry' on conflict do nothing;
delete from favorite where brand='Flesh' and flavor='blueberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blueberry_donut',tier,position from "tierListItem" where brand='Flesh' and flavor='blueberry' on conflict do nothing;
delete from "tierListItem" where brand='Flesh' and flavor='blueberry';

-- Flesh: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flesh' and a.flavor='original' and b.brand='Flash Up' and b.flavor='blueberry_donut') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blueberry_donut' where brand='Flesh' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blueberry_donut',"createdAt" from favorite where brand='Flesh' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blueberry_donut',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flesh' and flavor='original' on conflict do nothing;
delete from favorite where brand='Flesh' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blueberry_donut',tier,position from "tierListItem" where brand='Flesh' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Flesh' and flavor='original';

-- Flesh: bubblegum
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flesh' and a.flavor='bubblegum' and b.brand='Flash Up' and b.flavor='bubblegum') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='bubblegum' where brand='Flesh' and flavor='bubblegum';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','bubblegum',"createdAt" from favorite where brand='Flesh' and flavor='bubblegum' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','bubblegum',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flesh' and flavor='bubblegum' on conflict do nothing;
delete from favorite where brand='Flesh' and flavor='bubblegum';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','bubblegum',tier,position from "tierListItem" where brand='Flesh' and flavor='bubblegum' on conflict do nothing;
delete from "tierListItem" where brand='Flesh' and flavor='bubblegum';

-- Flash Up: strawberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='strawberry' and b.brand='Flash Up' and b.flavor='bubblegum') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='bubblegum' where brand='Flash Up' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','bubblegum',"createdAt" from favorite where brand='Flash Up' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','bubblegum',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','bubblegum',tier,position from "tierListItem" where brand='Flash Up' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='strawberry';

-- Flash Up: blend:blueberry+peach
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='blend:blueberry+peach' and b.brand='Flash Up' and b.flavor='blend:blueberry+peach:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:blueberry+peach:sugarfree' where brand='Flash Up' and flavor='blend:blueberry+peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',"createdAt" from favorite where brand='Flash Up' and flavor='blend:blueberry+peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='blend:blueberry+peach' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='blend:blueberry+peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:blueberry+peach:sugarfree',tier,position from "tierListItem" where brand='Flash Up' and flavor='blend:blueberry+peach' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='blend:blueberry+peach';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
