-- «Первые шаги» (first-steps.ts): три коротких шага новичка с наградами. Пять свайпов дают тег «Первый заряд», подписка —
-- рамку «Заряд». Награду забирают кнопкой на главной; строка здесь — и отметка, и право носить рамку.
create table "firstStepReward" (
  "userId" text not null references "user"(id) on delete cascade,
  step text not null check (step in ('swipes', 'follow')),
  "claimedAt" timestamptz not null default now(),
  primary key ("userId", step)
);

alter table "user" drop constraint user_known_profile_tag;
alter table "user" add constraint user_known_profile_tag check ("profileTags" <@ array['burner','adrenaline','six-seven','collector','admin','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator','week-hero','week-best','week-charge','boomer','dushnila','based','pickme','winged','voltage','owl','vibe','sigma','boss','chill','npc','crush','battery','tilt','auf','cyber','main','first-charge']);

alter table "user" drop constraint user_profile_appearance;
alter table "user" add constraint user_profile_appearance check (
  jsonb_typeof("profileAppearance") = 'object'
  and "profileAppearance" ?& array['theme','frame']
  and "profileAppearance"->>'theme' in ('default','dark','lavender','mint','gold','ocean','platinum','cobalt','ember','legend')
  and "profileAppearance"->>'frame' in ('none','orbit','pulse','prism','abyss','nova','frost','blaze','liquid','can','legend','pumpkin',
    'monster','redbull','flashup','adrenaline','gorilla','jaguar','volt','tornado','burn','lit','drive','bubbles','aurora','hologram','charge')
);

-- Like the other tags, «Первый заряд» pays the usual achievement XP once.
create trigger first_steps_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key = 'first-charge') execute function drink_achievement_experience();
