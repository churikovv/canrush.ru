-- A market listing published on behalf of a company: the seller is still the member who wrote it (orders and chat go
-- to them), the market shows the company's name and logo. A deleted company leaves a personal listing.
alter table "marketListing" add column "businessId" uuid references business(id) on delete set null;
create index market_listing_business on "marketListing"("businessId") where "businessId" is not null;
