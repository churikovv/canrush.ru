lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;


-- Volt Energy: orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='orange' and b.brand='Volt Energy' and b.flavor='blend:orange+passion_fruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:orange+passion_fruit' where brand='Volt Energy' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:orange+passion_fruit',"createdAt" from favorite where brand='Volt Energy' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:orange+passion_fruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='orange' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:orange+passion_fruit',tier,position from "tierListItem" where brand='Volt Energy' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='orange';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
