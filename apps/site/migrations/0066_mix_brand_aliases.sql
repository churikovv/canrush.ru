-- "Mix" is Edadeal's brand for flyers named "...микс": Burn "Апельсиновый микс" and "BYБАСТА Цитрус микс".
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Mix: orange -> Burn: orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Mix' and a.flavor='orange' and b.brand='Burn' and b.flavor='orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Burn', flavor='orange' where brand='Mix' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Burn','orange',"createdAt" from favorite where brand='Mix' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Burn','orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Mix' and flavor='orange' on conflict do nothing;
delete from favorite where brand='Mix' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Burn','orange',tier,position from "tierListItem" where brand='Mix' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='Mix' and flavor='orange';
update "drinkLog" set brand='Burn', flavor='orange' where brand='Mix' and flavor='orange';

-- Mix: blend:citrus+grapefruit+lemon+orange -> By Баста: blend:grapefruit+lemon+orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Mix' and a.flavor='blend:citrus+grapefruit+lemon+orange' and b.brand='By Баста' and b.flavor='blend:grapefruit+lemon+orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='By Баста', flavor='blend:grapefruit+lemon+orange' where brand='Mix' and flavor='blend:citrus+grapefruit+lemon+orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'By Баста','blend:grapefruit+lemon+orange',"createdAt" from favorite where brand='Mix' and flavor='blend:citrus+grapefruit+lemon+orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'By Баста','blend:grapefruit+lemon+orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Mix' and flavor='blend:citrus+grapefruit+lemon+orange' on conflict do nothing;
delete from favorite where brand='Mix' and flavor='blend:citrus+grapefruit+lemon+orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'By Баста','blend:grapefruit+lemon+orange',tier,position from "tierListItem" where brand='Mix' and flavor='blend:citrus+grapefruit+lemon+orange' on conflict do nothing;
delete from "tierListItem" where brand='Mix' and flavor='blend:citrus+grapefruit+lemon+orange';
update "drinkLog" set brand='By Баста', flavor='blend:grapefruit+lemon+orange' where brand='Mix' and flavor='blend:citrus+grapefruit+lemon+orange';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
