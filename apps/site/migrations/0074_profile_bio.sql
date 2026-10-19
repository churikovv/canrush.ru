-- Short profile description shown under the name in the profile header and in member search.
alter table "user" add column bio text check (bio is null or char_length(bio) between 1 and 160);
