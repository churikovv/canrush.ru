alter table "user" add column "profileAppearance" jsonb not null default '{"theme":"default","frame":"none"}';
alter table "user" add constraint user_profile_appearance check (
  jsonb_typeof("profileAppearance") = 'object'
  and "profileAppearance" ?& array['theme','frame']
  and "profileAppearance"->>'theme' in ('default','dark','lavender','mint')
  and "profileAppearance"->>'frame' in ('none','orbit','pulse','prism')
);
