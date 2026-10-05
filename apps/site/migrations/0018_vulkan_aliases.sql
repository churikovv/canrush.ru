-- migrate.mjs runs this migration in one transaction.
lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;
-- Stop rather than discard either review if someone reviewed multiple aliases.
do $$
begin
  if exists (
    select 1 from review
    where brand = 'Vulkan' and flavor in ('blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical', 'tropical')
    group by "userId" having count(*) > 1
  ) then
    raise exception 'Vulkan alias merge: multiple reviews from one user; resolve manually without losing review text before retrying';
  end if;
end $$;

update review set flavor = 'tropical'
where brand = 'Vulkan' and flavor in ('blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical');

insert into favorite ("userId", brand, flavor, "createdAt")
select "userId", brand, 'tropical', min("createdAt")
from favorite where brand = 'Vulkan' and flavor in ('blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical')
group by "userId", brand
on conflict do nothing;

insert into "favoritePriceWatch" ("userId", brand, flavor, city, volume, price, "snapshotAt")
select distinct on ("userId", city, volume)
  "userId", brand, 'tropical', city, volume, price, "snapshotAt"
from "favoritePriceWatch"
where brand = 'Vulkan' and flavor in ('blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical')
order by "userId", city, volume, "snapshotAt" desc, flavor
on conflict do nothing;

delete from favorite where brand = 'Vulkan' and flavor in ('blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical');

-- Keep an existing canonical placement; otherwise keep the earliest position.
insert into "tierListItem" ("tierListId", brand, flavor, tier, position)
select distinct on ("tierListId")
  "tierListId", brand, 'tropical', tier, position
from "tierListItem"
where brand = 'Vulkan' and flavor in ('blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical')
order by "tierListId", tier, position, flavor
on conflict do nothing;

delete from "tierListItem" where brand = 'Vulkan' and flavor in ('blend:mango+passion_fruit', 'blend:mango+passion_fruit+tropical');

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;

-- migrate.mjs runs this migration in one transaction.
lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;
-- Stop rather than discard either review if someone reviewed multiple aliases.
do $$
begin
  if exists (
    select 1 from review
    where brand = 'Vulkan' and flavor in ('blend:citrus+pineapple', 'citrus')
    group by "userId" having count(*) > 1
  ) then
    raise exception 'Vulkan alias merge: multiple reviews from one user; resolve manually without losing review text before retrying';
  end if;
end $$;

update review set flavor = 'citrus'
where brand = 'Vulkan' and flavor in ('blend:citrus+pineapple');

insert into favorite ("userId", brand, flavor, "createdAt")
select "userId", brand, 'citrus', min("createdAt")
from favorite where brand = 'Vulkan' and flavor in ('blend:citrus+pineapple')
group by "userId", brand
on conflict do nothing;

insert into "favoritePriceWatch" ("userId", brand, flavor, city, volume, price, "snapshotAt")
select distinct on ("userId", city, volume)
  "userId", brand, 'citrus', city, volume, price, "snapshotAt"
from "favoritePriceWatch"
where brand = 'Vulkan' and flavor in ('blend:citrus+pineapple')
order by "userId", city, volume, "snapshotAt" desc, flavor
on conflict do nothing;

delete from favorite where brand = 'Vulkan' and flavor in ('blend:citrus+pineapple');

-- Keep an existing canonical placement; otherwise keep the earliest position.
insert into "tierListItem" ("tierListId", brand, flavor, tier, position)
select distinct on ("tierListId")
  "tierListId", brand, 'citrus', tier, position
from "tierListItem"
where brand = 'Vulkan' and flavor in ('blend:citrus+pineapple')
order by "tierListId", tier, position, flavor
on conflict do nothing;

delete from "tierListItem" where brand = 'Vulkan' and flavor in ('blend:citrus+pineapple');

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;

-- migrate.mjs runs this migration in one transaction.
lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;
-- Stop rather than discard either review if someone reviewed multiple aliases.
do $$
begin
  if exists (
    select 1 from review
    where brand = 'Vulkan' and flavor in ('blend:berry+pomegranate+raspberry', 'berry')
    group by "userId" having count(*) > 1
  ) then
    raise exception 'Vulkan alias merge: multiple reviews from one user; resolve manually without losing review text before retrying';
  end if;
end $$;

update review set flavor = 'berry'
where brand = 'Vulkan' and flavor in ('blend:berry+pomegranate+raspberry');

insert into favorite ("userId", brand, flavor, "createdAt")
select "userId", brand, 'berry', min("createdAt")
from favorite where brand = 'Vulkan' and flavor in ('blend:berry+pomegranate+raspberry')
group by "userId", brand
on conflict do nothing;

insert into "favoritePriceWatch" ("userId", brand, flavor, city, volume, price, "snapshotAt")
select distinct on ("userId", city, volume)
  "userId", brand, 'berry', city, volume, price, "snapshotAt"
from "favoritePriceWatch"
where brand = 'Vulkan' and flavor in ('blend:berry+pomegranate+raspberry')
order by "userId", city, volume, "snapshotAt" desc, flavor
on conflict do nothing;

delete from favorite where brand = 'Vulkan' and flavor in ('blend:berry+pomegranate+raspberry');

-- Keep an existing canonical placement; otherwise keep the earliest position.
insert into "tierListItem" ("tierListId", brand, flavor, tier, position)
select distinct on ("tierListId")
  "tierListId", brand, 'berry', tier, position
from "tierListItem"
where brand = 'Vulkan' and flavor in ('blend:berry+pomegranate+raspberry')
order by "tierListId", tier, position, flavor
on conflict do nothing;

delete from "tierListItem" where brand = 'Vulkan' and flavor in ('blend:berry+pomegranate+raspberry');

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
