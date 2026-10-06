create table "profileReport" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  "targetId" text not null references "user"(id) on delete cascade,
  reason text not null check (reason in ('scam','spam','insults','prohibited')),
  comment text not null default '' check (char_length(comment) <= 1000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  "createdAt" timestamptz not null default now(),
  "reviewedAt" timestamptz,
  "reviewedBy" text references "user"(id) on delete set null,
  check ("userId" <> "targetId")
);
create unique index profile_report_open_unique on "profileReport" ("userId","targetId") where status='open';
create index profile_report_queue on "profileReport" (status,"createdAt" desc);
create index profile_report_rate on "profileReport" ("userId","createdAt" desc);
create trigger profile_report_blocked before insert on "profileReport"
for each row execute function prevent_blocked_contribution();
