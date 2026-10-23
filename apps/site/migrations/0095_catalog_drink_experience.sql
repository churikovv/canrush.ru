-- Напитки от участников: +50 XP автору, когда напиток проходит модерацию (status = 'published'), как магазины (0089).
-- Ключ — id напитка: повторная модерация не платит снова, удаление опыт не отбирает; не больше 50 напитков.
-- Тег «Сэнсэй» (`sensei`, достижение «Исследователь») за 3 опубликованных напитка платит обычные 20 XP.
alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak','collection','store','swipe','catalog-drink'));

create or replace function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 when 'store' then 75 when 'swipe' then 2 when 'catalog-drink' then 50 end;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 when 'store' then 20 when 'swipe' then 30 when 'catalog-drink' then 50 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;

create function catalog_drink_experience_trigger() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (TG_OP = 'INSERT' or old.status is distinct from 'published') then
    perform award_profile_experience(new."ownerId", 'catalog-drink', new.id::text);
  end if;
  return new;
end $$;
create trigger catalog_drink_experience after insert or update of status on "catalogDrink" for each row execute function catalog_drink_experience_trigger();

alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','drink-start','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei']::text[]
);
create trigger sensei_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key = 'sensei') execute function drink_achievement_experience();

-- Drinks published before this migration pay too, in the order they were reviewed, as if the rule had always been there.
do $$
declare item record;
begin
  for item in select "ownerId" as actor, id::text as source_key, coalesce("reviewedAt", "updatedAt") as at from "catalogDrink"
    where status = 'published' order by at, id
  loop
    if not exists(select 1 from "userBlock" where "userId" = item.actor)
       and (select count(*) from "profileExperience" where "userId" = item.actor and reason = 'catalog-drink') < 50 then
      insert into "profileExperience" ("userId", reason, "sourceKey", points, "createdAt") values (item.actor, 'catalog-drink', item.source_key, 50, item.at) on conflict do nothing;
    end if;
  end loop;
end $$;
