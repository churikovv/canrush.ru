-- Октябрьский топ подвели по старым наградам (+1000/+600/+300 у тройки, места 4–10 без награды), а новая гонка платит намного
-- больше. Доплачиваем участникам десятки октября разницу до новой шкалы (7000 / 3500 / 1200) и сообщаем об этом уведомлением.
-- Причина `weekly-top`: опыт не идёт ни в гонку, ни в пропуск, ни в тег «Фан». Гонка недели 26 октября платит сама, в понедельник.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus'));

with totals as (
  select u.id, sum(x.points)::int as xp, max(x."createdAt") as reached
  from "profileExperience" x join "user" u on u.id = x."userId"
  where x.reason not in ('monthly-top', 'weekly-top') and x."createdAt" <@ monthly_top_bounds('2026-10-01')
    and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
  group by u.id),
ranked as (select id, row_number() over (order by xp desc, reached, id)::int as place from totals),
due as (
  select r.id, r.place,
    coalesce((select a.reward from "monthlyTopAward" a where a.month = '2026-10-01' and a."userId" = r.id), 0) as paid,
    case when r.place = 1 then 7000 when r.place <= 5 then 3500 else 1200 end as total
  from ranked r where r.place <= 10),
granted as (
  insert into "profileExperience" ("userId", reason, "sourceKey", points)
  select id, 'weekly-top', 'top-bonus:2026-10', total - paid from due where total > paid
  on conflict do nothing
  returning "userId", points)
insert into notification ("userId", kind, "eventKey", payload)
select g."userId", 'top-bonus', 'top-bonus:2026-10', jsonb_build_object('place', d.place, 'paid', d.paid, 'bonus', g.points, 'total', d.total)
from granted g join due d on d.id = g."userId"
on conflict ("userId", "eventKey") do nothing;
