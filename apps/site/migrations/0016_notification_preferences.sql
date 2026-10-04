create table "notificationPreference" (
  "userId" text not null references "user"(id) on delete cascade,
  kind text not null check (kind in ('follow','like','review-comment','wall-comment','price')),
  enabled boolean not null default true,
  primary key ("userId", kind)
);
create function apply_notification_preference() returns trigger language plpgsql as $$
begin
  if exists (select 1 from "notificationPreference" where "userId"=new."userId" and kind=new.kind and not enabled) then
    return null;
  end if;
  return new;
end $$;
create trigger notification_preference before insert on notification for each row execute function apply_notification_preference();
