-- Site errors without third-party services: one row per group (same place, same message), repeats only count.
-- Nothing about a person is stored: the path without its query, a cleaned message and the first stack frames.
create table "errorGroup" (
  hash text primary key,
  source text not null check (source in ('server', 'client')),
  path text not null,
  message text not null,
  stack text not null default '',
  count integer not null default 1,
  "firstSeenAt" timestamptz not null default now(),
  "lastSeenAt" timestamptz not null default now(),
  -- Last alert to the administrators: a group alerts at most once an hour.
  "notifiedAt" timestamptz,
  -- Hidden by an administrator: keeps counting, shows only under «Скрытые» and sends no alerts.
  "hiddenAt" timestamptz
);
create index "errorGroup_recent" on "errorGroup" ("lastSeenAt" desc);

alter table "telegramOutbox" drop constraint "telegramOutbox_kind_check";
alter table "telegramOutbox" add constraint "telegramOutbox_kind_check"
  check (kind in ('notification', 'market', 'promo', 'digest', 'admin-summary', 'error-alert'));

-- Alerts have no switch of their own: the morning summary's one would silence them with the summary, «Скрыть» does it per group.
create or replace function telegram_enqueue(p_user text, p_kind text, p_payload jsonb, p_dedupe text) returns void language sql as $$
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
      when 'error-alert' then true
      else false end
  on conflict ("dedupeKey") do nothing
$$;
