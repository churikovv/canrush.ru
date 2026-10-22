-- Опыт за магазины: +75 XP автору, когда магазин проходит модерацию (status = 'published'). Ключ — id магазина,
-- поэтому повторная модерация после правки не платит снова, а удаление магазина опыт не отбирает. Не больше 20 магазинов.
alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak','collection','store'));

create or replace function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 when 'store' then 75 end;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 when 'store' then 20 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;

create function store_experience_trigger() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (TG_OP = 'INSERT' or old.status is distinct from 'published') then
    perform award_profile_experience(new."ownerId", 'store', new.id::text);
  end if;
  return new;
end $$;
create trigger store_experience after insert or update of status on "marketStore" for each row execute function store_experience_trigger();

-- Уже опубликованные магазины тоже платят — в порядке и со временем модерации, как будто правило было всегда.
do $$
declare item record;
begin
  for item in select "ownerId" as actor, id::text as source_key, coalesce("reviewedAt", "updatedAt") as at from "marketStore"
    where status = 'published' order by at, id
  loop
    if not exists(select 1 from "userBlock" where "userId" = item.actor)
       and (select count(*) from "profileExperience" where "userId" = item.actor and reason = 'store') < 20 then
      insert into "profileExperience" ("userId", reason, "sourceKey", points, "createdAt") values (item.actor, 'store', item.source_key, 75, item.at) on conflict do nothing;
    end if;
  end loop;
end $$;
