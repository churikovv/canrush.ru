-- «Рецензия на отзывы»: GigaChat's brief on the reviews of one drink for the companies attached to it. Each run is a row
-- (the latest per drink is shown), so the company's daily limit and the cooldown are counted from here.
create table "businessReviewDigest" (
  id bigint generated always as identity primary key,
  brand text not null,
  flavor text not null,
  "businessId" uuid references business(id) on delete set null,
  digest jsonb not null,
  "reviewCount" integer not null,
  "lastReviewAt" timestamptz not null,
  model text not null,
  "createdAt" timestamptz not null default now()
);
create index business_review_digest_drink on "businessReviewDigest"(brand, flavor, "createdAt" desc);
create index business_review_digest_business on "businessReviewDigest"("businessId", "createdAt" desc);
