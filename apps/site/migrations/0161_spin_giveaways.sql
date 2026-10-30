-- Раздачи круток из админки: баннер в ленте дарит крутки Банкомата за просмотр.
-- Подарочные крутки — свой журнал, как крышки и осколки: начисление (+) за раздачу и списание (−) за крутку, баланс — сумма.
create table "spinLedger" (
  "userId" text not null references "user"(id) on delete cascade,
  reason text not null check (reason in ('giveaway','pull')),
  "sourceKey" text not null check (char_length("sourceKey") between 1 and 300),
  amount integer not null check (amount <> 0 and amount between -10 and 10),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", reason, "sourceKey")
);

-- `claimed` растёт атомарно при получении и упирается в `maxClaims`. `endedAt` — досрочная остановка: срок не трогаем,
-- чтобы в истории осталось, на сколько раздача задумывалась.
create table "spinGiveaway" (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 140),
  spins integer not null check (spins between 1 and 10),
  "viewSeconds" integer not null check ("viewSeconds" between 3 and 30),
  "maxClaims" integer check ("maxClaims" > 0),
  claimed integer not null default 0 check (claimed >= 0),
  "startsAt" timestamptz not null,
  "endsAt" timestamptz not null,
  "endedAt" timestamptz,
  "adminEmail" text not null,
  "createdAt" timestamptz not null default now(),
  constraint spin_giveaway_period check ("endsAt" > "startsAt"),
  constraint spin_giveaway_limit check ("maxClaims" is null or claimed <= "maxClaims")
);
create index spin_giveaway_period_idx on "spinGiveaway"("startsAt", "endsAt");

-- Просмотр баннера участником. `seenAt` ставит сервер: получить можно только через `viewSeconds` после него, какой бы
-- таймер ни показывал браузер. Заодно это счётчик показов для истории в админке.
create table "spinGiveawayView" (
  "giveawayId" uuid not null references "spinGiveaway"(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  "seenAt" timestamptz not null default now(),
  "claimedAt" timestamptz,
  primary key ("giveawayId", "userId")
);
create index spin_giveaway_view_user on "spinGiveawayView"("userId");
