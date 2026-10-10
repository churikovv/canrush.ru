alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner', 'adrenaline', 'six-seven', 'collector', 'first-review', 'admin', 'friend', 'critic', 'deadinside', 'explorer', 'three', 'kitty', 'telegram', 'altushka', 'flash']::text[]
);

create function product_achievement_experience() returns trigger language plpgsql as $$
begin
  perform award_profile_experience(new."userId", 'achievement', new.key);
  return new;
end $$;
create trigger product_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key in ('altushka', 'flash')) execute function product_achievement_experience();
