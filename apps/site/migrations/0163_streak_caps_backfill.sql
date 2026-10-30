-- Крышки за уже идущие серии трекера: разовая доплата при запуске Банкомата. Вехи платит триггер `caps_streak` в момент
-- их достижения, а тем, кто прошёл 7 или 14 дней до миграции 0154, он не сработал. Берём только живые серии (последний
-- день — сегодня или вчера по Москве) и те же суммы и ключи `<первый день>:<веха>`, поэтому уже выплаченное не повторится,
-- а следующие вехи этой серии заплатит обычный триггер. Заблокированным `award_caps` не платит.
with days as (select distinct "userId", day from "drinkStreakDay"),
runs as (
  select "userId", min(day) as first_day, max(day) as last_day, count(*)::int as length
  from (select "userId", day, day - (row_number() over (partition by "userId" order by day))::int as run from days) grouped
  group by "userId", run
)
select award_caps(r."userId", 'streak', r.first_day::text || ':' || milestone, case when milestone >= 30 then 60 else 20 end, null)
from runs r
cross join lateral (select unnest(array[7, 14]) as milestone union all select generate_series(30, r.length, 30)) reached
where r.last_day >= (now() at time zone 'Europe/Moscow')::date - 1 and milestone <= r.length;
