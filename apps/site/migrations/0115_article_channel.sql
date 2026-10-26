-- Telegram-канал, который автор прикрепляет к статье (как «Канал автора» у отзывов). Пусто — канала нет.
alter table article add column "telegramChannel" text check ("telegramChannel" is null or "telegramChannel" ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$');
