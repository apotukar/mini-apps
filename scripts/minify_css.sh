#!/usr/bin/env bash
set -euo pipefail

DIR="public"

find "$DIR" -type f -name "*.min.css" -delete

for f in "$DIR"/*.css; do
  [[ "$f" == *.min.css ]] && continue
  [ -e "$f" ] || continue

  out="${f%.css}.min.css"
  cleancss -o "$out" "$f"
  echo "✔ minified: $out"
done
