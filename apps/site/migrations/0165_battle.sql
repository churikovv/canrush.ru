-- «Битва банок»: бой с ботом за колечки, из которых собираются подарочные крутки Банкомата.

-- Колечки — свой журнал, как крышки и осколки: начисление (+) за победу, списание (-) за сборку крутки.
create table "ringLedger" (
  "userId" text not null references "user"(id) on delete cascade,
  reason text not null check (reason in ('battle','craft')),
  "sourceKey" text not null check (char_length("sourceKey") between 1 and 300),
  amount integer not null check (amount <> 0 and amount between -1000 and 100),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", reason, "sourceKey")
);
create index "ringLedger_daily_idx" on "ringLedger" ("userId", reason, "createdAt");

alter table "spinLedger" drop constraint "spinLedger_reason_check";
alter table "spinLedger" add constraint "spinLedger_reason_check" check (reason in ('giveaway','pull','craft'));

-- Числа карт на сезон (месяц по Москве): считаются один раз, поэтому отзыв не меняет карту посреди сезона.
create table "battleCardStat" (
  season text not null check (season ~ '^\d{4}-\d{2}$'),
  brand text not null check (char_length(brand) between 1 and 120),
  flavor text not null check (char_length(flavor) between 1 and 120),
  cost smallint not null check (cost between 1 and 10),
  attack smallint not null check (attack between 1 and 20),
  health smallint not null check (health between 1 and 20),
  keyword text check (keyword in ('shield','match','taunt','loyal','rush')),
  primary key (season, brand, flavor)
);

-- Бой целиком лежит в строке: выкатка сайта его не обрывает. Руку соперника и зерно видит только сервер.
create table "battle" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  status text not null default 'active' check (status in ('active','won','lost')),
  state jsonb not null,
  "createdAt" timestamptz not null default now(),
  "finishedAt" timestamptz
);
create unique index "battle_one_active" on "battle" ("userId") where status = 'active';
create index "battle_user_idx" on "battle" ("userId", "createdAt" desc);
