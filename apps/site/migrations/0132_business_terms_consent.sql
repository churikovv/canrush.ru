-- The «Условия для бизнеса» a company accepted when it applied (or applied again after a refusal): when and which
-- edition (its date), so the consent can be shown later.
alter table business add column "termsAcceptedAt" timestamptz, add column "termsVersion" text check ("termsVersion" is null or char_length("termsVersion") <= 20);
