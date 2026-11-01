-- Команда может снять опубликованный магазин: он возвращается автору черновиком с причиной, а правка автора снова отправляет его на проверку.
-- Награды охоты и опыт привязаны к магазину, поэтому повторная публикация не платит второй раз. Об этом и об удалении автор узнаёт уведомлением.
alter table "marketStore" drop constraint "marketStore_status_check";
alter table "marketStore" add constraint "marketStore_status_check" check (status in ('draft', 'pending', 'published', 'rejected'));

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus','drink-bonus','hunt-order','store-moderation'));
