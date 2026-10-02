create table "profileExperience" (
  "userId" text not null references "user"(id) on delete cascade,
  reason text not null check (reason in ('review','favorite','tierlist','achievement')),
  "sourceKey" text not null,
  points integer not null check (points > 0),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", reason, "sourceKey")
);

-- Serialize awards per account; removal/recreation never removes the ledger entry.
create function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 end;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;

create function profile_experience_trigger() returns trigger language plpgsql as $$
begin
  if TG_TABLE_NAME = 'review' then
    perform award_profile_experience(new."userId", 'review', jsonb_build_array(new.brand, new.flavor)::text);
  elsif TG_TABLE_NAME = 'favorite' then
    perform award_profile_experience(new."userId", 'favorite', jsonb_build_array(new.brand, new.flavor)::text);
  elsif TG_TABLE_NAME = 'tierList' then
    if new.status = 'published' then perform award_profile_experience(new."userId", 'tierlist', new.id::text); end if;
  elsif TG_TABLE_NAME = 'profileAchievement' then
    if new.key in ('burner','adrenaline','six-seven','collector','first-review','friend','critic','deadinside','explorer','three','kitty') then
    perform award_profile_experience(new."userId", 'achievement', new.key); end if;
  end if;
  return new;
end $$;
create trigger review_experience after insert on review for each row execute function profile_experience_trigger();
create trigger favorite_experience after insert on favorite for each row execute function profile_experience_trigger();
create trigger tierlist_experience after insert or update of status on "tierList" for each row execute function profile_experience_trigger();
create trigger achievement_experience after insert on "profileAchievement" for each row execute function profile_experience_trigger();

-- Existing contributions count too, in their original chronological order.
do $$
declare item record;
begin
  for item in select "userId" as actor, 'review'::text as category, jsonb_build_array(brand,flavor)::text as source_key, "createdAt" as at from review
    union all select "userId", 'favorite', jsonb_build_array(brand,flavor)::text, "createdAt" from favorite
    union all select "userId", 'tierlist', id::text, "createdAt" from "tierList" where status='published'
    union all select "userId", 'achievement', key, "earnedAt" from "profileAchievement" where key in ('burner','adrenaline','six-seven','collector','first-review','friend','critic','deadinside','explorer','three','kitty')
    order by at, source_key
  loop perform award_profile_experience(item.actor, item.category, item.source_key); end loop;
end $$;

create view "profileRanking" as
select u.id, u.username, u.name, coalesce(sum(x.points),0)::int as xp,
  rank() over(order by coalesce(sum(x.points),0) desc)::int as rank
from "user" u left join "profileExperience" x on x."userId"=u.id
where u.username is not null and not exists(select 1 from "userBlock" b where b."userId"=u.id)
group by u.id;
