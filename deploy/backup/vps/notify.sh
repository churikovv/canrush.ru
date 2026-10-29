#!/bin/sh
# Sends a message to the site owner in Telegram through the bot: CHAT, TOKEN and API come from the env file next to
# this script (600, root only). Never fails the caller: a backup must not stop because Telegram is away.
. "$(dirname "$0")/notify.env" 2>/dev/null || exit 0
[ -n "$TOKEN" ] && [ -n "$CHAT" ] || exit 0
curl -fsS -m 20 -o /dev/null --data-urlencode "chat_id=$CHAT" --data-urlencode "text=$1" "${API:-https://api.telegram.org}/bot$TOKEN/sendMessage" || true
