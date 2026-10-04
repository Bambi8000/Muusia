# MUUSIA — Shared workflow for Claude and Astra

Daniel owns the project and sets priorities. **Both Claude and Astra may author
nodes.** Astra also maintains Learn; Claude is the usual engine/hardware author.
These are defaults for choosing work, not exclusive permissions. A task's agreed
scope determines what its author may change. This agreement supersedes the old
Claude-only node / Astra-only Learn ownership table.

## 1. Start from shared facts and claim the work

Read this file, `docs/MUUSIA-WORKSTATE.json`, and the latest entries in
`docs/MUUSIA-HANDOFF.md` before editing. For nodes also read
`docs/MUUSIA-NODE-API.md` and `nodes-lab/README.md`; for Learn read
`learn/README.md` and `docs/MUUSIA-LEARN-PLAN.md`.

A repository-capable session checks:

```sh
git status --short
git log -5 --oneline
git rev-parse HEAD
```

Read APP_VERSION and node counts from source. Fetch and inspect remote changes
before integration; fast-forward a clean checkout when appropriate. Never
reset, stash, delete or overwrite another task's work to obtain a clean tree.

Before implementation, add an entry to `MUUSIA-WORKSTATE.json` with a task id,
owner (Claude or Astra), role, full base commit, exact files or bounded directories,
status (`in_progress`, `ready`, or `blocked`), and a one-sentence outcome. Tell
Daniel briefly what this task owns. Do not require another approval for routine
work already within Daniel's request. Extend the entry before expanding scope.
A claim is a coordination record, not an automatic lock or evidence of completion.

Use a separate branch/worktree for independent concurrent implementation
(`codex/<topic>` for Astra; respect an explicitly requested branch name).
**One writer per shared checkout.** Separate worktrees may work on disjoint
scopes, but changes to the same node or shared engine/helper/export file must be
sequenced. On overlap, keep doing independent work and resolve who owns the
shared edit before writing it. Do not ask Daniel to repeat a decision already
recorded in the current task or work state.

## 2. Claude's project is a snapshot, not the live repository

A Claude web project cannot infer new repository changes from an old conversation.
The repository is authoritative. `tools/project-files.sh [output-directory]`
prepares current app modules (discovered from source), all bundled node sources, shared docs, Learn checks,
and existing hardware references. Its `MUUSIA-SOURCE-SNAPSHOT.json` records
APP_VERSION, HEAD, node count, working-tree state, repository paths and SHA-256s.
The default destination is `~/Desktop/muusia-project-files`.

Before a Claude task, refresh the project files if the manifest differs from the
current repository. Replace old copies, do not accumulate dated source variants.
The exporter only prepares local files; a completed UI upload must be verified
before saying Claude is up to date. Refresh after a completed integration, and
before handing an in-progress task to a web-only session. A dirty snapshot must
remain labelled as such; HEAD alone does not describe its uncommitted content.

A web-only session delivers its base commit, changed paths, complete files or an
idempotent anchored patch, intended behavior, tests it actually ran, and tests
still needed in the real app. The repository integrator compares that base with
current files before applying the delivery. Stale patch anchors or newer changes
require review, never a blind full-file replacement. Do not claim local builds,
UI tests, deployment or hardware tests that were not actually performed.

Project-file sync does not authorize sending chat messages or issuing work to
another assistant. Discuss/retrieve the relevant chat or send a handoff when
Daniel requests that action. Put enduring decisions in these shared files.

## 3. Node work has the same recipe for both authors

For the first Astra node, choose one bounded generator or modifier with Daniel,
using existing pin types and helpers. Name the intended visual result, inputs,
parameters, seed behavior and example patch before coding. No engine change is
needed for a normal DEFS node; a shared helper or engine change gets its own
explicit scope in the work state.

1. Prototype in `nodes-lab/<key>.plotternode.js` using the Node API contract.
   Inspect it in the real app with **Node ⇣**; use seeded randomness and English
   UI labels. Once a key is built in, use the bake/HMR workflow instead of
   importing a competing definition with the same key.
2. Write and run a focused validator using the actual helpers: deterministic
   output, finite coordinates, valid path/mesh structure and pen indices,
   meaningful parameter changes, boundary cases and the node's own geometric
   invariants. Check bounds when the node promises bounded output.
