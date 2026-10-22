# Canrush для Android

Оболочка Capacitor 8: WebView открывает живой `https://canrush.ru`. Первая публикация — RuStore,
Google Play — позже тем же проектом.

## Окружение

- Android Studio и Android SDK 36 в `~/Library/Android/sdk` (`android/local.properties` с `sdk.dir`, в git не попадает).
- JDK 21 для Gradle 8.14 (JBR 25 из Android Studio Gradle 8.14 не запускает):
  `brew install openjdk@21`, затем `export JAVA_HOME=/opt/homebrew/opt/openjdk@21 ANDROID_HOME=~/Library/Android/sdk`.
- Node ≥ 22.
- Эмулятор: AVD `canrush_api36` (Pixel 7, Android 16, arm64), `~/Library/Android/sdk/emulator/emulator -avd canrush_api36`.

## Команды (из корня)

```bash
npm -w apps/android run sync        # перенести capacitor.config.ts и плагины в android/
npm -w apps/android run open        # открыть проект в Android Studio
npm -w apps/android run apk:debug   # отладочный APK → android/app/build/outputs/apk/debug/
npm -w apps/android run icons       # перерисовать иконки и заставку из apps/site/src/app/icon.svg
```

Отладка на локальном сайте (эмулятор видит Mac как `10.0.2.2`):

```bash
CANRUSH_APP_URL=http://10.0.2.2:3000 CANRUSH_APP_DEBUG=1 npm -w apps/android run sync
```

Перед релизной сборкой снова запусти `sync` без этих переменных.

## Что уже есть

- `server.url` + `errorPath`: без сети показывается `www/offline.html` с кнопкой «Повторить».
- User-Agent дополняется `CanrushApp/Android` — по нему сайт может узнать приложение.
- Ссылки на другие домены открываются во внешних приложениях; t.me на бота или канал —
  сразу в Telegram через `tg://resolve` (`TelegramLinksPlugin`), иначе Telegram не из Google Play
  открывался через Chrome.
- Кнопка «Назад» листает историю WebView, на первой странице закрывает приложение (`@capacitor/app`).
- App Links на `canrush.ru` (`MainActivity` открывает ссылку в WebView). Заработают после
  `/.well-known/assetlinks.json` на сайте с SHA-256 ключа подписи.
- Геолокация для выбора города.
- Поля фото на сайте открывают выбор «Камера / Фото и видео» (`MediaChooserChromeClient`;
  Capacitor сам по себе даёт только галерею). Разрешение CAMERA не объявлено намеренно.
- Сайт узнаёт приложение и зовёт нативные модули через `apps/site/src/lib/native-app.ts`:
  «Поделиться» — системное меню (в WebView нет `navigator.share`), вход через Telegram — сразу
  переход на t.me без пустой вкладки.

- Быстрые действия по долгому нажатию на иконку: «Отметить банку», «Поиск», «Цены», «Маркет»
  (`res/xml/shortcuts.xml`).
- Вход по паролю для проверяющего магазина — только в приложении, ссылка «Вход по паролю» на
  странице входа. Настройка: `npm -w apps/site run review:password`, затем `REVIEW_LOGIN_EMAIL` и
  `REVIEW_LOGIN_PASSWORD_HASH` в `apps/site/.env.local` на сервере; почту и пароль — в Play Console →
  «Доступ к приложению» и в комментарии для модерации RuStore.

## Push-уведомления

- Сайт: уведомления и события маркета уходят и в push (`apps/site/src/lib/push/`). Устройство
  регистрируется после входа, канал «Уведомления Canrush» создаёт `CanrushPushPlugin`.
- FCM: создать проект Firebase, добавить Android-приложение `ru.canrush.app`, положить
  `google-services.json` в `android/app/` и пересобрать. На сервере — JSON сервисного аккаунта
  (Firebase → Настройки проекта → Сервисные аккаунты) файлом вне репозитория, путь в
  `FCM_SERVICE_ACCOUNT_FILE`. Без `google-services.json` приложение просто не просит разрешение.
- RuStore Push (телефоны без сервисов Google): SDK `ru.rustore.sdk:pushclient` 7.5.0, ID проекта — в
  `AndroidManifest.xml` (не секрет), сервисный токен — только на сервере (`RUSTORE_PUSH_PROJECT_ID`,
  `RUSTORE_PUSH_TOKEN`). Сайт берёт токен RuStore (`CanrushPush.rustoreToken()`), если FCM нет в сборке
  или его регистрация не удалась. Нужны установленный RuStore и подпись релизным ключом, чей SHA-256
  указан в консоли RuStore; нажатие на уведомление открывает `https://canrush.ru/…` как deep link.

## Подпись

- Ключ релиза: `~/.canrush-signing/canrush-release.jks` (alias `canrush`, RSA 4096, до 2056 года),
  пароли — в `~/.canrush-signing/keystore.properties` рядом. Gradle берёт их оттуда (другой путь —
  `CANRUSH_KEYSTORE`); в репозитории ключа и паролей нет.
- SHA-256 сертификата (RuStore, RuStore Push, `assetlinks.json`):
  `6A:B9:4C:53:E1:99:C3:EC:7F:64:E2:74:92:C2:D9:93:FD:B1:52:9D:20:97:2A:CF:F5:5F:58:C3:EF:F0:97:27`.
  В Google Play этим ключом подписывается загрузка, а пользователям приложение подписывает Google —
  его отпечаток для `assetlinks.json` будет в Play Console → «Целостность приложения».
- Релиз: `npm -w apps/android run bundle:release` → `app-release.apk` (RuStore) и `app-release.aab` (Google Play)
  в `android/app/build/outputs/`.
- Потеря ключа = обновления в RuStore выпустить нельзя. Храни копию `.jks` и паролей в менеджере паролей.
