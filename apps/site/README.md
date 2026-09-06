# @canrush/site

Сайт CanRush на Next.js 16. Текущий MVP реализует публичный вход по одноразовой Magic Link, защищённый профиль и пустое состояние будущего избранного.

## Стек

- Next.js App Router, React, TypeScript
- Better Auth 1.7.2, built-in PostgreSQL adapter
- PostgreSQL через `pg`
- Nodemailer и SpaceWeb SMTP
- Vitest, отдельный integration suite для auth

## Что нужно локально

- Node.js 20.9 или новее
- PostgreSQL
- две отдельные БД: `canrush_site_dev` и `canrush_site_test`
- почтовый ящик SpaceWeb с новым уникальным паролем

Пароль, ранее переданный в чате, использовать нельзя. Сначала смените его в панели SpaceWeb. Новый пароль храните только в `.env.local` или secret manager и не отправляйте в сообщения.

## Настройка

```bash
createdb canrush_site_dev
createdb canrush_site_test
cp apps/site/.env.example apps/site/.env.local
openssl rand -base64 32
```

Результат последней команды внесите в `BETTER_AUTH_SECRET` локально. В `SMTP_PASSWORD` укажите только новый пароль после ротации.

Основные переменные:

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | PostgreSQL для dev |
| `TEST_DATABASE_URL` | Отдельная PostgreSQL для integration-тестов |
| `BETTER_AUTH_URL` | Origin приложения, локально `http://localhost:3000`, без `/api/auth` |
| `BETTER_AUTH_SECRET` | Секрет не короче 32 высокоэнтропийных байт |
| `SMTP_HOST` | `smtp.spaceweb.ru` |
| `SMTP_PORT` | `465`, implicit TLS |
| `SMTP_USER` | Адрес отправителя и SMTP-логин, они должны совпадать |
| `SMTP_PASSWORD` | Новый пароль ящика |
| `MAIL_FROM_NAME` | Отображаемое имя отправителя |

IMAP, POP3 и Webmail приложению не нужны. Они относятся только к чтению ящика; Magic Link использует SMTP.

## База данных

Сначала посмотреть план без изменений:

```bash
npm -w apps/site run db:plan
```

Применить только отсутствующие versioned migrations:

```bash
npm -w apps/site run db:migrate
```

Migration runner хранит checksum в `_canrush_migrations` и отказывается продолжать, если уже применённый SQL был изменён.

## Запуск

Из корня репозитория:

```bash
npm run dev
```

Откройте `http://localhost:3000`. Без заполненного `.env.local` сервер намеренно завершится с ошибкой конфигурации.

## Проверки

```bash
npm run build
npm run lint
npm test
npm -w apps/site run typecheck
npm -w apps/site run test:auth
```

`test:auth` работает только с `canrush_site_test`, использует уникальные адреса и не выполняет `DROP` или `TRUNCATE`.

Ручной smoke test с новым SMTP-паролем:

1. Запросить ссылку на `/sign-in`.
2. Убедиться, что письмо содержит ссылку на `/auth/confirm`, а не сразу на verifier.
3. Открыть письмо. До нажатия кнопки токен не должен погашаться.
4. Нажать «Войти в CanRush» и увидеть `/profile`.
5. Повторно открыть ссылку и получить безопасную ошибку.
6. Выйти и проверить, что `/profile` снова перенаправляет на вход.

## Реализованные меры безопасности

- токен Better Auth живёт 5 минут, хранится как хэш и атомарно погашается один раз;
- email/password и социальные providers отключены;
- запрос письма проверяет trusted origin и ограничивается по IP и HMAC нормализованного email;
- callback URL фиксированы, Host header не используется при создании ссылки;
- interstitial требует явный POST, поэтому GET-сканер почты не расходует токен;
- session cookie серверная, HttpOnly, SameSite=Lax и Secure на HTTPS;
- CSP с nonce, запрет iframe/object, no-store и no-referrer на чувствительных маршрутах;
- SMTP использует port 465, TLS >= 1.2, проверку сертификата и фиксированный From;
- токены, email и секреты не пишутся в application logs.

Magic Link доказывает доступ к почтовому ящику, но не является phishing-resistant MFA. Для административных или других чувствительных действий позже нужны passkeys/WebAuthn либо повторная проверка.

## Перед публичным запуском

На 5 сентября 2026 года авторитетные DNS-серверы `canrush.ru` не возвращают MX, SPF, DKIM и DMARC. Настройте и повторно проверьте:

- MX: `mx1.spaceweb.ru.` priority 10;
- MX: `mx2.spaceweb.ru.` priority 20;
- SPF: `v=spf1 include:_spf.spaceweb.ru ~all`;
- DKIM: включить в панели SpaceWeb и проверить опубликованный selector;
- DMARC: начать с `v=DMARC1; p=none; aspf=r; sp=none`, затем ужесточать после проверки alignment и отчётов.

Также до публикации нужны managed PostgreSQL и логи на территории РФ, TLS и least-privilege роль БД, резервные копии, финальная политика обработки данных, согласие/основание обработки, удаление аккаунта и юридическая проверка требований 152-ФЗ. При злоупотреблении добавьте CAPTCHA/WAF поверх уже действующих лимитов.

## Дизайн

Auth и profile адаптированы из Figma-файла `Canrush | 2026`, узлы `454:2493` и `465:2035`. Локальные SVG/PNG лежат в `public/brand`, лицензированные PP Object Sans Regular/Heavy и slanted-варианты — в `fonts/` и подключены через `next/font/local`.
