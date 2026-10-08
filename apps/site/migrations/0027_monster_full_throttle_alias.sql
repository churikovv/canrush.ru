-- migrate.mjs runs this migration in one transaction.

lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;
-- Stop rather than discard either review if someone reviewed multiple aliases.
do $$
begin
  if exists (
    select 1 from review
    where brand = 'Monster' and flavor in ('monster_full_throttle:sugarfree', 'monster_full_throttle')
    group by "userId" having count(*) > 1
  ) then
    raise exception 'Monster alias merge: multiple reviews from one user; resolve manually without losing review text before retrying';
  end if;
end $$;

update review set flavor = 'monster_full_throttle'
where brand = 'Monster' and flavor in ('monster_full_throttle:sugarfree');

insert into favorite ("userId", brand, flavor, "createdAt")
select "userId", brand, 'monster_full_throttle', min("createdAt")
from favorite where brand = 'Monster' and flavor in ('monster_full_throttle:sugarfree')
group by "userId", brand
on conflict do nothing;

insert into "favoritePriceWatch" ("userId", brand, flavor, city, volume, price, "snapshotAt")
select distinct on ("userId", city, volume)
  "userId", brand, 'monster_full_throttle', city, volume, price, "snapshotAt"
from "favoritePriceWatch"
where brand = 'Monster' and flavor in ('monster_full_throttle:sugarfree')
order by "userId", city, volume, "snapshotAt" desc, flavor
on conflict do nothing;

delete from favorite where brand = 'Monster' and flavor in ('monster_full_throttle:sugarfree');

-- Keep an existing canonical placement; otherwise keep the earliest position.
insert into "tierListItem" ("tierListId", brand, flavor, tier, position)
select distinct on ("tierListId")
  "tierListId", brand, 'monster_full_throttle', tier, position
from "tierListItem"
where brand = 'Monster' and flavor in ('monster_full_throttle:sugarfree')
order by "tierListId", tier, position, flavor
on conflict do nothing;

delete from "tierListItem" where brand = 'Monster' and flavor in ('monster_full_throttle:sugarfree');

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;

