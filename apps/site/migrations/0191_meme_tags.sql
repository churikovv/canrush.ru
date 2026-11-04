-- New tags: «Бумер», «Душнила», «База», «Пикми», «Окрылённый» (Red Bull) and «Под напряжением» (Volt).
alter table "user" drop constraint user_known_profile_tag;
alter table "user" add constraint user_known_profile_tag check ("profileTags" <@ array['burner','adrenaline','six-seven','collector','admin','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator','week-hero','week-best','week-charge','boomer','dushnila','based','pickme','winged','voltage']);

-- Like the other tags, each pays the usual achievement XP once.
create trigger meme_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key in ('boomer', 'dushnila', 'based', 'pickme', 'winged', 'voltage')) execute function drink_achievement_experience();
