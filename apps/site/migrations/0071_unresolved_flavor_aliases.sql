-- Unresolved flavors verified by retailer title and photo; the same pairs are in REVIEWED_PRODUCT_ALIASES.
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Adrenaline Rush: unresolved:788ec3c0fa3f02185b46d9d2 -> Adrenaline Rush: mystery
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='unresolved:788ec3c0fa3f02185b46d9d2' and b.brand='Adrenaline Rush' and b.flavor='mystery') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='mystery' where brand='Adrenaline Rush' and flavor='unresolved:788ec3c0fa3f02185b46d9d2';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','mystery',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='unresolved:788ec3c0fa3f02185b46d9d2' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','mystery',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='unresolved:788ec3c0fa3f02185b46d9d2' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='unresolved:788ec3c0fa3f02185b46d9d2';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','mystery',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:788ec3c0fa3f02185b46d9d2' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:788ec3c0fa3f02185b46d9d2';
update "drinkLog" set brand='Adrenaline Rush', flavor='mystery' where brand='Adrenaline Rush' and flavor='unresolved:788ec3c0fa3f02185b46d9d2';

-- Adrenaline Rush: unresolved:51389a77e8bb7f6f1fd3e3d7 -> Adrenaline Rush: mystery
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='unresolved:51389a77e8bb7f6f1fd3e3d7' and b.brand='Adrenaline Rush' and b.flavor='mystery') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='mystery' where brand='Adrenaline Rush' and flavor='unresolved:51389a77e8bb7f6f1fd3e3d7';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','mystery',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='unresolved:51389a77e8bb7f6f1fd3e3d7' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','mystery',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='unresolved:51389a77e8bb7f6f1fd3e3d7' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='unresolved:51389a77e8bb7f6f1fd3e3d7';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','mystery',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:51389a77e8bb7f6f1fd3e3d7' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:51389a77e8bb7f6f1fd3e3d7';
update "drinkLog" set brand='Adrenaline Rush', flavor='mystery' where brand='Adrenaline Rush' and flavor='unresolved:51389a77e8bb7f6f1fd3e3d7';

-- BOMBBAR: unresolved:cfa54864d41bcfc651f9417b -> BOMBBAR: gin_tonic:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='BOMBBAR' and a.flavor='unresolved:cfa54864d41bcfc651f9417b' and b.brand='BOMBBAR' and b.flavor='gin_tonic:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='BOMBBAR', flavor='gin_tonic:sugarfree' where brand='BOMBBAR' and flavor='unresolved:cfa54864d41bcfc651f9417b';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'BOMBBAR','gin_tonic:sugarfree',"createdAt" from favorite where brand='BOMBBAR' and flavor='unresolved:cfa54864d41bcfc651f9417b' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'BOMBBAR','gin_tonic:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='BOMBBAR' and flavor='unresolved:cfa54864d41bcfc651f9417b' on conflict do nothing;
delete from favorite where brand='BOMBBAR' and flavor='unresolved:cfa54864d41bcfc651f9417b';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'BOMBBAR','gin_tonic:sugarfree',tier,position from "tierListItem" where brand='BOMBBAR' and flavor='unresolved:cfa54864d41bcfc651f9417b' on conflict do nothing;
delete from "tierListItem" where brand='BOMBBAR' and flavor='unresolved:cfa54864d41bcfc651f9417b';
update "drinkLog" set brand='BOMBBAR', flavor='gin_tonic:sugarfree' where brand='BOMBBAR' and flavor='unresolved:cfa54864d41bcfc651f9417b';

-- Tornado: unresolved:4d34814885aeed76ebbe4c33 -> Tornado: tornado_boost
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Tornado' and a.flavor='unresolved:4d34814885aeed76ebbe4c33' and b.brand='Tornado' and b.flavor='tornado_boost') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Tornado', flavor='tornado_boost' where brand='Tornado' and flavor='unresolved:4d34814885aeed76ebbe4c33';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Tornado','tornado_boost',"createdAt" from favorite where brand='Tornado' and flavor='unresolved:4d34814885aeed76ebbe4c33' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Tornado','tornado_boost',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Tornado' and flavor='unresolved:4d34814885aeed76ebbe4c33' on conflict do nothing;
delete from favorite where brand='Tornado' and flavor='unresolved:4d34814885aeed76ebbe4c33';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Tornado','tornado_boost',tier,position from "tierListItem" where brand='Tornado' and flavor='unresolved:4d34814885aeed76ebbe4c33' on conflict do nothing;
delete from "tierListItem" where brand='Tornado' and flavor='unresolved:4d34814885aeed76ebbe4c33';
update "drinkLog" set brand='Tornado', flavor='tornado_boost' where brand='Tornado' and flavor='unresolved:4d34814885aeed76ebbe4c33';

