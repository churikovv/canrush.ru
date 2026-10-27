-- When the site first saw each catalog identity (brand + flavor), for «Новинки». Parser files carry no dates, so the
-- site records them itself; rows of the very first sync are the baseline (already known, not novelties).
create table "catalogFirstSeen" (
  brand text not null,
  flavor text not null,
  "firstSeenAt" timestamptz not null default now(),
  baseline boolean not null default false,
  primary key (brand, flavor)
);

create index catalog_first_seen_recent on "catalogFirstSeen"("firstSeenAt" desc) where not baseline;
