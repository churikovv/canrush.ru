-- Задания дня в Банкомате: награда за выполненное задание — строка журнала крышек. Ключ `<день по Москве>:<задание>`,
-- поэтому одно задание платит один раз за день. Сами задания и суммы — в коде (`gacha-quests-fields.ts`), их выполнение
-- сервер считает по настоящим действиям участника.
alter table "capLedger" drop constraint "capLedger_reason_check";
alter table "capLedger" add constraint "capLedger_reason_check"
  check (reason in ('welcome','drink-day','review','tierlist','swipes','streak','pull','quest'));
