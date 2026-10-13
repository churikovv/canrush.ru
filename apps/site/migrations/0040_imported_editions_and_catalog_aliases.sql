lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Red Bull: unresolved:029f4aa3f454b6d2504f7e19
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:029f4aa3f454b6d2504f7e19' and b.brand='Red Bull' and b.flavor='redbull_fruit_mix') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='redbull_fruit_mix' where brand='Red Bull' and flavor='unresolved:029f4aa3f454b6d2504f7e19';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','redbull_fruit_mix',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:029f4aa3f454b6d2504f7e19' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','redbull_fruit_mix',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:029f4aa3f454b6d2504f7e19' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:029f4aa3f454b6d2504f7e19';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','redbull_fruit_mix',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:029f4aa3f454b6d2504f7e19' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:029f4aa3f454b6d2504f7e19';

-- Red Bull: unresolved:b1e3a0f4d0b92c7c91553f3e
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:b1e3a0f4d0b92c7c91553f3e' and b.brand='Red Bull' and b.flavor='redbull_krating_daeng') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='redbull_krating_daeng' where brand='Red Bull' and flavor='unresolved:b1e3a0f4d0b92c7c91553f3e';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','redbull_krating_daeng',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:b1e3a0f4d0b92c7c91553f3e' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','redbull_krating_daeng',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:b1e3a0f4d0b92c7c91553f3e' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:b1e3a0f4d0b92c7c91553f3e';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','redbull_krating_daeng',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:b1e3a0f4d0b92c7c91553f3e' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:b1e3a0f4d0b92c7c91553f3e';

-- Red Bull: unresolved:131fdbe09dfd5551820a2296
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:131fdbe09dfd5551820a2296' and b.brand='Red Bull' and b.flavor='redbull_krating_daeng_extra_zinc') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='redbull_krating_daeng_extra_zinc' where brand='Red Bull' and flavor='unresolved:131fdbe09dfd5551820a2296';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','redbull_krating_daeng_extra_zinc',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:131fdbe09dfd5551820a2296' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','redbull_krating_daeng_extra_zinc',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:131fdbe09dfd5551820a2296' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:131fdbe09dfd5551820a2296';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','redbull_krating_daeng_extra_zinc',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:131fdbe09dfd5551820a2296' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:131fdbe09dfd5551820a2296';

-- Volt Energy: cherry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='cherry' and b.brand='Volt Energy' and b.flavor='blend:cherry+cola') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:cherry+cola' where brand='Volt Energy' and flavor='cherry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:cherry+cola',"createdAt" from favorite where brand='Volt Energy' and flavor='cherry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:cherry+cola',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='cherry' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='cherry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:cherry+cola',tier,position from "tierListItem" where brand='Volt Energy' and flavor='cherry' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='cherry';

-- Volt: peach
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='peach' and b.brand='Volt Energy' and b.flavor='peach') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='peach' where brand='Volt' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','peach',"createdAt" from favorite where brand='Volt' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','peach',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','peach',tier,position from "tierListItem" where brand='Volt' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='peach';

-- Volt: blueberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='blueberry' and b.brand='Volt Energy' and b.flavor='blend:blueberry+pomegranate') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:blueberry+pomegranate' where brand='Volt' and flavor='blueberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:blueberry+pomegranate',"createdAt" from favorite where brand='Volt' and flavor='blueberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:blueberry+pomegranate',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='blueberry' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='blueberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:blueberry+pomegranate',tier,position from "tierListItem" where brand='Volt' and flavor='blueberry' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='blueberry';

-- Volt: plum
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='plum' and b.brand='Volt Energy' and b.flavor='plum_pie') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='plum_pie' where brand='Volt' and flavor='plum';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','plum_pie',"createdAt" from favorite where brand='Volt' and flavor='plum' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','plum_pie',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='plum' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='plum';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','plum_pie',tier,position from "tierListItem" where brand='Volt' and flavor='plum' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='plum';

