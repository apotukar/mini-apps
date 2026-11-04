#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f .env ]; then
  while IFS='=' read -r key value; do
    key="${key%%[[:space:]]*}"
    value="${value%%[[:space:]]*}"
    if [[ -z "$key" ]] || [[ "$key" =~ ^# ]]; then
      continue
    fi
    if [ -z "${!key+x}" ]; then
      export "$key=$value"
    fi
  done <.env
fi

PORT="${PORT:-3443}"

echo "Select an option:"
echo "1) BASH"
echo "2) CREATE TOKENS"
echo "3) START DEV"
echo "4) START PROD"
echo "5) STOP"
echo "6) BACKUP"
echo "7) CREATE CERTS"
echo "8) CREATE USER"
echo "9) RECREATE IMAGE"
echo "q) QUIT"
echo
read -rp "Your choice: " choice

case "$choice" in
1)
  docker compose run --rm node bash
  ;;
2)
  docker compose run --rm -p "${PORT}:${PORT}" node npm run create-tokens
  ;;
3)
  MODE_ENV=DEV docker compose up
  ;;
4)
  MODE_ENV=PROD docker compose up
  ;;
5)
  docker compose down
  ;;
6)
  "${SCRIPT_DIR}/backup.sh"
  ;;
7)
  docker compose run --rm node npm run create-certs
  ;;
8)
  docker compose run --rm node npm run create-user
  ;;
9)
  docker compose build --no-cache
  ;;
q | Q)
  exit 0
  ;;
*)
  exit 1
  ;;
esac
