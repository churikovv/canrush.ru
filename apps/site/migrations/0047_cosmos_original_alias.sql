lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;


-- Cosmos: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Cosmos' and a.flavor='original' and b.brand='Cosmos' and b.flavor='cosmos_bold') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Cosmos', flavor='cosmos_bold' where brand='Cosmos' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Cosmos','cosmos_bold',"createdAt" from favorite where brand='Cosmos' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Cosmos','cosmos_bold',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Cosmos' and flavor='original' on conflict do nothing;
delete from favorite where brand='Cosmos' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Cosmos','cosmos_bold',tier,position from "tierListItem" where brand='Cosmos' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Cosmos' and flavor='original';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
