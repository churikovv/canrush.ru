-- Achievements that are not tags: they can never be worn next to the name, only earned and shown on the achievements
-- screen. Kept apart from "profileAchievement" so `validateProfileTags` and the tag checks never see them, and so they
-- pay no XP (the tag triggers pay 20 XP; these feed only the trophy score). Earned once and kept, like tags.
create table "profileBadge" (
  "userId" text not null references "user"(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9-]{1,40}$'),
  "earnedAt" timestamptz not null default now(),
  primary key ("userId", key)
);
create index profile_badge_recent on "profileBadge" ("userId", "earnedAt" desc);
