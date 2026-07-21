/* make-src-bundle.mjs - concatenate all node sources into one markdown */
import fs from "fs";
const files = fs.readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js")).sort();
const out = ["# MUUSIA v2.29 — Node Sources (" + files.length + " files, generated)", ""];
out.push("All built-in node definitions from `src/defs/nodes/`. Engine, UI and the");
out.push("`group`/`reititys` entries live in `src/App.jsx`; shared helpers in `src/defs/helpers.js`.");
out.push("");
for (const f of files) {
  out.push("## " + f, "", "```js", fs.readFileSync("src/defs/nodes/" + f, "utf8").trimEnd(), "```", "");
}
fs.writeFileSync("MUUSIA-NODES-SRC.md", out.join("\n"));
console.log("wrote MUUSIA-NODES-SRC.md (" + files.length + " nodes)");