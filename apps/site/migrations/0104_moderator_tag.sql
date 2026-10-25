-- Тег «Модератор» (достижение «Модератор», особое): как «Админ», он не хранится в profileAchievement, а следует роли
-- siteAdmin.role = 'moderator' — виден, пока человек модератор, и пропадает вместе с ролью. Опыта за него нет.
alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','drink-start','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator']::text[]
);
