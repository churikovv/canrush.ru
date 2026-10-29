-- Where members use CanRush from: one row per member, Moscow day and platform — the iOS or Android app (their
-- User-Agent ends in CanrushApp/iOS or CanrushApp/Android), the Telegram Mini App, or the website. Written by the same
-- heartbeat as "activityDay"; the admin analytics counts it. Rows older than 400 days are removed with "activityDay".
create table "platformDay" (
  day date not null,
  "userId" text not null references "user"(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'telegram', 'web')),
  primary key (day, "userId", platform)
);
create index platform_day_day on "platformDay"(day, platform);
