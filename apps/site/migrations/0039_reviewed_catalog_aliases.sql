-- Preserve user content while consolidating verified historical identities.
lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Monster: strawberry
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='strawberry' and b.brand='Monster' and b.flavor='monster_ultra_strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='monster_ultra_strawberry' where brand='Monster' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','monster_ultra_strawberry',"createdAt" from favorite where brand='Monster' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','monster_ultra_strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','monster_ultra_strawberry',tier,position from "tierListItem" where brand='Monster' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='strawberry';

-- Monster: strawberry:sugarfree
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='strawberry:sugarfree' and b.brand='Monster' and b.flavor='monster_ultra_strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='monster_ultra_strawberry' where brand='Monster' and flavor='strawberry:sugarfree';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','monster_ultra_strawberry',"createdAt" from favorite where brand='Monster' and flavor='strawberry:sugarfree' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','monster_ultra_strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='strawberry:sugarfree' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='strawberry:sugarfree';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','monster_ultra_strawberry',tier,position from "tierListItem" where brand='Monster' and flavor='strawberry:sugarfree' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='strawberry:sugarfree';

-- Monster: orange
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='orange' and b.brand='Monster' and b.flavor='monster_nitro') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='monster_nitro' where brand='Monster' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','monster_nitro',"createdAt" from favorite where brand='Monster' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','monster_nitro',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='orange' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','monster_nitro',tier,position from "tierListItem" where brand='Monster' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='orange';

-- Volt: mint
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='mint' and b.brand='Volt Energy' and b.flavor='blend:mint+pomelo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:mint+pomelo' where brand='Volt' and flavor='mint';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:mint+pomelo',"createdAt" from favorite where brand='Volt' and flavor='mint' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:mint+pomelo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='mint' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='mint';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:mint+pomelo',tier,position from "tierListItem" where brand='Volt' and flavor='mint' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='mint';

-- Volt Energy: mint
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='mint' and b.brand='Volt Energy' and b.flavor='blend:mint+pomelo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:mint+pomelo' where brand='Volt Energy' and flavor='mint';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:mint+pomelo',"createdAt" from favorite where brand='Volt Energy' and flavor='mint' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:mint+pomelo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='mint' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='mint';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:mint+pomelo',tier,position from "tierListItem" where brand='Volt Energy' and flavor='mint' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='mint';

-- Volt: pomelo
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='pomelo' and b.brand='Volt Energy' and b.flavor='blend:mint+pomelo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:mint+pomelo' where brand='Volt' and flavor='pomelo';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:mint+pomelo',"createdAt" from favorite where brand='Volt' and flavor='pomelo' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:mint+pomelo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='pomelo' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='pomelo';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:mint+pomelo',tier,position from "tierListItem" where brand='Volt' and flavor='pomelo' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='pomelo';

-- Volt Energy: pomelo
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='pomelo' and b.brand='Volt Energy' and b.flavor='blend:mint+pomelo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:mint+pomelo' where brand='Volt Energy' and flavor='pomelo';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:mint+pomelo',"createdAt" from favorite where brand='Volt Energy' and flavor='pomelo' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:mint+pomelo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='pomelo' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='pomelo';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:mint+pomelo',tier,position from "tierListItem" where brand='Volt Energy' and flavor='pomelo' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='pomelo';

-- Volt: strawberry
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='strawberry' and b.brand='Volt Energy' and b.flavor='blend:grapefruit+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:grapefruit+strawberry' where brand='Volt' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',"createdAt" from favorite where brand='Volt' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:grapefruit+strawberry',tier,position from "tierListItem" where brand='Volt' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='strawberry';

-- Volt Energy: strawberry
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='strawberry' and b.brand='Volt Energy' and b.flavor='blend:grapefruit+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:grapefruit+strawberry' where brand='Volt Energy' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',"createdAt" from favorite where brand='Volt Energy' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:grapefruit+strawberry',tier,position from "tierListItem" where brand='Volt Energy' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='strawberry';

-- Volt: grapefruit
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='grapefruit' and b.brand='Volt Energy' and b.flavor='blend:grapefruit+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:grapefruit+strawberry' where brand='Volt' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',"createdAt" from favorite where brand='Volt' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:grapefruit+strawberry',tier,position from "tierListItem" where brand='Volt' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='grapefruit';

