create table "adCampaign" (
 id uuid primary key, name text not null, path text not null,
 source text not null, medium text not null, campaign text not null,
 content text not null default '', term text not null default '',
 "createdAt" timestamptz not null default now()
);
create table "adVisit" (
 id uuid primary key, "campaignId" uuid not null references "adCampaign"(id) on delete cascade,
 visitor uuid not null, bucket bigint not null, "createdAt" timestamptz not null default now(),
 unique ("campaignId", visitor, bucket)
);
create index "adVisit_campaign_date" on "adVisit"("campaignId", "createdAt");
create index "adVisit_visitor_date" on "adVisit"(visitor, "createdAt");
create table "adRegistration" (
 "userId" text primary key references "user"(id) on delete cascade,
 "visitId" uuid not null references "adVisit"(id) on delete cascade,
 "createdAt" timestamptz not null default now()
);
create index "adRegistration_visit" on "adRegistration"("visitId");
