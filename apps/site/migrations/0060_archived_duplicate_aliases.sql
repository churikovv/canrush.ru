-- Archived catalog identities that are the same can as a live product (same cover photo, verified against retailer titles).
-- Generated from the aliases added to REVIEWED_PRODUCT_ALIASES; moves member data onto the live identity.
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Burn: apple -> Burn: blend:apple+kiwi
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Burn' and a.flavor='apple' and b.brand='Burn' and b.flavor='blend:apple+kiwi') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Burn', flavor='blend:apple+kiwi' where brand='Burn' and flavor='apple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Burn','blend:apple+kiwi',"createdAt" from favorite where brand='Burn' and flavor='apple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Burn','blend:apple+kiwi',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Burn' and flavor='apple' on conflict do nothing;
delete from favorite where brand='Burn' and flavor='apple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Burn','blend:apple+kiwi',tier,position from "tierListItem" where brand='Burn' and flavor='apple' on conflict do nothing;
delete from "tierListItem" where brand='Burn' and flavor='apple';
update "drinkLog" set brand='Burn', flavor='blend:apple+kiwi' where brand='Burn' and flavor='apple';

-- Burn: watermelon -> Burn: watermelon:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Burn' and a.flavor='watermelon' and b.brand='Burn' and b.flavor='watermelon:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Burn', flavor='watermelon:sugarfree' where brand='Burn' and flavor='watermelon';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Burn','watermelon:sugarfree',"createdAt" from favorite where brand='Burn' and flavor='watermelon' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Burn','watermelon:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Burn' and flavor='watermelon' on conflict do nothing;
delete from favorite where brand='Burn' and flavor='watermelon';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Burn','watermelon:sugarfree',tier,position from "tierListItem" where brand='Burn' and flavor='watermelon' on conflict do nothing;
delete from "tierListItem" where brand='Burn' and flavor='watermelon';
update "drinkLog" set brand='Burn', flavor='watermelon:sugarfree' where brand='Burn' and flavor='watermelon';

-- Burn: citrus -> Burn: citrus:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Burn' and a.flavor='citrus' and b.brand='Burn' and b.flavor='citrus:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Burn', flavor='citrus:sugarfree' where brand='Burn' and flavor='citrus';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Burn','citrus:sugarfree',"createdAt" from favorite where brand='Burn' and flavor='citrus' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Burn','citrus:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Burn' and flavor='citrus' on conflict do nothing;
delete from favorite where brand='Burn' and flavor='citrus';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Burn','citrus:sugarfree',tier,position from "tierListItem" where brand='Burn' and flavor='citrus' on conflict do nothing;
delete from "tierListItem" where brand='Burn' and flavor='citrus';
update "drinkLog" set brand='Burn', flavor='citrus:sugarfree' where brand='Burn' and flavor='citrus';

-- Bizon: original -> Bizon: bizon_black
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Bizon' and a.flavor='original' and b.brand='Bizon' and b.flavor='bizon_black') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Bizon', flavor='bizon_black' where brand='Bizon' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Bizon','bizon_black',"createdAt" from favorite where brand='Bizon' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Bizon','bizon_black',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Bizon' and flavor='original' on conflict do nothing;
delete from favorite where brand='Bizon' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Bizon','bizon_black',tier,position from "tierListItem" where brand='Bizon' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Bizon' and flavor='original';
update "drinkLog" set brand='Bizon', flavor='bizon_black' where brand='Bizon' and flavor='original';

-- Bizon: mango -> Bizon: blend:mango+passion_fruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Bizon' and a.flavor='mango' and b.brand='Bizon' and b.flavor='blend:mango+passion_fruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Bizon', flavor='blend:mango+passion_fruit' where brand='Bizon' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Bizon','blend:mango+passion_fruit',"createdAt" from favorite where brand='Bizon' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Bizon','blend:mango+passion_fruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Bizon' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Bizon' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Bizon','blend:mango+passion_fruit',tier,position from "tierListItem" where brand='Bizon' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Bizon' and flavor='mango';
update "drinkLog" set brand='Bizon', flavor='blend:mango+passion_fruit' where brand='Bizon' and flavor='mango';

-- Bizon: passion_fruit -> Bizon: blend:mango+passion_fruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Bizon' and a.flavor='passion_fruit' and b.brand='Bizon' and b.flavor='blend:mango+passion_fruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Bizon', flavor='blend:mango+passion_fruit' where brand='Bizon' and flavor='passion_fruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Bizon','blend:mango+passion_fruit',"createdAt" from favorite where brand='Bizon' and flavor='passion_fruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Bizon','blend:mango+passion_fruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Bizon' and flavor='passion_fruit' on conflict do nothing;
delete from favorite where brand='Bizon' and flavor='passion_fruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Bizon','blend:mango+passion_fruit',tier,position from "tierListItem" where brand='Bizon' and flavor='passion_fruit' on conflict do nothing;
delete from "tierListItem" where brand='Bizon' and flavor='passion_fruit';
update "drinkLog" set brand='Bizon', flavor='blend:mango+passion_fruit' where brand='Bizon' and flavor='passion_fruit';

-- Flash Up: pineapple -> Flash Up: blend:mango+pineapple
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='pineapple' and b.brand='Flash Up' and b.flavor='blend:mango+pineapple') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:mango+pineapple' where brand='Flash Up' and flavor='pineapple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:mango+pineapple',"createdAt" from favorite where brand='Flash Up' and flavor='pineapple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:mango+pineapple',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='pineapple' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='pineapple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:mango+pineapple',tier,position from "tierListItem" where brand='Flash Up' and flavor='pineapple' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='pineapple';
update "drinkLog" set brand='Flash Up', flavor='blend:mango+pineapple' where brand='Flash Up' and flavor='pineapple';

-- Flash Up: mint -> Flash Up: blend:lime+mint
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='mint' and b.brand='Flash Up' and b.flavor='blend:lime+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:lime+mint' where brand='Flash Up' and flavor='mint';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:lime+mint',"createdAt" from favorite where brand='Flash Up' and flavor='mint' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:lime+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='mint' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='mint';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:lime+mint',tier,position from "tierListItem" where brand='Flash Up' and flavor='mint' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='mint';
update "drinkLog" set brand='Flash Up', flavor='blend:lime+mint' where brand='Flash Up' and flavor='mint';

-- Flash Up: lime -> Flash Up: blend:lime+mint
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='lime' and b.brand='Flash Up' and b.flavor='blend:lime+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:lime+mint' where brand='Flash Up' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:lime+mint',"createdAt" from favorite where brand='Flash Up' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:lime+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='lime' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:lime+mint',tier,position from "tierListItem" where brand='Flash Up' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='lime';
update "drinkLog" set brand='Flash Up', flavor='blend:lime+mint' where brand='Flash Up' and flavor='lime';

-- Flash Up: lemon -> Flash Up: lemon_waffle
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='lemon' and b.brand='Flash Up' and b.flavor='lemon_waffle') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='lemon_waffle' where brand='Flash Up' and flavor='lemon';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','lemon_waffle',"createdAt" from favorite where brand='Flash Up' and flavor='lemon' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','lemon_waffle',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='lemon' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='lemon';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','lemon_waffle',tier,position from "tierListItem" where brand='Flash Up' and flavor='lemon' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='lemon';
update "drinkLog" set brand='Flash Up', flavor='lemon_waffle' where brand='Flash Up' and flavor='lemon';