3. Bake with `node tools/bake.mjs <key>`, verify the built-in source exists and
   rerun validation against that source. Remove the graduated lab copy only
   after verifying the built-in replacement; explicitly stage new ignored node
   paths if necessary. Test a fresh app load, representative parameters and
   relevant SVG/G-code exports. A running import-only demo is not a shipped node.
4. Add catalog/tags, node documentation and a small reproducible example. For a
   tutorial-oriented node, add the Learn reference, real screenshots and lesson
   in a separately scoped follow-up or the same agreed task. Never fabricate
   screenshots or silently change existing tutorial geometry.
5. The integrator bumps APP_VERSION once for the final app release, regenerates
   the source bundle/catalog/Learn outputs with the existing tools, and includes
   documentation and focused validation with the release. Read the next version
   from the current checkout; neither author reserves a future number in chat.

A second-author review is useful for new contracts, shared helpers and export
semantics, but ordinary node work is not blocked on a mandatory second chat.
Report remaining visual/design questions for Daniel's review separately from
whether the implementation passes its technical checks.

## 4. One integration owner and one release gate

The task doing final repository integration owns versioning, generated files,
merge/conflict review, validation, commit, push and deployment verification.
Usually this is the repository-capable Astra task when Claude supplies web
artifacts; either author with repository access can integrate. Only one task
integrates to main at a time. Recheck current HEAD and working-tree changes before
staging, and stage only reviewed paths. A green check applies to the tested tree;
changes after validation need the affected checks again.

Before committing changes to `src/`, `learn/`, `package.json` or `.github/`, run
focused checks first, then the shared gate in order:

```sh
node tools/validate-catalog.mjs
npm run build
npm run check:learn
```

Run `node tools/validate-machine.mjs` for machine/profile changes. Keep Node 20
compatibility for CI scripts. Documentation-only changes need appropriate
content/link checks; exporter changes also need a real snapshot and checksum check.

After an authorized push, find the workflow run for **that exact commit**, not
whichever task most recently pushed. Watch its explicit run id, check Pages and
the relevant public result. Never say “published” based only on a successful
local build. Preparing a node experiment does not itself authorize publication;
follow Daniel's existing task/session publication scope without asking again.

## 5. Learn and engine changes must remain compatible

Plain APP_VERSION bumps and unrelated UI changes must not invalidate unchanged
reference exports. Do not hash all of `src/App.jsx`. The current schema-2 check
uses `src/machine.js`, selected export/evaluation scopes and their tracked
helpers/nodes via `learn/lib/export-provenance.mjs`.

Changing a tracked scope requires the affected real browser export and fresh
provenance, even if the output bytes remain unchanged. Do not just replace a
checksum, weaken a check, or use the obsolete `reviewedChange` Help-copy exception.
Consult `learn/README.md` for capture steps. A new node outside the tracked
examples normally does not need recapture; the shared gate decides whether a
tracked dependency changed. Exporter extraction needs an explicit integration
plan for the selectors and captures, not an assumption that every App edit fails.

Record a failing cross-task check and its exact message in the work state. The
integrator can coordinate an actual recapture/fix within the authorized scope;
resolve substantive export behavior questions with Daniel. Keep the previous
published build while the gate is red. Never bypass the check merely to deploy.

Regenerate committed outputs (`src/defs/catalog.js`, `docs/MUUSIA-NODES-SRC.md`,
`learn/generated/manifest.json`) with their tools, never by hand. Their content
must be reproducible; Learn's existing HEAD provenance field may change on a
build and is not an equality gate. Do not commit `dist/` or temporary backups.

## 6. Finish with one durable handoff

Before commit, update `docs/MUUSIA-HANDOFF.md` → Version history with the final
behavior, changed areas, validation and any action the next task must take.
Use a release entry for app releases, `L` for Learn, or `W` for shared workflow.
Docs belong with the change, not in an unspecified later doc batch.

Remove the completed claim from `MUUSIA-WORKSTATE.json` in the integration commit.
Keep incomplete/blocked claims with a concrete next step. Commit only this task's
work and explain any remaining work-tree changes rather than deleting them.
A shared-checkout claim is visible immediately; for another worktree or Claude
project, explicitly share/refresh it before concurrent work relies on it.

The final task report is short: outcome, commit/base, relevant checks, published
or local-only status, and the next task/remaining limitation. Refresh the Claude
snapshot after the final commit so its metadata describes the finished tree.
