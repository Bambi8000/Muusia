import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';
import { computeExportSourceRecords, assertExportSourcesMatch, EXPORT_SOURCE_PROVENANCE_VERSION } from '../lib/export-provenance.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const kinds = ['svg-workflow', 'physical-plot'];
const originals = new Map();
const evidence = {};
for (const kind of kinds) {
  const sourceFiles = await computeExportSourceRecords(kind);
  evidence[kind] = { sourceProvenanceVersion: EXPORT_SOURCE_PROVENANCE_VERSION, sourceFiles };
  for (const record of sourceFiles) if (!originals.has(record.path)) originals.set(record.path, await fs.readFile(path.join(rootDir, record.path), 'utf8'));
}
const readSource = async file => {
  assert.ok(originals.has(file), `Unexpected source ${file}`);
  return originals.get(file);
};
function changed(file, before, after) {
  const original = originals.get(file);
  assert.ok(original.includes(before), `Test fixture no longer contains ${before}; update the mutation to exercise the intended behavior.`);
  return { readSource: async name => name === file ? original.replace(before, after) : readSource(name) };
}
const clone = value => JSON.parse(JSON.stringify(value));
function replaceSource(file, source) {
  return { readSource: async name => name === file ? source : readSource(name) };
}
function changePresentationText(file) {
  const original = originals.get(file);
  const ast = parseAst(original, { lang: 'jsx' }, file);
  const texts = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXText' && /[A-Za-z]/.test(node.value)) texts.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
  // Prefer the Learn Help label when present; neither that wording nor any other UI copy is required.
  const text = texts.find(node => /Muusia Learn/.test(node.value)) || texts[0];
  const edited = text
    ? original.slice(0, text.start) + 'Updated presentation wording.' + original.slice(text.end)
    : original + '\nconst unrelatedPresentationCopy = "Updated presentation wording.";\n';
  return replaceSource(file, edited);
}

test('current source records validate both real export routes with required coverage', async () => {
  for (const kind of kinds) {
    await assertExportSourcesMatch(evidence[kind], kind, { readSource });
    const records = evidence[kind].sourceFiles;
    assert.ok(records.some(item => item.path === 'src/machine.js' && item.selector === 'file'));
    assert.ok(records.some(item => item.path === 'src/App.jsx' && item.selector === 'app-export-core'));
    assert.ok(!records.some(item => item.path === 'src/App.jsx' && item.selector === 'file'));
  }
});

test('release version, Help copy, and unrelated app or Stack presentation changes preserve provenance', async () => {
  const version = /const APP_VERSION = "\d+\.\d+"/.exec(originals.get('src/App.jsx'));
  assert.ok(version, 'Update the version-bump mutation fixture if APP_VERSION declaration syntax changes.');
  const variants = [
    changed('src/App.jsx', version[0], 'const APP_VERSION = "99.999"'),
    changePresentationText('src/App.jsx'),
    changePresentationText('src/stack-view.jsx'),
    ...['src/App.jsx', 'src/stack-view.jsx', 'src/defs/helpers.js'].map(file => replaceSource(file,
      originals.get(file) + '\nconst unrelatedPresentationSettings = { note: "New release", perspective: "100px", font: "sans-serif" };\n')),
  ];
  for (const variant of variants) for (const kind of kinds) await assertExportSourcesMatch(evidence[kind], kind, variant);
});

test('machine, serializers, route selection, workflow gate and download wiring changes require recapture', async () => {
  const mutations = [
    ['src/machine.js', 'workW: 330', 'workW: 331'],
    ['src/App.jsx', 'stroke-width="0.3"', 'stroke-width="0.4"'],
    ['src/App.jsx', 'function toGcode(ps, ctx, prof) {', 'function toGcode(ps, ctx, prof) {\n  prof = { ...prof, flipY: false };'],
    ['src/App.jsx', 'const exportPS = () => (routeOpt ?', 'const exportPS = () => (false ?'],
    ['src/App.jsx', 'const gcodeProf = isGcodeWorkflow(prof);', 'const gcodeProf = !isGcodeWorkflow(prof);'],
    ['src/App.jsx', 'disabled={!primaryPS.paths.length || !gcodeProf}', 'disabled={!primaryPS.paths.length}'],
    ['src/defs/helpers.js', '{ name: "Blue", c: "#2A56A8" }', '{ name: "Blue", c: "#123456" }'],
    ['src/defs/nodes/grid.js', 'def: 13', 'def: 14'],
  ];
  for (const mutation of mutations) for (const kind of kinds) await assert.rejects(assertExportSourcesMatch(evidence[kind], kind, changed(...mutation)), /changed since.*capture.*Recapture/);
});

test('per-pen split, export decoration, ZIP membership and App-to-Stack wiring changes require recapture', async () => {
  const mutations = [
    ['src/stack-view.jsx', 'const pen = ((p.layer ?? 0) % 12 + 12) % 12;', 'const pen = 0;'],
    ['src/stack-view.jsx', 'translatePS(s.ps, margin, margin)', 'translatePS(s.ps, margin + 1, margin)'],
    ['src/stack-view.jsx', 'const files = sheets.map((s, i)', 'const files = sheets.filter((s, i) => !hidden.has(i)).map((s, i)'],
    ['src/App.jsx', 'exportText={(kind, ps, ctxE) => kind === "svg" ? toSVG(ps, ctxE)', 'exportText={(kind, ps, ctxE) => kind === "svg" ? toSVG(ps, { ...ctxE, W: 1 })'],
  ];
  for (const mutation of mutations) await assert.rejects(assertExportSourcesMatch(evidence['svg-workflow'], 'svg-workflow', changed(...mutation)), /changed since.*capture.*Recapture/);
});

test('missing, renamed, ambiguous and unparsable selectors fail closed with repair instructions', async () => {
  const mutations = [
    ['src/App.jsx', 'function toSVG(ps, ctx) {', 'function renamedSVG(ps, ctx) {'],
    ['src/App.jsx', 'function toSVG(ps, ctx) {', 'function toSVG() {}\nfunction toSVG(ps, ctx) {'],
    ['src/App.jsx', 'exportText={(kind, ps, ctxE)', 'renamedExportText={(kind, ps, ctxE)'],
    ['src/App.jsx', 'function toSVG(ps, ctx) {', 'function toSVG(ps, ctx) { invalid@@'],
  ];
  for (const mutation of mutations) await assert.rejects(computeExportSourceRecords('svg-workflow', changed(...mutation)), /Export provenance:.*(?:Review the selector|Fix source syntax)/s);
});

test('evidence cannot remove records, substitute selectors, duplicate sources or use historical exceptions', async () => {
  for (const kind of kinds) {
    const cases = [
      data => { delete data.sourceFiles; },
      data => { data.sourceFiles = []; },
      data => { data.sourceFiles.pop(); },
      data => { data.sourceFiles[0] = clone(data.sourceFiles[1]); },
      data => { data.sourceFiles[0].selector = 'untracked'; },
      data => { data.sourceFiles[0].path = 'src/unused.js'; },
      data => { data.sourceFiles[0].sha256 = 'bad'; },
      data => { data.sourceFiles[0].reviewedChange = { reason: 'please bypass' }; },
      data => { delete data.sourceProvenanceVersion; },
    ];
    for (const mutate of cases) {
      const data = clone(evidence[kind]); mutate(data);
      await assert.rejects(assertExportSourcesMatch(data, kind, { readSource }), /Export provenance:.*Recapture/);
    }
  }
});
