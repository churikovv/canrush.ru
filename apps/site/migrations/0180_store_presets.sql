-- Свои шаблоны ассортимента: участник сохраняет список напитков под своим названием и добавляет его в форме магазина. Шаблон видит только
-- он сам, и в нём только напитки: цены у каждой точки свои. Удаляются вместе с аккаунтом.
create table "storePreset" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  "createdAt" timestamptz not null default now()
);
create unique index store_preset_name on "storePreset"("userId", lower(name));
