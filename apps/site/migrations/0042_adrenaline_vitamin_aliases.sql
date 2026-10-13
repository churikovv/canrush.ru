lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;


-- Adrenaline Rush: mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='mango' and b.brand='Adrenaline Game Fuel' and b.flavor='mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Game Fuel', flavor='mango' where brand='Adrenaline Rush' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Game Fuel','mango',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Game Fuel','mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Game Fuel','mango',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='mango';

-- Adrenaline: strawberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline' and a.flavor='strawberry' and b.brand='Adrenaline Rush' and b.flavor='blend:calamansi+strawberry+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='blend:calamansi+strawberry+yuzu' where brand='Adrenaline' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',"createdAt" from favorite where brand='Adrenaline' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Adrenaline' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',tier,position from "tierListItem" where brand='Adrenaline' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline' and flavor='strawberry';

-- Adrenaline: calamansi
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline' and a.flavor='calamansi' and b.brand='Adrenaline Rush' and b.flavor='blend:calamansi+strawberry+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='blend:calamansi+strawberry+yuzu' where brand='Adrenaline' and flavor='calamansi';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',"createdAt" from favorite where brand='Adrenaline' and flavor='calamansi' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline' and flavor='calamansi' on conflict do nothing;
delete from favorite where brand='Adrenaline' and flavor='calamansi';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',tier,position from "tierListItem" where brand='Adrenaline' and flavor='calamansi' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline' and flavor='calamansi';

-- Adrenaline: orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline' and a.flavor='orange' and b.brand='Adrenaline Rush' and b.flavor='orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='orange' where brand='Adrenaline' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','orange',"createdAt" from favorite where brand='Adrenaline' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline' and flavor='orange' on conflict do nothing;
delete from favorite where brand='Adrenaline' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','orange',tier,position from "tierListItem" where brand='Adrenaline' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline' and flavor='orange';

-- Adrenaline: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline' and a.flavor='original' and b.brand='Adrenaline Rush' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='berry' where brand='Adrenaline' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','berry',"createdAt" from favorite where brand='Adrenaline' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline' and flavor='original' on conflict do nothing;
delete from favorite where brand='Adrenaline' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','berry',tier,position from "tierListItem" where brand='Adrenaline' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline' and flavor='original';

-- Adrenaline: berry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline' and a.flavor='berry' and b.brand='Adrenaline Rush' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='berry' where brand='Adrenaline' and flavor='berry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','berry',"createdAt" from favorite where brand='Adrenaline' and flavor='berry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline' and flavor='berry' on conflict do nothing;
delete from favorite where brand='Adrenaline' and flavor='berry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','berry',tier,position from "tierListItem" where brand='Adrenaline' and flavor='berry' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline' and flavor='berry';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
