-- Точки продаж компании (`src/lib/business-points.ts`): где купить её напитки или где стоят её магазины. Добавляют
-- владелец и менеджеры подтверждённой компании в кабинете, точка всегда на карте: координаты даёт геокодер по адресу.
-- Публично — вкладка «Где купить» профиля компании, раздел `points` в «Что показывать».
create table "businessPoint" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text references "user"(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('store', 'kiosk', 'cafe', 'vending', 'wholesale', 'other')),
  city text not null check (char_length(city) between 2 and 60),
  address text not null check (char_length(address) between 3 and 200),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  hours text check (hours is null or char_length(hours) between 1 and 80),
  note text check (note is null or char_length(note) between 1 and 200),
  -- Напитки компании в этой точке: [{brand, flavor}], только её подтверждённые (проверяет сервер).
  drinks jsonb not null default '[]'::jsonb check (jsonb_typeof(drinks) = 'array' and jsonb_array_length(drinks) <= 60),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index business_point_business on "businessPoint" ("businessId", city, name);
-- Одна и та же точка дважды: то же название в том же месте (до метра).
create unique index business_point_place on "businessPoint" ("businessId", lower(name), round(latitude::numeric, 5), round(longitude::numeric, 5));
create trigger "businessPoint_freeze" before insert on "businessPoint" for each row execute function prevent_frozen_posting('userId');

alter table business drop constraint "business_profileHidden_check";
alter table business add constraint "business_profileHidden_check" check ("profileHidden" <@ array['store', 'presentations', 'drinks', 'listings', 'awards', 'points']::text[]);
