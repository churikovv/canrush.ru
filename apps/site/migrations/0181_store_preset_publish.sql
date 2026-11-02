-- Свой шаблон ассортимента можно показать всем участникам: он попадает в «Шаблоны» формы магазина с ником автора. Модерация после
-- публикации, как у историй и записей: жалоба и удаление командой. Заморозка не даёт опубликовать, но не мешает держать шаблон для себя.
alter table "storePreset" add column "publishedAt" timestamptz;
create index store_preset_published on "storePreset"("publishedAt" desc) where "publishedAt" is not null;
create trigger "storePreset_freeze" before insert or update on "storePreset" for each row when (new."publishedAt" is not null) execute function prevent_frozen_posting('userId');

alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story','article','business-post','business-award','store-preset'
));
