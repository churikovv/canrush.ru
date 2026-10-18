-- Duplicates reported by members: flyer and archived identities of live products, merged via REVIEWED_PRODUCT_ALIASES.
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Drive Me: unresolved:694eb7e1e8c49093e30aa420 -> Drive Me: original (flyer "ДРАЙВ МИ оридж")
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='unresolved:694eb7e1e8c49093e30aa420' and b.brand='Drive Me' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='original' where brand='Drive Me' and flavor='unresolved:694eb7e1e8c49093e30aa420';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','original',"createdAt" from favorite where brand='Drive Me' and flavor='unresolved:694eb7e1e8c49093e30aa420' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='unresolved:694eb7e1e8c49093e30aa420' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='unresolved:694eb7e1e8c49093e30aa420';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','original',tier,position from "tierListItem" where brand='Drive Me' and flavor='unresolved:694eb7e1e8c49093e30aa420' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='unresolved:694eb7e1e8c49093e30aa420';
update "drinkLog" set brand='Drive Me', flavor='original' where brand='Drive Me' and flavor='unresolved:694eb7e1e8c49093e30aa420';

-- Drive Me: sugarfree -> Drive Me: blend:guava+mango:sugarfree (Lavka "Drive Me манго без сахара" (guava + mango zero can))
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Drive Me' and a.flavor='sugarfree' and b.brand='Drive Me' and b.flavor='blend:guava+mango:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Drive Me', flavor='blend:guava+mango:sugarfree' where brand='Drive Me' and flavor='sugarfree';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Drive Me','blend:guava+mango:sugarfree',"createdAt" from favorite where brand='Drive Me' and flavor='sugarfree' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Drive Me','blend:guava+mango:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Drive Me' and flavor='sugarfree' on conflict do nothing;
delete from favorite where brand='Drive Me' and flavor='sugarfree';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Drive Me','blend:guava+mango:sugarfree',tier,position from "tierListItem" where brand='Drive Me' and flavor='sugarfree' on conflict do nothing;
delete from "tierListItem" where brand='Drive Me' and flavor='sugarfree';
update "drinkLog" set brand='Drive Me', flavor='blend:guava+mango:sugarfree' where brand='Drive Me' and flavor='sugarfree';

-- Volt Energy: mango -> Volt Energy: blend:coconut+mango (archived card with the coconut + mango cover)
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Volt Energy' and a.flavor='mango' and b.brand='Volt Energy' and b.flavor='blend:coconut+mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Volt Energy', flavor='blend:coconut+mango' where brand='Volt Energy' and flavor='mango';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Volt Energy','blend:coconut+mango',"createdAt" from favorite where brand='Volt Energy' and flavor='mango' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Volt Energy','blend:coconut+mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Volt Energy' and flavor='mango' on conflict do nothing;
delete from favorite where brand='Volt Energy' and flavor='mango';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Volt Energy','blend:coconut+mango',tier,position from "tierListItem" where brand='Volt Energy' and flavor='mango' on conflict do nothing;
delete from "tierListItem" where brand='Volt Energy' and flavor='mango';
update "drinkLog" set brand='Volt Energy', flavor='blend:coconut+mango' where brand='Volt Energy' and flavor='mango';

-- Adrenaline Rush: blend:lime+melon+mint:sugarfree -> Adrenaline Rush: blend:lime+melon+mint (one flyer for Juiced melon-lime-mint and Silver zero)
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Adrenaline Rush' and a.flavor='blend:lime+melon+mint:sugarfree' and b.brand='Adrenaline Rush' and b.flavor='blend:lime+melon+mint') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Adrenaline Rush', flavor='blend:lime+melon+mint' where brand='Adrenaline Rush' and flavor='blend:lime+melon+mint:sugarfree';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Adrenaline Rush','blend:lime+melon+mint',"createdAt" from favorite where brand='Adrenaline Rush' and flavor='blend:lime+melon+mint:sugarfree' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Adrenaline Rush','blend:lime+melon+mint',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Adrenaline Rush' and flavor='blend:lime+melon+mint:sugarfree' on conflict do nothing;
delete from favorite where brand='Adrenaline Rush' and flavor='blend:lime+melon+mint:sugarfree';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Adrenaline Rush','blend:lime+melon+mint',tier,position from "tierListItem" where brand='Adrenaline Rush' and flavor='blend:lime+melon+mint:sugarfree' on conflict do nothing;
delete from "tierListItem" where brand='Adrenaline Rush' and flavor='blend:lime+melon+mint:sugarfree';
update "drinkLog" set brand='Adrenaline Rush', flavor='blend:lime+melon+mint' where brand='Adrenaline Rush' and flavor='blend:lime+melon+mint:sugarfree';

