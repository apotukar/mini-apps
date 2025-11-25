#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-icons}"
DEST_DIR="${2:-$SRC_DIR/tiny}"
SIZE="${3:-32}"

mkdir -p "$DEST_DIR"

find "$DEST_DIR" -type f -name "*.min.png" -delete

for img in "$SRC_DIR"/*.png; do
  [ -e "$img" ] || continue
  [[ "$img" == *".min.png" ]] && continue

  base="$(basename "$img" .png)"
  out="$DEST_DIR/${base}.min.png"

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
