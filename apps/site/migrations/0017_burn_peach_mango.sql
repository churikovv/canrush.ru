-- migrate.mjs runs this migration in one transaction.
lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;
-- Stop rather than discard either review if someone reviewed multiple aliases.
do $$
begin
  if exists (
    select 1 from review
    where brand = 'Burn' and flavor in ('blend:mango+peach', 'peach:sugarfree', 'blend:mango+peach:sugarfree')
    group by "userId" having count(*) > 1
  ) then
    raise exception 'Burn alias merge: multiple reviews from one user; resolve manually without losing review text before retrying';
  end if;
end $$;

update review set flavor = 'blend:mango+peach:sugarfree'
where brand = 'Burn' and flavor in ('blend:mango+peach', 'peach:sugarfree');

insert into favorite ("userId", brand, flavor, "createdAt")
select "userId", brand, 'blend:mango+peach:sugarfree', min("createdAt")
from favorite where brand = 'Burn' and flavor in ('blend:mango+peach', 'peach:sugarfree')
group by "userId", brand
on conflict do nothing;

insert into "favoritePriceWatch" ("userId", brand, flavor, city, volume, price, "snapshotAt")
select distinct on ("userId", city, volume)
  "userId", brand, 'blend:mango+peach:sugarfree', city, volume, price, "snapshotAt"
from "favoritePriceWatch"
where brand = 'Burn' and flavor in ('blend:mango+peach', 'peach:sugarfree')
order by "userId", city, volume, "snapshotAt" desc, flavor
on conflict do nothing;

delete from favorite where brand = 'Burn' and flavor in ('blend:mango+peach', 'peach:sugarfree');

-- Keep an existing canonical placement; otherwise keep the earliest position.
insert into "tierListItem" ("tierListId", brand, flavor, tier, position)
select distinct on ("tierListId")
  "tierListId", brand, 'blend:mango+peach:sugarfree', tier, position
from "tierListItem"
where brand = 'Burn' and flavor in ('blend:mango+peach', 'peach:sugarfree')
order by "tierListId", tier, position, flavor
on conflict do nothing;

delete from "tierListItem" where brand = 'Burn' and flavor in ('blend:mango+peach', 'peach:sugarfree');

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