-- Volt Energy: feijoa -> Volt Energy: blend:feijoa+kiwi
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='feijoa' and b.brand='Volt Energy' and b.flavor='blend:feijoa+kiwi') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:feijoa+kiwi' where brand='Volt Energy' and flavor='feijoa';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:feijoa+kiwi',"createdAt" from favorite where brand='Volt Energy' and flavor='feijoa' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:feijoa+kiwi',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='feijoa' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='feijoa';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:feijoa+kiwi',tier,position from "tierListItem" where brand='Volt Energy' and flavor='feijoa' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='feijoa';
update "drinkLog" set brand='Volt Energy', flavor='blend:feijoa+kiwi' where brand='Volt Energy' and flavor='feijoa';

-- Fitness Food Factory: cherry -> Fitness Food Factory: blend:cherry+cola:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Fitness Food Factory' and a.flavor='cherry' and b.brand='Fitness Food Factory' and b.flavor='blend:cherry+cola:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Fitness Food Factory', flavor='blend:cherry+cola:sugarfree' where brand='Fitness Food Factory' and flavor='cherry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Fitness Food Factory','blend:cherry+cola:sugarfree',"createdAt" from favorite where brand='Fitness Food Factory' and flavor='cherry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Fitness Food Factory','blend:cherry+cola:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Fitness Food Factory' and flavor='cherry' on conflict do nothing;
delete from favorite where brand='Fitness Food Factory' and flavor='cherry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Fitness Food Factory','blend:cherry+cola:sugarfree',tier,position from "tierListItem" where brand='Fitness Food Factory' and flavor='cherry' on conflict do nothing;
delete from "tierListItem" where brand='Fitness Food Factory' and flavor='cherry';
update "drinkLog" set brand='Fitness Food Factory', flavor='blend:cherry+cola:sugarfree' where brand='Fitness Food Factory' and flavor='cherry';

-- Fitness Food Factory: raspberry -> Fitness Food Factory: blend:mint+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Fitness Food Factory' and a.flavor='raspberry' and b.brand='Fitness Food Factory' and b.flavor='blend:mint+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Fitness Food Factory', flavor='blend:mint+raspberry' where brand='Fitness Food Factory' and flavor='raspberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Fitness Food Factory','blend:mint+raspberry',"createdAt" from favorite where brand='Fitness Food Factory' and flavor='raspberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Fitness Food Factory','blend:mint+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Fitness Food Factory' and flavor='raspberry' on conflict do nothing;
delete from favorite where brand='Fitness Food Factory' and flavor='raspberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Fitness Food Factory','blend:mint+raspberry',tier,position from "tierListItem" where brand='Fitness Food Factory' and flavor='raspberry' on conflict do nothing;
delete from "tierListItem" where brand='Fitness Food Factory' and flavor='raspberry';
update "drinkLog" set brand='Fitness Food Factory', flavor='blend:mint+raspberry' where brand='Fitness Food Factory' and flavor='raspberry';

-- Fitness Food Factory: peach -> Fitness Food Factory: blend:guava+peach
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Fitness Food Factory' and a.flavor='peach' and b.brand='Fitness Food Factory' and b.flavor='blend:guava+peach') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Fitness Food Factory', flavor='blend:guava+peach' where brand='Fitness Food Factory' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Fitness Food Factory','blend:guava+peach',"createdAt" from favorite where brand='Fitness Food Factory' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Fitness Food Factory','blend:guava+peach',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Fitness Food Factory' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Fitness Food Factory' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Fitness Food Factory','blend:guava+peach',tier,position from "tierListItem" where brand='Fitness Food Factory' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Fitness Food Factory' and flavor='peach';
update "drinkLog" set brand='Fitness Food Factory', flavor='blend:guava+peach' where brand='Fitness Food Factory' and flavor='peach';

-- Fitness Food Factory: grapefruit -> Fitness Food Factory: blend:grapefruit+mint
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Fitness Food Factory' and a.flavor='grapefruit' and b.brand='Fitness Food Factory' and b.flavor='blend:grapefruit+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Fitness Food Factory', flavor='blend:grapefruit+mint' where brand='Fitness Food Factory' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Fitness Food Factory','blend:grapefruit+mint',"createdAt" from favorite where brand='Fitness Food Factory' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Fitness Food Factory','blend:grapefruit+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Fitness Food Factory' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='Fitness Food Factory' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Fitness Food Factory','blend:grapefruit+mint',tier,position from "tierListItem" where brand='Fitness Food Factory' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='Fitness Food Factory' and flavor='grapefruit';
update "drinkLog" set brand='Fitness Food Factory', flavor='blend:grapefruit+mint' where brand='Fitness Food Factory' and flavor='grapefruit';

-- Aziano: original -> Aziano: aziano_fly
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Aziano' and a.flavor='original' and b.brand='Aziano' and b.flavor='aziano_fly') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Aziano', flavor='aziano_fly' where brand='Aziano' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Aziano','aziano_fly',"createdAt" from favorite where brand='Aziano' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Aziano','aziano_fly',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Aziano' and flavor='original' on conflict do nothing;
delete from favorite where brand='Aziano' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Aziano','aziano_fly',tier,position from "tierListItem" where brand='Aziano' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Aziano' and flavor='original';
update "drinkLog" set brand='Aziano', flavor='aziano_fly' where brand='Aziano' and flavor='original';

-- Ninja Star: strawberry -> Ninja Star: blend:strawberry+vanilla
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Ninja Star' and a.flavor='strawberry' and b.brand='Ninja Star' and b.flavor='blend:strawberry+vanilla') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Ninja Star', flavor='blend:strawberry+vanilla' where brand='Ninja Star' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Ninja Star','blend:strawberry+vanilla',"createdAt" from favorite where brand='Ninja Star' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Ninja Star','blend:strawberry+vanilla',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Ninja Star' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Ninja Star' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Ninja Star','blend:strawberry+vanilla',tier,position from "tierListItem" where brand='Ninja Star' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Ninja Star' and flavor='strawberry';
update "drinkLog" set brand='Ninja Star', flavor='blend:strawberry+vanilla' where brand='Ninja Star' and flavor='strawberry';

-- Ninja Star: original -> Ninja Star: cherry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Ninja Star' and a.flavor='original' and b.brand='Ninja Star' and b.flavor='cherry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Ninja Star', flavor='cherry' where brand='Ninja Star' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Ninja Star','cherry',"createdAt" from favorite where brand='Ninja Star' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Ninja Star','cherry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Ninja Star' and flavor='original' on conflict do nothing;
delete from favorite where brand='Ninja Star' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Ninja Star','cherry',tier,position from "tierListItem" where brand='Ninja Star' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Ninja Star' and flavor='original';
update "drinkLog" set brand='Ninja Star', flavor='cherry' where brand='Ninja Star' and flavor='original';

