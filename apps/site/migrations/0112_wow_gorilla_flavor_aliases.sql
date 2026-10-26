-- Unresolved flavors checked by Edadeal title and cover (October 2026); the same pairs are in REVIEWED_PRODUCT_ALIASES.
-- «WOW Energy Burn Energy» was filed under Burn; the parser now knows the Wow brand, «buble gum» and «мохито».
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog", "drinkSwipe" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Burn: unresolved:7eb90192bec3099c1399a4b6 -> Wow: wow_burn:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Burn' and a.flavor='unresolved:7eb90192bec3099c1399a4b6' and b.brand='Wow' and b.flavor='wow_burn:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Wow', flavor='wow_burn:sugarfree' where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Wow','wow_burn:sugarfree',"createdAt" from favorite where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Wow','wow_burn:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6' on conflict do nothing;
delete from "favoritePriceWatch" where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6';
delete from favorite where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Wow','wow_burn:sugarfree',tier,position from "tierListItem" where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6' on conflict do nothing;
delete from "tierListItem" where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6';
update "drinkLog" set brand='Wow', flavor='wow_burn:sugarfree' where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6';
-- An update, not an insert: inserting a swipe would pay its XP again (swipe_experience).
update "drinkSwipe" s set brand='Wow', flavor='wow_burn:sugarfree' where s.brand='Burn' and s.flavor='unresolved:7eb90192bec3099c1399a4b6' and not exists(select 1 from "drinkSwipe" t where t."userId"=s."userId" and t.brand='Wow' and t.flavor='wow_burn:sugarfree');
delete from "drinkSwipe" where brand='Burn' and flavor='unresolved:7eb90192bec3099c1399a4b6';

-- Wow: unresolved:d31458043ac244b7adb6a16a -> Wow: bubblegum:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Wow' and a.flavor='unresolved:d31458043ac244b7adb6a16a' and b.brand='Wow' and b.flavor='bubblegum:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Wow', flavor='bubblegum:sugarfree' where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Wow','bubblegum:sugarfree',"createdAt" from favorite where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Wow','bubblegum:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a' on conflict do nothing;
delete from "favoritePriceWatch" where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a';
delete from favorite where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Wow','bubblegum:sugarfree',tier,position from "tierListItem" where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a' on conflict do nothing;
delete from "tierListItem" where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a';
update "drinkLog" set brand='Wow', flavor='bubblegum:sugarfree' where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a';
-- An update, not an insert: inserting a swipe would pay its XP again (swipe_experience).
update "drinkSwipe" s set brand='Wow', flavor='bubblegum:sugarfree' where s.brand='Wow' and s.flavor='unresolved:d31458043ac244b7adb6a16a' and not exists(select 1 from "drinkSwipe" t where t."userId"=s."userId" and t.brand='Wow' and t.flavor='bubblegum:sugarfree');
delete from "drinkSwipe" where brand='Wow' and flavor='unresolved:d31458043ac244b7adb6a16a';

-- Gorilla: unresolved:f8276697e27ba95210a91f8b -> Gorilla: mojito
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Gorilla' and a.flavor='unresolved:f8276697e27ba95210a91f8b' and b.brand='Gorilla' and b.flavor='mojito') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Gorilla', flavor='mojito' where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Gorilla','mojito',"createdAt" from favorite where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Gorilla','mojito',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b' on conflict do nothing;
delete from "favoritePriceWatch" where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b';
delete from favorite where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Gorilla','mojito',tier,position from "tierListItem" where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b' on conflict do nothing;
delete from "tierListItem" where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b';
update "drinkLog" set brand='Gorilla', flavor='mojito' where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b';
-- An update, not an insert: inserting a swipe would pay its XP again (swipe_experience).
update "drinkSwipe" s set brand='Gorilla', flavor='mojito' where s.brand='Gorilla' and s.flavor='unresolved:f8276697e27ba95210a91f8b' and not exists(select 1 from "drinkSwipe" t where t."userId"=s."userId" and t.brand='Gorilla' and t.flavor='mojito');
delete from "drinkSwipe" where brand='Gorilla' and flavor='unresolved:f8276697e27ba95210a91f8b';

alter table favorite enable trigger favorite_experience;
alter table review enable trigger review_prevent_blocked_contribution;
