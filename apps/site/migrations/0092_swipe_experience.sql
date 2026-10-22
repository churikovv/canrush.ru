-- Дейтинг: +2 XP за каждый из первых 30 свайпов (ключ — напиток, поэтому «вернуть» и повторный свайп того же напитка
-- не платят снова, а «вернуть» опыт не отбирает) и тег «Люблю <3» (`date`, достижение «Свидание»).
alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak','collection','store','swipe'));

create or replace function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 when 'store' then 75 when 'swipe' then 2 end;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 when 'store' then 20 when 'swipe' then 30 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;

create function swipe_experience_trigger() returns trigger language plpgsql as $$
begin
  perform award_profile_experience(new."userId", 'swipe', new.brand || ':' || new.flavor);
  return new;
end $$;
create trigger swipe_experience after insert on "drinkSwipe" for each row execute function swipe_experience_trigger();

alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','drink-start','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date']::text[]
);

-- Like the other new tags (0081), «Люблю <3» pays the usual achievement XP once.
create trigger date_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key = 'date') execute function drink_achievement_experience();

-- Swipes made before this migration pay too, oldest first, as if the rule had always been there.
do $$
declare item record;
begin
  for item in select "userId" as actor, brand || ':' || flavor as source_key, "createdAt" as at from "drinkSwipe" order by "createdAt", brand, flavor
  loop
    if not exists(select 1 from "userBlock" where "userId" = item.actor)
       and (select count(*) from "profileExperience" where "userId" = item.actor and reason = 'swipe') < 30 then
      insert into "profileExperience" ("userId", reason, "sourceKey", points, "createdAt") values (item.actor, 'swipe', item.source_key, 2, item.at) on conflict do nothing;
    end if;
  end loop;
end $$;
