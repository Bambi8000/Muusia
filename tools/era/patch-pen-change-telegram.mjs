/* tools/era/patch-pen-change-telegram.mjs — one-shot.

   Routes the pen-change prompt to Telegram. moonraker-telegram-bot watches
   gcode responses for prefixes: tgalarm sends WITH a phone notification,
   tgnotify sends silently. An 11-pen plot pauses ten times, so the alert has
   to reach the phone rather than just the Mainsail console.

   The follow-up /resume line becomes a tappable command in the chat, because
   Telegram linkifies messages that start with "/" and contain no spaces.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-pen-change-telegram.mjs                             */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CFG = ["klipper/printer.cfg", "printer.cfg", "config/printer.cfg"].find((p) => existsSync(p));
if (!CFG) { console.log("MISS  printer.cfg not found"); process.exit(1); }
let cfg = readFileSync(CFG, "utf8");

if (cfg.includes("tgalarm")) { console.log("SKIP  tgalarm already in " + CFG); process.exit(0); }

const OLD = '  RESPOND PREFIX=info MSG="PEN CHANGE: seat the new pen on the block, then Resume"\n';
const n = cfg.split(OLD).length - 1;
if (n !== 1) { console.log("MISS  pen-change RESPOND line found " + n + " times, need 1"); process.exit(1); }

const NEW = '  RESPOND PREFIX=tgalarm MSG="PEN CHANGE: seat the new pen on the block, then resume"\n'
  + '  RESPOND PREFIX=tgnotify MSG="/resume"\n';

cfg = cfg.replace(OLD, NEW);
writeFileSync(CFG, cfg);
console.log("OK    pen-change prompt now goes to Telegram (tgalarm) with a tappable /resume");
console.log("DONE  sync to the Pi and RESTART when no plot is running");
