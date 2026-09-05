#!/bin/sh
set -e
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT"
OUT="$HOME/Desktop/muusia-project-files"
mkdir -p "$OUT"
rm -f "$OUT"/MUUSIA-*.md "$OUT"/MUUSIA-*.json "$OUT"/App.jsx
for f in docs/MUUSIA-HANDOFF.md docs/MUUSIA-NODES.md docs/MUUSIA-NODES-SRC.md docs/MUUSIA-TAGS.json docs/MUUSIA-NODE-API.md src/App.jsx; do
  if [ -f "$f" ]; then cp "$f" "$OUT/"; printf "copied   %s\n" "$(basename "$f")"; else printf "MISSING  %s\n" "$f"; fi
done
printf "version  %s\n" "$(grep -o 'APP_VERSION = "[^"]*"' src/App.jsx | sed 's/.*"\(.*\)"/\1/')"
printf "nodes    %s files\n" "$(ls src/defs/nodes | wc -l | tr -d ' ')"
printf "folder   %s\n" "$OUT"
