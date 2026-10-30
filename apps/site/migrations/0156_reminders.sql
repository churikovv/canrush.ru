-- Напоминания, которые возвращают участника: вечером о серии трекера, днём о бесплатной крутке Банкомата
-- (src/lib/reminders.ts). Вид один на оба: ключ `reminder:<день по Москве>` и уникальность ("userId", "eventKey") не
-- пропустят второе напоминание за сутки. Выключается в настройках, в Telegram и push уходит через
-- notification_telegram и notification_push, как любое уведомление.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder'));

alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review','business-reply','company-post','reminder'));
