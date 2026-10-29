-- «Банкомат», этап 2: осколки за дубли и крафт карточек, сезонные баннеры и эксклюзивная косметика (первая — рамка
-- аватарки «Тыквенная» из «Тыквенного автомата»).

-- Осколки — отдельная от крышек валюта: дубль приносит их по редкости (ключ — крутка), крафт недостающей карточки
-- тратит (ключ — напиток, поэтому одну карточку не собрать дважды). Баланс — сумма.
create table "shardLedger" (
  "userId" text not null references "user"(id) on delete cascade,
  reason text not null check (reason in ('dupe','craft')),
  "sourceKey" text not null check (char_length("sourceKey") between 1 and 300),
  amount integer not null check (amount <> 0 and amount between -10000 and 1000),
  "createdAt" timestamptz not null default now(),
  primary key ("userId", reason, "sourceKey")
);

-- Карточка, собранная из осколков, помечена: в альбоме она такая же, но журнал отличает её от выпавшей.
alter table "gachaCard" add column crafted boolean not null default false;

-- Эксклюзивная косметика сезонных баннеров: после закрытия баннера больше не выпадает.
create table "gachaCosmetic" (
  "userId" text not null references "user"(id) on delete cascade,
  key text not null check (key in ('pumpkin')),
  banner text not null check (char_length(banner) between 1 and 40),
  "obtainedAt" timestamptz not null default now(),
  primary key ("userId", key)
);

alter table "user" drop constraint user_profile_appearance;
alter table "user" add constraint user_profile_appearance check (
  jsonb_typeof("profileAppearance") = 'object'
  and "profileAppearance" ?& array['theme','frame']
  and "profileAppearance"->>'theme' in ('default','dark','lavender','mint','gold','ocean','platinum','cobalt','ember','legend')
  and "profileAppearance"->>'frame' in ('none','orbit','pulse','prism','abyss','nova','frost','blaze','liquid','can','legend','pumpkin')
);
