#!/usr/bin/env bash
set -euo pipefail

echo "Select an option:"
echo "1) Open interactive bash in container"
echo "2) Run 'npm run create-tokens' with port 3443 exposed"
echo "3) MODE_ENV=DEV  docker compose up"
echo "4) MODE_ENV=PROD docker compose up"
echo "q) Quit"
echo
read -rp "Your choice: " choice

case "$choice" in
1)
  echo "Starting interactive bash..."
  docker compose run --rm node bash
  ;;
2)
  echo "Running create-tokens script with port mapping..."
  docker compose run --rm -p 3443:3443 node npm run create-tokens
  ;;
3)
  echo "Starting docker compose with MODE_ENV=DEV..."
  MODE_ENV=DEV docker compose up
  ;;
4)
  echo "Starting docker compose with MODE_ENV=PROD..."
  MODE_ENV=PROD docker compose up
  ;;
q | Q)
  echo "Exiting."
  exit 0
  ;;
*)
  echo "Invalid selection."
  exit 1
  ;;
esac
