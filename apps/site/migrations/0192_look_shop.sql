-- The look shop (`shop-items.ts`): tags and frames bought with achievement points. Points are the trophy score minus what
-- was spent here; the price is kept as paid, so a later price change does not alter anyone's balance.
create table "shopPurchase" (
  "userId" text not null references "user"(id) on delete cascade,
  key text not null check (key in ('owl', 'vibe', 'sigma', 'boss', 'bubbles', 'aurora', 'hologram')),
  price integer not null check (price > 0),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", key)
);

alter table "user" drop constraint user_known_profile_tag;
alter table "user" add constraint user_known_profile_tag check ("profileTags" <@ array['burner','adrenaline','six-seven','collector','admin','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator','week-hero','week-best','week-charge','boomer','dushnila','based','pickme','winged','voltage','owl','vibe','sigma','boss']);

alter table "user" drop constraint user_profile_appearance;
alter table "user" add constraint user_profile_appearance check (
  jsonb_typeof("profileAppearance") = 'object'
  and "profileAppearance" ?& array['theme','frame']
  and "profileAppearance"->>'theme' in ('default','dark','lavender','mint','gold','ocean','platinum','cobalt','ember','legend')
  and "profileAppearance"->>'frame' in ('none','orbit','pulse','prism','abyss','nova','frost','blaze','liquid','can','legend','pumpkin',
    'monster','redbull','flashup','adrenaline','gorilla','jaguar','volt','tornado','burn','lit','drive','bubbles','aurora','hologram')
);