-- Bacchus: original -> Bacchus: bacchus_still
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Bacchus' and a.flavor='original' and b.brand='Bacchus' and b.flavor='bacchus_still') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Bacchus', flavor='bacchus_still' where brand='Bacchus' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Bacchus','bacchus_still',"createdAt" from favorite where brand='Bacchus' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Bacchus','bacchus_still',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Bacchus' and flavor='original' on conflict do nothing;
delete from favorite where brand='Bacchus' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Bacchus','bacchus_still',tier,position from "tierListItem" where brand='Bacchus' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Bacchus' and flavor='original';
update "drinkLog" set brand='Bacchus', flavor='bacchus_still' where brand='Bacchus' and flavor='original';

-- Dydo: original -> Dydo: dydo_vita_jelly
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Dydo' and a.flavor='original' and b.brand='Dydo' and b.flavor='dydo_vita_jelly') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Dydo', flavor='dydo_vita_jelly' where brand='Dydo' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Dydo','dydo_vita_jelly',"createdAt" from favorite where brand='Dydo' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Dydo','dydo_vita_jelly',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Dydo' and flavor='original' on conflict do nothing;
delete from favorite where brand='Dydo' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Dydo','dydo_vita_jelly',tier,position from "tierListItem" where brand='Dydo' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Dydo' and flavor='original';
update "drinkLog" set brand='Dydo', flavor='dydo_vita_jelly' where brand='Dydo' and flavor='original';

-- Wk Up: peach -> Wk Up: blend:guava+peach
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Wk Up' and a.flavor='peach' and b.brand='Wk Up' and b.flavor='blend:guava+peach') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Wk Up', flavor='blend:guava+peach' where brand='Wk Up' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Wk Up','blend:guava+peach',"createdAt" from favorite where brand='Wk Up' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Wk Up','blend:guava+peach',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Wk Up' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Wk Up' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Wk Up','blend:guava+peach',tier,position from "tierListItem" where brand='Wk Up' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Wk Up' and flavor='peach';
update "drinkLog" set brand='Wk Up', flavor='blend:guava+peach' where brand='Wk Up' and flavor='peach';

-- Wk Up: cherry -> Wk Up: blend:cherry+cola
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Wk Up' and a.flavor='cherry' and b.brand='Wk Up' and b.flavor='blend:cherry+cola') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Wk Up', flavor='blend:cherry+cola' where brand='Wk Up' and flavor='cherry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Wk Up','blend:cherry+cola',"createdAt" from favorite where brand='Wk Up' and flavor='cherry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Wk Up','blend:cherry+cola',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Wk Up' and flavor='cherry' on conflict do nothing;
delete from favorite where brand='Wk Up' and flavor='cherry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Wk Up','blend:cherry+cola',tier,position from "tierListItem" where brand='Wk Up' and flavor='cherry' on conflict do nothing;
delete from "tierListItem" where brand='Wk Up' and flavor='cherry';
update "drinkLog" set brand='Wk Up', flavor='blend:cherry+cola' where brand='Wk Up' and flavor='cherry';

-- Wk Up: raspberry -> Wk Up: blend:mint+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Wk Up' and a.flavor='raspberry' and b.brand='Wk Up' and b.flavor='blend:mint+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Wk Up', flavor='blend:mint+raspberry' where brand='Wk Up' and flavor='raspberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Wk Up','blend:mint+raspberry',"createdAt" from favorite where brand='Wk Up' and flavor='raspberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Wk Up','blend:mint+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Wk Up' and flavor='raspberry' on conflict do nothing;
delete from favorite where brand='Wk Up' and flavor='raspberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Wk Up','blend:mint+raspberry',tier,position from "tierListItem" where brand='Wk Up' and flavor='raspberry' on conflict do nothing;
delete from "tierListItem" where brand='Wk Up' and flavor='raspberry';
update "drinkLog" set brand='Wk Up', flavor='blend:mint+raspberry' where brand='Wk Up' and flavor='raspberry';

-- BOMBBAR: raspberry -> BOMBBAR: blend:kiwi+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='BOMBBAR' and a.flavor='raspberry' and b.brand='BOMBBAR' and b.flavor='blend:kiwi+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='BOMBBAR', flavor='blend:kiwi+raspberry' where brand='BOMBBAR' and flavor='raspberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'BOMBBAR','blend:kiwi+raspberry',"createdAt" from favorite where brand='BOMBBAR' and flavor='raspberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'BOMBBAR','blend:kiwi+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='BOMBBAR' and flavor='raspberry' on conflict do nothing;
delete from favorite where brand='BOMBBAR' and flavor='raspberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'BOMBBAR','blend:kiwi+raspberry',tier,position from "tierListItem" where brand='BOMBBAR' and flavor='raspberry' on conflict do nothing;
delete from "tierListItem" where brand='BOMBBAR' and flavor='raspberry';
update "drinkLog" set brand='BOMBBAR', flavor='blend:kiwi+raspberry' where brand='BOMBBAR' and flavor='raspberry';

-- BOMBBAR: lime -> BOMBBAR: blend:lime+mint
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='BOMBBAR' and a.flavor='lime' and b.brand='BOMBBAR' and b.flavor='blend:lime+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='BOMBBAR', flavor='blend:lime+mint' where brand='BOMBBAR' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'BOMBBAR','blend:lime+mint',"createdAt" from favorite where brand='BOMBBAR' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'BOMBBAR','blend:lime+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='BOMBBAR' and flavor='lime' on conflict do nothing;
delete from favorite where brand='BOMBBAR' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'BOMBBAR','blend:lime+mint',tier,position from "tierListItem" where brand='BOMBBAR' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='BOMBBAR' and flavor='lime';
update "drinkLog" set brand='BOMBBAR', flavor='blend:lime+mint' where brand='BOMBBAR' and flavor='lime';

-- Genesis: mango -> Genesis: blend:lime+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Genesis' and a.flavor='mango' and b.brand='Genesis' and b.flavor='blend:lime+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Genesis', flavor='blend:lime+mango' where brand='Genesis' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Genesis','blend:lime+mango',"createdAt" from favorite where brand='Genesis' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Genesis','blend:lime+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Genesis' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Genesis' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Genesis','blend:lime+mango',tier,position from "tierListItem" where brand='Genesis' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Genesis' and flavor='mango';
update "drinkLog" set brand='Genesis', flavor='blend:lime+mango' where brand='Genesis' and flavor='mango';

-- Genesis: orange -> Genesis: blend:orange+yuzu
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Genesis' and a.flavor='orange' and b.brand='Genesis' and b.flavor='blend:orange+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Genesis', flavor='blend:orange+yuzu' where brand='Genesis' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Genesis','blend:orange+yuzu',"createdAt" from favorite where brand='Genesis' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Genesis','blend:orange+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Genesis' and flavor='orange' on conflict do nothing;
delete from favorite where brand='Genesis' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Genesis','blend:orange+yuzu',tier,position from "tierListItem" where brand='Genesis' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='Genesis' and flavor='orange';
update "drinkLog" set brand='Genesis', flavor='blend:orange+yuzu' where brand='Genesis' and flavor='orange';

