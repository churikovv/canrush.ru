-- «Конкуренты»: up to three catalog brands a company compares itself with (the team edits the list in the cabinet).
create table "businessCompetitor" (
  "businessId" uuid not null references business(id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 120),
  "createdAt" timestamptz not null default now(),
  primary key ("businessId", brand)
);

-- The weekly report by email: one row per company, member and week, written before the letter goes out, so several
-- instances or a second pass never send it twice. A failed letter keeps its row with `failedAt` (no retry storm).
create table "businessWeeklyReport" (
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  week date not null,
  "sentAt" timestamptz not null default now(),
  "failedAt" timestamptz,
  primary key ("businessId", "userId", week)
);

-- Members who turned the weekly report off (it is on by default for the owner and the active team).
create table "businessReportOptOut" (
  "userId" text primary key references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);
