-- "Двигатель беты": the first 500 members get a personal number and the "engine" tag.
-- A number is never reused: a deleted account keeps its row with "userId" null, so the counter only grows.
create table "betaEngine" (
  number integer primary key check (number between 1 and 500),
  "userId" text unique references "user"(id) on delete set null,
  "assignedAt" timestamptz not null default now()
);

create function assign_beta_engine(member text) returns integer language plpgsql as $$
declare assigned integer;
begin
  -- Serializes concurrent sign-ups so two members never race for the same number.
  perform pg_advisory_xact_lock(hashtext('betaEngine'));
  select coalesce(max(number), 0) + 1 into assigned from "betaEngine";
  if assigned > 500 or exists(select 1 from "betaEngine" where "userId" = member) then return null; end if;
  insert into "betaEngine" (number, "userId") values (assigned, member);
  insert into "profileAchievement" ("userId", key) values (member, 'engine') on conflict do nothing;
  return assigned;
end $$;

create function beta_engine_member() returns trigger language plpgsql as $$
begin
  perform assign_beta_engine(new.id);
  return new;
end $$;
create trigger beta_engine_member after insert on "user" for each row execute function beta_engine_member();

-- Members who are already here, in sign-up order.
do $$
declare member record;
begin
  for member in select id from "user" order by "createdAt", id limit 500 loop
    perform assign_beta_engine(member.id);
  end loop;
end $$;

-- 0072 added "energizer" without allowing it as a profile tag; both special tags are allowed now.
alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller','top','drink-start','streak-7','streak-14','streak-30','energizer','engine']::text[]
);
