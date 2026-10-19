-- Personal Telegram account a member chooses to show on the profile (stored without "@" or "t.me/").
alter table "user" add column "telegramUsername" text;
alter table "user" add constraint user_telegram_username check ("telegramUsername" is null or "telegramUsername" ~* '^[a-z][a-z0-9_]{3,31}$');
