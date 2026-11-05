-- «Лунный цикл» — ежедневные награды (daily-reward-fields.ts): путь на 30 дней, одна награда в день по Москве, пропуск
-- начинает путь заново. Каждый день — опыт (журнал опыта, причина daily) и искры (их считает магазин образов по этой
-- таблице), каждый пятый — тег, фон профиля или рамка. Строка с item — и отметка, и право носить фон или рамку.
create table "dailyReward" (
  "userId" text not null references "user"(id) on delete cascade,
  day date not null,
  step smallint not null check (step between 1 and 30),
  xp integer not null check (xp >= 0),
  sparks integer not null check (sparks >= 0),
  item text check (item in ('moon-young', 'moonlight', 'crescent', 'moon-full', 'midnight', 'moon-cycle')),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", day)
);

alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak','collection','store','swipe','catalog-drink','weekly-top','daily'));

alter table "user" drop constraint user_known_profile_tag;
alter table "user" add constraint user_known_profile_tag check ("profileTags" <@ array['burner','adrenaline','six-seven','collector','admin','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator','week-hero','week-best','week-charge','boomer','dushnila','based','pickme','winged','voltage','owl','vibe','sigma','boss','chill','npc','crush','battery','tilt','auf','cyber','main','first-charge','moon-young','moon-full']);

alter table "user" drop constraint user_profile_appearance;
alter table "user" add constraint user_profile_appearance check (
  jsonb_typeof("profileAppearance") = 'object'
  and "profileAppearance" ?& array['theme','frame']
  and "profileAppearance"->>'theme' in ('default','dark','lavender','mint','gold','ocean','platinum','cobalt','ember','legend','moonlight','midnight')
  and "profileAppearance"->>'frame' in ('none','orbit','pulse','prism','abyss','nova','frost','blaze','liquid','can','legend','pumpkin',
    'monster','redbull','flashup','adrenaline','gorilla','jaguar','volt','tornado','burn','lit','drive','bubbles','aurora','hologram','charge','crescent','moon-cycle')
);

-- Like the other tags, the two moon tags pay the usual achievement XP once.
create trigger daily_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key in ('moon-young', 'moon-full')) execute function drink_achievement_experience();