-- X-Turbo: unresolved:210223d3b2fa9c0cc7b69564 -> X-Turbo: blend:berry+raspberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='X-Turbo' and a.flavor='unresolved:210223d3b2fa9c0cc7b69564' and b.brand='X-Turbo' and b.flavor='blend:berry+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='X-Turbo', flavor='blend:berry+raspberry' where brand='X-Turbo' and flavor='unresolved:210223d3b2fa9c0cc7b69564';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'X-Turbo','blend:berry+raspberry',"createdAt" from favorite where brand='X-Turbo' and flavor='unresolved:210223d3b2fa9c0cc7b69564' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'X-Turbo','blend:berry+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='X-Turbo' and flavor='unresolved:210223d3b2fa9c0cc7b69564' on conflict do nothing;
delete from favorite where brand='X-Turbo' and flavor='unresolved:210223d3b2fa9c0cc7b69564';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'X-Turbo','blend:berry+raspberry',tier,position from "tierListItem" where brand='X-Turbo' and flavor='unresolved:210223d3b2fa9c0cc7b69564' on conflict do nothing;
delete from "tierListItem" where brand='X-Turbo' and flavor='unresolved:210223d3b2fa9c0cc7b69564';
update "drinkLog" set brand='X-Turbo', flavor='blend:berry+raspberry' where brand='X-Turbo' and flavor='unresolved:210223d3b2fa9c0cc7b69564';

-- Красная птица АШАН: unresolved:9a6ed4c919a0e7a38a8b714d -> Красная птица АШАН: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Красная птица АШАН' and a.flavor='unresolved:9a6ed4c919a0e7a38a8b714d' and b.brand='Красная птица АШАН' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Красная птица АШАН', flavor='original' where brand='Красная птица АШАН' and flavor='unresolved:9a6ed4c919a0e7a38a8b714d';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Красная птица АШАН','original',"createdAt" from favorite where brand='Красная птица АШАН' and flavor='unresolved:9a6ed4c919a0e7a38a8b714d' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Красная птица АШАН','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Красная птица АШАН' and flavor='unresolved:9a6ed4c919a0e7a38a8b714d' on conflict do nothing;
delete from favorite where brand='Красная птица АШАН' and flavor='unresolved:9a6ed4c919a0e7a38a8b714d';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Красная птица АШАН','original',tier,position from "tierListItem" where brand='Красная птица АШАН' and flavor='unresolved:9a6ed4c919a0e7a38a8b714d' on conflict do nothing;
delete from "tierListItem" where brand='Красная птица АШАН' and flavor='unresolved:9a6ed4c919a0e7a38a8b714d';
update "drinkLog" set brand='Красная птица АШАН', flavor='original' where brand='Красная птица АШАН' and flavor='unresolved:9a6ed4c919a0e7a38a8b714d';

-- Red Bull: unresolved:8688970ebadb429a9212a309 -> Red Bull: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:8688970ebadb429a9212a309' and b.brand='Red Bull' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='original' where brand='Red Bull' and flavor='unresolved:8688970ebadb429a9212a309';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','original',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:8688970ebadb429a9212a309' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:8688970ebadb429a9212a309' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:8688970ebadb429a9212a309';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','original',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:8688970ebadb429a9212a309' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:8688970ebadb429a9212a309';
update "drinkLog" set brand='Red Bull', flavor='original' where brand='Red Bull' and flavor='unresolved:8688970ebadb429a9212a309';

-- My Element: unresolved:e45481e1e9fd04a090e3575a -> My Element: cotton_candy
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='My Element' and a.flavor='unresolved:e45481e1e9fd04a090e3575a' and b.brand='My Element' and b.flavor='cotton_candy') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='My Element', flavor='cotton_candy' where brand='My Element' and flavor='unresolved:e45481e1e9fd04a090e3575a';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'My Element','cotton_candy',"createdAt" from favorite where brand='My Element' and flavor='unresolved:e45481e1e9fd04a090e3575a' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'My Element','cotton_candy',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='My Element' and flavor='unresolved:e45481e1e9fd04a090e3575a' on conflict do nothing;
delete from favorite where brand='My Element' and flavor='unresolved:e45481e1e9fd04a090e3575a';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'My Element','cotton_candy',tier,position from "tierListItem" where brand='My Element' and flavor='unresolved:e45481e1e9fd04a090e3575a' on conflict do nothing;
delete from "tierListItem" where brand='My Element' and flavor='unresolved:e45481e1e9fd04a090e3575a';
update "drinkLog" set brand='My Element', flavor='cotton_candy' where brand='My Element' and flavor='unresolved:e45481e1e9fd04a090e3575a';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
