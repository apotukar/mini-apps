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
  tmp="$DEST_DIR/${base}.tmp.png"
  out="$DEST_DIR/${base}.min.png"

  magick "$img" \
    -fuzz 5% \
    -transparent white \
    -resize "${SIZE}x${SIZE}" \
    "$tmp"

  pngquant --force --output "$out" --quality=65-90 "$tmp"

  rm "$tmp"

  echo "✔ generated: $out"
done

echo "🎉 Done. Tiny icons are in: $DEST_DIR"
