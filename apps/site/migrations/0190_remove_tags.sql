-- The owner removes three tags nobody wore: «Пепе» (friend), «Первое открытие» (first-review) and «Первый глоток»
-- (drink-start). The tags go from every profile and from the earned list; the XP already paid for them stays.

-- A weekly winner gets their previous tag back at the next result: it must not be a removed one.
update "weeklyTopAward" set "previousTag" = null where "previousTag" in ('friend', 'first-review', 'drink-start');
update "user" set "profileTags" = array_remove(array_remove(array_remove("profileTags", 'friend'), 'first-review'), 'drink-start')
  where "profileTags" && array['friend', 'first-review', 'drink-start'];
delete from "profileAchievement" where key in ('friend', 'first-review', 'drink-start');

alter table "user" drop constraint user_known_profile_tag;
alter table "user" add constraint user_known_profile_tag check ("profileTags" <@ array['burner','adrenaline','six-seven','collector','admin','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator','week-hero','week-best','week-charge']);
