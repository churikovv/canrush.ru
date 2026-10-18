-- Tassay flyer "TASSAY Energy" (white and blue can) is the original edition.
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Tassay: unresolved:c5563315b9f9cea139f1f86d -> Tassay: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Tassay' and a.flavor='unresolved:c5563315b9f9cea139f1f86d' and b.brand='Tassay' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Tassay', flavor='original' where brand='Tassay' and flavor='unresolved:c5563315b9f9cea139f1f86d';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Tassay','original',"createdAt" from favorite where brand='Tassay' and flavor='unresolved:c5563315b9f9cea139f1f86d' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Tassay','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Tassay' and flavor='unresolved:c5563315b9f9cea139f1f86d' on conflict do nothing;
delete from favorite where brand='Tassay' and flavor='unresolved:c5563315b9f9cea139f1f86d';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Tassay','original',tier,position from "tierListItem" where brand='Tassay' and flavor='unresolved:c5563315b9f9cea139f1f86d' on conflict do nothing;
delete from "tierListItem" where brand='Tassay' and flavor='unresolved:c5563315b9f9cea139f1f86d';
update "drinkLog" set brand='Tassay', flavor='original' where brand='Tassay' and flavor='unresolved:c5563315b9f9cea139f1f86d';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
