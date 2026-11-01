-- Сезоны рейтинга: месяц — сезон (октябрь 2026 — первый), внутри него недельная гонка. Топ-10 недели получает опыт и тег
-- на следующую неделю, топ-10 сезона — опыт, первая тройка ещё и постоянный тег «ТОП». Бесплатный пропуск сезона платит
-- крышками, осколками, крутками и колечками. Подведённые месяцы не пересчитываются: октябрь остаётся как выплачен.
alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak','collection','store','swipe','catalog-drink','weekly-top'));

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top'));

alter table "user" drop constraint user_known_profile_tag;
alter table "user" add constraint user_known_profile_tag check ("profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','drink-start','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator','week-hero','week-best','week-charge']);

alter table "capLedger" drop constraint "capLedger_reason_check";
alter table "capLedger" add constraint "capLedger_reason_check" check (reason in ('welcome','drink-day','review','tierlist','swipes','streak','pull','quest','pass'));
alter table "shardLedger" drop constraint "shardLedger_reason_check";
alter table "shardLedger" add constraint "shardLedger_reason_check" check (reason in ('dupe','craft','pass'));
alter table "spinLedger" drop constraint "spinLedger_reason_check";
alter table "spinLedger" add constraint "spinLedger_reason_check" check (reason in ('giveaway','pull','craft','pass'));
alter table "ringLedger" drop constraint "ringLedger_reason_check";
alter table "ringLedger" add constraint "ringLedger_reason_check" check (reason in ('battle','craft','pass'));

-- Какие уровни пропуска участник забрал в сезоне: сама награда лежит в журнале своей валюты.
create table "seasonPassClaim" (
  "userId" text not null references "user"(id) on delete cascade,
  season text not null check (season ~ '^\d{4}-\d{2}$'),
  level smallint not null check (level between 1 and 100),
  "claimedAt" timestamptz not null default now(),
  primary key ("userId", season, level)
);

create table "weeklyTopSettlement" (week date primary key, "settledAt" timestamptz not null default now());
-- `previousTag` — что участник носил до тега недели: когда неделя кончается, ему возвращается его выбор.
create table "weeklyTopAward" (
  week date not null references "weeklyTopSettlement"(week) on delete cascade,
  place smallint not null check (place between 1 and 10),
  "userId" text not null references "user"(id) on delete cascade,
  xp integer not null,
  reward integer not null,
  tag text not null check (tag in ('week-hero','week-best','week-charge')),
  "previousTag" text,
  primary key (week, place)
);
create index "weeklyTopAward_user_idx" on "weeklyTopAward" ("userId", week desc);

create function weekly_top_bounds(period date) returns tstzrange language sql stable as $$
  select tstzrange(period::timestamp at time zone 'Europe/Moscow', (period + interval '7 days')::timestamp at time zone 'Europe/Moscow')
$$;

-- Те же числа и теги — в src/lib/season-fields.ts, меняй вместе. Теги недели живут строками profileAchievement до следующих
-- итогов: их удаляет эта же функция, поэтому запросы, которые проверяют тег автора, работают без изменений.
create function settle_weekly_top(at timestamptz default now()) returns void language plpgsql as $$
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
    prize := case when winner.place = 1 then 1500 when winner.place <= 5 then 700 else 300 end;
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

-- Сезон: топ-10 вместо топ-3 и награды в пять раз выше (те же числа — SEASON_REWARDS в season-fields.ts).
create or replace function settle_monthly_top(at timestamptz default now()) returns void language plpgsql as $$
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
    where x.reason not in ('monthly-top', 'weekly-top') and x."createdAt" <@ monthly_top_bounds(period)
      and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
    group by x."userId" order by place limit 10
  loop
    prize := case when winner.place = 1 then 5000 when winner.place = 2 then 3500 when winner.place = 3 then 2500 when winner.place <= 5 then 1500 else 800 end;
    insert into "monthlyTopAward" (month, place, "userId", xp, reward) values (period, winner.place, winner."userId", winner.xp, prize);
    insert into "profileExperience" ("userId", reason, "sourceKey", points) values (winner."userId", 'monthly-top', to_char(period, 'YYYY-MM'), prize) on conflict do nothing;
    if winner.place <= 3 then insert into "profileAchievement" ("userId", key) values (winner."userId", 'top') on conflict do nothing; end if;
    insert into notification ("userId", kind, "eventKey", payload)
      values (winner."userId", 'monthly-top', 'monthly-top:' || to_char(period, 'YYYY-MM'), jsonb_build_object('month', to_char(period, 'YYYY-MM'), 'place', winner.place, 'reward', prize))
      on conflict do nothing;
  end loop;
end $$;

-- Награды за неделю не должны двигать гонку сезона: иначе победитель недели обгонял бы всех одним начислением.
create or replace function notify_monthly_overtaken() returns trigger language plpgsql as $$
declare
  period date := date_trunc('month', now() at time zone 'Europe/Moscow')::date;
  actor_after integer;
  actor_before integer;
  passed record;
begin
  if new.reason in ('monthly-top', 'weekly-top') or new.points <= 0 or not (new."createdAt" <@ monthly_top_bounds(period)) then return null; end if;
  if exists(select 1 from "userBlock" where "userId" = new."userId")
    or (select username from "user" where id = new."userId") is null then return null; end if;

  select coalesce(sum(points), 0)::int into actor_after from "profileExperience"
    where "userId" = new."userId" and reason not in ('monthly-top', 'weekly-top') and "createdAt" <@ monthly_top_bounds(period);
  actor_before := actor_after - new.points;

  -- Places before this award (equal XP share a place, as on the leaderboard); the passed members are those who were
  -- in the top five strictly above the actor's old total and are now strictly below the new one.
  for passed in
    with totals as (
      select x."userId", sum(x.points)::int as xp from "profileExperience" x join "user" u on u.id = x."userId"
      where x.reason not in ('monthly-top', 'weekly-top') and x."createdAt" <@ monthly_top_bounds(period)
        and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
      group by x."userId"),
    before as (
      select "userId", case when "userId" = new."userId" then actor_before else xp end as xp from totals),
    ranked as (
      select "userId", xp, rank() over (order by xp desc) as place from before where xp > 0)
    select "userId", xp, place from ranked
    where "userId" <> new."userId" and place <= 5 and xp > actor_before and xp < actor_after
  loop
    -- The notification must never fail the award itself: a passed member deleting the account at the same moment
    -- would otherwise break the actor's XP insert with a foreign key error.
    begin
      insert into notification ("userId", "actorId", kind, "eventKey", payload)
      values (passed."userId", new."userId", 'overtaken',
        'overtaken:' || to_char(period, 'YYYY-MM') || ':' || new."userId" || ':' || to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM-DD'),
        jsonb_build_object('month', to_char(period, 'YYYY-MM'), 'place', passed.place + 1, 'gap', actor_after - passed.xp))
      on conflict ("userId", "eventKey") do nothing;
    exception when foreign_key_violation then null;
    end;
  end loop;
  return null;
end $$;

-- Напитки в каталог добавляются без потолка: опыт по-прежнему платит только модерация.
create or replace function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 when 'store' then 95 when 'swipe' then 2 when 'catalog-drink' then 50 end;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 when 'store' then 20 when 'swipe' then 30 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;
