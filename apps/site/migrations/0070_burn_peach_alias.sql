-- Burn "Персик" is an archived identity whose cover is the Peach Mango Zero Sugar 449 ml can: there is no plain Burn peach.
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Burn: peach -> Burn: blend:mango+peach:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Burn' and a.flavor='peach' and b.brand='Burn' and b.flavor='blend:mango+peach:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Burn', flavor='blend:mango+peach:sugarfree' where brand='Burn' and flavor='peach';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Burn','blend:mango+peach:sugarfree',"createdAt" from favorite where brand='Burn' and flavor='peach' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Burn','blend:mango+peach:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Burn' and flavor='peach' on conflict do nothing;
delete from favorite where brand='Burn' and flavor='peach';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Burn','blend:mango+peach:sugarfree',tier,position from "tierListItem" where brand='Burn' and flavor='peach' on conflict do nothing;
delete from "tierListItem" where brand='Burn' and flavor='peach';
update "drinkLog" set brand='Burn', flavor='blend:mango+peach:sugarfree' where brand='Burn' and flavor='peach';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
