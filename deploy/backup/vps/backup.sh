#!/bin/bash
# CanRush nightly backup on the main VPS (cron, see /etc/cron.d/canrush-backup): a pg_dump of the site database in
# custom format, checked with pg_restore --list, plus the compose .env, packed and encrypted with age to the owner's
# SSH public key (recipients.txt) — only the owner's private key can read it. The backup VPS pulls the files
# (serve.sh); the last three stay here until then. Any failure is sent to the owner in Telegram.
set -euo pipefail
DIR=/opt/canrush-backup
OUT=/var/backups/canrush
COMPOSE="docker compose -f /opt/canrush/docker-compose.yml"
umask 077
fail() { "$DIR/notify.sh" "⚠️ Бэкап CanRush на основном сервере не сделан: $1"; exit 1; }
trap 'fail "ошибка на строке $LINENO"' ERR
STAMP=$(date -u +%Y-%m-%dT%H%MZ)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
$COMPOSE exec -T postgres pg_dump -U canrush -d canrush -Fc -Z 6 > "$WORK/canrush.dump"
[ -s "$WORK/canrush.dump" ] || fail "пустой дамп"
$COMPOSE exec -T postgres pg_restore --list < "$WORK/canrush.dump" > /dev/null || fail "дамп не читается"
cp /opt/canrush/.env "$WORK/env"
tar -C "$WORK" -cf - canrush.dump env | age -R "$DIR/recipients.txt" -o "$OUT/canrush-$STAMP.tar.age"
( cd "$OUT" && sha256sum "canrush-$STAMP.tar.age" > "canrush-$STAMP.tar.age.sha256" )
# Keep the three newest here: the backup VPS pulls nightly, a short outage there loses nothing.
ls -1t "$OUT"/canrush-*.tar.age | tail -n +4 | while read -r old; do rm -f "$old" "$old.sha256"; done
echo "$(date -u +%FT%TZ) ok canrush-$STAMP.tar.age $(stat -c %s "$OUT/canrush-$STAMP.tar.age")" >> "$DIR/backup.log"
