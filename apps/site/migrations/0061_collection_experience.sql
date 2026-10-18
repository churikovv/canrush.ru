-- Brand collections pay XP for reaching 25/50/75/100% of a brand; "sourceKey" = '<brand>:<percent>'.
alter table "profileExperience" drop constraint "profileExperience_reason_check";
alter table "profileExperience" add constraint "profileExperience_reason_check"
  check (reason in ('review','favorite','tierlist','achievement','monthly-top','drink-day','drink-streak','collection'));
