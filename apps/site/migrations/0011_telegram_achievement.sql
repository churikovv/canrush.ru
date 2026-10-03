alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner', 'adrenaline', 'six-seven', 'collector', 'first-review', 'admin', 'friend', 'critic', 'deadinside', 'explorer', 'three', 'kitty', 'telegram']::text[]
);

-- A profile link is an achievement, not proof of Telegram account ownership.
-- The existing experience ledger makes the award idempotent across link changes.
create function telegram_achievement_experience() returns trigger language plpgsql as $$
begin
  perform award_profile_experience(new."userId", 'achievement', 'telegram');
  return new;
end $$;
create trigger telegram_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key = 'telegram') execute function telegram_achievement_experience();

insert into "profileAchievement" ("userId", key)
select id, 'telegram' from "user" where "telegramChannel" ~* '^[a-z][a-z0-9_]{4,31}$'
on conflict do nothing;
