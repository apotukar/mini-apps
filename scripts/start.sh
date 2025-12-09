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
echo "1) Open interactive bash in container"
echo "2) Run create-tokens (npm run create-tokens)"
echo "3) MODE_ENV=DEV  docker compose up"
echo "4) MODE_ENV=PROD docker compose up"
echo "5) docker compose down"
echo "6) Run backup.sh"
echo "7) Run create-certs (npm run create-certs)"
echo "8) Run create-user (npm run create-user)"
echo "q) Quit"
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
q | Q)
  exit 0
  ;;
*)
  exit 1
  ;;
esac
