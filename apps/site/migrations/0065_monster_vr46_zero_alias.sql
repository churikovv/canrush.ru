-- Monster "VR46" without "zero" in the title is the blue VR46 Zero Sugar can (The Doctor has its own identity).
lock table review, favorite, "favoritePriceWatch", "tierListItem", "drinkLog" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;

-- Monster: monster_vr46 -> Monster: monster_vr46:sugarfree
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Monster' and a.flavor='monster_vr46' and b.brand='Monster' and b.flavor='monster_vr46:sugarfree') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Monster', flavor='monster_vr46:sugarfree' where brand='Monster' and flavor='monster_vr46';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Monster','monster_vr46:sugarfree',"createdAt" from favorite where brand='Monster' and flavor='monster_vr46' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Monster','monster_vr46:sugarfree',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Monster' and flavor='monster_vr46' on conflict do nothing;
delete from favorite where brand='Monster' and flavor='monster_vr46';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Monster','monster_vr46:sugarfree',tier,position from "tierListItem" where brand='Monster' and flavor='monster_vr46' on conflict do nothing;
delete from "tierListItem" where brand='Monster' and flavor='monster_vr46';
update "drinkLog" set brand='Monster', flavor='monster_vr46:sugarfree' where brand='Monster' and flavor='monster_vr46';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
