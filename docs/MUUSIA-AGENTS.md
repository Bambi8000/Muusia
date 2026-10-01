# MUUSIA — Working agreement for autonomous agents

Two kinds of autonomous sessions commit to this repository: **node / engine
sessions** (Claude, via `docs/MUUSIA-HANDOFF.md`) and **Learn / documentation
sessions** (Astra, via `learn/README.md` and `docs/MUUSIA-LEARN-PLAN.md`). Both
read this file at the start of every session. It exists because v2.107 broke the
Pages deploy: a Learn validation step required capture provenance to equal the
current `APP_VERSION`, and node releases bump `APP_VERSION` every time.

Daniel is the owner of everything; these rules are between the agents.

## 1. One gate for every push

Before any commit that touches `src/`, `learn/`, `package.json` or
`.github/`, run the same thing CI runs, in this order, and push only when all
of it is green:

```
node tools/validate-catalog.mjs
npm run build
npm run check:learn
```

`npm run build` includes `build:learn`; `check:learn` is the Learn validator
(~18k checks). A red result is a stop, not a note in the commit message. If a
step is red because of the *other* agent's work, do not fix it blind — see §5.

After pushing, confirm the deploy without an interactive prompt (`gh run watch`
with no id asks which run to follow and looks like a hang):

```
id=$(gh run list --limit 1 --json databaseId -q '.[0].databaseId'); gh run watch "$id" --exit-status && echo "DEPLOY GREEN"
```

The workflow pins `node-version: 20` for the app build; local development runs
on a newer Node. Code must work on both — no Node ≥ 22-only APIs in `tools/`,
`learn/` or build scripts without raising the workflow version in the same
commit (and announcing it, §3).

## 2. Any CI check must survive a plain version bump

Every node release changes exactly one line in `src/App.jsx`
(`APP_VERSION = "2.XX"`) and regenerates `learn/generated/manifest.json`,
`docs/MUUSIA-NODES-SRC.md`, `src/defs/catalog.js`. A check added to
`deploy.yml`, `validate.mjs`, `validate-catalog.mjs` or any `npm run` script
that CI calls must therefore:

- **pass on a commit whose only change is the version bump** — never compare a
  recorded version for equality with the live one (record it as provenance,
  allow older, reject newer or malformed);
- **never hash a whole file another agent edits every release** (`src/App.jsx`,
  generated files). Hash the specific module or normalise the volatile line, as
  `learn/validate.mjs` now does for `APP_VERSION`;
- **be runnable locally with one documented `npm run` script** and be listed in
  `docs/MUUSIA-HANDOFF.md` → *Build / release routine* in the same commit that
  adds it to CI;
- **fail with a message that says how to fix it** (recapture X, add a
  `reviewedChange`, run script Y), not only what differs.

An escape hatch (like `reviewedChange`) must be documented where the check is
documented.

## 3. Ownership

| Area | Owner | Others may |
|---|---|---|
| `src/defs/nodes/`, `src/defs/helpers.js`, `nodes-lab/`, `tools/`, `tools/era/` | node sessions | read |
| `src/App.jsx`, `src/*.jsx` (engine, UI) | node sessions | Learn: Help copy only, via `reviewedChange` |
| `docs/MUUSIA-HANDOFF.md`, `MUUSIA-NODES.md`, `MUUSIA-NODE-API.md`, `MUUSIA-TAGS.json` | node sessions | Learn: append to version history (§5) |
| `learn/`, `docs/MUUSIA-LEARN-*.md`, Learn pages and assets | Learn sessions | node sessions: read; never hand-edit `learn/generated/` |
| `package.json` scripts, `.github/workflows/deploy.yml`, `vite.config.*` | **shared — announce first** | additive changes only; existing scripts keep working |
| `APP_VERSION` | node sessions only | Learn never bumps; reads it from source at build time |

"Announce first" means: write the intended change into the HANDOFF version
history (or the Learn plan) *before* committing it, with the local command that
proves it passes §2.

## 4. Generated files and the working tree

- Generated, committed: `learn/generated/manifest.json`, `docs/MUUSIA-NODES-SRC.md`,
  `src/defs/catalog.js`. Regenerate with the build / catalog tools; never edit by hand;
  commit them with the change that caused them to move.
- A committed generated file must be **deterministic from its sources**: no
  timestamps, no run-specific values, and nothing CI computes differently from a
  local build. `manifest.json`'s `sourceCommit` (HEAD at build time) is tolerated
  only because nothing compares it — it can never equal the commit it is committed
  in, so it churns on every build. Prefer deriving provenance from content hashes.
- Never committed: `dist/`, `nodes-lab/*` after bake, `*.bak-*`.
- **Leave no untracked files behind.** A session ends with `git status --short`
  empty or with every leftover committed on its own topic commit. (An untracked
  `docs/MUUSIA-MACHINE-PROFILES-CLAUDE-HANDOFF.md` sat in the tree across two
  node releases — a file that is not committed does not exist for the other agent.)
- One topic per commit; the first line names the version for releases
  (`v2.107: new node Hair Web`) or the area otherwise (`Learn: …`).

## 5. The shared log

`docs/MUUSIA-HANDOFF.md` → *Version history* is the single place both agents
read to learn what the other did. Every commit that changes behaviour, a check,
a script or a shared file gets an entry there:

- node sessions: `- **2.XX** …` as today;
- Learn sessions: `- **L** <date> Learn: …` (what changed, which CI checks were
  added or changed, what the other agent must now do differently).

If your gate (§1) is red because of the other agent's work, write what you see
into the version history as `- **BLOCKED** <date> …` with the exact failing
message, commit *only* that, and stop. Daniel decides. Do not patch the other
agent's validator or assets to make your own push go through — the fix in
v2.107 (`tools/era/patch-learn-version-tolerant.mjs`) was made by Daniel's
decision, not unilaterally.

## 6. Shared facts live in the repo, not in the conversation

Read `APP_VERSION`, node counts, file lists and manifest versions from the
filesystem at run time. Never hardcode a version or a count in a script, a
check, a doc patch or a provenance file that will be compared later.
