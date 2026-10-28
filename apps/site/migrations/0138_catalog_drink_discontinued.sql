-- A drink that is no longer made: the member marks it in the request (or the team in the admin editor), and the
-- published drink goes to the catalog's archive — found by search under «Архивные напитки», out of the main list,
-- the tier list picker, the dating deck and recommendations; reviews and everything else stay.
alter table "catalogDrink" add column discontinued boolean not null default false;
