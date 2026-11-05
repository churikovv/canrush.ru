-- A rank above Legend: «Миф» from level 40, open-ended — a new degree every 5 levels (Миф I — 40, II — 45, …), each
-- announced in the feed. Legend keeps its degrees from 20 every 5 levels, now four of them (20, 25, 30, 35).
-- Levels mirror LEVEL_TIERS and TOP_DEGREE_STEP in src/lib/level-tier.ts. Nobody is past level 40 yet, so no backfill.
alter table "rankUp" drop constraint "rankUp_tier_check";
alter table "rankUp" add constraint "rankUp_tier_check" check (tier in ('gold', 'platinum', 'legend', 'myth'));
alter table "rankUp" drop constraint rank_up_single_degree;
alter table "rankUp" add constraint rank_up_single_degree check (tier in ('legend', 'myth') or degree = 1);

create or replace function rank_up_step(level integer, out tier text, out degree integer) language sql immutable as $$
  select case when level >= 40 then 'myth' when level >= 20 then 'legend' when level >= 12 then 'platinum' when level >= 8 then 'gold' end,
         case when level >= 40 then (level - 40) / 5 + 1 when level >= 20 then (level - 20) / 5 + 1 when level >= 8 then 1 end
$$;
