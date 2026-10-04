/** Capture evidence for the export pipeline, without fingerprinting unrelated app UI or release versions. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseAst } from 'rolldown/parseAst';

export const EXPORT_SOURCE_PROVENANCE_VERSION = 2;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const appPath = 'src/App.jsx';
const stackPath = 'src/stack-view.jsx';
const helperPath = 'src/defs/helpers.js';
const coreNames = ['routeOptimize', 'bindingType', 'groupOutType', 'defIns', 'defOuts', 'numericParams', 'defaultFor', 'evalLevel', 'levelOf', 'CRC_TABLE', 'crc32', 'buildZip', 'sliceMega', 'sliceRoll', 'magnetPlacement', 'jigGcode', 'toGcode', 'toSVG', 'toDXF'];
const appDataNames = ['canvasW', 'canvasH', 'megaOn', 'megaC', 'megaR', 'megaSeam', 'megaLabels', 'megaMode', 'megaMarks', 'megaMarkPen', 'megaKind', 'rollW', 'rollLen', 'rollStrips', 'rollSeg', 'megaRoll', 'rollPieces', 'megaCols', 'megaRows', 'megaW', 'megaH', 'machines', 'machineIdx', 'prof', 'gcodeProf', 'toGcodeGated', 'jigGcodeGated', 'ctx', 'evalResult', 'results', 'lvl', 'primary', 'primaryNode', 'primaryOut', 'primaryPS', 'routeOpt', 'preserveDir'];
const appActionNames = ['exportPS', 'megaTiles', 'tileTag', 'megaPreview', 'doExport', 'doExportSVG', 'doExportDXF', 'downloadMega', 'downloadMegaFull', 'downloadJig', 'exportAllFrames', 'download'];
const stackGlobals = ['MAX_SHEETS', 'DRILL_DIA', 'splitByPens', 'mirrorX', 'translatePS', 'drillMarks'];
const stackData = ['mode', 'frameSheets', 'margin', 'mirror', 'drill', 'inset', 'numbers', 'markPen', 'fromSheetsNode', 'nFrames', 'unit', 'penSheets', 'sheets', 'loading', 'sheetW', 'sheetH', 'decorate', 'exportZip'];
const stackProps = ['PENS', 'W', 'H', 'frameCount', 'primaryPS', 'exportText', 'gcodeEnabled', 'buildZip', 'projName', 'fontStrokes', 'sheetsCount', 'evalFrame'];
const nodeFiles = {
  'svg-workflow': ['grid', 'aaltoilu', 'radat', 'merge'],
  'physical-plot': ['container', 'grid', 'move_scale', 'merge'],
};

function fail(message) { throw new Error(`Export provenance: ${message}`); }
function one(matches, label) {
  if (matches.length !== 1) fail(`${label}: expected exactly one source selector match, found ${matches.length}. Review the selector in learn/lib/export-provenance.mjs against the source refactor, then recapture the affected browser export.`);
  return matches[0];
}
function unwrap(node) { return node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' ? node.declaration : node; }
function boundNames(node) {
  if (!node) return [];
  if (node.type === 'Identifier') return [node.name];
  if (node.type === 'ArrayPattern') return node.elements.flatMap(boundNames);
  if (node.type === 'ObjectPattern') return node.properties.flatMap(item => boundNames(item.value || item.argument));
  if (node.type === 'AssignmentPattern') return boundNames(node.left);
  if (node.type === 'RestElement') return boundNames(node.argument);
  return [];
}
function declaration(scope, name, label) {
  const matches = scope.map(unwrap).filter(Boolean).flatMap(node => {
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) return [node];
    if (node.type === 'VariableDeclaration') return node.declarations.filter(item => boundNames(item.id).includes(name));
    return [];
  });
  return one(matches, `${label} binding ${name}`);
}
function descendants(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (predicate(node)) out.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(item => descendants(item, predicate, out));
    else if (value && typeof value === 'object') descendants(value, predicate, out);
  }
  return out;
}
function named(parts, label, text) { parts.push([label, text]); }

function selectedSource(source, file, selector) {
  let ast;
  try { ast = parseAst(source, { lang: file.endsWith('.jsx') ? 'jsx' : 'js' }, file); }
  catch (error) { fail(`${file}: cannot parse source (${error.message}). Fix source syntax before checking or recapturing exports.`); }
  const parts = [];
  const text = node => source.slice(node.start, node.end);
  const bindings = (scope, names) => names.forEach(name => named(parts, name, text(declaration(scope, name, file))));
  const app = () => declaration(ast.body, 'App', file).body.body;
  const effect = (scope, dependencies) => {
    const statement = one(scope.filter(node => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression'
      && node.expression.callee.name === 'useEffect' && node.expression.arguments[1]
      && text(node.expression.arguments[1]).replace(/\s/g, '') === dependencies), `${file} effect ${dependencies}`);
    named(parts, `effect:${dependencies}`, text(statement));
  };
  const importBinding = (name, modulePath) => {
    const matches = ast.body.filter(node => node.type === 'ImportDeclaration' && node.source.value === modulePath)
      .flatMap(node => node.specifiers.filter(item => item.local.name === name).map(item => ({ node, item })));
    const { node, item } = one(matches, `${file} import ${name} from ${modulePath}`);
    named(parts, `import:${name}`, `${text(item)} from ${text(node.source)}`);
  };
  if (selector === 'app-export-core') {
    bindings(ast.body, coreNames);
    for (const name of ['PENS', 'pathLength', 'fontStrokes']) importBinding(name, './defs/helpers.js');
  } else if (selector === 'app-export-data-and-actions') {
    bindings(app(), [...appDataNames, ...appActionNames]);
    for (const name of ['DEFAULT_MACHINE', 'DEFAULT_MACHINE_B', 'DEFAULT_MACHINE_C', 'assignIds', 'isGcodeWorkflow', 'gcodeRefusal', 'machineCtx']) importBinding(name, './machine.js');
    effect(app(), '[machineIdx,prof.workflow]');
    // Hash export event wiring and gates, while keeping button wording and styling out of the fingerprint.
    for (const handler of ['doExport', 'doExportSVG', 'doExportDXF', 'download', 'downloadMegaFull', 'downloadJig']) {
      const opening = one(descendants(ast, node => node.type === 'JSXOpeningElement' && node.name.name === 'button'
        && node.attributes.some(attr => attr.name?.name === 'onClick' && attr.value?.expression?.name === handler)), `${file} button ${handler}`);
      for (const attrName of ['download', 'downloadMegaFull'].includes(handler) ? ['onClick'] : ['onClick', 'disabled']) {
        named(parts, `${handler}:${attrName}`, text(one(opening.attributes.filter(attr => attr.name?.name === attrName), `${handler} ${attrName}`)));
      }
    }
    for (const kind of ['gcode', 'svg', 'dxf']) {
      const opening = one(descendants(ast, node => node.type === 'JSXOpeningElement' && node.name.name === 'button'
        && node.attributes.some(attr => attr.name?.name === 'onClick'
          && descendants(attr, item => item.type === 'CallExpression' && item.callee.name === 'exportAllFrames' && item.arguments[0]?.value === kind).length)), `${file} exportAllFrames ${kind}`);
      for (const attrName of ['onClick', 'disabled']) named(parts, `exportAllFrames:${kind}:${attrName}`,
        text(one(opening.attributes.filter(attr => attr.name?.name === attrName), `exportAllFrames ${kind} ${attrName}`)));
    }
  } else if (selector === 'app-stack-export-props') {
    importBinding('StackView', './stack-view.jsx');
    const opening = one(descendants(ast, node => node.type === 'JSXOpeningElement' && node.name.name === 'StackView'), `${file} StackView`);
    for (const prop of stackProps) named(parts, `StackView:${prop}`, text(one(opening.attributes.filter(attr => attr.name?.name === prop), `${file} StackView ${prop}`)));
  } else if (selector === 'stack-export-pipeline') {
    bindings(ast.body, stackGlobals);
    const component = declaration(ast.body, 'StackView', file);
    const scope = component.body.body;
    for (const prop of stackProps) named(parts, `parameter:${prop}`, text(one(component.params[0].properties.filter(item => item.key?.name === prop), `${file} StackView parameter ${prop}`)));
    bindings(scope, stackData);
    effect(scope, '[mode,nFrames]');
    const kinds = one(descendants(component, node => node.type === 'ConditionalExpression' && node.test.name === 'gcodeEnabled'), `${file} enabled export formats`);
    named(parts, 'enabled-export-formats', text(kinds));
    const button = one(descendants(component, node => node.type === 'JSXOpeningElement' && node.name.name === 'button'
      && node.attributes.some(attr => attr.name?.name === 'onClick' && descendants(attr, item => item.type === 'CallExpression' && item.callee.name === 'exportZip').length)), `${file} exportZip button`);
    for (const attrName of ['onClick', 'disabled']) named(parts, `exportZip:${attrName}`, text(one(button.attributes.filter(attr => attr.name?.name === attrName), `${file} exportZip ${attrName}`)));
  } else if (selector === 'export-helpers') {
    bindings(ast.body, ['PENS_DEFAULT', 'PENS', 'savePens', 'resetPens', 'pathLength', 'fontStrokes', 'SFONT']);
    const hydrate = one(ast.body.filter(node => node.type === 'TryStatement' && descendants(node, item => item.type === 'Literal' && item.value === 'muusia-pens').length), `${file} saved pen palette loader`);
    named(parts, 'saved-pen-palette', text(hydrate));
  } else fail(`${file}: unknown selector ${selector}. Update the fixed source coverage before recapturing.`);
  return JSON.stringify(parts);
}

function requiredSources(kind) {
  if (!nodeFiles[kind]) fail(`unknown artifact kind ${kind}; use svg-workflow or physical-plot.`);
  return [
    { path: 'src/machine.js', selector: 'file' },
    { path: appPath, selector: 'app-export-core' },
    { path: appPath, selector: 'app-export-data-and-actions' },
    ...(kind === 'svg-workflow' ? [{ path: appPath, selector: 'app-stack-export-props' }, { path: stackPath, selector: 'stack-export-pipeline' }] : []),
    { path: helperPath, selector: 'export-helpers' },
    ...nodeFiles[kind].map(name => ({ path: `src/defs/nodes/${name}.js`, selector: 'file' })),
  ];
}

/** Call only after a real browser recapture; computing hashes is not a substitute for re-exporting the file. */
export async function computeExportSourceRecords(kind, { rootDir = ROOT, readSource = file => fs.readFile(path.join(rootDir, file), 'utf8') } = {}) {
  const cache = new Map();
  const records = [];
  for (const required of requiredSources(kind)) {
    if (!cache.has(required.path)) {
      try { cache.set(required.path, await readSource(required.path)); }
      catch (error) { fail(`${required.path}: cannot read export source (${error.message}). Restore the source or review its selector after a refactor.`); }
    }
    const source = cache.get(required.path);
    records.push({ ...required, sha256: hash(required.selector === 'file' ? source : selectedSource(source, required.path, required.selector)) });
  }
  return records;
}

