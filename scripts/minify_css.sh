#!/usr/bin/env bash
set -euo pipefail

DIR="public"

# vorhandene *.min.css löschen
find "$DIR" -type f -name "*.min.css" -delete

# nur echte CSS-Dateien minifizieren
for f in "$DIR"/*.css; do
  [[ "$f" == *.min.css ]] && continue
  [ -e "$f" ] || continue

  out="${f%.css}.min.css"
  cleancss -o "$out" "$f"
  echo "✔ minified: $out"
done
