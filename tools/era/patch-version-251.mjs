/* tools/era/patch-version-251.mjs — APP_VERSION 2.50 -> 2.51 */
import { readFileSync, writeFileSync } from "node:fs";
const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");
const FIND = `const APP_VERSION = "2.50"; /* single source: shown in the UI header and stamped into G-code */`;
const REPL = `const APP_VERSION = "2.51"; /* single source: shown in the UI header and stamped into G-code */`;
if (src.includes(REPL)) { console.log("SKIP  version bump (already 2.51)"); process.exit(0); }
const parts = src.split(FIND);
if (parts.length !== 2) { console.log(`MISS  version anchor (found ${parts.length - 1}) — ABORT`); process.exit(1); }
writeFileSync(FILE, parts.join(REPL));
console.log('OK    APP_VERSION -> "2.51"\nVerify: grep -c \'APP_VERSION = "2.51"\' src/App.jsx (expect 1)');
