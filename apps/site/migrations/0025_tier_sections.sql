-- Preserve the five rows and all placements in existing lists.
alter table "tierList" add column "tiers" text[] not null default array['S','A','B','C','D'];
alter table "tierList" add constraint "tierList_tiers_check" check (
  cardinality("tiers") between 1 and 6
  and array_ndims("tiers") = 1
  and array_position("tiers", null) is null
  and "tiers" <@ array['SS','S','A','B','C','D']::text[]
);
alter table "tierListItem" drop constraint "tierListItem_tier_check";
alter table "tierListItem" add constraint "tierListItem_tier_check" check ("tier" in ('SS','S','A','B','C','D'));
