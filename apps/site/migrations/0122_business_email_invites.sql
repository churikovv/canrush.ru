-- Team invitations by email, the main way: a letter goes to the address; whoever signs in with it sees the invitation
-- in the cabinet. An address without an account waits here; with an account the invitation becomes a pending member
-- at once. Until accepted the owner sees only the address, so an invitation never tells whether the email has an account.
create table "businessEmailInvite" (
  "businessId" uuid not null references business(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  "invitedBy" text references "user"(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  primary key ("businessId", email)
);
create index business_email_invite_email on "businessEmailInvite"(email);
alter table "businessMember" add column "invitedEmail" text;