-- Genesis: original -> Genesis: genesis_mystery
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Genesis' and a.flavor='original' and b.brand='Genesis' and b.flavor='genesis_mystery') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Genesis', flavor='genesis_mystery' where brand='Genesis' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Genesis','genesis_mystery',"createdAt" from favorite where brand='Genesis' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Genesis','genesis_mystery',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Genesis' and flavor='original' on conflict do nothing;
delete from favorite where brand='Genesis' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Genesis','genesis_mystery',tier,position from "tierListItem" where brand='Genesis' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Genesis' and flavor='original';
update "drinkLog" set brand='Genesis', flavor='genesis_mystery' where brand='Genesis' and flavor='original';

-- Alligator: coconut -> Alligator: blend:coconut+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Alligator' and a.flavor='coconut' and b.brand='Alligator' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Alligator', flavor='blend:coconut+mango' where brand='Alligator' and flavor='coconut';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Alligator','blend:coconut+mango',"createdAt" from favorite where brand='Alligator' and flavor='coconut' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Alligator','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Alligator' and flavor='coconut' on conflict do nothing;
delete from favorite where brand='Alligator' and flavor='coconut';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Alligator','blend:coconut+mango',tier,position from "tierListItem" where brand='Alligator' and flavor='coconut' on conflict do nothing;
delete from "tierListItem" where brand='Alligator' and flavor='coconut';
update "drinkLog" set brand='Alligator', flavor='blend:coconut+mango' where brand='Alligator' and flavor='coconut';

-- Alligator: mango -> Alligator: blend:coconut+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Alligator' and a.flavor='mango' and b.brand='Alligator' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Alligator', flavor='blend:coconut+mango' where brand='Alligator' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Alligator','blend:coconut+mango',"createdAt" from favorite where brand='Alligator' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Alligator','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Alligator' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Alligator' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Alligator','blend:coconut+mango',tier,position from "tierListItem" where brand='Alligator' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Alligator' and flavor='mango';
update "drinkLog" set brand='Alligator', flavor='blend:coconut+mango' where brand='Alligator' and flavor='mango';

-- Alligator: lime -> Alligator: blend:guava+lime+mint
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Alligator' and a.flavor='lime' and b.brand='Alligator' and b.flavor='blend:guava+lime+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Alligator', flavor='blend:guava+lime+mint' where brand='Alligator' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Alligator','blend:guava+lime+mint',"createdAt" from favorite where brand='Alligator' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Alligator','blend:guava+lime+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Alligator' and flavor='lime' on conflict do nothing;
delete from favorite where brand='Alligator' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Alligator','blend:guava+lime+mint',tier,position from "tierListItem" where brand='Alligator' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='Alligator' and flavor='lime';
update "drinkLog" set brand='Alligator', flavor='blend:guava+lime+mint' where brand='Alligator' and flavor='lime';

-- Alligator: guava -> Alligator: blend:guava+lime+mint
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Alligator' and a.flavor='guava' and b.brand='Alligator' and b.flavor='blend:guava+lime+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Alligator', flavor='blend:guava+lime+mint' where brand='Alligator' and flavor='guava';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Alligator','blend:guava+lime+mint',"createdAt" from favorite where brand='Alligator' and flavor='guava' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Alligator','blend:guava+lime+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Alligator' and flavor='guava' on conflict do nothing;
delete from favorite where brand='Alligator' and flavor='guava';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Alligator','blend:guava+lime+mint',tier,position from "tierListItem" where brand='Alligator' and flavor='guava' on conflict do nothing;
delete from "tierListItem" where brand='Alligator' and flavor='guava';
update "drinkLog" set brand='Alligator', flavor='blend:guava+lime+mint' where brand='Alligator' and flavor='guava';

-- Juster: raspberry -> Juster: blend:guava+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Juster' and a.flavor='raspberry' and b.brand='Juster' and b.flavor='blend:guava+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Juster', flavor='blend:guava+raspberry' where brand='Juster' and flavor='raspberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Juster','blend:guava+raspberry',"createdAt" from favorite where brand='Juster' and flavor='raspberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Juster','blend:guava+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Juster' and flavor='raspberry' on conflict do nothing;
delete from favorite where brand='Juster' and flavor='raspberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Juster','blend:guava+raspberry',tier,position from "tierListItem" where brand='Juster' and flavor='raspberry' on conflict do nothing;
delete from "tierListItem" where brand='Juster' and flavor='raspberry';
update "drinkLog" set brand='Juster', flavor='blend:guava+raspberry' where brand='Juster' and flavor='raspberry';

-- Juster: original -> Juster: blend:calamansi+yuzu
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Juster' and a.flavor='original' and b.brand='Juster' and b.flavor='blend:calamansi+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Juster', flavor='blend:calamansi+yuzu' where brand='Juster' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Juster','blend:calamansi+yuzu',"createdAt" from favorite where brand='Juster' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Juster','blend:calamansi+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Juster' and flavor='original' on conflict do nothing;
delete from favorite where brand='Juster' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Juster','blend:calamansi+yuzu',tier,position from "tierListItem" where brand='Juster' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Juster' and flavor='original';
update "drinkLog" set brand='Juster', flavor='blend:calamansi+yuzu' where brand='Juster' and flavor='original';

-- Juster: calamansi -> Juster: blend:calamansi+yuzu
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Juster' and a.flavor='calamansi' and b.brand='Juster' and b.flavor='blend:calamansi+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Juster', flavor='blend:calamansi+yuzu' where brand='Juster' and flavor='calamansi';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Juster','blend:calamansi+yuzu',"createdAt" from favorite where brand='Juster' and flavor='calamansi' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Juster','blend:calamansi+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Juster' and flavor='calamansi' on conflict do nothing;
delete from favorite where brand='Juster' and flavor='calamansi';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Juster','blend:calamansi+yuzu',tier,position from "tierListItem" where brand='Juster' and flavor='calamansi' on conflict do nothing;
delete from "tierListItem" where brand='Juster' and flavor='calamansi';
update "drinkLog" set brand='Juster', flavor='blend:calamansi+yuzu' where brand='Juster' and flavor='calamansi';

-- Black Rocket: mango -> Black Rocket: blend:apricot+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Black Rocket' and a.flavor='mango' and b.brand='Black Rocket' and b.flavor='blend:apricot+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Black Rocket', flavor='blend:apricot+mango' where brand='Black Rocket' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Black Rocket','blend:apricot+mango',"createdAt" from favorite where brand='Black Rocket' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Black Rocket','blend:apricot+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Black Rocket' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Black Rocket' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Black Rocket','blend:apricot+mango',tier,position from "tierListItem" where brand='Black Rocket' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Black Rocket' and flavor='mango';
update "drinkLog" set brand='Black Rocket', flavor='blend:apricot+mango' where brand='Black Rocket' and flavor='mango';

-- Black Rocket: apricot -> Black Rocket: blend:apricot+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Black Rocket' and a.flavor='apricot' and b.brand='Black Rocket' and b.flavor='blend:apricot+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Black Rocket', flavor='blend:apricot+mango' where brand='Black Rocket' and flavor='apricot';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Black Rocket','blend:apricot+mango',"createdAt" from favorite where brand='Black Rocket' and flavor='apricot' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Black Rocket','blend:apricot+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Black Rocket' and flavor='apricot' on conflict do nothing;
delete from favorite where brand='Black Rocket' and flavor='apricot';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Black Rocket','blend:apricot+mango',tier,position from "tierListItem" where brand='Black Rocket' and flavor='apricot' on conflict do nothing;
delete from "tierListItem" where brand='Black Rocket' and flavor='apricot';
update "drinkLog" set brand='Black Rocket', flavor='blend:apricot+mango' where brand='Black Rocket' and flavor='apricot';

