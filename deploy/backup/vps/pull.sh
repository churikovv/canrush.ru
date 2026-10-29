#!/bin/bash
# CanRush backups on the backup VPS (cron, see /etc/cron.d/canrush-backup): pulls the newest encrypted copy from the
# main VPS with a key that may only `list` and `get` there (serve.sh), checks its sha256, and keeps 7 daily, 4 weekly
# and 6 monthly copies (prune.py). The copies stay encrypted here: only the owner's private key reads them. If no new
# copy arrived for 30 hours, the owner hears it in Telegram.
set -euo pipefail
DIR=/opt/canrush-backup
STORE=/var/backups/canrush
source "$DIR/pull.env"   # MAIN=root@<main VPS>
SSH=(ssh -i /root/.ssh/canrush_backup -o BatchMode=yes -o ConnectTimeout=20 "$MAIN")
umask 077
mkdir -p "$STORE"
fail() { "$DIR/notify.sh" "⚠️ Бэкап CanRush не забран на резервный сервер: $1"; exit 1; }
LATEST=$("${SSH[@]}" list | sort | tail -1) || fail "основной сервер не отвечает"
[ -n "$LATEST" ] || fail "на основном сервере нет копий"
if [ ! -f "$STORE/$LATEST" ]; then
  "${SSH[@]}" get "$LATEST" > "$STORE/$LATEST.part" || fail "не удалось скачать $LATEST"
  "${SSH[@]}" get "$LATEST.sha256" > "$STORE/$LATEST.sha256" || fail "нет контрольной суммы $LATEST"
  mv "$STORE/$LATEST.part" "$STORE/$LATEST"
  ( cd "$STORE" && sha256sum -c --status "$LATEST.sha256" ) || { rm -f "$STORE/$LATEST"; fail "контрольная сумма $LATEST не сошлась"; }
  echo "$(date -u +%FT%TZ) pulled $LATEST $(stat -c %s "$STORE/$LATEST")" >> "$DIR/pull.log"
fi
python3 "$DIR/prune.py" "$STORE"
# The newest copy older than 30 hours means the main VPS stopped making them.
NEWEST=$(ls -1t "$STORE"/canrush-*.tar.age | head -1)
[ $(( $(date +%s) - $(stat -c %Y "$NEWEST") )) -lt $((30 * 3600)) ] || fail "последней копии больше 30 часов ($(basename "$NEWEST"))"
