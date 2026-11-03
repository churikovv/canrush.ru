-- Brand avatar frames (`avatar-frame-brands.tsx`): they open with reviews of different flavours of the brand, not with a
-- level, so nothing new is stored — only the saved appearance has to accept their keys.
alter table "user" drop constraint user_profile_appearance;
alter table "user" add constraint user_profile_appearance check (
  jsonb_typeof("profileAppearance") = 'object'
  and "profileAppearance" ?& array['theme','frame']
  and "profileAppearance"->>'theme' in ('default','dark','lavender','mint','gold','ocean','platinum','cobalt','ember','legend')
  and "profileAppearance"->>'frame' in ('none','orbit','pulse','prism','abyss','nova','frost','blaze','liquid','can','legend','pumpkin',
    'monster','redbull','flashup','adrenaline','gorilla','jaguar','volt','tornado','burn','lit','drive')
);
