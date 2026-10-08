alter table "marketListing" add column brand text;
alter table "marketListing" add column "anyCity" boolean not null default false;
create index "marketListing_brand_city" on "marketListing"(brand,city) where not closed and "deletedAt" is null;