-- My Rules: mango -> My Rules: blend:mango+passion_fruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='My Rules' and a.flavor='mango' and b.brand='My Rules' and b.flavor='blend:mango+passion_fruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='My Rules', flavor='blend:mango+passion_fruit' where brand='My Rules' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'My Rules','blend:mango+passion_fruit',"createdAt" from favorite where brand='My Rules' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'My Rules','blend:mango+passion_fruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='My Rules' and flavor='mango' on conflict do nothing;
delete from favorite where brand='My Rules' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'My Rules','blend:mango+passion_fruit',tier,position from "tierListItem" where brand='My Rules' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='My Rules' and flavor='mango';
update "drinkLog" set brand='My Rules', flavor='blend:mango+passion_fruit' where brand='My Rules' and flavor='mango';

-- My Rules: passion_fruit -> My Rules: blend:mango+passion_fruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='My Rules' and a.flavor='passion_fruit' and b.brand='My Rules' and b.flavor='blend:mango+passion_fruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='My Rules', flavor='blend:mango+passion_fruit' where brand='My Rules' and flavor='passion_fruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'My Rules','blend:mango+passion_fruit',"createdAt" from favorite where brand='My Rules' and flavor='passion_fruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'My Rules','blend:mango+passion_fruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='My Rules' and flavor='passion_fruit' on conflict do nothing;
delete from favorite where brand='My Rules' and flavor='passion_fruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'My Rules','blend:mango+passion_fruit',tier,position from "tierListItem" where brand='My Rules' and flavor='passion_fruit' on conflict do nothing;
delete from "tierListItem" where brand='My Rules' and flavor='passion_fruit';
update "drinkLog" set brand='My Rules', flavor='blend:mango+passion_fruit' where brand='My Rules' and flavor='passion_fruit';

-- Ninja: original -> Ninja: grape
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Ninja' and a.flavor='original' and b.brand='Ninja' and b.flavor='grape') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Ninja', flavor='grape' where brand='Ninja' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Ninja','grape',"createdAt" from favorite where brand='Ninja' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Ninja','grape',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Ninja' and flavor='original' on conflict do nothing;
delete from favorite where brand='Ninja' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Ninja','grape',tier,position from "tierListItem" where brand='Ninja' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Ninja' and flavor='original';
update "drinkLog" set brand='Ninja', flavor='grape' where brand='Ninja' and flavor='original';

-- Sangaria: original -> Sangaria: sangaria_miracle
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Sangaria' and a.flavor='original' and b.brand='Sangaria' and b.flavor='sangaria_miracle') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Sangaria', flavor='sangaria_miracle' where brand='Sangaria' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Sangaria','sangaria_miracle',"createdAt" from favorite where brand='Sangaria' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Sangaria','sangaria_miracle',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Sangaria' and flavor='original' on conflict do nothing;
delete from favorite where brand='Sangaria' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Sangaria','sangaria_miracle',tier,position from "tierListItem" where brand='Sangaria' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Sangaria' and flavor='original';
update "drinkLog" set brand='Sangaria', flavor='sangaria_miracle' where brand='Sangaria' and flavor='original';

-- Arizona: original -> Arizona: watermelon
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Arizona' and a.flavor='original' and b.brand='Arizona' and b.flavor='watermelon') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Arizona', flavor='watermelon' where brand='Arizona' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Arizona','watermelon',"createdAt" from favorite where brand='Arizona' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Arizona','watermelon',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Arizona' and flavor='original' on conflict do nothing;
delete from favorite where brand='Arizona' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Arizona','watermelon',tier,position from "tierListItem" where brand='Arizona' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Arizona' and flavor='original';
update "drinkLog" set brand='Arizona', flavor='watermelon' where brand='Arizona' and flavor='original';

-- Target: apple -> Target: blend:apple+kiwi
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Target' and a.flavor='apple' and b.brand='Target' and b.flavor='blend:apple+kiwi') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Target', flavor='blend:apple+kiwi' where brand='Target' and flavor='apple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Target','blend:apple+kiwi',"createdAt" from favorite where brand='Target' and flavor='apple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Target','blend:apple+kiwi',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Target' and flavor='apple' on conflict do nothing;
delete from favorite where brand='Target' and flavor='apple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Target','blend:apple+kiwi',tier,position from "tierListItem" where brand='Target' and flavor='apple' on conflict do nothing;
delete from "tierListItem" where brand='Target' and flavor='apple';
update "drinkLog" set brand='Target', flavor='blend:apple+kiwi' where brand='Target' and flavor='apple';

-- By Баста: orange -> By Баста: blend:grapefruit+lemon+orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='By Баста' and a.flavor='orange' and b.brand='By Баста' and b.flavor='blend:grapefruit+lemon+orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='By Баста', flavor='blend:grapefruit+lemon+orange' where brand='By Баста' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'By Баста','blend:grapefruit+lemon+orange',"createdAt" from favorite where brand='By Баста' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'By Баста','blend:grapefruit+lemon+orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='By Баста' and flavor='orange' on conflict do nothing;
delete from favorite where brand='By Баста' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'By Баста','blend:grapefruit+lemon+orange',tier,position from "tierListItem" where brand='By Баста' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='By Баста' and flavor='orange';
update "drinkLog" set brand='By Баста', flavor='blend:grapefruit+lemon+orange' where brand='By Баста' and flavor='orange';

-- By Баста: grapefruit -> By Баста: blend:grapefruit+lemon+orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='By Баста' and a.flavor='grapefruit' and b.brand='By Баста' and b.flavor='blend:grapefruit+lemon+orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='By Баста', flavor='blend:grapefruit+lemon+orange' where brand='By Баста' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'By Баста','blend:grapefruit+lemon+orange',"createdAt" from favorite where brand='By Баста' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'By Баста','blend:grapefruit+lemon+orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='By Баста' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='By Баста' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'By Баста','blend:grapefruit+lemon+orange',tier,position from "tierListItem" where brand='By Баста' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='By Баста' and flavor='grapefruit';
update "drinkLog" set brand='By Баста', flavor='blend:grapefruit+lemon+orange' where brand='By Баста' and flavor='grapefruit';

-- By Баста: barberry -> By Баста: blend:barberry+pomegranate
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='By Баста' and a.flavor='barberry' and b.brand='By Баста' and b.flavor='blend:barberry+pomegranate') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='By Баста', flavor='blend:barberry+pomegranate' where brand='By Баста' and flavor='barberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'By Баста','blend:barberry+pomegranate',"createdAt" from favorite where brand='By Баста' and flavor='barberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'By Баста','blend:barberry+pomegranate',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='By Баста' and flavor='barberry' on conflict do nothing;
delete from favorite where brand='By Баста' and flavor='barberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'By Баста','blend:barberry+pomegranate',tier,position from "tierListItem" where brand='By Баста' and flavor='barberry' on conflict do nothing;
delete from "tierListItem" where brand='By Баста' and flavor='barberry';
update "drinkLog" set brand='By Баста', flavor='blend:barberry+pomegranate' where brand='By Баста' and flavor='barberry';