-- Volt Energy: grapefruit
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='grapefruit' and b.brand='Volt Energy' and b.flavor='blend:grapefruit+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:grapefruit+strawberry' where brand='Volt Energy' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',"createdAt" from favorite where brand='Volt Energy' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:grapefruit+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:grapefruit+strawberry',tier,position from "tierListItem" where brand='Volt Energy' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='grapefruit';

-- Volt: grape
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='grape' and b.brand='Volt Energy' and b.flavor='blend:grape+guava') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:grape+guava' where brand='Volt' and flavor='grape';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:grape+guava',"createdAt" from favorite where brand='Volt' and flavor='grape' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:grape+guava',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='grape' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='grape';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:grape+guava',tier,position from "tierListItem" where brand='Volt' and flavor='grape' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='grape';

-- Volt Energy: grape
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='grape' and b.brand='Volt Energy' and b.flavor='blend:grape+guava') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:grape+guava' where brand='Volt Energy' and flavor='grape';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:grape+guava',"createdAt" from favorite where brand='Volt Energy' and flavor='grape' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:grape+guava',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='grape' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='grape';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:grape+guava',tier,position from "tierListItem" where brand='Volt Energy' and flavor='grape' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='grape';

-- Volt: mango
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='mango' and b.brand='Volt Energy' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:coconut+mango' where brand='Volt' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:coconut+mango',"createdAt" from favorite where brand='Volt' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:coconut+mango',tier,position from "tierListItem" where brand='Volt' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='mango';

-- Volt Energy: coconut
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='coconut' and b.brand='Volt Energy' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:coconut+mango' where brand='Volt Energy' and flavor='coconut';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:coconut+mango',"createdAt" from favorite where brand='Volt Energy' and flavor='coconut' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='coconut' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='coconut';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:coconut+mango',tier,position from "tierListItem" where brand='Volt Energy' and flavor='coconut' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='coconut';

-- Volt Energy: lime
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='lime' and b.brand='Volt Energy' and b.flavor='blend:lime+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:lime+mango' where brand='Volt Energy' and flavor='lime';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:lime+mango',"createdAt" from favorite where brand='Volt Energy' and flavor='lime' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:lime+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='lime' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='lime';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:lime+mango',tier,position from "tierListItem" where brand='Volt Energy' and flavor='lime' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='lime';

-- Volt: original
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt' and a.flavor='original' and b.brand='Volt Energy' and b.flavor='berry_dragee') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='berry_dragee' where brand='Volt' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','berry_dragee',"createdAt" from favorite where brand='Volt' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','berry_dragee',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt' and flavor='original' on conflict do nothing;
delete from favorite where brand='Volt' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','berry_dragee',tier,position from "tierListItem" where brand='Volt' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Volt' and flavor='original';

-- Lit Energy: coconut
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='coconut' and b.brand='Lit Energy' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:coconut+mango' where brand='Lit Energy' and flavor='coconut';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:coconut+mango',"createdAt" from favorite where brand='Lit Energy' and flavor='coconut' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='coconut' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='coconut';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:coconut+mango',tier,position from "tierListItem" where brand='Lit Energy' and flavor='coconut' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='coconut';

-- Lit Energy: mango
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='mango' and b.brand='Lit Energy' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:coconut+mango' where brand='Lit Energy' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:coconut+mango',"createdAt" from favorite where brand='Lit Energy' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:coconut+mango',tier,position from "tierListItem" where brand='Lit Energy' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='mango';

-- Lit Energy: bubblegum
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='bubblegum' and b.brand='Lit Energy' and b.flavor='blend:bubblegum+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:bubblegum+strawberry' where brand='Lit Energy' and flavor='bubblegum';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',"createdAt" from favorite where brand='Lit Energy' and flavor='bubblegum' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='bubblegum' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='bubblegum';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:bubblegum+strawberry',tier,position from "tierListItem" where brand='Lit Energy' and flavor='bubblegum' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='bubblegum';

