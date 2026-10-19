-- Giveaway draws: who won, out of whom (participant ids) and with which filters, so every draw can be checked later.
-- A winner who does not answer is marked "unreachable" and a new draw (a new row) excludes them; a reached winner is "confirmed".
create table "contestDraw" (
  id uuid primary key default gen_random_uuid(),
  contest text not null,
  "winnerId" text references "user"(id) on delete set null,
  "poolSize" integer not null check ("poolSize" > 0),
  pool jsonb not null check (jsonb_typeof(pool) = 'array'),
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unreachable')),
  "drawnBy" text not null,
  "drawnAt" timestamptz not null default now(),
  "resolvedBy" text,
  "resolvedAt" timestamptz,
  check ((status = 'pending') = ("resolvedAt" is null))
);
create index "contestDraw_contest_drawnAt_idx" on "contestDraw" (contest, "drawnAt" desc);
-- At most one open (pending or confirmed) winner per contest; unreachable ones stay as history.
create unique index "contestDraw_open_winner_idx" on "contestDraw" (contest) where status <> 'unreachable';
