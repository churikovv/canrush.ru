-- Эмодзи тирлиста: показывается перед названием в карточке и на странице тирлиста.
-- Набор допустимых эмодзи — TIER_LIST_EMOJIS (tier-list-types.ts), его проверяет сервер; здесь только предел длины.
alter table "tierList" add column "emoji" text check ("emoji" is null or char_length("emoji") between 1 and 8);
