-- The look shop sells for «Искры» now and has more tags (`shop-items.ts`): the purchase and profile checks take the new keys.
alter table "shopPurchase" drop constraint "shopPurchase_key_check";
alter table "shopPurchase" add constraint "shopPurchase_key_check" check (key in ('owl', 'chill', 'npc', 'vibe', 'crush', 'battery', 'bubbles', 'tilt', 'sigma', 'auf', 'cyber', 'aurora', 'boss', 'hologram', 'main'));

alter table "user" drop constraint user_known_profile_tag;
alter table "user" add constraint user_known_profile_tag check ("profileTags" <@ array['burner','adrenaline','six-seven','collector','admin','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','streak-7','streak-14','streak-30','energizer','engine','monster','fan','shopper','date','sensei','moderator','week-hero','week-best','week-charge','boomer','dushnila','based','pickme','winged','voltage','owl','vibe','sigma','boss','chill','npc','crush','battery','tilt','auf','cyber','main']);
