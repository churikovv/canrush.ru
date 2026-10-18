-- Go Champ "grapefruit" is an archived flyer identity of the watermelon + grapefruit can (same packaging).
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Go Champ: grapefruit -> Go Champ: blend:grapefruit+watermelon
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Go Champ' and a.flavor='grapefruit' and b.brand='Go Champ' and b.flavor='blend:grapefruit+watermelon') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Go Champ', flavor='blend:grapefruit+watermelon' where brand='Go Champ' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Go Champ','blend:grapefruit+watermelon',"createdAt" from favorite where brand='Go Champ' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Go Champ','blend:grapefruit+watermelon',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Go Champ' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='Go Champ' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Go Champ','blend:grapefruit+watermelon',tier,position from "tierListItem" where brand='Go Champ' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='Go Champ' and flavor='grapefruit';
update "drinkLog" set brand='Go Champ', flavor='blend:grapefruit+watermelon' where brand='Go Champ' and flavor='grapefruit';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
