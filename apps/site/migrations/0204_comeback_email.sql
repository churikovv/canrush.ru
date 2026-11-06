-- Письмо «Что нового на CanRush» тем, кто давно не заходил (`src/lib/comeback-email.ts`): самое интересное на сайте
-- сейчас — премия или другое событие, непрочитанные уведомления, новые напитки, популярное за неделю, статьи. Каждое
-- письмо — строка журнала (участник и день по Москве: второе в тот же день не уйдёт), сбой отправки помечается.
-- Отписка — переключатель в настройках уведомлений и ссылка в письме, вид `comeback-email` в `notificationPreference`.
create table "comebackEmail" (
  "userId" text not null references "user"(id) on delete cascade,
  day date not null,
  "sentAt" timestamptz not null default now(),
  "failedAt" timestamptz,
  primary key ("userId", day)
);
create index comeback_email_user_sent on "comebackEmail" ("userId", "sentAt" desc);

alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review','business-reply','company-post','reminder','question-answer','card-trade','business-question','comeback-email'));
