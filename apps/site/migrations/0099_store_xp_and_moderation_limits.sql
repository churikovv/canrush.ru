-- Магазин, прошедший модерацию, теперь даёт +95 XP вместо 75. Уже выплаченные 75 не пересчитываются — новая сумма
-- действует с этой миграции; лимит по-прежнему 20 магазинов на участника. Заявок на проверке теперь может быть до 50 —
-- это правило сайта (stores.ts, catalog-drink-fields.ts), в базе его нет.
create or replace function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 when 'store' then 95 when 'swipe' then 2 when 'catalog-drink' then 50 end;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 when 'store' then 20 when 'swipe' then 30 when 'catalog-drink' then 50 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;
