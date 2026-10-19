-- One row per member per Moscow day with signed-in activity (the presence heartbeat), whatever their
-- online-status setting. The admin page shows only totals from it (active today / in 7 days), never names.
create table "activityDay" (
  day date not null,
  "userId" text not null references "user"(id) on delete cascade,
  primary key (day, "userId")
);
