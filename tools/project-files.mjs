#!/usr/bin/env node
// A flat, verifiable Claude project snapshot. Does not change or upload the repo.
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || join(homedir(), 'Desktop', 'muusia-project-files'));
// Keep project titles unique; original repository paths are in the manifest.
const sources = [
  ["docs/MUUSIA-HANDOFF.md", "MUUSIA-HANDOFF.md"],
  ["docs/MUUSIA-AGENTS.md", "MUUSIA-AGENTS.md"],
  ["docs/MUUSIA-NODES-SRC.md", "MUUSIA-NODES-SRC.md"],
  ["docs/MUUSIA-NODES.md", "MUUSIA-NODES.md"],
  ["docs/MUUSIA-TAGS.json", "MUUSIA-TAGS.json"],
  ["docs/MUUSIA-NODE-API.md", "MUUSIA-NODE-API.md"],
  ["learn/README.md", "MUUSIA-LEARN-README.md"],
  ["learn/validate.mjs", "learn-validate.mjs"],
  ["learn/lib/export-provenance.mjs", "export-provenance.mjs"],
  ["learn/test/export-provenance.test.mjs", "export-provenance.test.mjs"],
  ["package.json", "package.json"],
  [".github/workflows/deploy.yml", "deploy.yml"],
  ["tools/validate-machine.mjs", "validate-machine.mjs"],
  ["tools/project-files.sh", "project-files.sh"],
  ["docs/MUUSIA-PLOTTER-MECH-HANDOFF.md", "MUUSIA-PLOTTER-MECH-HANDOFF.md"],
  ["klipper/printer.cfg", "printer.cfg"],
  ["klipper/canvas-check.cfg", "canvas-check.cfg"],
  ["klipper/moonraker.conf", "moonraker.conf"],
  ["klipper/telegram_conf.example", "telegram_conf.example"],
  ["README.md", "README.md"],
  ["klipper/README.md", "KLIPPER-README.md"],
  ["klipper/dro/dro.service", "dro.service"],
  ["klipper/dro/dro_tm1637.py", "dro_tm1637.py"],
  ["docs/MUUSIA-PORTRAIT-MANUAL.md", "MUUSIA-PORTRAIT-MANUAL.md"],
  ["docs/MUUSIA-PORTRAIT-SPEC.md", "MUUSIA-PORTRAIT-SPEC.md"],
  ["docs/MUUSIA-MAGNET-JIG-SPEC.md", "MUUSIA-MAGNET-JIG-SPEC.md"],
  ["klipper/crowsnest.conf", "crowsnest.conf"],
  ["docs/MUUSIA-LEARN-PLAN.md", "MUUSIA-LEARN-PLAN.md"],
  ["docs/MUUSIA-WORKSTATE.json", "MUUSIA-WORKSTATE.json"],
  ["tools/project-files.mjs", "project-files.mjs"],
  ["nodes-lab/README.md", "NODES-LAB-README.md"],
];

// Discover app modules so an extraction such as src/export.js is included automatically.
// Individual node files are represented by the generated NODES-SRC bundle.
for (const folder of ['src', 'src/defs']) {
  const entries = await readdir(join(root, folder), { withFileTypes: true });
  for (const entry of entries.filter(e => e.isFile() && /\.(?:js|jsx|css)$/.test(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    sources.push([`${folder}/${entry.name}`, entry.name]);
  }
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (output === root || output.startsWith(root + '/')) {
  throw new Error('Choose a snapshot directory outside the repository.');
}
if (new Set(sources.map(([, title]) => title)).size !== sources.length) {
  throw new Error('Duplicate project filenames in the snapshot list.');
}
// Read all sources first: a missing source must fail before replacing any files.
const records = await Promise.all(sources.map(async ([source, title]) => {
  const bytes = await readFile(join(root, source));
  return { projectFile: title, repositoryPath: source, bytes: bytes.length, sha256: hash(bytes) };
}));
const app = await readFile(join(root, 'src/App.jsx'), 'utf8');
const version = app.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (!version) throw new Error('APP_VERSION was not found.');
const sourceCommit = git('rev-parse', 'HEAD');
const changes = git('status', '--porcelain=v1');
const nodeCount = (await readdir(join(root, 'src/defs/nodes'))).filter(n => n.endsWith('.js')).length;
await mkdir(output, { recursive: true });
for (const record of records) {
  const target = join(output, record.projectFile);
  await copyFile(join(root, record.repositoryPath), target);
  if (hash(await readFile(target)) !== record.sha256) {
    throw new Error(`Source changed while copying ${record.repositoryPath}; rerun the snapshot.`);
  }
}
if (git('rev-parse', 'HEAD') !== sourceCommit || git('status', '--porcelain=v1') !== changes) {
  throw new Error('Repository changed during the snapshot; rerun before sharing.');
}
// A file can change without changing its porcelain status; verify the source bytes too.
for (const record of records) {
  if (hash(await readFile(join(root, record.repositoryPath))) !== record.sha256) {
    throw new Error(`Source changed during the snapshot: ${record.repositoryPath}`);
  }
}
const manifest = {
  schemaVersion: 1,
  app: 'Muusia', appVersion: version, sourceCommit, nodeCount,
  generatedAt: new Date().toISOString(),
  workingTree: { clean: !changes, changes: changes ? changes.split('\n') : [] },
  notes: [
    'Project files are snapshots, not a live repository connection.',
    'MUUSIA-NODES-SRC.md contains all bundled nodes; its heading may retain a legacy generator version.',
    'A dirty snapshot includes uncommitted work on top of sourceCommit.',
    'Only files listed here belong to this snapshot. Other output-directory files are left untouched.',
  ],
  files: records,
};
await writeFile(join(output, 'MUUSIA-SOURCE-SNAPSHOT.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`version  ${version}`);
console.log(`commit   ${sourceCommit}`);
console.log(`state    ${changes ? 'WORKING TREE SNAPSHOT — includes uncommitted changes' : 'clean committed snapshot'}`);
console.log(`nodes    ${nodeCount}`);
console.log(`files    ${records.length} + manifest`);
console.log(`folder   ${output}`);
console.log('Prepared locally; replace the corresponding Claude project files and verify the upload.');