-- Drive Me: mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='mango' and b.brand='Drive Me' and b.flavor='blend:guava+mango:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='blend:guava+mango:sugarfree' where brand='Drive Me' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','blend:guava+mango:sugarfree',"createdAt" from favorite where brand='Drive Me' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','blend:guava+mango:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','blend:guava+mango:sugarfree',tier,position from "tierListItem" where brand='Drive Me' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='mango';

-- Drive Me: blend:guava+mango
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='blend:guava+mango' and b.brand='Drive Me' and b.flavor='blend:guava+mango:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='blend:guava+mango:sugarfree' where brand='Drive Me' and flavor='blend:guava+mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','blend:guava+mango:sugarfree',"createdAt" from favorite where brand='Drive Me' and flavor='blend:guava+mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','blend:guava+mango:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='blend:guava+mango' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='blend:guava+mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','blend:guava+mango:sugarfree',tier,position from "tierListItem" where brand='Drive Me' and flavor='blend:guava+mango' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='blend:guava+mango';

-- Drive Me: cactus
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='cactus' and b.brand='Drive Me' and b.flavor='blend:cactus+lulo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='blend:cactus+lulo' where brand='Drive Me' and flavor='cactus';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','blend:cactus+lulo',"createdAt" from favorite where brand='Drive Me' and flavor='cactus' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','blend:cactus+lulo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='cactus' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='cactus';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','blend:cactus+lulo',tier,position from "tierListItem" where brand='Drive Me' and flavor='cactus' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='cactus';

-- Drive Me: drive_exotic
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='drive_exotic' and b.brand='Drive Me' and b.flavor='blend:cactus+lulo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='blend:cactus+lulo' where brand='Drive Me' and flavor='drive_exotic';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','blend:cactus+lulo',"createdAt" from favorite where brand='Drive Me' and flavor='drive_exotic' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','blend:cactus+lulo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='drive_exotic' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='drive_exotic';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','blend:cactus+lulo',tier,position from "tierListItem" where brand='Drive Me' and flavor='drive_exotic' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='drive_exotic';

-- Drive Me: lime
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='lime' and b.brand='Drive Me' and b.flavor='citrus') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='citrus' where brand='Drive Me' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','citrus',"createdAt" from favorite where brand='Drive Me' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','citrus',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='lime' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','citrus',tier,position from "tierListItem" where brand='Drive Me' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='lime';

-- Drive Me: strawberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='strawberry' and b.brand='Drive Me' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='berry' where brand='Drive Me' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','berry',"createdAt" from favorite where brand='Drive Me' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','berry',tier,position from "tierListItem" where brand='Drive Me' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='strawberry';

-- Байкал: strawberry
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Байкал' and a.flavor='strawberry' and b.brand='Байкал' and b.flavor='blend:cherry+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Байкал', flavor='blend:cherry+strawberry' where brand='Байкал' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Байкал','blend:cherry+strawberry',"createdAt" from favorite where brand='Байкал' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Байкал','blend:cherry+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Байкал' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Байкал' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Байкал','blend:cherry+strawberry',tier,position from "tierListItem" where brand='Байкал' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Байкал' and flavor='strawberry';

-- Байкал: blackcurrant
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Байкал' and a.flavor='blackcurrant' and b.brand='Байкал' and b.flavor='blend:blackcurrant+raspberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Байкал', flavor='blend:blackcurrant+raspberry' where brand='Байкал' and flavor='blackcurrant';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Байкал','blend:blackcurrant+raspberry',"createdAt" from favorite where brand='Байкал' and flavor='blackcurrant' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Байкал','blend:blackcurrant+raspberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Байкал' and flavor='blackcurrant' on conflict do nothing;
delete from favorite where brand='Байкал' and flavor='blackcurrant';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Байкал','blend:blackcurrant+raspberry',tier,position from "tierListItem" where brand='Байкал' and flavor='blackcurrant' on conflict do nothing;
delete from "tierListItem" where brand='Байкал' and flavor='blackcurrant';

