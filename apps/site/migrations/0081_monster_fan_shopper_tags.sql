-- New achievements: «Монстр» (Monster Energy reviews), «Фан» (a fast XP week) and «Шоппер» (a published store).
alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','drink-start','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper']::text[]
);

-- Like the calendar tags (0059), each new tag pays the usual achievement XP once.
create trigger new_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key in ('monster', 'fan', 'shopper')) execute function drink_achievement_experience();
