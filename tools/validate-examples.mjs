/* tools/validate-examples.mjs — structural check for src/examples.js.
 * Runs in plain Node (no Vite): injects a stub defaults() and verifies
 * each example builds a coherent graph. OK/FAIL per example.
 *
 * Usage: node tools/validate-examples.mjs
 */
import { EXAMPLES } from "../src/examples.js";

const stubDefaults = (type) => {
  if (typeof type !== "string" || !type) throw new Error("defaults() called with bad type: " + type);
  return {};
};

let fails = 0;
for (const ex of EXAMPLES) {
  const problems = [];
  try {
    if (!ex.name || typeof ex.name !== "string") problems.push("missing name");
    if (!ex.desc || typeof ex.desc !== "string") problems.push("missing desc");
    if (typeof ex.make !== "function") throw new Error("make is not a function");
    const data = ex.make(stubDefaults);
    if (!Array.isArray(data.nodes) || !data.nodes.length) problems.push("nodes empty");
    if (!Array.isArray(data.edges)) problems.push("edges not an array");

    const ids = new Set();
    for (const n of data.nodes || []) {
      if (typeof n.id !== "number") problems.push(`node id not a number: ${n.id}`);
      if (ids.has(n.id)) problems.push(`duplicate node id: ${n.id}`);
      ids.add(n.id);
      if (typeof n.type !== "string") problems.push(`node ${n.id}: missing type`);
      if (typeof n.x !== "number" || typeof n.y !== "number") problems.push(`node ${n.id}: missing x/y`);
      if (typeof n.params !== "object" || n.params === null) problems.push(`node ${n.id}: missing params`);
      if (n.id < 9001 || n.id >= 9500) problems.push(`node id ${n.id} outside 9001..9499 (loadExample resets NEXT_ID=9500)`);
    }
    const eids = new Set();
    for (const e of data.edges || []) {
      if (typeof e.id !== "string" || !/^e\d+$/.test(e.id)) problems.push(`edge id malformed: ${e.id}`);
      if (eids.has(e.id)) problems.push(`duplicate edge id: ${e.id}`);
      eids.add(e.id);
      if (!ids.has(e.from)) problems.push(`edge ${e.id}: from ${e.from} not in nodes`);
      if (!ids.has(e.to)) problems.push(`edge ${e.id}: to ${e.to} not in nodes`);
      const tp = e.toPort;
      if (!(typeof tp === "number" || (typeof tp === "string" && tp.startsWith("p:"))))
        problems.push(`edge ${e.id}: toPort must be number or "p:<key>", got ${JSON.stringify(tp)}`);
      const m = /^e(\d+)$/.exec(e.id);
      if (m && (+m[1] < 9001 || +m[1] >= 9500)) problems.push(`edge id ${e.id} outside e9001..e9499`);
    }
    if (ex.canvas && (typeof ex.canvas.W !== "number" || typeof ex.canvas.H !== "number"))
      problems.push("canvas present but W/H not numbers");
  } catch (err) {
    problems.push("threw: " + err.message);
  }
  if (problems.length) {
    fails++;
    console.log(`FAIL  ${ex && ex.name ? ex.name : "(unnamed)"}`);
    for (const p of problems) console.log(`      - ${p}`);
  } else {
    console.log(`OK    ${ex.name}`);
  }
}
console.log(fails ? `\n${fails} example(s) failed` : `\nAll ${EXAMPLES.length} examples OK`);
process.exit(fails ? 1 : 0);
