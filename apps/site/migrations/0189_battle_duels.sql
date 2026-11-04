-- «Битва банок» с другом: вызов по ссылке, принятие, бой двух участников. Состояние боя — тот же jsonb движка, что у
-- боя с Совой: хозяин вызова играет сторону `me`, гость — `rival`. Колечек за дуэль нет: два своих аккаунта иначе
-- раздавали бы их друг другу.
create table "battleDuel" (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{12}$'),
  "hostId" text not null references "user"(id) on delete cascade,
  "guestId" text references "user"(id) on delete cascade,
  status text not null default 'open' check (status in ('open','active','finished','cancelled')),
  state jsonb,
  -- Номер последнего события боя и последние события (клиент догоняет соперника по ним).
  seq integer not null default 0,
  log jsonb not null default '[]',
  "turnEndsAt" timestamptz,
  "hostMissed" smallint not null default 0,
  "guestMissed" smallint not null default 0,
  winner text check (winner in ('host','guest')),
  reason text check (reason in ('hero','surrender','timeout')),
  "createdAt" timestamptz not null default now(),
  "startedAt" timestamptz,
  "finishedAt" timestamptz,
  "expiresAt" timestamptz not null,
  check ("guestId" is null or "guestId" <> "hostId"),
  check (status = 'open' or status = 'cancelled' or ("guestId" is not null and state is not null)),
  check ((status = 'finished') = (winner is not null))
);
-- Открытый вызов у участника один: повторное нажатие отдаёт ту же ссылку.
create unique index "battleDuel_one_open" on "battleDuel" ("hostId") where status = 'open';
create index "battleDuel_host_idx" on "battleDuel" ("hostId", status);
create index "battleDuel_guest_idx" on "battleDuel" ("guestId", status);

-- Приглашение друга с сайта: уведомление, а через него — Telegram и push.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus','drink-bonus','hunt-order','store-moderation','question-answer','duel-invite'));
