-- «Вернуть огонёк»: a member who forgot to log a day can fill one missed day of a streak, at most once every 15 days.
-- A restored day is not a can (no drinkLog row, no day XP) — it only joins the two runs around it. Every streak count
-- reads days through the view, so the calendar, the leaderboard and the 7 / 14 / 30 tags agree.
create table "drinkStreakRestore" (
  "userId" text not null references "user"(id) on delete cascade,
  day date not null,
  "createdAt" timestamptz not null default now(),
  primary key ("userId", day)
);
create index drink_streak_restore_recent on "drinkStreakRestore"("userId", "createdAt");

create view "drinkStreakDay" as
  select "userId", day from "drinkLog"
  union
  select "userId", day from "drinkStreakRestore";