/** Every required record must be present exactly once; JSON cannot opt out of source coverage. */
export async function assertExportSourcesMatch(provenance, kind, options) {
  const remedy = `Recapture ${kind} in the actual Muusia browser, replace its export file, and record fresh sources with computeExportSourceRecords('${kind}') from learn/lib/export-provenance.mjs; then run npm run build && npm run check:learn.`;
  if (provenance.sourceProvenanceVersion !== EXPORT_SOURCE_PROVENANCE_VERSION) fail(`unsupported or missing sourceProvenanceVersion for ${kind}. ${remedy}`);
  const expected = requiredSources(kind);
  if (!Array.isArray(provenance.sourceFiles) || provenance.sourceFiles.length !== expected.length) fail(`${kind}: missing or extra source records; expected ${expected.length}. ${remedy}`);
  const key = record => `${record.path}#${record.selector}`;
  const requiredKeys = new Set(expected.map(key));
  const recorded = new Map();
  for (const record of provenance.sourceFiles) {
    if (!record || typeof record !== 'object' || !requiredKeys.has(key(record)) || recorded.has(key(record))) fail(`${kind}: unknown, missing or duplicate source selector. ${remedy}`);
    if (Object.keys(record).sort().join(',') !== 'path,selector,sha256' || !/^[a-f0-9]{64}$/.test(record.sha256)) fail(`${kind}: invalid source record for ${key(record)}; historical reviewedChange exceptions are not accepted. ${remedy}`);
    recorded.set(key(record), record.sha256);
  }
  for (const current of await computeExportSourceRecords(kind, options)) {
    if (recorded.get(key(current)) !== current.sha256) fail(`${key(current)} changed since the ${kind} capture. ${remedy}`);
  }
}
