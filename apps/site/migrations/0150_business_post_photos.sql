-- Photos on a company's wall posts (news with pictures): up to four still images per post, re-encoded to WebP like
-- review photos, served only while the company is public. A post may now be photos alone, so «text or a file» moves
-- from the table to `createCompanyPost` (photos are inserted after the post, in the same transaction).
alter table "businessPost" drop constraint "businessPost_check1";

create table "businessPostPhoto" (
  id uuid primary key default gen_random_uuid(),
  "postId" uuid not null references "businessPost"(id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  data bytea not null check (octet_length(data) between 1 and 2097152),
  thumbnail bytea not null check (octet_length(thumbnail) between 1 and 262144),
  unique ("postId", position)
);
alter table "businessPostPhoto" alter column data set storage external;
