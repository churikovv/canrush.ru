-- Business plans: «Старт» (free), «Бренд» and «Сеть». A plan runs until "planUntil"; past it the company is on «Старт».
-- `founder` — one of the first 20 approved companies: three months of «Бренд» free and the founder price after.
alter table business
  add column plan text not null default 'start' check (plan in ('start', 'brand', 'network')),
  add column "planUntil" timestamptz,
  add column founder boolean not null default false;
-- Companies approved before plans existed are the pilot: three months of «Бренд» from today.
update business set plan = 'brand', "planUntil" = now() + interval '90 days', founder = true where status = 'approved';

-- Paying by invoice: the company asks for a plan with its requisites, the team sends the invoice and marks it paid,
-- which extends the plan.
create table "businessPlanRequest" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text references "user"(id) on delete set null,
  plan text not null check (plan in ('brand', 'network')),
  period text not null check (period in ('month', 'year')),
  payer text not null check (char_length(payer) between 2 and 200),
  inn text not null check (inn ~ '^[0-9]{10}([0-9]{2})?$'),
  email text not null check (char_length(email) between 5 and 254),
  comment text check (comment is null or char_length(comment) <= 500),
  status text not null default 'pending' check (status in ('pending', 'invoiced', 'paid', 'cancelled')),
  "adminNote" text check ("adminNote" is null or char_length("adminNote") <= 500),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index business_plan_request_queue on "businessPlanRequest"(status, "createdAt");
create unique index business_plan_request_open on "businessPlanRequest"("businessId") where status in ('pending', 'invoiced');

-- Promotion by request: placement, budget and wishes; the team agrees it and registers each placement with an ad
-- data operator (ОРД) — `erid` is the token the placement is shown with.
create table "businessPromoRequest" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text references "user"(id) on delete set null,
  placement text not null check (placement in ('picks', 'dating', 'catalog', 'stories')),
  budget int not null check (budget between 1000 and 10000000),
  comment text check (comment is null or char_length(comment) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'running', 'done', 'declined')),
  erid text check (erid is null or char_length(erid) <= 100),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index business_promo_request_queue on "businessPromoRequest"(status, "createdAt");
