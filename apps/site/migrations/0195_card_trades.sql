-- Обмен карточками Банкомата между участниками. Обмен только равный: ценность сторон по редкости (`TRADE_VALUE` в
-- card-trade-fields.ts) расходится не больше чем на `TRADE_TOLERANCE_PERCENT`, поэтому с фейка нельзя перелить коллекцию
-- в один конец — за каждую карточку отдаётся столько же. Проверки и лимиты — в коде (`card-trades.ts`), здесь — сами
-- предложения, их карточки и пауза у полученной карточки.

-- Полученная в обмене карточка какое-то время не уходит дальше: цепочка «фейк → фейк → основной» становится долгой.
alter table "gachaCard" add column "tradeLockedUntil" timestamptz;

create table "cardTrade" (
  id uuid primary key default gen_random_uuid(),
  "fromId" text not null references "user"(id) on delete cascade,
  "toId" text not null references "user"(id) on delete cascade,
  status text not null default 'open' check (status in ('open','accepted','declined','cancelled','expired')),
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null,
  "decidedAt" timestamptz,
  check ("fromId" <> "toId"),
  check ((status = 'open') = ("decidedAt" is null))
);
-- Открытое предложение у пары одно, в какую сторону ни было бы: поменять условия — отменить и предложить снова.
create unique index "cardTrade_open_pair" on "cardTrade" (least("fromId", "toId"), greatest("fromId", "toId")) where status = 'open';
create index "cardTrade_from_idx" on "cardTrade" ("fromId", "createdAt" desc);
create index "cardTrade_to_idx" on "cardTrade" ("toId", "createdAt" desc);

-- Карточки предложения: `give` переходит от предложившего к получателю, `take` — обратно. Редкость — на момент
-- предложения; при принятии она сверяется ещё раз.
create table "cardTradeItem" (
  "tradeId" uuid not null references "cardTrade"(id) on delete cascade,
  side text not null check (side in ('give','take')),
  brand text not null check (char_length(brand) between 1 and 120),
  flavor text not null check (char_length(flavor) between 1 and 120),
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  primary key ("tradeId", side, brand, flavor)
);

-- Уведомление о предложении и о состоявшемся обмене; выключается в настройках, Telegram и push — как обычно.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus','drink-bonus','hunt-order','store-moderation','question-answer','duel-invite','card-trade'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review','business-reply','company-post','reminder','question-answer','card-trade'));

