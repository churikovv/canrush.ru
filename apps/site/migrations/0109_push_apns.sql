-- Push iOS-приложения (apps/ios) идёт через APNs: токен устройства Apple — третий вид рядом с FCM и RuStore Push.
alter table "pushDevice" drop constraint "pushDevice_provider_check";
alter table "pushDevice" add constraint "pushDevice_provider_check" check (provider in ('fcm', 'rustore', 'apns'));