-- X-Turbo: raspberry -> X-Turbo: blend:berry+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='X-Turbo' and a.flavor='raspberry' and b.brand='X-Turbo' and b.flavor='blend:berry+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='X-Turbo', flavor='blend:berry+raspberry' where brand='X-Turbo' and flavor='raspberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'X-Turbo','blend:berry+raspberry',"createdAt" from favorite where brand='X-Turbo' and flavor='raspberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'X-Turbo','blend:berry+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='X-Turbo' and flavor='raspberry' on conflict do nothing;
delete from favorite where brand='X-Turbo' and flavor='raspberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'X-Turbo','blend:berry+raspberry',tier,position from "tierListItem" where brand='X-Turbo' and flavor='raspberry' on conflict do nothing;
delete from "tierListItem" where brand='X-Turbo' and flavor='raspberry';
update "drinkLog" set brand='X-Turbo', flavor='blend:berry+raspberry' where brand='X-Turbo' and flavor='raspberry';

-- Quantum: lime -> Quantum: blend:lime+mint
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Quantum' and a.flavor='lime' and b.brand='Quantum' and b.flavor='blend:lime+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Quantum', flavor='blend:lime+mint' where brand='Quantum' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Quantum','blend:lime+mint',"createdAt" from favorite where brand='Quantum' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Quantum','blend:lime+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Quantum' and flavor='lime' on conflict do nothing;
delete from favorite where brand='Quantum' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Quantum','blend:lime+mint',tier,position from "tierListItem" where brand='Quantum' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='Quantum' and flavor='lime';
update "drinkLog" set brand='Quantum', flavor='blend:lime+mint' where brand='Quantum' and flavor='lime';

-- Rocket: mango -> Rocket: blend:apricot+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Rocket' and a.flavor='mango' and b.brand='Rocket' and b.flavor='blend:apricot+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Rocket', flavor='blend:apricot+mango' where brand='Rocket' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Rocket','blend:apricot+mango',"createdAt" from favorite where brand='Rocket' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Rocket','blend:apricot+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Rocket' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Rocket' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Rocket','blend:apricot+mango',tier,position from "tierListItem" where brand='Rocket' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Rocket' and flavor='mango';
update "drinkLog" set brand='Rocket', flavor='blend:apricot+mango' where brand='Rocket' and flavor='mango';

-- Rocket: apricot -> Rocket: blend:apricot+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Rocket' and a.flavor='apricot' and b.brand='Rocket' and b.flavor='blend:apricot+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Rocket', flavor='blend:apricot+mango' where brand='Rocket' and flavor='apricot';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Rocket','blend:apricot+mango',"createdAt" from favorite where brand='Rocket' and flavor='apricot' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Rocket','blend:apricot+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Rocket' and flavor='apricot' on conflict do nothing;
delete from favorite where brand='Rocket' and flavor='apricot';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Rocket','blend:apricot+mango',tier,position from "tierListItem" where brand='Rocket' and flavor='apricot' on conflict do nothing;
delete from "tierListItem" where brand='Rocket' and flavor='apricot';
update "drinkLog" set brand='Rocket', flavor='blend:apricot+mango' where brand='Rocket' and flavor='apricot';

-- Red Bull: pineapple -> Red Bull: blend:lemon+pineapple:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='pineapple' and b.brand='Red Bull' and b.flavor='blend:lemon+pineapple:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='blend:lemon+pineapple:sugarfree' where brand='Red Bull' and flavor='pineapple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','blend:lemon+pineapple:sugarfree',"createdAt" from favorite where brand='Red Bull' and flavor='pineapple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','blend:lemon+pineapple:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='pineapple' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='pineapple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','blend:lemon+pineapple:sugarfree',tier,position from "tierListItem" where brand='Red Bull' and flavor='pineapple' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='pineapple';
update "drinkLog" set brand='Red Bull', flavor='blend:lemon+pineapple:sugarfree' where brand='Red Bull' and flavor='pineapple';

-- Red Bull: berry -> Red Bull: redbull_sods_summer_berry:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='berry' and b.brand='Red Bull' and b.flavor='redbull_sods_summer_berry:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='redbull_sods_summer_berry:sugarfree' where brand='Red Bull' and flavor='berry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','redbull_sods_summer_berry:sugarfree',"createdAt" from favorite where brand='Red Bull' and flavor='berry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','redbull_sods_summer_berry:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='berry' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='berry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','redbull_sods_summer_berry:sugarfree',tier,position from "tierListItem" where brand='Red Bull' and flavor='berry' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='berry';
update "drinkLog" set brand='Red Bull', flavor='redbull_sods_summer_berry:sugarfree' where brand='Red Bull' and flavor='berry';

-- Red Bull: orange -> Red Bull: blend:orange+passion_fruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='orange' and b.brand='Red Bull' and b.flavor='blend:orange+passion_fruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='blend:orange+passion_fruit' where brand='Red Bull' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','blend:orange+passion_fruit',"createdAt" from favorite where brand='Red Bull' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','blend:orange+passion_fruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='orange' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','blend:orange+passion_fruit',tier,position from "tierListItem" where brand='Red Bull' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='orange';
update "drinkLog" set brand='Red Bull', flavor='blend:orange+passion_fruit' where brand='Red Bull' and flavor='orange';

-- Red Bull: blackcurrant -> Red Bull: blend:blackcurrant+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='blackcurrant' and b.brand='Red Bull' and b.flavor='blend:blackcurrant+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='blend:blackcurrant+raspberry' where brand='Red Bull' and flavor='blackcurrant';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','blend:blackcurrant+raspberry',"createdAt" from favorite where brand='Red Bull' and flavor='blackcurrant' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','blend:blackcurrant+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='blackcurrant' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='blackcurrant';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','blend:blackcurrant+raspberry',tier,position from "tierListItem" where brand='Red Bull' and flavor='blackcurrant' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='blackcurrant';
update "drinkLog" set brand='Red Bull', flavor='blend:blackcurrant+raspberry' where brand='Red Bull' and flavor='blackcurrant';

-- Monster: apple -> Monster: blend:apple+kiwi
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='apple' and b.brand='Monster' and b.flavor='blend:apple+kiwi') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='blend:apple+kiwi' where brand='Monster' and flavor='apple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','blend:apple+kiwi',"createdAt" from favorite where brand='Monster' and flavor='apple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','blend:apple+kiwi',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='apple' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='apple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','blend:apple+kiwi',tier,position from "tierListItem" where brand='Monster' and flavor='apple' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='apple';
update "drinkLog" set brand='Monster', flavor='blend:apple+kiwi' where brand='Monster' and flavor='apple';

-- Monster: peach -> Monster: monster_rehab_peach_tea
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='peach' and b.brand='Monster' and b.flavor='monster_rehab_peach_tea') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='monster_rehab_peach_tea' where brand='Monster' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','monster_rehab_peach_tea',"createdAt" from favorite where brand='Monster' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','monster_rehab_peach_tea',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','monster_rehab_peach_tea',tier,position from "tierListItem" where brand='Monster' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='peach';
update "drinkLog" set brand='Monster', flavor='monster_rehab_peach_tea' where brand='Monster' and flavor='peach';