-- Lit Energy: strawberry
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='strawberry' and b.brand='Lit Energy' and b.flavor='blend:bubblegum+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:bubblegum+strawberry' where brand='Lit Energy' and flavor='strawberry';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',"createdAt" from favorite where brand='Lit Energy' and flavor='strawberry' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='strawberry' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='strawberry';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:bubblegum+strawberry',tier,position from "tierListItem" where brand='Lit Energy' and flavor='strawberry' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='strawberry';

-- Lit Energy: unresolved:f89ed28c6356c6b5a1037b4d
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='unresolved:f89ed28c6356c6b5a1037b4d' and b.brand='Lit Energy' and b.flavor='blend:bubblegum+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:bubblegum+strawberry' where brand='Lit Energy' and flavor='unresolved:f89ed28c6356c6b5a1037b4d';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',"createdAt" from favorite where brand='Lit Energy' and flavor='unresolved:f89ed28c6356c6b5a1037b4d' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='unresolved:f89ed28c6356c6b5a1037b4d' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='unresolved:f89ed28c6356c6b5a1037b4d';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:bubblegum+strawberry',tier,position from "tierListItem" where brand='Lit Energy' and flavor='unresolved:f89ed28c6356c6b5a1037b4d' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='unresolved:f89ed28c6356c6b5a1037b4d';

-- Lit Energy: unresolved:40c07468378c5c2e3d3ec6c4
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='unresolved:40c07468378c5c2e3d3ec6c4' and b.brand='Lit Energy' and b.flavor='blend:bubblegum+strawberry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:bubblegum+strawberry' where brand='Lit Energy' and flavor='unresolved:40c07468378c5c2e3d3ec6c4';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',"createdAt" from favorite where brand='Lit Energy' and flavor='unresolved:40c07468378c5c2e3d3ec6c4' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:bubblegum+strawberry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='unresolved:40c07468378c5c2e3d3ec6c4' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='unresolved:40c07468378c5c2e3d3ec6c4';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:bubblegum+strawberry',tier,position from "tierListItem" where brand='Lit Energy' and flavor='unresolved:40c07468378c5c2e3d3ec6c4' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='unresolved:40c07468378c5c2e3d3ec6c4';

-- Lit Energy: lit_turbo:sugarfree
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='lit_turbo:sugarfree' and b.brand='Lit Energy' and b.flavor='lit_turbo') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='lit_turbo' where brand='Lit Energy' and flavor='lit_turbo:sugarfree';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','lit_turbo',"createdAt" from favorite where brand='Lit Energy' and flavor='lit_turbo:sugarfree' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','lit_turbo',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='lit_turbo:sugarfree' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='lit_turbo:sugarfree';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','lit_turbo',tier,position from "tierListItem" where brand='Lit Energy' and flavor='lit_turbo:sugarfree' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='lit_turbo:sugarfree';

-- Lit Energy: peach
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Lit Energy' and a.flavor='peach' and b.brand='Lit Energy' and b.flavor='blend:mango+peach') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Lit Energy', flavor='blend:mango+peach' where brand='Lit Energy' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Lit Energy','blend:mango+peach',"createdAt" from favorite where brand='Lit Energy' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Lit Energy','blend:mango+peach',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Lit Energy' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Lit Energy' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Lit Energy','blend:mango+peach',tier,position from "tierListItem" where brand='Lit Energy' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Lit Energy' and flavor='peach';

-- Flash Up: banana
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='banana' and b.brand='Flash Up' and b.flavor='blend:banana+feijoa') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:banana+feijoa' where brand='Flash Up' and flavor='banana';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:banana+feijoa',"createdAt" from favorite where brand='Flash Up' and flavor='banana' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:banana+feijoa',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='banana' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='banana';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:banana+feijoa',tier,position from "tierListItem" where brand='Flash Up' and flavor='banana' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='banana';

-- Flash Up: feijoa
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='feijoa' and b.brand='Flash Up' and b.flavor='blend:banana+feijoa') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:banana+feijoa' where brand='Flash Up' and flavor='feijoa';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:banana+feijoa',"createdAt" from favorite where brand='Flash Up' and flavor='feijoa' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:banana+feijoa',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='feijoa' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='feijoa';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:banana+feijoa',tier,position from "tierListItem" where brand='Flash Up' and flavor='feijoa' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='feijoa';

