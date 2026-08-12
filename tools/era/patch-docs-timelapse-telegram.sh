#!/usr/bin/env bash
# patch-docs-timelapse-telegram.sh
# Adds moonraker-timelapse + Telegram bot to the MECH handoff stack line and
# two rows (moonraker.conf, telegram.conf.example) to the klipper/README.md
# file table. Idempotent: SKIPs already-applied patches, reports MISS if an
# anchor is not found. Run from the repo root:  bash tools/era/patch-docs-timelapse-telegram.sh

set -u
HANDOFF="docs/MUUSIA-PLOTTER-MECH-HANDOFF.md"
README="klipper/README.md"
FAIL=0

# ---------- Patch 1: handoff stack line ----------
if [ ! -f "$HANDOFF" ]; then
  echo "MISS  $HANDOFF not found - run from repo root"; FAIL=1
elif grep -q 'moonraker-timelapse' "$HANDOFF"; then
  echo "SKIP  handoff stack line already mentions moonraker-timelapse"
elif grep -q 'Crowsnest (BRIO webcam, 1080p15)' "$HANDOFF"; then
  perl -0777 -i -pe 's/Crowsnest \(BRIO webcam, 1080p15\)/Crowsnest (BRIO webcam, 1080p15) + moonraker-timelapse + Telegram bot/' "$HANDOFF"
  echo "OK    handoff stack line updated"
else
  echo "MISS  anchor 'Crowsnest (BRIO webcam, 1080p15)' not found in $HANDOFF"; FAIL=1
fi

# ---------- Patch 2: README table rows ----------
ROWS='| `moonraker.conf` | Moonraker config incl. the `[timelapse]` component (moonraker-timelapse, hyperlapse via BRIO). | Synced from viivain 2026-08-12 |
| `telegram.conf.example` | Sanitized template for moonraker-telegram-bot (status/photo/timelapse to phone). Real `telegram.conf` with bot token + chat id lives only on the Pi and is gitignored. | Bot running on viivain 2026-08-12 |'

if [ ! -f "$README" ]; then
  echo "MISS  $README not found - run from repo root"; FAIL=1
elif grep -q 'telegram.conf.example' "$README"; then
  echo "SKIP  README table already has telegram.conf.example row"
elif grep -q '| `crowsnest.conf` |' "$README"; then
  ROWS="$ROWS" perl -0777 -i -pe 's/(\| `crowsnest\.conf` \|[^\n]*\n)/$1$ENV{ROWS}\n/' "$README"
  echo "OK    README table rows added (moonraker.conf, telegram.conf.example)"
else
  echo "MISS  anchor row '| \`crowsnest.conf\` |' not found in $README"; FAIL=1
fi

# ---------- Verification ----------
echo "---- verify ----"
grep -n 'moonraker-timelapse + Telegram bot' "$HANDOFF" || { echo "VERIFY FAIL: handoff"; FAIL=1; }
CNT=$(grep -c 'telegram.conf.example' "$README" 2>/dev/null || echo 0)
echo "README telegram.conf.example rows: $CNT (expected 1)"
[ "$CNT" = "1" ] || FAIL=1
CNT2=$(grep -c '`moonraker.conf`' "$README" 2>/dev/null || echo 0)
echo "README moonraker.conf rows: $CNT2 (expected 1)"
[ "$CNT2" = "1" ] || FAIL=1

if [ "$FAIL" = "0" ]; then echo "RESULT: ALL OK"; else echo "RESULT: FAILURES - do not commit, report output"; fi
