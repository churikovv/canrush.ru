-- Вопросы о напитках в кабинете бизнеса: о новом вопросе к подтверждённому напитку компании узнают её владелец и активная
-- команда — уведомлением `business-question` на сайте, в Telegram и в приложении (триггеры зеркал берут любое уведомление).
-- Как `business-review`: не автору вопроса, не от заблокированного сайтом, выключается в настройках кабинета
-- (`notificationPreference`, общий фильтр уведомлений).
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post','reminder','weekly-top','top-bonus','drink-bonus','hunt-order','store-moderation','question-answer','duel-invite','card-trade','business-question'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review','business-reply','company-post','reminder','question-answer','card-trade','business-question'));

create function notify_business_question() returns trigger language plpgsql as $$
begin
  if exists(select 1 from "userBlock" where "userId" = new."userId") then return null; end if;
  insert into notification("userId", "actorId", kind, "eventKey", payload)
  select distinct people."userId", new."userId", 'business-question', 'business-question:' || new.id,
    jsonb_build_object('brand', new.brand, 'flavor', new.flavor, 'business', b.name, 'questionId', new.id, 'text', left(new.text, 160))
  from "businessDrink" d
  join business b on b.id = d."businessId" and b.status = 'approved'
  join lateral (select b."ownerId" as "userId" union select m."userId" from "businessMember" m where m."businessId" = b.id and m.status = 'active') people on true
  where d.brand = new.brand and d.flavor = new.flavor and d.status = 'approved' and people."userId" <> new."userId"
  on conflict ("userId", "eventKey") do nothing;
  return null;
exception when foreign_key_violation then return null;
end $$;
create trigger drink_question_business_notify after insert on "drinkQuestion" for each row execute function notify_business_question();
