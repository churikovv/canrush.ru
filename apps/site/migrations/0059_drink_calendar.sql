-- Drink calendar: one row per can. "day" is the Moscow calendar day the member drank it.
create table "drinkLog" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  day date not null,
  name text not null check (char_length(name) between 1 and 150),
  brand text,
  flavor text,
  price integer check (price between 1 and 10000000),
  store text check (char_length(store) between 1 and 80),
  "createdAt" timestamptz not null default now(),
  constraint drink_log_catalog check ((brand is null) = (flavor is null))
);
create index drink_log_user_day_idx on "drinkLog" ("userId", day desc);

alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak'));

alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','drink-start','streak-7','streak-14','streak-30']::text[]
);

create function drink_achievement_experience() returns trigger language plpgsql as $$
begin
  perform award_profile_experience(new."userId", 'achievement', new.key);
  return new;
end $$;
create trigger drink_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key in ('drink-start', 'streak-7', 'streak-14', 'streak-30')) execute function drink_achievement_experience();
