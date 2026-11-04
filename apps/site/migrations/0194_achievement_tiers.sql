-- Achievement tiers (I → II → III, `tiers` in profile-achievements.ts): the highest one reached is kept with the earned
-- tag. Rows written without it (week tags, older builds) are tier I. Tiers never go down, like the tags themselves.
alter table "profileAchievement" add column tier smallint not null default 1 check (tier between 1 and 3);
