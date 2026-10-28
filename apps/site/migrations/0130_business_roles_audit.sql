-- Team roles: a manager works in the cabinet (replies, drinks, company listings, templates), an analyst only looks
-- (analytics, competitors, exports). Invitations carry the role into the team.
alter table "businessMember" add column role text not null default 'manager' check (role in ('manager', 'analyst'));
alter table "businessEmailInvite" add column role text not null default 'manager' check (role in ('manager', 'analyst'));

-- What the team did in the cabinet: who, what and on which object. Kept with the company; a removed member stays as
-- a name-less row (`userId` null).
create table "businessAuditLog" (
  id bigserial primary key,
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text references "user"(id) on delete set null,
  action text not null check (char_length(action) between 1 and 40),
  target text check (target is null or char_length(target) <= 200),
  "createdAt" timestamptz not null default now()
);
create index business_audit_log_business on "businessAuditLog"("businessId", "createdAt" desc);
