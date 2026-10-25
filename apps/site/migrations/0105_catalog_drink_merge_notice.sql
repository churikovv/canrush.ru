-- Склейка напитка участника с карточкой каталога из админки (catalog-drinks.ts, mergeCatalogDrink): автор получает
-- уведомление `drink-merged` — куда переехали отзывы и отметки и сколько опыта за дубль снято. Отключить его нельзя
-- (как и «Топ месяца»), поэтому в notificationPreference вида нет.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged'));
