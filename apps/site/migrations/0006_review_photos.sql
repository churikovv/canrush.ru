create table "reviewPhoto" (
  "id" uuid primary key default gen_random_uuid(),
  "reviewId" uuid not null references "review" ("id") on delete cascade,
  "position" smallint not null check ("position" between 0 and 4),
  "data" bytea not null check (octet_length("data") between 1 and 2097152),
  "thumbnail" bytea not null check (octet_length("thumbnail") between 1 and 262144),
  unique ("reviewId", "position")
);
