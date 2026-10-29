#!/bin/sh
# The only command the backup VPS's key may run here (forced in authorized_keys): `list` prints the backup files,
# `get NAME` sends one of them. It cannot delete, write or run anything else.
OUT=/var/backups/canrush
set -- $SSH_ORIGINAL_COMMAND
case "$1" in
  list) cd "$OUT" && ls -1 canrush-*.tar.age 2>/dev/null ;;
  get)
    case "$2" in
      canrush-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9][0-9][0-9]Z.tar.age|canrush-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9][0-9][0-9]Z.tar.age.sha256)
        [ -f "$OUT/$2" ] && exec cat "$OUT/$2" ;;
    esac
    echo "no such backup" >&2; exit 1 ;;
  *) echo "only list and get" >&2; exit 1 ;;
esac
