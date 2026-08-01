# nodes-lab

Experimental `.plotternode.js` files for the in-app **Node ⇣** import.
Not part of the build.

Workflow: iterate here → validate with a Node.js harness →
graduate with `node tools/bake.mjs <name>` → **delete the lab file**.
Baked versions in `src/defs/nodes/` are the source of truth; stale lab
files risk overwriting newer baked code on a re-bake.

Spec: docs/MUUSIA-NODE-API.md
