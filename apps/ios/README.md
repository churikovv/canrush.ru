# Canrush для iPhone, iPad и iPhone Duo

Оболочка Capacitor 8, как и Android-версия (`apps/android`): WKWebView открывает живой `https://canrush.ru`.
Отдельный проект, а не платформа в `apps/android`, чтобы релизы для App Store и RuStore не зависели друг от друга.
Bundle ID — `ru.canrush.app` (после публикации не меняется), пакеты — Swift Package Manager, без CocoaPods.

## Окружение

- **Xcode 27.1 или новее** (iOS 27.1 SDK). Только сборка на этом SDK растягивает приложение на весь внутренний экран
  iPhone Duo и получает метку «Made for iPhone Duo»; на старом SDK оно запустится с чёрными полями. С SDK iOS 27 приложение
  без сценного жизненного цикла (UIScene) не запускается — он здесь уже есть (`SceneDelegate`).
- После установки: `sudo xcode-select -s /Applications/Xcode.app` (иначе `xcodebuild` ищет Command Line Tools).
- Аккаунт Apple Developer (Team ID нужен сайту и для подписи).
- Node ≥ 22.

## Команды (из корня)

```bash
npm -w apps/ios run sync        # перенести capacitor.config.ts и плагины в ios/ (Package.swift)
npm -w apps/ios run open        # открыть ios/App/App.xcodeproj в Xcode
npm -w apps/ios run build:sim   # отладочная сборка под симулятор без подписи → ios/build
npm -w apps/ios run icons       # перерисовать иконку и заставку из apps/site/src/app/icon.svg
```

Отладка на локальном сайте (симулятор видит Mac как `localhost`):

```bash
CANRUSH_APP_URL=http://localhost:3000 CANRUSH_APP_DEBUG=1 npm -w apps/ios run sync
```

Перед релизной сборкой снова запусти `sync` без этих переменных. `CANRUSH_APP_DEBUG=1` включает Web Inspector в Safari.

## iPhone Duo, iPad и ориентации

- Все ориентации на iPhone и iPad, `UIRequiresFullScreen = false`: Split View, Stage Manager и внутренний экран Duo
  меняют размер окна, а не обрамляют его полями. Сайт адаптивный: на Duo окно от ~382 до ~951 CSS px, от 960 px
  включается шапка компьютерной версии.
- Одно окно (`UIApplicationSupportsMultipleScenes = false`): сайт держит состояние в одном WebView.
- `AppDelegate` отдаёт `SceneDelegate` только роли `windowApplication`. Шаблон Capacitor 8.5 отдавал его любой роли,
  и внешний экран или AirPlay запускали вторую копию сайта (ionic-team/capacitor#8648).
- Сайт рисуется от края до края (`contentInset: never`, `viewport-fit=cover`) и сам отступает от выреза, скруглений и
  домашней полосы через `env(safe-area-inset-*)`, в альбомной ориентации — и по бокам. На экране Duo 466×678
  статус-бар — колонка справа (безопасная зона ~84 px), полоса рядом со страницей залита цветом шапки, иначе тёмные
  значки статуса пропадают.
- Сгиб Duo: WKWebView не сообщает о нём без флага (Viewport Segments и Device Posture в Safari 27.1 — превью за
  флагом). Сайт использует их как улучшение: на раскрытом экране «книжкой» просмотрщик историй встаёт в правую половину.
- Скриншоты для App Store с iPhone Duo станут обязательными с апреля 2027 — сними их в симуляторе Duo в Xcode 27.1
  (Device Hub показывает все позы и ориентации).

## Что уже есть

- `server.url` + `errorPath`: без сети показывается `www/offline.html` с кнопкой «Повторить».
- User-Agent дополняется `CanrushApp/iOS`; сайт узнаёт приложение через `apps/site/src/lib/native-app.ts`
  (`isNativeApp`, `isNativeIos`).
- Заставка — фирменный синий с белым знаком (`Splash` в Assets, растягивается с обрезкой под любой экран); сайт прячет
  её сам, когда страница отрисована. Иконка с тёмным и тонированным вариантами для тем iOS 18+.
- «Поделиться» — системное меню (`@capacitor/share`). Скриншоты тирлистов и календаря — через `navigator.share` с файлом:
  в меню есть «Сохранить изображение» (в «Фото»), отдельный нативный модуль, как на Android, не нужен.
- Universal Links на `canrush.ru` (entitlement `applinks:canrush.ru`): ссылки сайта и письмо со входом открываются в
  приложении. Сайт отдаёт `/.well-known/apple-app-site-association`, когда на сервере задан `APPLE_TEAM_ID`.
- Камера, микрофон и геолокация — по системному запросу с описанием из `Info.plist`; манифест приватности
  `PrivacyInfo.xcprivacy` (без отслеживания).
- Вход по паролю для проверяющего App Store — как на Android (`REVIEW_LOGIN_EMAIL`), ссылка «Вход по паролю» видна в
  приложении. Почту и пароль — в App Store Connect → «Информация для проверки приложения».

## Push-уведомления (APNs)

1. developer.apple.com → Certificates, IDs & Profiles → Identifiers → `ru.canrush.app`: включить Push Notifications и
   Associated Domains.
2. Keys → новый ключ с Apple Push Notifications service → скачать `AuthKey_XXXXXXXXXX.p8` (скачивается один раз).
3. На сервере: файл в `/opt/canrush/secrets/`, в `.env` — `APNS_KEY_FILE=/run/secrets/canrush/AuthKey_….p8`,
   `APNS_KEY_ID`, `APNS_TEAM_ID` и `APPLE_TEAM_ID`. `APNS_SANDBOX=1` — только для сборок из Xcode на свой телефон:
   токены App Store и TestFlight — боевые.
4. Сайт регистрирует токен устройства после входа (`PushRegistration`, провайдер `apns`), сервер шлёт через HTTP/2
   (`sendApns` в `apps/site/src/lib/push/providers.ts`), удалённое приложение (410) убирает устройство.

## Публикация

- В Xcode: Signing & Capabilities → Team, затем Product → Archive → Distribute App → App Store Connect.
- Версия — `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` в настройках таргета.
- App Store Connect: политика — `https://canrush.ru/privacy`, удаление аккаунта — `https://canrush.ru/account-deletion`
  (в приложении — Настройки → «О CanRush» → «Документы и связь»), возраст — 18+ (энергетики).
