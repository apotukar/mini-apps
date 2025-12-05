#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:-}"
DIR="${2:-}"
CONFIG_FILE="${3:-./minify.config.json}"

if [[ -z "$TYPE" || -z "$DIR" ]]; then
  echo "Usage: $0 <png|png-to-gif|css|js> <dir> [config.json]"
  exit 1
fi

case "$TYPE" in

png)
  for img in "$DIR"/*.png; do
    [ -e "$img" ] || continue
    [[ "$img" == *".min.png" ]] && continue

    out="${img%.png}.min.png"
    tmp="/tmp/$(basename "${img%.png}").tmp.png"

    convert "$img" \
      -fuzz 5% -transparent white \
      -filter Lanczos \
      -resize x48 \
      -unsharp 0x0.7 \
      "$tmp"

    pngquant --output $out \
      --force \
      --quality=65-90 \
      "$tmp"

    rm "$tmp"
    echo "generated: $out"

  done
  ;;

png-to-gif)
  for img in "$DIR"/*.png; do
    [ -e "$img" ] || continue
    [[ "$img" == *".min.png" ]] && continue
    [[ "$img" == *".min.gif" ]] && continue

    out="${img%.png}.min.gif"

    convert "$img" \
      -filter Lanczos -resize x48 \
      -alpha set -fuzz 1% -transparent white \
      -colors 128 +dither \
      "$out"

    echo "generated: $out"
  done
  ;;

css)
  for f in "$DIR"/*.css; do
    [ -e "$f" ] || continue
    [[ "$f" == *.min.css ]] && continue

    out="${f%.css}.min.css"
    echo "cleancss args: -o $out $f"
    npx cleancss -o "$out" "$f"
    echo "minified: $out"
  done
  ;;

js)
  COMPRESS=$(jq -r '.js.compress' "$CONFIG_FILE")
  MANGLE=$(jq -r '.js.mangle' "$CONFIG_FILE")

  for f in "$DIR"/*.js; do
    [ -e "$f" ] || continue
    [[ "$f" == *.min.js ]] && continue

    out="${f%.js}.min.js"
    TERSER_ARGS=""
    [[ "$COMPRESS" == "true" ]] && TERSER_ARGS="$TERSER_ARGS -c"
    [[ "$MANGLE" == "true" ]] && TERSER_ARGS="$TERSER_ARGS -m"
    echo "terser args: $TERSER_ARGS"
    npx terser "$f" $TERSER_ARGS -o "$out"
    echo "minified: $out"
  done
  ;;

*)
  echo "Unknown type: $TYPE"
  exit 1
  ;;

esac
