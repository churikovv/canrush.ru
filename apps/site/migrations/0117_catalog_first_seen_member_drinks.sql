-- Members' drinks published before «Новинки» are the baseline too: hundreds were added in the first days of the
-- feature, a backlog of drinks already on sale, not novelties. Later ones are recorded by the site's sync.
insert into "catalogFirstSeen"(brand, flavor, "firstSeenAt", baseline)
select brand, flavor, coalesce("reviewedAt", "createdAt"), true from "catalogDrink" where status = 'published'
on conflict do nothing;
