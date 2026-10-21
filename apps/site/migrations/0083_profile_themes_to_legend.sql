-- Themes and frames up to the Legend rank (level 20).
alter table "user" drop constraint user_profile_appearance;
alter table "user" add constraint user_profile_appearance check (
  jsonb_typeof("profileAppearance") = 'object'
  and "profileAppearance" ?& array['theme','frame']
  and "profileAppearance"->>'theme' in ('default','dark','lavender','mint','gold','ocean','platinum','cobalt','ember','legend')
  and "profileAppearance"->>'frame' in ('none','orbit','pulse','prism','abyss','nova','frost','blaze','liquid','can','legend')
);
