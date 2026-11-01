-- Первая неделя платит половину наград. Семь из её десятки только что получили компенсацию за октябрь, и полная выплата дала бы
-- десятке 52 100 XP за два дня при 105 тысячах XP на всём сайте. Со следующей недели суммы полные, как в `WEEK_PRIZES`.
create or replace function settle_weekly_top(at timestamptz default now()) returns void language plpgsql as $$
declare
  period date := (date_trunc('week', at at time zone 'Europe/Moscow') - interval '7 days')::date;
  week_tags text[] := array['week-hero', 'week-best', 'week-charge'];
  winner record;
  prize integer;
  badge text;
  previous text;
begin
  if period < date '2026-10-26' or exists(select 1 from "weeklyTopSettlement" where week = period) then return; end if;
  perform pg_advisory_xact_lock(hashtext('canrush:weekly-top'));
  insert into "weeklyTopSettlement" (week) values (period) on conflict do nothing;
  if not found then return; end if;
  update "user" u set "profileTags" = coalesce((select case when a."previousTag" is null then null else array[a."previousTag"] end
      from "weeklyTopAward" a where a."userId" = u.id and a.week < period order by a.week desc limit 1), '{}'::text[])
    where u."profileTags"[1] = any(week_tags);
  delete from "profileAchievement" where key = any(week_tags);
  for winner in
    select x."userId", sum(x.points)::int as xp, row_number() over (order by sum(x.points) desc, max(x."createdAt"), x."userId")::int as place
    from "profileExperience" x join "user" u on u.id = x."userId"
    where x.reason not in ('monthly-top', 'weekly-top') and x."createdAt" <@ weekly_top_bounds(period)
      and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
    group by x."userId" order by place limit 10
  loop
    prize := case when winner.place = 1 then 7000 when winner.place <= 5 then 3500 else 1200 end;
    if period = date '2026-10-26' then prize := prize / 2; end if;
    badge := case when winner.place = 1 then 'week-hero' when winner.place <= 5 then 'week-best' else 'week-charge' end;
    select "profileTags"[1] into previous from "user" where id = winner."userId";
    insert into "weeklyTopAward" (week, place, "userId", xp, reward, tag, "previousTag") values (period, winner.place, winner."userId", winner.xp, prize, badge, previous);
    insert into "profileExperience" ("userId", reason, "sourceKey", points) values (winner."userId", 'weekly-top', to_char(period, 'YYYY-MM-DD'), prize) on conflict do nothing;
    insert into "profileAchievement" ("userId", key) values (winner."userId", badge) on conflict do nothing;
    update "user" set "profileTags" = array[badge] where id = winner."userId";
    insert into notification ("userId", kind, "eventKey", payload)
      values (winner."userId", 'weekly-top', 'weekly-top:' || to_char(period, 'YYYY-MM-DD'), jsonb_build_object('week', to_char(period, 'YYYY-MM-DD'), 'place', winner.place, 'reward', prize, 'tag', badge))
      on conflict do nothing;
  end loop;
end $$;
