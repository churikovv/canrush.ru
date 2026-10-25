-- Заморозка участника из админки: временный запрет писать на 1, 7 или 30 дней. В отличие от блокировки ("userBlock"),
-- профиль и прежние записи остаются видны, а запрет снимается сам, когда проходит `until`. Сайт показывает понятное
-- сообщение раньше (`frozenMessage` в src/lib/moderation.ts); триггер — страховка для мест, где проверки нет.
create table "userFreeze" (
  "userId" text primary key references "user"(id) on delete cascade,
  until timestamptz not null,
  "frozenBy" text references "user"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

-- TG_ARGV[0] — колонка автора в таблице (userId, sellerId, senderId, ownerId).
create function prevent_frozen_posting() returns trigger language plpgsql as $$
declare
  author text;
  frozen_until timestamptz;
begin
  execute format('select ($1).%I', TG_ARGV[0]) using new into author;
  select until into frozen_until from "userFreeze" where "userId" = author and until > now();
  if frozen_until is not null then
    raise exception 'Аккаунт заморожен до %', to_char(frozen_until at time zone 'Europe/Moscow', 'DD.MM.YYYY HH24:MI') using errcode = 'CR002';
  end if;
  return new;
end $$;

create trigger review_freeze before insert on review for each row execute function prevent_frozen_posting('userId');
create trigger "reviewComment_freeze" before insert on "reviewComment" for each row execute function prevent_frozen_posting('userId');
create trigger "tierListComment_freeze" before insert on "tierListComment" for each row execute function prevent_frozen_posting('userId');
create trigger "profileComment_freeze" before insert on "profileComment" for each row execute function prevent_frozen_posting('userId');
create trigger "wallReply_freeze" before insert on "wallReply" for each row execute function prevent_frozen_posting('userId');
create trigger story_freeze before insert on story for each row execute function prevent_frozen_posting('userId');
create trigger "marketListing_freeze" before insert on "marketListing" for each row execute function prevent_frozen_posting('sellerId');
create trigger "marketMessage_freeze" before insert on "marketMessage" for each row execute function prevent_frozen_posting('senderId');
create trigger "catalogDrink_freeze" before insert on "catalogDrink" for each row execute function prevent_frozen_posting('ownerId');
create trigger "marketStore_freeze" before insert on "marketStore" for each row execute function prevent_frozen_posting('ownerId');
-- A tier list may be drafted while frozen, but not published.
create trigger "tierList_freeze" before insert or update of status on "tierList" for each row when (new.status = 'published')
  execute function prevent_frozen_posting('userId');