-- Flesh: mango
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flesh' and a.flavor='mango' and b.brand='Flash Up' and b.flavor='blend:mango+pineapple') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:mango+pineapple' where brand='Flesh' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:mango+pineapple',"createdAt" from favorite where brand='Flesh' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:mango+pineapple',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flesh' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Flesh' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:mango+pineapple',tier,position from "tierListItem" where brand='Flesh' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Flesh' and flavor='mango';

-- Flesh: peach
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flesh' and a.flavor='peach' and b.brand='Flash Up' and b.flavor='blend:blueberry+peach:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:blueberry+peach:sugarfree' where brand='Flesh' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',"createdAt" from favorite where brand='Flesh' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flesh' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Flesh' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:blueberry+peach:sugarfree',tier,position from "tierListItem" where brand='Flesh' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Flesh' and flavor='peach';

-- Flash Up: peach
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='peach' and b.brand='Flash Up' and b.flavor='blend:blueberry+peach:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:blueberry+peach:sugarfree' where brand='Flash Up' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',"createdAt" from favorite where brand='Flash Up' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:blueberry+peach:sugarfree',tier,position from "tierListItem" where brand='Flash Up' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='peach';

-- Flash Up: peach:sugarfree
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='peach:sugarfree' and b.brand='Flash Up' and b.flavor='blend:blueberry+peach:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blend:blueberry+peach:sugarfree' where brand='Flash Up' and flavor='peach:sugarfree';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',"createdAt" from favorite where brand='Flash Up' and flavor='peach:sugarfree' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blend:blueberry+peach:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='peach:sugarfree' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='peach:sugarfree';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blend:blueberry+peach:sugarfree',tier,position from "tierListItem" where brand='Flash Up' and flavor='peach:sugarfree' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='peach:sugarfree';

-- Flash Up: unresolved:f13c38bd33a9f9a227039acb
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='unresolved:f13c38bd33a9f9a227039acb' and b.brand='Flash Up' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='original' where brand='Flash Up' and flavor='unresolved:f13c38bd33a9f9a227039acb';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','original',"createdAt" from favorite where brand='Flash Up' and flavor='unresolved:f13c38bd33a9f9a227039acb' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='unresolved:f13c38bd33a9f9a227039acb' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='unresolved:f13c38bd33a9f9a227039acb';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','original',tier,position from "tierListItem" where brand='Flash Up' and flavor='unresolved:f13c38bd33a9f9a227039acb' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='unresolved:f13c38bd33a9f9a227039acb';

-- Flash Up: unresolved:6ebe4d3de09d180a6b47fb95
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='unresolved:6ebe4d3de09d180a6b47fb95' and b.brand='Flash Up' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='original' where brand='Flash Up' and flavor='unresolved:6ebe4d3de09d180a6b47fb95';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','original',"createdAt" from favorite where brand='Flash Up' and flavor='unresolved:6ebe4d3de09d180a6b47fb95' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='unresolved:6ebe4d3de09d180a6b47fb95' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='unresolved:6ebe4d3de09d180a6b47fb95';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','original',tier,position from "tierListItem" where brand='Flash Up' and flavor='unresolved:6ebe4d3de09d180a6b47fb95' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='unresolved:6ebe4d3de09d180a6b47fb95';

-- Flash Up: unresolved:2279ecdd4b8973ce10e794ab
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Flash Up' and a.flavor='unresolved:2279ecdd4b8973ce10e794ab' and b.brand='Flash Up' and b.flavor='blueberry_donut') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Flash Up', flavor='blueberry_donut' where brand='Flash Up' and flavor='unresolved:2279ecdd4b8973ce10e794ab';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Flash Up','blueberry_donut',"createdAt" from favorite where brand='Flash Up' and flavor='unresolved:2279ecdd4b8973ce10e794ab' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Flash Up','blueberry_donut',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Flash Up' and flavor='unresolved:2279ecdd4b8973ce10e794ab' on conflict do nothing;
delete from favorite where brand='Flash Up' and flavor='unresolved:2279ecdd4b8973ce10e794ab';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Flash Up','blueberry_donut',tier,position from "tierListItem" where brand='Flash Up' and flavor='unresolved:2279ecdd4b8973ce10e794ab' on conflict do nothing;
delete from "tierListItem" where brand='Flash Up' and flavor='unresolved:2279ecdd4b8973ce10e794ab';

