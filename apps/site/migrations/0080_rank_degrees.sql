-- Rank degrees: Legend is open-ended and announces a new degree every 5 levels (Легенда I — 20, II — 25, …),
-- so a member now reaches Legend more than once. Gold and platinum are still announced once, at degree 1.
-- Levels mirror LEVEL_TIERS and LEGEND_DEGREE_STEP in src/lib/level-tier.ts.
alter table "rankUp" add column degree integer not null default 1 check (degree >= 1);
alter table "rankUp" drop constraint "rankUp_userId_tier_key";
alter table "rankUp" add constraint "rankUp_userId_tier_degree_key" unique ("userId", tier, degree);
alter table "rankUp" add constraint rank_up_single_degree check (tier = 'legend' or degree = 1);

-- experienceLevel(): level L starts at 50·L·(L−1) XP. At a threshold 1 + xp/12.5 is an exact square, so this is exact.
create function experience_level(xp integer) returns integer language sql immutable as $$
  select floor((1 + sqrt(1 + greatest(xp, 0)::float8 / 12.5)) / 2)::integer
$$;

-- The announced rank a level belongs to, or nothing below gold.
create function rank_up_step(level integer, out tier text, out degree integer) language sql immutable as $$
  select case when level >= 20 then 'legend' when level >= 12 then 'platinum' when level >= 8 then 'gold' end,
         case when level >= 20 then (level - 20) / 5 + 1 when level >= 8 then 1 end
$$;

create or replace function record_rank_up() returns trigger language plpgsql as $$
declare total integer; previous record; reached record;
begin
  -- Serializes concurrent awards of one member, so the running total always includes the other award.
  perform pg_advisory_xact_lock(hashtext('rankUp:' || new."userId"));
  select coalesce(sum(points), 0) into total from "profileExperience" where "userId" = new."userId";
  select * into previous from rank_up_step(experience_level(total - new.points));
  select * into reached from rank_up_step(experience_level(total));
  -- A jump over several ranks at once announces only the highest one.
  if reached.tier is not null and (previous.tier, previous.degree) is distinct from (reached.tier, reached.degree) then
    insert into "rankUp" ("userId", tier, degree) values (new."userId", reached.tier, reached.degree) on conflict do nothing;
  end if;
  return new;
end $$;
drop function rank_up_tiers();

-- Legend degrees members already passed, at the moment their running total crossed into them.
insert into "rankUp" ("userId", tier, degree, "createdAt")
select x."userId", s.tier, s.degree, min(x."createdAt")
from (select "userId", "createdAt", sum(points) over (partition by "userId" order by "createdAt", reason, "sourceKey")::integer as running
      from "profileExperience") x
cross join lateral rank_up_step(experience_level(x.running)) s
where s.tier = 'legend' and s.degree > 1
group by x."userId", s.tier, s.degree
on conflict do nothing;
