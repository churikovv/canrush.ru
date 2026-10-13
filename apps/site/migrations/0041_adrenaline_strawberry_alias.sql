lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Adrenaline Rush: strawberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='strawberry' and b.brand='Adrenaline Rush' and b.flavor='blend:calamansi+strawberry+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='blend:calamansi+strawberry+yuzu' where brand='Adrenaline Rush' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='strawberry';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
