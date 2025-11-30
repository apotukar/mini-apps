#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:-}"
DIR="${2:-}"
CONFIG_FILE="${3:-./minify.config.json}"
ONLY_GIT="${4:-false}"

if [[ -z "$TYPE" || -z "$DIR" ]]; then
  echo "Usage: $0 <png|png-to-gif|css|js> <dir> [config.json] [true|false]"
  exit 1
fi

CHANGED_FILES=""

if [[ "$ONLY_GIT" == "true" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    case "$TYPE" in
    png) CHANGED_FILES="$(git ls-files --modified --others --exclude-standard -- "$DIR"/*.png || true)" ;;
    css) CHANGED_FILES="$(git ls-files --modified --others --exclude-standard -- "$DIR"/*.css || true)" ;;
    js) CHANGED_FILES="$(git ls-files --modified --others --exclude-standard -- "$DIR"/*.js || true)" ;;
    *)
      echo "Unknown type: $TYPE"
      exit 1
      ;;
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

png)
  for img in "$DIR"/*.png; do
    [ -e "$img" ] || continue
    [[ "$img" == *".min.png" ]] && continue
    if ! should_process "$img"; then continue; fi

    out="${img%.png}.min.png"
    tmp="/tmp/$(basename "${img%.png}").tmp.png"
    CONVERT_ARGS="-fuzz 5% -transparent white -resize 32x32"
    convert "$img" $CONVERT_ARGS "$tmp"
    PNGQUANT_ARGS="--force --output $out --quality=65-90"
    pngquant $PNGQUANT_ARGS "$tmp"
    rm "$tmp"
    echo "generated: $out"

  done
  ;;

png-to-gif)
  for img in "$DIR"/*.png; do
    [ -e "$img" ] || continue
    [[ "$img" == *".min.png" ]] && continue
    [[ "$img" == *".min.gif" ]] && continue
    if ! should_process "$img"; then continue; fi

    out="${img%.png}.min.gif"
    CONVERT_ARGS="-alpha set -fuzz 1% -transparent white -colors 256 -dither FloydSteinberg -layers Optimize -resize 32x32"
    convert "$img" $CONVERT_ARGS "$out"
    echo "generated: $out"
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
