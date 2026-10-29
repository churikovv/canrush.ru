-- The brand's own words on its profile, editable by the owner without a new check (unlike the reviewed company data):
-- a short line under the name (`bio`), a long story for «О бренде» and public contacts — e-mail, phone, address.
alter table business
  add column bio text check (bio is null or char_length(bio) <= 160),
  add column story text check (story is null or char_length(story) <= 4000),
  add column "publicEmail" text check ("publicEmail" is null or char_length("publicEmail") <= 254),
  add column phone text check (phone is null or char_length(phone) <= 32),
  add column address text check (address is null or char_length(address) <= 200);
