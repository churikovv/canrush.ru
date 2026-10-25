#!/usr/bin/env bash
# Deploys the site without a gap: nginx (deploy/nginx/canrush.ru.conf) sends traffic to 127.0.0.1:3002 (`site`)
# and falls back to 127.0.0.1:3003 (`site-standby`) only while 3002 does not answer.
#
#   1. build the new image, tagged with the commit (DEPLOYMENT_ID → Next.js deploymentId);
#   2. run migrations with it;
#   3. start the new image as `site-standby` on 3003 and wait until it serves pages;
#   4. recreate `site` on 3002 — while it starts, nginx serves from the standby;
#   5. wait for `site`, then remove the standby.
#
# Usage on the VPS: cd /opt/canrush && git pull && deploy/deploy-site.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export DEPLOYMENT_ID="$(git rev-parse --short HEAD)"

wait_for() {
  local port=$1
  for _ in $(seq 1 90); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/")" = 200 ]; then return 0; fi
    sleep 1
  done
  echo "port $port did not answer in 90 s" >&2
  return 1
}

echo "build $DEPLOYMENT_ID"
docker compose build site

echo "migrations"
docker compose run --rm --no-deps site node apps/site/scripts/migrate.mjs

echo "standby on 3003"
docker compose --profile standby up -d --no-deps --force-recreate site-standby
wait_for 3003

echo "recreate site on 3002 (nginx serves the standby meanwhile)"
docker compose up -d --no-deps site
wait_for 3002

echo "remove standby"
docker compose --profile standby rm -sf site-standby
echo "done: $DEPLOYMENT_ID"