-- Red Bull: citrus -> Red Bull: lime (Summer Edition "Citrus Zest" is the sudachi lime can)
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Red Bull' and a.flavor='citrus' and b.brand='Red Bull' and b.flavor='lime') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Red Bull', flavor='lime' where brand='Red Bull' and flavor='citrus';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Red Bull','lime',"createdAt" from favorite where brand='Red Bull' and flavor='citrus' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Red Bull','lime',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Red Bull' and flavor='citrus' on conflict do nothing;
delete from favorite where brand='Red Bull' and flavor='citrus';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Red Bull','lime',tier,position from "tierListItem" where brand='Red Bull' and flavor='citrus' on conflict do nothing;
delete from "tierListItem" where brand='Red Bull' and flavor='citrus';
update "drinkLog" set brand='Red Bull', flavor='lime' where brand='Red Bull' and flavor='citrus';

-- Burn: unresolved:8c920057d6960a32c56e29af -> Burn: mango (Metro flyer "BURN арт. 241868" shows the mango can)
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Burn' and a.flavor='unresolved:8c920057d6960a32c56e29af' and b.brand='Burn' and b.flavor='mango') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Burn', flavor='mango' where brand='Burn' and flavor='unresolved:8c920057d6960a32c56e29af';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Burn','mango',"createdAt" from favorite where brand='Burn' and flavor='unresolved:8c920057d6960a32c56e29af' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Burn','mango',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Burn' and flavor='unresolved:8c920057d6960a32c56e29af' on conflict do nothing;
delete from favorite where brand='Burn' and flavor='unresolved:8c920057d6960a32c56e29af';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Burn','mango',tier,position from "tierListItem" where brand='Burn' and flavor='unresolved:8c920057d6960a32c56e29af' on conflict do nothing;
delete from "tierListItem" where brand='Burn' and flavor='unresolved:8c920057d6960a32c56e29af';
update "drinkLog" set brand='Burn', flavor='mango' where brand='Burn' and flavor='unresolved:8c920057d6960a32c56e29af';

-- Rocket: unresolved:e5fcf35a0a30ae2756bac51d -> Rocket: original (Rocket Ride Vitamins, the same can as the original card)
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Rocket' and a.flavor='unresolved:e5fcf35a0a30ae2756bac51d' and b.brand='Rocket' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Rocket', flavor='original' where brand='Rocket' and flavor='unresolved:e5fcf35a0a30ae2756bac51d';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Rocket','original',"createdAt" from favorite where brand='Rocket' and flavor='unresolved:e5fcf35a0a30ae2756bac51d' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Rocket','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Rocket' and flavor='unresolved:e5fcf35a0a30ae2756bac51d' on conflict do nothing;
delete from favorite where brand='Rocket' and flavor='unresolved:e5fcf35a0a30ae2756bac51d';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Rocket','original',tier,position from "tierListItem" where brand='Rocket' and flavor='unresolved:e5fcf35a0a30ae2756bac51d' on conflict do nothing;
delete from "tierListItem" where brand='Rocket' and flavor='unresolved:e5fcf35a0a30ae2756bac51d';
update "drinkLog" set brand='Rocket', flavor='original' where brand='Rocket' and flavor='unresolved:e5fcf35a0a30ae2756bac51d';

-- Tornado: unresolved:a8dfc8f215a4a82ed09c9312 -> Tornado: tornado_lemoncake (Magnit offer of Tornado Max Energy Lemoncake)
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Tornado' and a.flavor='unresolved:a8dfc8f215a4a82ed09c9312' and b.brand='Tornado' and b.flavor='tornado_lemoncake') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Tornado', flavor='tornado_lemoncake' where brand='Tornado' and flavor='unresolved:a8dfc8f215a4a82ed09c9312';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Tornado','tornado_lemoncake',"createdAt" from favorite where brand='Tornado' and flavor='unresolved:a8dfc8f215a4a82ed09c9312' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Tornado','tornado_lemoncake',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Tornado' and flavor='unresolved:a8dfc8f215a4a82ed09c9312' on conflict do nothing;
delete from favorite where brand='Tornado' and flavor='unresolved:a8dfc8f215a4a82ed09c9312';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Tornado','tornado_lemoncake',tier,position from "tierListItem" where brand='Tornado' and flavor='unresolved:a8dfc8f215a4a82ed09c9312' on conflict do nothing;
delete from "tierListItem" where brand='Tornado' and flavor='unresolved:a8dfc8f215a4a82ed09c9312';
update "drinkLog" set brand='Tornado', flavor='tornado_lemoncake' where brand='Tornado' and flavor='unresolved:a8dfc8f215a4a82ed09c9312';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
