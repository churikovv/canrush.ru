create table notification (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null references "user"(id) on delete cascade,
  "actorId" text references "user"(id) on delete cascade,
  kind text not null check (kind in ('follow','like','review-comment','wall-comment','price')),
  "eventKey" text not null,
  "reviewId" uuid references review(id) on delete cascade,
  "commentId" uuid references "reviewComment"(id) on delete cascade,
  "wallId" uuid references "profileComment"(id) on delete cascade,
  payload jsonb not null default '{}',
  "createdAt" timestamptz not null default now(),
  "readAt" timestamptz,
  unique ("userId", "eventKey")
);
create index notification_inbox_idx on notification ("userId", "createdAt" desc, id desc);
create index notification_unread_idx on notification ("userId") where "readAt" is null;
create table "favoritePriceWatch" (
  "userId" text not null,
  brand text not null,
  flavor text not null,
  city text not null,
  volume integer not null check (volume > 0),
  price integer not null check (price > 0), -- kopecks, no float comparisons
  "snapshotAt" timestamptz not null,
  primary key ("userId",brand,flavor,city,volume),
  foreign key ("userId",brand,flavor) references favorite("userId",brand,flavor) on delete cascade
);
create function notify_social_event() returns trigger language plpgsql as $$
declare recipient text;
begin
  if TG_TABLE_NAME='userFollow' then
    if new."userId"<>new."targetId" then
      insert into notification ("userId","actorId",kind,"eventKey") values (new."targetId",new."userId",'follow','follow:'||new."userId") on conflict do nothing;
    end if;
  elsif TG_TABLE_NAME='reviewReaction' then
    if new.value=1 then
      select "userId" into recipient from review where id=new."reviewId";
      if recipient<>new."userId" then
        insert into notification ("userId","actorId",kind,"eventKey","reviewId") values (recipient,new."userId",'like','like:'||new."reviewId"||':'||new."userId",new."reviewId") on conflict do nothing;
      end if;
    end if;
  elsif TG_TABLE_NAME='reviewComment' then
    select "userId" into recipient from review where id=new."reviewId";
    if recipient<>new."userId" then
      insert into notification ("userId","actorId",kind,"eventKey","reviewId","commentId") values (recipient,new."userId",'review-comment','comment:'||new.id,new."reviewId",new.id);
    end if;
  elsif TG_TABLE_NAME='profileComment' then
    if new."profileId"<>new."userId" then
      insert into notification ("userId","actorId",kind,"eventKey","wallId") values (new."profileId",new."userId",'wall-comment','wall:'||new.id,new.id);
    end if;
  end if;
  return new;
end $$;
create trigger notification_follow after insert on "userFollow" for each row execute function notify_social_event();
create trigger notification_like after insert or update of value on "reviewReaction" for each row execute function notify_social_event();
create trigger notification_review_comment after insert on "reviewComment" for each row execute function notify_social_event();
create trigger notification_wall_comment after insert on "profileComment" for each row execute function notify_social_event();
