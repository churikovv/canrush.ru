-- Личные сообщения от команды через Telegram-бота. Исходящие идут обычной очередью, ответ участника сохраняется только в течение
-- недели после сообщения команды: остальной текст в боте по-прежнему поиск напитков и нигде не хранится.
create table "botMessage" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  "fromTeam" boolean not null,
  text text not null check (char_length(text) between 1 and 2000),
  "adminEmail" text,
  "readAt" timestamptz,
  "createdAt" timestamptz not null default now()
);
create index "botMessage_dialog" on "botMessage" ("userId", "createdAt" desc);
create index "botMessage_unread" on "botMessage" ("userId") where not "fromTeam" and "readAt" is null;

alter table "telegramOutbox" drop constraint "telegramOutbox_kind_check";
alter table "telegramOutbox" add constraint "telegramOutbox_kind_check"
  check (kind in ('notification', 'market', 'promo', 'digest', 'admin-summary', 'error-alert', 'direct', 'direct-reply'));

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
      when 'direct' then true
      when 'direct-reply' then true
      else false end
  on conflict ("dedupeKey") do nothing
$$;
