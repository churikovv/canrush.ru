-- Keep the first still-supported selection when reducing the limit to one tag.
update "user" u set "profileTags" = array(
  select tag from unnest(u."profileTags") with ordinality as selected(tag, position)
  where tag = any(array['burner', 'adrenaline', 'six-seven', 'collector', 'first-review', 'admin', 'friend', 'critic', 'deadinside', 'explorer', 'three', 'kitty'])
  order by position limit 1
);
alter table "user" add constraint "user_single_profile_tag" check (cardinality("profileTags") <= 1);
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner', 'adrenaline', 'six-seven', 'collector', 'first-review', 'admin', 'friend', 'critic', 'deadinside', 'explorer', 'three', 'kitty']::text[]
);

create table "profileImage" (
  "id" uuid not null unique default gen_random_uuid(),
  "userId" text not null references "user" ("id") on delete cascade,
  "kind" text not null check ("kind" in ('avatar', 'banner')),
  "data" bytea not null check (octet_length("data") between 1 and 2097152),
  "updatedAt" timestamptz not null default now(),
  primary key ("userId", "kind")
);
create trigger "profileImage_prevent_blocked_contribution"
before insert or update on "profileImage"
for each row execute function prevent_blocked_contribution();
