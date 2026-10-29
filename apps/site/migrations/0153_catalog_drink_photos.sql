-- More photos of a member-added drink besides the can on the cover: the back with the label, the can in hand, the shop
-- shelf. Optional, up to five, re-encoded like review photos; shown as a swipeable row on the drink page and to the
-- moderator next to the request. Public with the drink once it is published, before that to the author and the team.
create table "catalogDrinkPhoto" (
  id uuid primary key default gen_random_uuid(),
  "drinkId" uuid not null references "catalogDrink"(id) on delete cascade,
  position smallint not null check (position between 0 and 4),
  data bytea not null check (octet_length(data) between 1 and 2097152),
  thumbnail bytea not null check (octet_length(thumbnail) between 1 and 262144),
  unique ("drinkId", position)
);
alter table "catalogDrinkPhoto" alter column data set storage external;
