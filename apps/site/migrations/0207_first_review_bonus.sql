-- The first review pays a one-time bonus on top of the usual 25 XP: +25 XP (reason `first-review`, one row per member,
-- sourceKey 'first'); the shop counts 25 sparks from the same row (`FIRST_REVIEW_SPARKS`). Deleting the review keeps
-- it, and writing another never pays it again.
alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak','collection','store','swipe','catalog-drink','weekly-top','daily','first-review'));

create or replace function award_profile_experience(actor text, category text, source_key text) returns void language plpgsql as $$
declare reward integer; award_limit integer;
begin
  perform 1 from "user" where id = actor for no key update;
  if exists(select 1 from "userBlock" where "userId" = actor) then return; end if;
  reward := case category when 'review' then 25 when 'favorite' then 2 when 'tierlist' then 50 when 'achievement' then 20 when 'store' then 95 when 'swipe' then 2 when 'catalog-drink' then 50 when 'first-review' then 25 end;
  if category = 'catalog-drink' and (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= 50 then reward := 25; end if;
  award_limit := case category when 'favorite' then 20 when 'tierlist' then 10 when 'store' then 20 when 'swipe' then 30 when 'first-review' then 1 else 2147483647 end;
  if reward is null or (select count(*) from "profileExperience" where "userId" = actor and reason = category) >= award_limit then return; end if;
  insert into "profileExperience" ("userId", reason, "sourceKey", points) values (actor, category, source_key, reward) on conflict do nothing;
end $$;

-- A trigger of its own after `review_experience` (triggers fire by name): the review's 25 XP first, then the bonus once.
create function first_review_experience() returns trigger language plpgsql as $$
begin
  perform award_profile_experience(new."userId", 'first-review', 'first');
  return new;
end $$;
create trigger review_first_bonus after insert on review for each row execute function first_review_experience();

-- Everyone who has written a review gets it too, dated at their first review (a review row or the XP it paid, which stays
-- after the review is deleted): an old review lands in its own week and season, not in this week's race or pass.
insert into "profileExperience" ("userId", reason, "sourceKey", points, "createdAt")
select first."userId", 'first-review', 'first', 25, first.at
from (
  select "userId", min(at) as at from (
    select "userId", "createdAt" as at from review
    union all
    select "userId", "createdAt" from "profileExperience" where reason = 'review'
  ) written group by "userId"
) first
where not exists(select 1 from "userBlock" b where b."userId" = first."userId")
on conflict do nothing;
