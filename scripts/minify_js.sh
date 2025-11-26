#!/usr/bin/env bash
set -euo pipefail

DIR="public/js"

find "$DIR" -type f -name "*.min.js" -delete

for f in "$DIR"/*.js; do
  [[ "$f" == *.min.js ]] && continue
  [ -e "$f" ] || continue

  out="${f%.js}.min.js"
  terser "$f" -c -m -o "$out"
  echo "✔ minified: $out"
done
