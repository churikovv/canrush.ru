-- «Вас обогнали в топе месяца»: когда начисление опыта поднимает участника выше того, кто был в первой пятёрке гонки
-- месяца, обойдённый получает уведомление `overtaken` (новое место и отставание). Гонка считается как в getMonthlyTop
-- и settle_monthly_top: опыт за календарный месяц по Москве без наградных `monthly-top`, только участники с ником и без
-- бана. Одна пара «кто обогнал — кого» уведомляет не чаще раза в московские сутки, чтобы обгоны туда-обратно не
-- засыпали уведомлениями. Как и остальные уведомления, его можно выключить в настройках, а Telegram и push получают его
-- через notification_telegram и notification_push.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken'));

create function notify_monthly_overtaken() returns trigger language plpgsql as $$
declare
  period date := date_trunc('month', now() at time zone 'Europe/Moscow')::date;
  actor_after integer;
  actor_before integer;
  passed record;
begin
  if new.reason = 'monthly-top' or new.points <= 0 or not (new."createdAt" <@ monthly_top_bounds(period)) then return null; end if;
  if exists(select 1 from "userBlock" where "userId" = new."userId")
    or (select username from "user" where id = new."userId") is null then return null; end if;

  select coalesce(sum(points), 0)::int into actor_after from "profileExperience"
    where "userId" = new."userId" and reason <> 'monthly-top' and "createdAt" <@ monthly_top_bounds(period);
  actor_before := actor_after - new.points;

  -- Places before this award (equal XP share a place, as on the leaderboard); the passed members are those who were
  -- in the top five strictly above the actor's old total and are now strictly below the new one.
  for passed in
    with totals as (
      select x."userId", sum(x.points)::int as xp from "profileExperience" x join "user" u on u.id = x."userId"
      where x.reason <> 'monthly-top' and x."createdAt" <@ monthly_top_bounds(period)
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

create trigger monthly_top_overtaken after insert on "profileExperience"
  for each row execute function notify_monthly_overtaken();
