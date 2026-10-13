lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;


-- Vulkan: mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Vulkan' and a.flavor='mango' and b.brand='Vulkan' and b.flavor='tropical') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Vulkan', flavor='tropical' where brand='Vulkan' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Vulkan','tropical',"createdAt" from favorite where brand='Vulkan' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Vulkan','tropical',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Vulkan' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Vulkan' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Vulkan','tropical',tier,position from "tierListItem" where brand='Vulkan' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Vulkan' and flavor='mango';

-- Vulkan: passion_fruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Vulkan' and a.flavor='passion_fruit' and b.brand='Vulkan' and b.flavor='tropical') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Vulkan', flavor='tropical' where brand='Vulkan' and flavor='passion_fruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Vulkan','tropical',"createdAt" from favorite where brand='Vulkan' and flavor='passion_fruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Vulkan','tropical',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Vulkan' and flavor='passion_fruit' on conflict do nothing;
delete from favorite where brand='Vulkan' and flavor='passion_fruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Vulkan','tropical',tier,position from "tierListItem" where brand='Vulkan' and flavor='passion_fruit' on conflict do nothing;
delete from "tierListItem" where brand='Vulkan' and flavor='passion_fruit';

-- Vulkan: raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Vulkan' and a.flavor='raspberry' and b.brand='Vulkan' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Vulkan', flavor='berry' where brand='Vulkan' and flavor='raspberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Vulkan','berry',"createdAt" from favorite where brand='Vulkan' and flavor='raspberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Vulkan','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Vulkan' and flavor='raspberry' on conflict do nothing;
delete from favorite where brand='Vulkan' and flavor='raspberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Vulkan','berry',tier,position from "tierListItem" where brand='Vulkan' and flavor='raspberry' on conflict do nothing;
delete from "tierListItem" where brand='Vulkan' and flavor='raspberry';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
