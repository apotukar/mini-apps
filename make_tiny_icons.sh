#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./make_tiny_icons.sh [SRC_DIR] [DEST_DIR] [SIZE]
#
# Example:
#   ./make_tiny_icons.sh public/icons public/icons/tiny 32
#
# Defaults:
#   SRC_DIR  = ./icons
#   DEST_DIR = ./icons/tiny
#   SIZE     = 32  (results in 32x32 px icons)

SRC_DIR="${1:-icons}"
DEST_DIR="${2:-$SRC_DIR/tiny}"
SIZE="${3:-32}"

mkdir -p "$DEST_DIR"

for img in "$SRC_DIR"/*.png; do
  [ -e "$img" ] || continue  # skip if no PNGs found

  base="$(basename "$img")"
  out="$DEST_DIR/$base"

  magick "$img" \
    -filter Lanczos \
    -resize "${SIZE}x${SIZE}" \
    -gravity center -extent "${SIZE}x${SIZE}" \
    -unsharp 0x1 \
    -strip \
    -define png:compression-level=9 \
    "$out"

  echo "✔ generated: $out"
done

echo "🎉 Done. Tiny icons are in: $DEST_DIR"
