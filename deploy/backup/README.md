# PostgreSQL → Яндекс Диск

Хранение: 2 ежедневные, 2 еженедельные и 1 ежемесячная копия.
Запуск ежедневно около 04:00 по Москве. Неделя — ISO, с понедельника.
Первый успешный запуск дня/недели/месяца сохраняет копию этого периода.
После пропущенного запуска systemd запускает задачу при включении сервера.
Исторические копии за пропущенные периоды не создаются.
В первый день будет по одной копии в трёх папках; постепенно останутся пять.

Дамп создаётся через pg_dump -Fc в работающем контейнере postgres, без остановки сайта.
Перед загрузкой проверяется оглавление pg_restore --list; после загрузки — SHA-256
обратно скачанного расшифрованного файла. Это не заменяет пробное восстановление.
Публикуется только проверенный файл: загрузка сначала идёт в .partial.
При сбое загрузки ротация не выполняется. Неудачный .partial может остаться на Диске;
его можно удалить вручную, завершённые .dump не трогать.
Удаляются только собственные файлы canrush-*.dump установленного формата в трёх
папках. Никакого sync/purge. Яндекс может сохранять удалённое в корзине — проверяйте
занятое место; скрипт не очищает общую корзину.

## Подключение на VPS (Ubuntu/Debian)

Сначала получите файлы из main и перейдите в каталог проекта:

```bash
cd /opt/canrush
git pull --ff-only origin main
sudo apt-get update
sudo apt-get install -y python3 rclone tzdata
sudo rclone config
```

В rclone config создайте:
1. remote с именем **yandex**, тип **yandex**. На сервере без браузера ответьте
   **n** на автоматическую авторизацию. Выполните предложенную rclone команду
   авторизации на своём компьютере с браузером и rclone, результат вставьте
   непосредственно в терминал VPS. Не присылайте токен в чат.
2. remote **canrush-backup**, тип **crypt**, remote/path:
   **yandex:CanrushBackups**. Шифрование имён **standard**, папок **true**.
   Сгенерируйте пароль и salt и сохраните их в менеджере паролей.

Сохраните также резервную копию /root/.config/rclone/rclone.conf вне VPS
в защищённом хранилище. Она содержит доступ к Диску и ключи расшифровки.
Без ключей восстановление невозможно. Конфигурация для unattended запуска
не должна требовать ввода пароля при каждом запуске.

```bash
sudo chmod 600 /root/.config/rclone/rclone.conf
sudo rclone mkdir canrush-backup:
sudo rclone lsd canrush-backup:
sudo install -m 644 deploy/backup/canrush-backup.service /etc/systemd/system/
sudo install -m 644 deploy/backup/canrush-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start canrush-backup.service
sudo journalctl -u canrush-backup.service -n 50 --no-pager
```

Если первый запуск успешен, включите расписание:

```bash
sudo systemctl enable --now canrush-backup.timer
sudo systemctl list-timers canrush-backup.timer
sudo rclone lsf canrush-backup: --recursive
```

Сбой помечает service как failed и записывается в journal.
Внешние уведомления пока не настроены. Проверка:

```bash
sudo systemctl status canrush-backup.service --no-pager
sudo journalctl -u canrush-backup.service --since '7 days ago'
```

Скрипт блокирует одновременные запуски. Временный незашифрованный дамп хранится
в /var/lib/canrush-backup с доступом только root, после запуска удаляется.
Нужно свободное место примерно под один сжатый дамп. После аварийного выключения
могут остаться каталоги dump-*; удаляйте их только при остановленном service.

Переопределения при необходимости в /etc/canrush-backup.env (root, 600):
CANRUSH_ROOT, BACKUP_STATE, BACKUP_REMOTE, RCLONE_CONFIG.
BACKUP_REMOTE должен ссылаться на remote типа crypt.

## Проверка восстановления

Выберите имя из rclone lsf, скачайте в закрытую папку:

```bash
sudo -i
umask 077
mkdir -p /root/canrush-restore
rclone lsf canrush-backup:daily/
# Подставьте существующее имя:
rclone copyto canrush-backup:daily/canrush-YYYY-MM-DD.dump /root/canrush-restore/database.dump
cd /opt/canrush
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" canrush_restore_check'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d canrush_restore_check --exit-on-error --no-owner --no-privileges' < /root/canrush-restore/database.dump
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d canrush_restore_check -c "\dt"'
```

Команды создают отдельную проверочную БД, рабочая БД не изменяется.
После проверки удалите только canrush_restore_check и скачанный дамп.
При повторной проверке используйте новое имя БД, если предыдущая ещё существует.

Резервируется только БД. Файлы вне PostgreSQL (фотографии, каталог и история
парсера в Docker volumes), конфигурация VPS и секреты требуют отдельных копий.

Документация:
- https://rclone.org/yandex/
- https://rclone.org/remote_setup/
- https://rclone.org/crypt/

## Ошибка 410 GoneError

Если даже `rclone lsd yandex:` возвращает 410, это не ошибка systemd:
проверьте `rclone version` и доступ через базовый remote. Аналогичная проблема
зарегистрирована в rclone: https://github.com/rclone/rclone/issues/10067.
Не включайте расписание, пока проверка доступа и первый бэкап не успешны.
Не публикуйте содержимое rclone.conf, OAuth-токены или ключи crypt.
