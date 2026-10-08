-- migrate.mjs runs this migration in one transaction.

lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;
-- Stop rather than discard either review if someone reviewed multiple aliases.
do $$
begin
  if exists (
    select 1 from review
    where brand = 'Volt Energy' and flavor in ('blueberry', 'blend:blueberry+pomegranate')
    group by "userId" having count(*) > 1
  ) then
    raise exception 'Volt Energy alias merge: multiple reviews from one user; resolve manually without losing review text before retrying';
  end if;
end $$;

update review set flavor = 'blend:blueberry+pomegranate'
where brand = 'Volt Energy' and flavor in ('blueberry');

insert into favorite ("userId", brand, flavor, "createdAt")
select "userId", brand, 'blend:blueberry+pomegranate', min("createdAt")
from favorite where brand = 'Volt Energy' and flavor in ('blueberry')
group by "userId", brand
on conflict do nothing;

insert into "favoritePriceWatch" ("userId", brand, flavor, city, volume, price, "snapshotAt")
select distinct on ("userId", city, volume)
  "userId", brand, 'blend:blueberry+pomegranate', city, volume, price, "snapshotAt"
from "favoritePriceWatch"
where brand = 'Volt Energy' and flavor in ('blueberry')
order by "userId", city, volume, "snapshotAt" desc, flavor
on conflict do nothing;

delete from favorite where brand = 'Volt Energy' and flavor in ('blueberry');

-- Keep an existing canonical placement; otherwise keep the earliest position.
insert into "tierListItem" ("tierListId", brand, flavor, tier, position)
select distinct on ("tierListId")
  "tierListId", brand, 'blend:blueberry+pomegranate', tier, position
from "tierListItem"
where brand = 'Volt Energy' and flavor in ('blueberry')
order by "tierListId", tier, position, flavor
on conflict do nothing;

delete from "tierListItem" where brand = 'Volt Energy' and flavor in ('blueberry');

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;

