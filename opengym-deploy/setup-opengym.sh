#!/usr/bin/env bash
# Устанавливает openGym (https://github.com/DuarteSantos8/openGym) на чистый Ubuntu 22.04/24.04
# с HTTPS через Caddy. Запускать от root на сервере:
#
#   bash setup-opengym.sh mygym-dima.duckdns.org [DUCKDNS_TOKEN]
#
# DUCKDNS_TOKEN необязателен: если указан, скрипт сам привяжет домен к IP сервера
# и поставит cron, который обновляет IP каждые 5 минут.
#
# Docker и Caddy ставятся из пакетов Ubuntu, а не с сайтов Docker: Docker Hub и
# download.docker.com ограничивают доступ с российских IP. Образы openGym берутся с ghcr.io.
# Скрипт можно запускать повторно: уже сделанные шаги он пропустит.
set -euo pipefail

DOMAIN="${1:?Укажите домен: bash setup-opengym.sh mygym.duckdns.org [DUCKDNS_TOKEN]}"
DUCKDNS_TOKEN="${2:-}"
APP_DIR=/root/opengym

[ "$(id -u)" -eq 0 ] || { echo "Запустите от root"; exit 1; }

echo "==> Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install docker.io docker-compose-v2 git caddy curl
systemctl enable --now docker

echo "==> Подкачка 2 ГБ"
if ! swapon --show | grep -q /swapfile; then
  [ -f /swapfile ] || fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if [ -n "$DUCKDNS_TOKEN" ]; then
  echo "==> DuckDNS"
  SUB="${DOMAIN%%.duckdns.org}"
  URL="https://www.duckdns.org/update?domains=${SUB}&token=${DUCKDNS_TOKEN}&ip="
  [ "$(curl -fsS "$URL")" = "OK" ] || { echo "DuckDNS не принял токен или домен"; exit 1; }
  echo "*/5 * * * * root curl -fsS '$URL' >/dev/null 2>&1" > /etc/cron.d/duckdns
  chmod 600 /etc/cron.d/duckdns
fi

echo "==> openGym"
[ -d "$APP_DIR/.git" ] || git clone --depth 1 https://github.com/DuarteSantos8/openGym.git "$APP_DIR"
cd "$APP_DIR"
if [ ! -f .env ]; then
  cat > .env <<ENV
RP_ID=$DOMAIN
ORIGIN=https://$DOMAIN
WEB_PORT=8080
RP_NAME=openGym
FIRST_USER_ADMIN=1
DEFAULT_LANG=ru
ENV
else
  echo ".env уже есть, оставляю как есть"
fi
docker compose pull
docker compose up -d

echo "==> HTTPS (Caddy)"
printf '%s {\n  reverse_proxy localhost:8080\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
systemctl restart caddy

echo "==> Проверка"
for i in $(seq 1 30); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS http://localhost:8080/api/health && echo
for i in $(seq 1 30); do
  if curl -fsS "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    echo "ГОТОВО: https://$DOMAIN"
    exit 0
  fi
  sleep 3
done
echo "openGym работает локально, но https://$DOMAIN пока не отвечает."
echo "Проверьте, что домен указывает на IP этого сервера, и смотрите: journalctl -u caddy -n 50"
exit 1