-- Monster: pineapple -> Monster: monster_ultra_golden_pineapple
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='pineapple' and b.brand='Monster' and b.flavor='monster_ultra_golden_pineapple') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='monster_ultra_golden_pineapple' where brand='Monster' and flavor='pineapple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','monster_ultra_golden_pineapple',"createdAt" from favorite where brand='Monster' and flavor='pineapple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','monster_ultra_golden_pineapple',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='pineapple' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='pineapple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','monster_ultra_golden_pineapple',tier,position from "tierListItem" where brand='Monster' and flavor='pineapple' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='pineapple';
update "drinkLog" set brand='Monster', flavor='monster_ultra_golden_pineapple' where brand='Monster' and flavor='pineapple';

-- Monster: grapefruit -> Monster: monster_ultra_rosa
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='grapefruit' and b.brand='Monster' and b.flavor='monster_ultra_rosa') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='monster_ultra_rosa' where brand='Monster' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','monster_ultra_rosa',"createdAt" from favorite where brand='Monster' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','monster_ultra_rosa',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','monster_ultra_rosa',tier,position from "tierListItem" where brand='Monster' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='grapefruit';
update "drinkLog" set brand='Monster', flavor='monster_ultra_rosa' where brand='Monster' and flavor='grapefruit';

-- Восторг: strawberry -> Восторг: strawberry:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Восторг' and a.flavor='strawberry' and b.brand='Восторг' and b.flavor='strawberry:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Восторг', flavor='strawberry:sugarfree' where brand='Восторг' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Восторг','strawberry:sugarfree',"createdAt" from favorite where brand='Восторг' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Восторг','strawberry:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Восторг' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Восторг' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Восторг','strawberry:sugarfree',tier,position from "tierListItem" where brand='Восторг' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Восторг' and flavor='strawberry';
update "drinkLog" set brand='Восторг', flavor='strawberry:sugarfree' where brand='Восторг' and flavor='strawberry';

-- Toxic Waste: original -> Toxic Waste: blend:blueberry+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Toxic Waste' and a.flavor='original' and b.brand='Toxic Waste' and b.flavor='blend:blueberry+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Toxic Waste', flavor='blend:blueberry+raspberry' where brand='Toxic Waste' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Toxic Waste','blend:blueberry+raspberry',"createdAt" from favorite where brand='Toxic Waste' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Toxic Waste','blend:blueberry+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Toxic Waste' and flavor='original' on conflict do nothing;
delete from favorite where brand='Toxic Waste' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Toxic Waste','blend:blueberry+raspberry',tier,position from "tierListItem" where brand='Toxic Waste' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Toxic Waste' and flavor='original';
update "drinkLog" set brand='Toxic Waste', flavor='blend:blueberry+raspberry' where brand='Toxic Waste' and flavor='original';

-- Toxic Waste: blueberry -> Toxic Waste: blend:blueberry+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Toxic Waste' and a.flavor='blueberry' and b.brand='Toxic Waste' and b.flavor='blend:blueberry+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Toxic Waste', flavor='blend:blueberry+raspberry' where brand='Toxic Waste' and flavor='blueberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Toxic Waste','blend:blueberry+raspberry',"createdAt" from favorite where brand='Toxic Waste' and flavor='blueberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Toxic Waste','blend:blueberry+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Toxic Waste' and flavor='blueberry' on conflict do nothing;
delete from favorite where brand='Toxic Waste' and flavor='blueberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Toxic Waste','blend:blueberry+raspberry',tier,position from "tierListItem" where brand='Toxic Waste' and flavor='blueberry' on conflict do nothing;
delete from "tierListItem" where brand='Toxic Waste' and flavor='blueberry';
update "drinkLog" set brand='Toxic Waste', flavor='blend:blueberry+raspberry' where brand='Toxic Waste' and flavor='blueberry';

-- Lit Energy: barberry -> Lit Energy: blend:barberry+cranberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='barberry' and b.brand='Lit Energy' and b.flavor='blend:barberry+cranberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:barberry+cranberry' where brand='Lit Energy' and flavor='barberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:barberry+cranberry',"createdAt" from favorite where brand='Lit Energy' and flavor='barberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:barberry+cranberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='barberry' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='barberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:barberry+cranberry',tier,position from "tierListItem" where brand='Lit Energy' and flavor='barberry' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='barberry';
update "drinkLog" set brand='Lit Energy', flavor='blend:barberry+cranberry' where brand='Lit Energy' and flavor='barberry';

-- Lit Energy: lime -> Lit Energy: blend:lime+yuzu
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='lime' and b.brand='Lit Energy' and b.flavor='blend:lime+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:lime+yuzu' where brand='Lit Energy' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:lime+yuzu',"createdAt" from favorite where brand='Lit Energy' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:lime+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='lime' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:lime+yuzu',tier,position from "tierListItem" where brand='Lit Energy' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='lime';
update "drinkLog" set brand='Lit Energy', flavor='blend:lime+yuzu' where brand='Lit Energy' and flavor='lime';

-- Mix: grapefruit -> Mix: blend:citrus+grapefruit+lemon+orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Mix' and a.flavor='grapefruit' and b.brand='Mix' and b.flavor='blend:citrus+grapefruit+lemon+orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Mix', flavor='blend:citrus+grapefruit+lemon+orange' where brand='Mix' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Mix','blend:citrus+grapefruit+lemon+orange',"createdAt" from favorite where brand='Mix' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Mix','blend:citrus+grapefruit+lemon+orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Mix' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='Mix' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Mix','blend:citrus+grapefruit+lemon+orange',tier,position from "tierListItem" where brand='Mix' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='Mix' and flavor='grapefruit';
update "drinkLog" set brand='Mix', flavor='blend:citrus+grapefruit+lemon+orange' where brand='Mix' and flavor='grapefruit';

-- My: original -> My Element: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='My' and a.flavor='original' and b.brand='My Element' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='My Element', flavor='original' where brand='My' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'My Element','original',"createdAt" from favorite where brand='My' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'My Element','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='My' and flavor='original' on conflict do nothing;
delete from favorite where brand='My' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'My Element','original',tier,position from "tierListItem" where brand='My' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='My' and flavor='original';
update "drinkLog" set brand='My Element', flavor='original' where brand='My' and flavor='original';

-- My: bubblegum -> My Element: bubblegum
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='My' and a.flavor='bubblegum' and b.brand='My Element' and b.flavor='bubblegum') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='My Element', flavor='bubblegum' where brand='My' and flavor='bubblegum';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'My Element','bubblegum',"createdAt" from favorite where brand='My' and flavor='bubblegum' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'My Element','bubblegum',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='My' and flavor='bubblegum' on conflict do nothing;
delete from favorite where brand='My' and flavor='bubblegum';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'My Element','bubblegum',tier,position from "tierListItem" where brand='My' and flavor='bubblegum' on conflict do nothing;
delete from "tierListItem" where brand='My' and flavor='bubblegum';
update "drinkLog" set brand='My Element', flavor='bubblegum' where brand='My' and flavor='bubblegum';

