lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;


-- Gorilla: berry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Gorilla' and a.flavor='berry' and b.brand='Gorilla' and b.flavor='gorilla_berry_blast') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Gorilla', flavor='gorilla_berry_blast' where brand='Gorilla' and flavor='berry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Gorilla','gorilla_berry_blast',"createdAt" from favorite where brand='Gorilla' and flavor='berry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Gorilla','gorilla_berry_blast',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Gorilla' and flavor='berry' on conflict do nothing;
delete from favorite where brand='Gorilla' and flavor='berry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Gorilla','gorilla_berry_blast',tier,position from "tierListItem" where brand='Gorilla' and flavor='berry' on conflict do nothing;
delete from "tierListItem" where brand='Gorilla' and flavor='berry';

-- Gorilla: blueberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Gorilla' and a.flavor='blueberry' and b.brand='Gorilla' and b.flavor='gorilla_berry_bloom') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Gorilla', flavor='gorilla_berry_bloom' where brand='Gorilla' and flavor='blueberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Gorilla','gorilla_berry_bloom',"createdAt" from favorite where brand='Gorilla' and flavor='blueberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Gorilla','gorilla_berry_bloom',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Gorilla' and flavor='blueberry' on conflict do nothing;
delete from favorite where brand='Gorilla' and flavor='blueberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Gorilla','gorilla_berry_bloom',tier,position from "tierListItem" where brand='Gorilla' and flavor='blueberry' on conflict do nothing;
delete from "tierListItem" where brand='Gorilla' and flavor='blueberry';

-- Gorilla: coconut
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Gorilla' and a.flavor='coconut' and b.brand='Gorilla' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Gorilla', flavor='blend:coconut+mango' where brand='Gorilla' and flavor='coconut';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Gorilla','blend:coconut+mango',"createdAt" from favorite where brand='Gorilla' and flavor='coconut' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Gorilla','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Gorilla' and flavor='coconut' on conflict do nothing;
delete from favorite where brand='Gorilla' and flavor='coconut';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Gorilla','blend:coconut+mango',tier,position from "tierListItem" where brand='Gorilla' and flavor='coconut' on conflict do nothing;
delete from "tierListItem" where brand='Gorilla' and flavor='coconut';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
