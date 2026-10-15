-- Telegram bot: private chats that allowed the bot to write (/start), and a delivery outbox.
-- Accounts are matched through the Mini App link: account.providerId = 'telegram', accountId = Telegram id.
create table "telegramChat" (
  "telegramId" bigint primary key,
  "chatId" bigint not null,
  city text,
  notify boolean not null default true,
  market boolean not null default true,
  "promoAlerts" boolean not null default true,
  "weeklyDigest" boolean not null default true,
  "adminSummary" boolean not null default true,
  "startedAt" timestamptz not null default now(),
  "blockedAt" timestamptz
);

-- Messages are stored as kind + data and rendered by the sender, so text always uses current formatting.
-- dedupeKey makes every producer idempotent; sent rows are pruned after 30 days.
create table "telegramOutbox" (
  id bigserial primary key,
  "chatId" bigint not null,
  kind text not null check (kind in ('notification', 'market', 'promo', 'digest', 'admin-summary')),
  payload jsonb not null default '{}',
  "dedupeKey" text not null unique,
  "sendAfter" timestamptz not null default now(),
  attempts smallint not null default 0,
  "sentAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz not null default now()
);
create index "telegramOutbox_pending" on "telegramOutbox" ("sendAfter", id) where "sentAt" is null;

-- Scheduled jobs claim a period (e.g. a Moscow date) before running, so several site instances run each job once.
create table "telegramJobRun" (
  job text not null,
  period text not null,
  "ranAt" timestamptz not null default now(),
  primary key (job, period)
);

-- Promotions already announced to a member: one alert per promo, even across days.
create table "telegramPromoSeen" (
  "userId" text not null references "user"(id) on delete cascade,
  key text not null,
  "seenAt" timestamptz not null default now(),
  primary key ("userId", key)
);

create function telegram_enqueue(p_user text, p_kind text, p_payload jsonb, p_dedupe text) returns void language sql as $$
  insert into "telegramOutbox" ("chatId", kind, payload, "dedupeKey")
  select c."chatId", p_kind, p_payload, p_dedupe
  from account a
  join "telegramChat" c on c."telegramId"::text = a."accountId"
  where a."userId" = p_user and a."providerId" = 'telegram' and c."blockedAt" is null
    and case p_kind
      when 'notification' then c.notify
      when 'market' then c.market
      when 'promo' then c."promoAlerts"
      when 'digest' then c."weeklyDigest"
      when 'admin-summary' then c."adminSummary"
      else false end
  on conflict ("dedupeKey") do nothing
$$;

-- Site notifications that survived the preference filter are mirrored to Telegram.
create function enqueue_telegram_notification() returns trigger language plpgsql as $$
begin
  perform telegram_enqueue(new."userId", 'notification', jsonb_build_object('notificationId', new.id), 'notification:' || new.id);
  return null;
end $$;
create trigger notification_telegram after insert on notification
  for each row execute function enqueue_telegram_notification();
