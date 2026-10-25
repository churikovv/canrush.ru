-- Роль модератора. Модератор входит в админ-панель и разбирает заявки (магазины, напитки, жалобы), удаляет контент,
-- блокирует участников и видит аналитику, но без почты участников; ему закрыты администраторы, конкурсы, рекламные
-- кампании и передача магазинов. Все существующие записи остаются администраторами; владелец — всегда администратор.
alter table "siteAdmin" add column role text not null default 'admin' check (role in ('admin', 'moderator'));
alter table "siteAdmin" add constraint "siteAdmin_owner_is_admin" check (not "isOwner" or role = 'admin');