-- Red Bull: unresolved:56309029a553e29e3d9c64d1
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:56309029a553e29e3d9c64d1' and b.brand='Red Bull' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='original' where brand='Red Bull' and flavor='unresolved:56309029a553e29e3d9c64d1';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','original',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:56309029a553e29e3d9c64d1' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:56309029a553e29e3d9c64d1' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:56309029a553e29e3d9c64d1';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','original',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:56309029a553e29e3d9c64d1' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:56309029a553e29e3d9c64d1';

-- Red Bull: unresolved:8f903599828ec7c4ba5c7c9e
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:8f903599828ec7c4ba5c7c9e' and b.brand='Red Bull' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='original' where brand='Red Bull' and flavor='unresolved:8f903599828ec7c4ba5c7c9e';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','original',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:8f903599828ec7c4ba5c7c9e' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:8f903599828ec7c4ba5c7c9e' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:8f903599828ec7c4ba5c7c9e';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','original',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:8f903599828ec7c4ba5c7c9e' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:8f903599828ec7c4ba5c7c9e';

-- Red Bull: unresolved:75d6da7139783d6fcad07b6c
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:75d6da7139783d6fcad07b6c' and b.brand='Red Bull' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='original' where brand='Red Bull' and flavor='unresolved:75d6da7139783d6fcad07b6c';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','original',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:75d6da7139783d6fcad07b6c' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:75d6da7139783d6fcad07b6c' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:75d6da7139783d6fcad07b6c';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','original',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:75d6da7139783d6fcad07b6c' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:75d6da7139783d6fcad07b6c';

-- Red Bull: unresolved:a7c07eb567bdeffecaa674c1
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:a7c07eb567bdeffecaa674c1' and b.brand='Red Bull' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='original' where brand='Red Bull' and flavor='unresolved:a7c07eb567bdeffecaa674c1';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','original',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:a7c07eb567bdeffecaa674c1' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:a7c07eb567bdeffecaa674c1' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:a7c07eb567bdeffecaa674c1';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','original',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:a7c07eb567bdeffecaa674c1' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:a7c07eb567bdeffecaa674c1';

-- Red Bull: unresolved:50d33a1efcb146f5a2ed66af
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:50d33a1efcb146f5a2ed66af' and b.brand='Red Bull' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='original' where brand='Red Bull' and flavor='unresolved:50d33a1efcb146f5a2ed66af';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','original',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:50d33a1efcb146f5a2ed66af' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:50d33a1efcb146f5a2ed66af' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:50d33a1efcb146f5a2ed66af';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','original',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:50d33a1efcb146f5a2ed66af' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:50d33a1efcb146f5a2ed66af';

-- Red Bull: unresolved:386f0d7bb336e65555044ddd
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:386f0d7bb336e65555044ddd' and b.brand='Red Bull' and b.flavor='sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='sugarfree' where brand='Red Bull' and flavor='unresolved:386f0d7bb336e65555044ddd';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','sugarfree',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:386f0d7bb336e65555044ddd' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:386f0d7bb336e65555044ddd' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:386f0d7bb336e65555044ddd';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','sugarfree',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:386f0d7bb336e65555044ddd' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:386f0d7bb336e65555044ddd';

-- Red Bull: unresolved:fb3c91b19ef226609d8a37b1
do $$ begin
if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='unresolved:fb3c91b19ef226609d8a37b1' and b.brand='Red Bull' and b.flavor='sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='sugarfree' where brand='Red Bull' and flavor='unresolved:fb3c91b19ef226609d8a37b1';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','sugarfree',"createdAt" from favorite where brand='Red Bull' and flavor='unresolved:fb3c91b19ef226609d8a37b1' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='unresolved:fb3c91b19ef226609d8a37b1' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='unresolved:fb3c91b19ef226609d8a37b1';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','sugarfree',tier,position from "tierListItem" where brand='Red Bull' and flavor='unresolved:fb3c91b19ef226609d8a37b1' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='unresolved:fb3c91b19ef226609d8a37b1';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
