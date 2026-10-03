-- Executed once, atomically with the migration journal entry by migrate.mjs.
-- Keep the original ratings, including composition, for recovery and auditing.
alter table review add column "legacyRatings" jsonb;
alter table review drop constraint review_design_check;
alter table review drop constraint review_taste_check;
alter table review alter column composition drop not null;

-- ALTER TABLE holds an exclusive lock until commit. Temporarily suspend only
-- the moderation guard so existing reviews by blocked users are converted too.
alter table review disable trigger review_prevent_blocked_contribution;
update review set "legacyRatings" = jsonb_build_object('scale', 5, 'design', design, 'taste', taste, 'composition', composition),
  design = design * 2, taste = taste * 2;
alter table review enable trigger review_prevent_blocked_contribution;

alter table review add constraint review_design_check check (design between 1 and 10);
alter table review add constraint review_taste_check check (taste between 1 and 10);
comment on column review."legacyRatings" is 'Original 1–5 ratings captured by migration 0012; never changed by review editing.';
comment on column review.composition is 'Retired 1–5 criterion. Historical values retained; NULL for new reviews; excluded from ratings.';
