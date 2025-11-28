#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:-}"
DIR="${2:-}"
CONFIG_FILE="${3:-./minify.config.json}"
ONLY_GIT="${4:-false}"

if [[ -z "$TYPE" || -z "$DIR" ]]; then
  echo "Usage: $0 <icons|css|js> <dir> [config.json] [true|false]"
  exit 1
fi

CHANGED_FILES=""

if [[ "$ONLY_GIT" == "true" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    case "$TYPE" in
      icons) CHANGED_FILES="$(git ls-files --modified --others --exclude-standard -- "$DIR"/*.png || true)" ;;
      css)   CHANGED_FILES="$(git ls-files --modified --others --exclude-standard -- "$DIR"/*.css || true)" ;;
      js)    CHANGED_FILES="$(git ls-files --modified --others --exclude-standard -- "$DIR"/*.js || true)" ;;
      *) echo "Unknown type: $TYPE"; exit 1 ;;
    esac
    CHANGED_FILES="$(printf '%s' "$CHANGED_FILES" | sed '/^[[:space:]]*$/d')"
  fi
fi

should_process() {
  local file="$1"
  if [[ "$ONLY_GIT" != "true" ]]; then return 0; fi
  if [[ -z "$CHANGED_FILES" ]]; then return 1; fi
  if printf '%s\n' "$CHANGED_FILES" | grep -Fxq "$file"; then return 0; fi
  return 1
}

case "$TYPE" in

  icons)
    FUZZ=$(jq -r '.icons.fuzz' "$CONFIG_FILE")
    TRANSPARENT=$(jq -r '.icons.transparent' "$CONFIG_FILE")
    QUALITY=$(jq -r '.icons.quality' "$CONFIG_FILE")
    SIZES=$(jq -r '.icons.sizes[]' "$CONFIG_FILE")

    for img in "$DIR"/*.png; do
      [ -e "$img" ] || continue
      [[ "$img" == *".min.png" ]] && continue
      if ! should_process "$img"; then continue; fi

      for SIZE in $SIZES; do
        out="${img%.png}.${SIZE}.min.png"
        tmp="${img%.png}.tmp.png"

        CONVERT_ARGS="-fuzz $FUZZ -transparent $TRANSPARENT -resize $SIZE"
        echo "convert args: $CONVERT_ARGS"
        convert "$img" $CONVERT_ARGS "$tmp"

        PNGQUANT_ARGS="--force --output $out --quality=$QUALITY"
        echo "pngquant args: $PNGQUANT_ARGS"
        pngquant $PNGQUANT_ARGS "$tmp"

        rm "$tmp"
        echo "generated: $out"
      done
    done
    ;;

  css)
    for f in "$DIR"/*.css; do
      [ -e "$f" ] || continue
      [[ "$f" == *.min.css ]] && continue
      if ! should_process "$f"; then continue; fi

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
      if ! should_process "$f"; then continue; fi

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
