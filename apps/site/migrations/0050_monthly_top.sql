alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check" check (reason in ('review','favorite','tierlist','achievement','monthly-top'));

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top'));

alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top']::text[]
);

-- A settled month stays settled even when a winner later deletes the account.
create table "monthlyTopSettlement" (
  month date primary key,
  "settledAt" timestamptz not null default now()
);
create table "monthlyTopAward" (
  month date not null references "monthlyTopSettlement"(month),
  place smallint not null check (place between 1 and 3),
  "userId" text not null references "user"(id) on delete cascade,
  xp integer not null check (xp > 0),
  reward integer not null check (reward > 0),
  primary key (month, place),
  unique (month, "userId")
);
create index monthly_top_award_user_idx on "monthlyTopAward" ("userId");
create index profile_experience_created_idx on "profileExperience" ("createdAt");

-- Months follow Moscow time; award XP itself never counts towards a monthly race.
create function monthly_top_bounds(period date) returns tstzrange language sql stable as $$
  select tstzrange(period::timestamp at time zone 'Europe/Moscow', (period + interval '1 month')::timestamp at time zone 'Europe/Moscow')
$$;

-- Idempotent and safe to call on every page view: settles the previous month once, starting with October 2026.
create function settle_monthly_top(at timestamptz default now()) returns void language plpgsql as $$
declare
  period date := (date_trunc('month', at at time zone 'Europe/Moscow') - interval '1 month')::date;
  winner record;
  prize integer;
begin
  if period < date '2026-10-01' or exists(select 1 from "monthlyTopSettlement" where month = period) then return; end if;
  perform pg_advisory_xact_lock(hashtext('canrush:monthly-top'));
  insert into "monthlyTopSettlement" (month) values (period) on conflict do nothing;
  if not found then return; end if;
  for winner in
    select x."userId", sum(x.points)::int as xp, row_number() over (order by sum(x.points) desc, max(x."createdAt"), x."userId")::int as place
    from "profileExperience" x join "user" u on u.id = x."userId"
    where x.reason <> 'monthly-top' and x."createdAt" <@ monthly_top_bounds(period)
      and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
    group by x."userId" order by place limit 3
  loop
    prize := case winner.place when 1 then 500 when 2 then 300 else 150 end;
    insert into "monthlyTopAward" (month, place, "userId", xp, reward) values (period, winner.place, winner."userId", winner.xp, prize);
    insert into "profileExperience" ("userId", reason, "sourceKey", points) values (winner."userId", 'monthly-top', to_char(period, 'YYYY-MM'), prize) on conflict do nothing;
    insert into "profileAchievement" ("userId", key) values (winner."userId", 'top') on conflict do nothing;
    insert into notification ("userId", kind, "eventKey", payload)
      values (winner."userId", 'monthly-top', 'monthly-top:' || to_char(period, 'YYYY-MM'), jsonb_build_object('month', to_char(period, 'YYYY-MM'), 'place', winner.place, 'reward', prize))
      on conflict do nothing;
  end loop;
end $$;
