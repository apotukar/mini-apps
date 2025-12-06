#!/usr/bin/env bash

set -euo pipefail

SRC="${DATA_DIR:?DATA_DIR is not set}"
DEST="${BACKUP_DIR:?BACKUP_DIR is not set}"

TS=$(date +"%Y-%m-%d_%H-%M-%S")
FILE="data-$TS.tar.xz"

mkdir -p "$DEST"

tar -cJf "$DEST/$FILE" "$SRC"

echo "Backup created: $DEST/$FILE"