-- Adrenaline: pineapple -> Adrenaline Rush: blend:pineapple+pomelo
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline' and a.flavor='pineapple' and b.brand='Adrenaline Rush' and b.flavor='blend:pineapple+pomelo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='blend:pineapple+pomelo' where brand='Adrenaline' and flavor='pineapple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','blend:pineapple+pomelo',"createdAt" from favorite where brand='Adrenaline' and flavor='pineapple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','blend:pineapple+pomelo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline' and flavor='pineapple' on conflict do nothing;
delete from favorite where brand='Adrenaline' and flavor='pineapple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','blend:pineapple+pomelo',tier,position from "tierListItem" where brand='Adrenaline' and flavor='pineapple' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline' and flavor='pineapple';
update "drinkLog" set brand='Adrenaline Rush', flavor='blend:pineapple+pomelo' where brand='Adrenaline' and flavor='pineapple';

-- Adrenaline: lime -> Adrenaline Rush: lime
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline' and a.flavor='lime' and b.brand='Adrenaline Rush' and b.flavor='lime') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='lime' where brand='Adrenaline' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','lime',"createdAt" from favorite where brand='Adrenaline' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','lime',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline' and flavor='lime' on conflict do nothing;
delete from favorite where brand='Adrenaline' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','lime',tier,position from "tierListItem" where brand='Adrenaline' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline' and flavor='lime';
update "drinkLog" set brand='Adrenaline Rush', flavor='lime' where brand='Adrenaline' and flavor='lime';

-- Adrenaline Game Fuel: original -> Adrenaline Rush: game_fuel
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Game Fuel' and a.flavor='original' and b.brand='Adrenaline Rush' and b.flavor='game_fuel') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='game_fuel' where brand='Adrenaline Game Fuel' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','game_fuel',"createdAt" from favorite where brand='Adrenaline Game Fuel' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','game_fuel',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Game Fuel' and flavor='original' on conflict do nothing;
delete from favorite where brand='Adrenaline Game Fuel' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','game_fuel',tier,position from "tierListItem" where brand='Adrenaline Game Fuel' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Game Fuel' and flavor='original';
update "drinkLog" set brand='Adrenaline Rush', flavor='game_fuel' where brand='Adrenaline Game Fuel' and flavor='original';

-- Green: original -> Red Bull: dragonfruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Green' and a.flavor='original' and b.brand='Red Bull' and b.flavor='dragonfruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='dragonfruit' where brand='Green' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','dragonfruit',"createdAt" from favorite where brand='Green' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','dragonfruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Green' and flavor='original' on conflict do nothing;
delete from favorite where brand='Green' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','dragonfruit',tier,position from "tierListItem" where brand='Green' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Green' and flavor='original';
update "drinkLog" set brand='Red Bull', flavor='dragonfruit' where brand='Green' and flavor='original';

-- BY: tropical -> Doma By Guf: tropical
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='BY' and a.flavor='tropical' and b.brand='Doma By Guf' and b.flavor='tropical') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Doma By Guf', flavor='tropical' where brand='BY' and flavor='tropical';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Doma By Guf','tropical',"createdAt" from favorite where brand='BY' and flavor='tropical' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Doma By Guf','tropical',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='BY' and flavor='tropical' on conflict do nothing;
delete from favorite where brand='BY' and flavor='tropical';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Doma By Guf','tropical',tier,position from "tierListItem" where brand='BY' and flavor='tropical' on conflict do nothing;
delete from "tierListItem" where brand='BY' and flavor='tropical';
update "drinkLog" set brand='Doma By Guf', flavor='tropical' where brand='BY' and flavor='tropical';

-- BY: peach -> Doma By Guf: peach
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='BY' and a.flavor='peach' and b.brand='Doma By Guf' and b.flavor='peach') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Doma By Guf', flavor='peach' where brand='BY' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Doma By Guf','peach',"createdAt" from favorite where brand='BY' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Doma By Guf','peach',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='BY' and flavor='peach' on conflict do nothing;
delete from favorite where brand='BY' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Doma By Guf','peach',tier,position from "tierListItem" where brand='BY' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='BY' and flavor='peach';
update "drinkLog" set brand='Doma By Guf', flavor='peach' where brand='BY' and flavor='peach';

-- BY: original -> Doma By Guf: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='BY' and a.flavor='original' and b.brand='Doma By Guf' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Doma By Guf', flavor='original' where brand='BY' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Doma By Guf','original',"createdAt" from favorite where brand='BY' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Doma By Guf','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='BY' and flavor='original' on conflict do nothing;
delete from favorite where brand='BY' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Doma By Guf','original',tier,position from "tierListItem" where brand='BY' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='BY' and flavor='original';
update "drinkLog" set brand='Doma By Guf', flavor='original' where brand='BY' and flavor='original';

-- White: original -> White Shark: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='White' and a.flavor='original' and b.brand='White Shark' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='White Shark', flavor='original' where brand='White' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'White Shark','original',"createdAt" from favorite where brand='White' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'White Shark','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='White' and flavor='original' on conflict do nothing;
delete from favorite where brand='White' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'White Shark','original',tier,position from "tierListItem" where brand='White' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='White' and flavor='original';
update "drinkLog" set brand='White Shark', flavor='original' where brand='White' and flavor='original';

-- Energy: cherry -> Ashkudi: cherry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Energy' and a.flavor='cherry' and b.brand='Ashkudi' and b.flavor='cherry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Ashkudi', flavor='cherry' where brand='Energy' and flavor='cherry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Ashkudi','cherry',"createdAt" from favorite where brand='Energy' and flavor='cherry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Ashkudi','cherry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Energy' and flavor='cherry' on conflict do nothing;
delete from favorite where brand='Energy' and flavor='cherry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Ashkudi','cherry',tier,position from "tierListItem" where brand='Energy' and flavor='cherry' on conflict do nothing;
delete from "tierListItem" where brand='Energy' and flavor='cherry';
update "drinkLog" set brand='Ashkudi', flavor='cherry' where brand='Energy' and flavor='cherry';

-- Energy: grape -> Ashkudi: grape
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Energy' and a.flavor='grape' and b.brand='Ashkudi' and b.flavor='grape') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Ashkudi', flavor='grape' where brand='Energy' and flavor='grape';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Ashkudi','grape',"createdAt" from favorite where brand='Energy' and flavor='grape' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Ashkudi','grape',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Energy' and flavor='grape' on conflict do nothing;
delete from favorite where brand='Energy' and flavor='grape';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Ashkudi','grape',tier,position from "tierListItem" where brand='Energy' and flavor='grape' on conflict do nothing;
delete from "tierListItem" where brand='Energy' and flavor='grape';
update "drinkLog" set brand='Ashkudi', flavor='grape' where brand='Energy' and flavor='grape';

-- Max: original -> Tornado: tornado_berrycream
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Max' and a.flavor='original' and b.brand='Tornado' and b.flavor='tornado_berrycream') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Tornado', flavor='tornado_berrycream' where brand='Max' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Tornado','tornado_berrycream',"createdAt" from favorite where brand='Max' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Tornado','tornado_berrycream',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Max' and flavor='original' on conflict do nothing;
delete from favorite where brand='Max' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Tornado','tornado_berrycream',tier,position from "tierListItem" where brand='Max' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Max' and flavor='original';
update "drinkLog" set brand='Tornado', flavor='tornado_berrycream' where brand='Max' and flavor='original';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
