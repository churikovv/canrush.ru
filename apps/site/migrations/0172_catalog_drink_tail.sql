-- С 51-го напитка опыт вдвое меньше: +25 XP вместо +50. Раньше за напитки сверх 50 не платили вовсе, поэтому опубликованные без
-- выплаты получают те же +25 один раз. Запись датирована 25 октября: опыт старый и не должен идти в гонку недели и очки пропуска.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus','drink-bonus'));

create or replace function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 when 'store' then 95 when 'swipe' then 2 when 'catalog-drink' then 50 end;
  if category = 'catalog-drink' and (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= 50 then reward := 25; end if;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 when 'store' then 20 when 'swipe' then 30 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;

with unpaid as (
  select c.id, c."ownerId" from "catalogDrink" c
  where c.status = 'published'
    and not exists(select 1 from "profileExperience" p where p."userId" = c."ownerId" and p.reason = 'catalog-drink' and p."sourceKey" = c.id::text)
    and not exists(select 1 from "userBlock" b where b."userId" = c."ownerId")),
granted as (
  insert into "profileExperience" ("userId", reason, "sourceKey", points, "createdAt")
  select "ownerId", 'catalog-drink', id::text, 25, timestamptz '2026-10-25 12:00:00+03' from unpaid
  on conflict do nothing
  returning "userId", points)
insert into notification ("userId", kind, "eventKey", payload)
select "userId", 'drink-bonus', 'drink-bonus:2026-11', jsonb_build_object('drinks', count(*), 'bonus', sum(points))
from granted group by "userId"
on conflict ("userId", "eventKey") do nothing;
