#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(dirname "$(realpath "$0")")"
CERT_DIR="$BASE_DIR/../certs"

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

rm -f server.key server.crt

openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout server.key \
  -out server.crt \
  -days 365 \
  -subj "/CN=localhost"
