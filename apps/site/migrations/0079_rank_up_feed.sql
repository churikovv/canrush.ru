-- Feed events for reaching a high level tier. XP only grows, so a member reaches each tier once.
-- A tier starts at 50·L·(L−1) XP for its first level L (experience-level.ts, LEVEL_TIERS in level-tier.ts):
-- Золото — 8 (2800 XP), Платина — 12 (6600 XP), Легенда — 20 (19000 XP).
create table "rankUp" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  tier text not null check (tier in ('gold','platinum','legend')),
  "createdAt" timestamptz not null default now(),
  unique ("userId", tier)
);
create index rank_up_feed on "rankUp" ("createdAt" desc, id desc);

create function rank_up_tiers() returns table (tier text, threshold integer) language sql immutable as $$
  values ('gold', 2800), ('platinum', 6600), ('legend', 19000)
$$;

-- Every award path inserts into "profileExperience", so one trigger catches all of them. A jump over several
-- tiers at once announces only the highest one.
create function record_rank_up() returns trigger language plpgsql as $$
declare total integer; reached text;
begin
  -- Serializes concurrent awards of one member, so the running total always includes the other award.
  perform pg_advisory_xact_lock(hashtext('rankUp:' || new."userId"));
  select coalesce(sum(points), 0) into total from "profileExperience" where "userId" = new."userId";
  select t.tier into reached from rank_up_tiers() t
    where t.threshold > total - new.points and t.threshold <= total order by t.threshold desc limit 1;
  if reached is not null then
    insert into "rankUp" ("userId", tier) values (new."userId", reached) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger rank_up after insert on "profileExperience" for each row execute function record_rank_up();

-- Members who are already there, at the moment their running total crossed the threshold.
insert into "rankUp" ("userId", tier, "createdAt")
select x."userId", t.tier, min(x."createdAt")
from (select "userId", "createdAt", sum(points) over (partition by "userId" order by "createdAt", reason, "sourceKey") as running
      from "profileExperience") x
join rank_up_tiers() t on x.running >= t.threshold
group by x."userId", t.tier
on conflict do nothing;