-- Байкал: lemon
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Байкал' and a.flavor='lemon' and b.brand='Байкал' and b.flavor='blend:coffee+lemon') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Байкал', flavor='blend:coffee+lemon' where brand='Байкал' and flavor='lemon';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Байкал','blend:coffee+lemon',"createdAt" from favorite where brand='Байкал' and flavor='lemon' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Байкал','blend:coffee+lemon',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Байкал' and flavor='lemon' on conflict do nothing;
delete from favorite where brand='Байкал' and flavor='lemon';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Байкал','blend:coffee+lemon',tier,position from "tierListItem" where brand='Байкал' and flavor='lemon' on conflict do nothing;
delete from "tierListItem" where brand='Байкал' and flavor='lemon';

-- Adrenaline Rush: unresolved:5eca7c37f5d01ff9d92f9821
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='unresolved:5eca7c37f5d01ff9d92f9821' and b.brand='Adrenaline Rush' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='berry' where brand='Adrenaline Rush' and flavor='unresolved:5eca7c37f5d01ff9d92f9821';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','berry',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='unresolved:5eca7c37f5d01ff9d92f9821' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='unresolved:5eca7c37f5d01ff9d92f9821' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='unresolved:5eca7c37f5d01ff9d92f9821';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','berry',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:5eca7c37f5d01ff9d92f9821' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:5eca7c37f5d01ff9d92f9821';

-- Adrenaline Rush: unresolved:0bbe22b23378cfc5f5ad0a2c
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='unresolved:0bbe22b23378cfc5f5ad0a2c' and b.brand='Adrenaline Rush' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='berry' where brand='Adrenaline Rush' and flavor='unresolved:0bbe22b23378cfc5f5ad0a2c';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','berry',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='unresolved:0bbe22b23378cfc5f5ad0a2c' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='unresolved:0bbe22b23378cfc5f5ad0a2c' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='unresolved:0bbe22b23378cfc5f5ad0a2c';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','berry',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:0bbe22b23378cfc5f5ad0a2c' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='unresolved:0bbe22b23378cfc5f5ad0a2c';

-- Adrenaline Rush: pineapple
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='pineapple' and b.brand='Adrenaline Rush' and b.flavor='blend:pineapple+pomelo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='blend:pineapple+pomelo' where brand='Adrenaline Rush' and flavor='pineapple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','blend:pineapple+pomelo',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='pineapple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','blend:pineapple+pomelo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='pineapple' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='pineapple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','blend:pineapple+pomelo',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='pineapple' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='pineapple';

-- Adrenaline Rush: calamansi
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='calamansi' and b.brand='Adrenaline Rush' and b.flavor='blend:calamansi+strawberry+yuzu') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='blend:calamansi+strawberry+yuzu' where brand='Adrenaline Rush' and flavor='calamansi';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='calamansi' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='calamansi' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='calamansi';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','blend:calamansi+strawberry+yuzu',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='calamansi' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='calamansi';

-- Adrenaline Rush: pomegranate
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='pomegranate' and b.brand='Adrenaline Rush' and b.flavor='spicy') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='spicy' where brand='Adrenaline Rush' and flavor='pomegranate';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','spicy',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='pomegranate' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','spicy',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='pomegranate' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='pomegranate';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','spicy',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='pomegranate' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='pomegranate';

-- Adrenaline Rush: passion_fruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='passion_fruit' and b.brand='Adrenaline Rush' and b.flavor='passion_fruit:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='passion_fruit:sugarfree' where brand='Adrenaline Rush' and flavor='passion_fruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','passion_fruit:sugarfree',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='passion_fruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','passion_fruit:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='passion_fruit' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='passion_fruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','passion_fruit:sugarfree',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='passion_fruit' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='passion_fruit';

-- Adrenaline Rush: blend:mango+tropical
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='blend:mango+tropical' and b.brand='Adrenaline Rush' and b.flavor='tropical') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='tropical' where brand='Adrenaline Rush' and flavor='blend:mango+tropical';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','tropical',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='blend:mango+tropical' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','tropical',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='blend:mango+tropical' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='blend:mango+tropical';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','tropical',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='blend:mango+tropical' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='blend:mango+tropical';
alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
