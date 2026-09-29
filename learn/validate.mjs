#!/usr/bin/env node
/** Validate the built Learn site, including publication below a repository prefix. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { unzipSync, strFromU8 } from 'fflate';
import { tutorials, nodeGuides } from './content.mjs';
import { PILOT_KEYS, DEFINITIONS, examples, evaluateExample } from './lib/fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '../dist');
const SITE = path.join(DIST, 'learn');
const manifest = JSON.parse(await fs.readFile(path.join(HERE, 'generated/manifest.json'), 'utf8'));
const legacyTutorialAssets = {
  'first-drawing': 'first',
  'style-and-stamp': 'stamps',
  'two-pen-composition': 'two-pens',
};
const tutorialAssetKey = tutorial => tutorial.assetKey || legacyTutorialAssets[tutorial.id] || tutorial.id;
const graphScreenshot = tutorial => tutorial.graphScreenshot || `assets/screenshots/tutorial-${tutorialAssetKey(tutorial)}.png`;
function captureExample(key) {
  if (examples[key]) return `examples/${key}.muusia.json`;
  const relative = `assets/screenshots/${key}.png`;
  const matchingLessons = tutorials.filter(tutorial => graphScreenshot(tutorial) === relative || tutorial.steps.some(step => step.image === relative));
  const patches = [...new Set(matchingLessons.map(tutorial => manifest.tutorials[tutorialAssetKey(tutorial)]?.example).filter(Boolean))];
  return patches.length === 1 ? patches[0] : undefined;
}
const graphCaptureKeys = new Set(tutorials.map(tutorial => path.basename(graphScreenshot(tutorial), '.png')));
const captureKeys = [...new Set([...PILOT_KEYS, ...graphCaptureKeys, ...tutorials.flatMap(tutorial => tutorial.steps
  .filter(step => step.image?.startsWith('assets/screenshots/')).map(step => path.basename(step.image, '.png')))])];
const failures = [];
let checks = 0;
function check(condition, message) { checks++; if (!condition) failures.push(message); }
function nonempty(value) { return typeof value === 'string' && /[A-Za-z]/.test(value) && value.trim().length > 1; }
const decode = value => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|#39|nbsp);/gi, (_, key) => {
  if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
  if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[key.toLowerCase()];
});
const plain = value => decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

async function assertExportSourceMatches(source) {
  const bytes = await fs.readFile(path.resolve(HERE, '..', source.path));
  const hash = value => createHash('sha256').update(value).digest('hex');
  const review = source.reviewedChange;
  if (!review) {
    assert.equal(hash(bytes), source.sha256, `${source.path}: export source matches captured code`);
    return;
  }
  // Keep the original capture hash. Only this exact Help-copy edit may differ.
  assert.equal(source.path, 'src/App.jsx', 'Only the reviewed App Help description may differ from capture');
  assert.equal(review.scope, 'help-copy-only');
  assert.match(review.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(nonempty(review.reason), 'A reviewed change must explain why export behavior is unchanged');
  assert.deepEqual(review.replacement, {
    before: 'Three step-by-step tutorials and twelve illustrated node guides.',
    after: 'Step-by-step tutorials and illustrated node guides.',
  });
  assert.equal(hash(bytes), review.sha256, 'Current App source matches the reviewed hash');
  const text = bytes.toString('utf8');
  assert.equal(text.split(review.replacement.after).length, 2, 'The reviewed Help replacement occurs exactly once');
  assert.equal(hash(text.replace(review.replacement.after, review.replacement.before)), source.sha256,
    'Reversing only the Help description change exactly restores the captured source hash');
}

async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

// Parse attributes from generated HTML. Content and attribute values are escaped by build.mjs.
function tags(html) {
  return [...html.matchAll(/<([a-z][\w:-]*)\b([^<>]*?)\/?\s*>/gi)].map(match => {
    const attributes = {};
    for (const attr of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attributes[attr[1].toLowerCase()] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
    return { name: match[1].toLowerCase(), attributes };
  });
}

const fresh = spawnSync(process.execPath, [path.join(HERE, 'generate-assets.mjs'), '--check'], { encoding: 'utf8' });
check(fresh.status === 0, `Generated assets are stale or invalid.\n${fresh.stdout}${fresh.stderr}`);
check(tutorials.length > 0 && tutorials.length === Object.keys(manifest.tutorials).length, 'Each published tutorial must have a generated example and vice versa.');
check(JSON.stringify(tutorials.map(tutorialAssetKey).sort()) === JSON.stringify(Object.keys(manifest.tutorials).sort()), 'Tutorial asset keys must cover the generated tutorial examples exactly.');
check(manifest.nodes.length === PILOT_KEYS.length, 'The pilot must contain every planned node reference.');
check(JSON.stringify([...Object.keys(nodeGuides)].sort()) === JSON.stringify([...PILOT_KEYS].sort()), 'Authored node guides must cover every published fixture node exactly once.');
check(JSON.stringify(manifest.nodes.map(n => n.key).sort()) === JSON.stringify([...PILOT_KEYS].sort()), 'Manifest node keys must match the pilot fixture keys.');
const tutorialIds = new Set(tutorials.map(t => t.id));
check(tutorialIds.size === tutorials.length, 'Tutorial IDs must be unique.');

for (const tutorial of tutorials) {
  check(nonempty(tutorial.title) && nonempty(tutorial.summary), `${tutorial.id}: missing title or summary.`);
  check(tutorial.nodeKeys.length > 0 && tutorial.nodeKeys.every(key => PILOT_KEYS.includes(key)), `${tutorial.id}: references an unknown node.`);
  check(tutorial.steps.length > 0 && tutorial.steps.every(step => nonempty(step.title) && nonempty(step.body)), `${tutorial.id}: a teaching step is empty.`);
  if (tutorial.next) check(tutorialIds.has(tutorial.next), `${tutorial.id}: unknown next tutorial ${tutorial.next}.`);
}
for (const [key, guide] of Object.entries(nodeGuides)) {
  check(nonempty(guide.summary) && nonempty(guide.useWhen), `${key}: missing guide overview.`);
  check(guide.recipe?.length > 0 && guide.recipe.every(nonempty), `${key}: missing usable example instructions.`);
  check(guide.related?.every(related => PILOT_KEYS.includes(related)), `${key}: related node is outside the published pilot.`);
  check(guide.tutorials?.every(id => tutorialIds.has(id)), `${key}: references an unknown tutorial.`);
}
for (const n of manifest.nodes) {
  const definition = DEFINITIONS[n.key], example = examples[n.key];
  check(definition?.name === n.name, `${n.key}: documented name differs from the actual node.`);
  check(example?.patch.root.nodes.some(node => node.type === n.key), `${n.key}: downloadable example does not contain the documented node.`);
  check(JSON.stringify(n.params.map(parameter => parameter.key)) === JSON.stringify(definition?.params.map(parameter => parameter.key)), `${n.key}: the control reference does not cover the current node controls.`);
  if (!definition || !example) continue;
  const representative = example.patch.root.nodes.find(node => node.type === n.key);
  for (const parameter of definition.params) {
    const documented = n.params.find(item => item.key === parameter.key);
    check(documented?.label === parameter.label && JSON.stringify(documented?.def) === JSON.stringify(parameter.def), `${n.key}.${parameter.key}: stale control label or default.`);
    if (parameter.showIf) check(documented?.conditional && nonempty(documented?.visibilityNote), `${n.key}.${parameter.key}: conditional control needs an explanation.`);
  }
  if (representative) {
    const actualInputs = typeof definition.ins === 'function' ? definition.ins(representative) : definition.ins || [];
    const actualOutputs = typeof definition.outs === 'function' ? definition.outs(representative) : definition.outs || [];
    check(JSON.stringify(n.inputs) === JSON.stringify(actualInputs), `${n.key}: input reference differs from its runnable example.`);
    check(JSON.stringify(n.outputs) === JSON.stringify(actualOutputs), `${n.key}: output reference differs from its runnable example.`);
  }
}

const expected = new Set(['index.html', 'tutorials/index.html', 'nodes/index.html',
  ...tutorials.map(t => `tutorials/${t.id}/index.html`), ...PILOT_KEYS.map(key => `nodes/${key}/index.html`)]);
let builtFiles = [];
try { builtFiles = await walk(SITE); } catch { failures.push('dist/learn is missing. Build the app and run node learn/build.mjs before validation.'); }
const pages = builtFiles.filter(file => file.endsWith('.html')).map(file => path.relative(SITE, file));
check(pages.length === expected.size, `Expected ${expected.size} published pages; found ${pages.length}.`);
for (const relative of expected) check(pages.includes(relative), `Missing expected page: ${relative}.`);
for (const relative of pages) check(expected.has(relative), `Unexpected stale or orphan page: ${relative}.`);
check(!builtFiles.some(file => path.relative(SITE, file).split(path.sep).includes('diagrams')), 'Synthetic connection-diagram assets must not be published.');
const publishedCaptureFiles = builtFiles.filter(file => path.dirname(file) === path.join(SITE, 'assets/screenshots') && file.endsWith('.png')).map(file => path.basename(file, '.png')).sort();
check(JSON.stringify(publishedCaptureFiles) === JSON.stringify([...captureKeys].sort()), 'Publish exactly the node, tutorial graph, and tutorial step screenshots referenced by the content.');

const documents = new Map();
const idsByFile = new Map();
const referencedPatches = new Set();
const referencedExports = new Set();
for (const relative of pages) {
  const full = path.join(SITE, relative), html = await fs.readFile(full, 'utf8'), elements = tags(html);
  const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(match => plain(match[1]));
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => plain(match[1]));
  check(elements.find(tag => tag.name === 'html')?.attributes.lang === 'en', `${relative}: document language must be English.`);
  check(titles.length === 1 && nonempty(titles[0]), `${relative}: needs one nonempty English title.`);
  check(headings.length === 1 && nonempty(headings[0]), `${relative}: needs one nonempty main heading.`);
  check(!/\b(?:undefined|NaN)\b|\[object Object\]/.test(plain(html)), `${relative}: contains a failed template value.`);
  check(!/\bTyyli\b/i.test(decode(html)), `${relative}: contains a Finnish Style label.`);
  check(!/assets\/diagrams\//i.test(decode(html)), `${relative}: references a synthetic connection diagram.`);
  check(!elements.some(tag => (tag.attributes.class || '').split(/\s+/).some(name => ['brand-mark', 'wire-node', 'wire-diagram'].includes(name))), `${relative}: contains the invented logo or reconstructed node-card diagram.`);
  const ids = elements.filter(tag => 'id' in tag.attributes).map(tag => tag.attributes.id);
  check(new Set(ids).size === ids.length, `${relative}: duplicate anchor IDs.`);
  check(ids.includes('main'), `${relative}: the skip link has no main destination.`);
  idsByFile.set(full, new Set(ids));
  documents.set(full, { relative, html, elements });
  for (const img of elements.filter(tag => tag.name === 'img')) check(nonempty(img.attributes.alt), `${relative}: image ${img.attributes.src} lacks descriptive alt text.`);
}

for (const tutorial of tutorials) {
  const doc = documents.get(path.join(SITE, `tutorials/${tutorial.id}/index.html`));
  if (!doc) continue;
  check(doc.html.includes(tutorial.title.replace(/&/g, '&amp;')), `${tutorial.id}: published title is missing.`);
  check(doc.elements.some(tag => tag.name === 'img' && tag.attributes.src?.endsWith(graphScreenshot(tutorial))), `${tutorial.id}: genuine tutorial graph screenshot is missing.`);
  for (const step of tutorial.steps.filter(step => step.image)) check(doc.elements.some(tag => tag.name === 'img' && tag.attributes.src?.endsWith(step.image)), `${tutorial.id}: step screenshot ${step.image} is missing.`);
}
for (const n of manifest.nodes) {
  const doc = documents.get(path.join(SITE, `nodes/${n.key}/index.html`));
  if (!doc) continue;
  const guideHeading = plain(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(doc.html)?.[1] || '');
  check(guideHeading === n.name, `${n.key}: the published node heading must use its actual English name.`);
  check(doc.elements.some(tag => tag.name === 'img' && tag.attributes.src?.endsWith(n.screenshot)), `${n.key}: actual UI screenshot is missing from its guide.`);
  check(doc.elements.some(tag => tag.name === 'a' && 'download' in tag.attributes && tag.attributes.href?.endsWith(n.example)), `${n.key}: guide has no downloadable example patch.`);
  check(n.comparisons.length >= 2 && n.comparisons.every(c => doc.elements.some(tag => tag.name === 'img' && tag.attributes.src?.endsWith(c.src))), `${n.key}: generated comparison images are missing from the guide.`);
}

// Resolve as browsers do, both at the domain root and on GitHub Pages below /plotter-patcher/.
for (const prefix of ['/', '/plotter-patcher/']) {
  const origin = 'https://muusia.invalid';
  const reachable = new Map();
  for (const [full, doc] of documents) {
    const pageURL = new URL(`${prefix}learn/${doc.relative.split(path.sep).join('/')}`, origin);
    const outgoing = new Set();
    for (const tag of doc.elements) for (const attribute of ['href', 'src', 'poster']) {
      const reference = tag.attributes[attribute];
      if (reference === undefined || /^(?:https?:|mailto:|tel:|data:)/i.test(reference)) continue;
      check(reference.length > 0, `${doc.relative}: empty ${attribute}.`);
      let resolved;
      try { resolved = new URL(reference, pageURL); } catch { failures.push(`${doc.relative}: malformed reference ${reference}.`); continue; }
      check(resolved.origin === origin && resolved.pathname.startsWith(prefix), `${doc.relative}: ${reference} escapes deployment prefix ${prefix}.`);
      if (resolved.origin !== origin || !resolved.pathname.startsWith(prefix)) continue;
      const local = decodeURIComponent(resolved.pathname.slice(prefix.length));
      let destination = path.resolve(DIST, local);
      if (resolved.pathname.endsWith('/')) destination = path.join(destination, 'index.html');
      check(destination === DIST || destination.startsWith(DIST + path.sep), `${doc.relative}: reference escapes dist: ${reference}.`);
      let status;
      try { status = await fs.stat(destination); } catch { /* report all broken references in one run */ }
      check(status?.isFile(), `${prefix}learn/${doc.relative}: broken ${attribute} ${reference}.`);
      if (!status?.isFile()) continue;
      if (destination.endsWith('.html')) {
        if (documents.has(destination)) outgoing.add(destination);
        if (resolved.hash) {
          const id = decodeURIComponent(resolved.hash.slice(1));
          const targetIds = idsByFile.get(destination);
          check(targetIds?.has(id), `${doc.relative}: missing fragment ${reference}.`);
        }
      }
      if (destination.endsWith('.muusia.json')) referencedPatches.add(destination);
      if (/\.(?:zip|svg)$/i.test(destination) && tag.name === 'a' && 'download' in tag.attributes) referencedExports.add(destination);
    }
    reachable.set(full, outgoing);
  }
  const seen = new Set(), queue = [path.join(SITE, 'index.html')];
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(reachable.get(current) || []));
  }
  for (const full of documents.keys()) check(seen.has(full), `${prefix}: page is unreachable from the overview: ${path.relative(SITE, full)}.`);
}

// A .png extension alone is insufficient: validate the actual PNG stream and pixel dimensions.
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
const screenshotHashes = new Set();
let captureManifest;
try {
  captureManifest = JSON.parse(await fs.readFile(path.join(HERE, 'assets/screenshots/capture-manifest.json'), 'utf8'));
  check(captureManifest.appVersion === manifest.version, 'Screenshot capture version must match the generated source manifest.');
  check(JSON.stringify(captureManifest.captures.map(capture => capture.file).sort()) === JSON.stringify(captureKeys.map(key => `${key}.png`).sort()), 'Capture manifest must cover exactly the published screenshots.');
  check((await fs.readFile(path.join(SITE, 'assets/screenshots/capture-manifest.json'), 'utf8')) === (await fs.readFile(path.join(HERE, 'assets/screenshots/capture-manifest.json'), 'utf8')), 'Published capture provenance must match its source.');
} catch (error) { check(false, `Capture manifest is missing or invalid (${error.message}).`); }
for (const key of captureKeys) {
  const relative = `assets/screenshots/${key}.png`;
  try {
    const bytes = await fs.readFile(path.join(SITE, relative));
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG signature');
    let position = 8, header, ended = false;
    const compressed = [];
    while (position < bytes.length) {
      const length = bytes.readUInt32BE(position), type = bytes.toString('ascii', position + 4, position + 8);
      assert.ok(position + length + 12 <= bytes.length, 'complete chunk');
      const data = bytes.subarray(position + 8, position + 8 + length);
      assert.equal(bytes.readUInt32BE(position + 8 + length), crc32(bytes.subarray(position + 4, position + 8 + length)), `${type} checksum`);
      if (type === 'IHDR') header = data;
      if (type === 'IDAT') compressed.push(data);
      if (type === 'IEND') ended = true;
      position += length + 12;
    }
    assert.ok(header && ended && compressed.length, 'complete PNG structure');
    const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
    assert.ok(width >= 320 && height >= 200, `legible screenshot dimensions (${width} × ${height})`);
    const pixels = inflateSync(Buffer.concat(compressed));
    assert.ok(pixels.length > width * height, 'substantive raster pixels');
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.ok(!screenshotHashes.has(hash), 'a distinct capture for each node and tutorial');
    screenshotHashes.add(hash);
    assert.deepEqual(bytes, await fs.readFile(path.join(HERE, relative)), 'published screenshot matches captured original');
    const capture = captureManifest?.captures.find(item => item.file === `${key}.png`);
    assert.ok(capture, 'capture provenance entry');
    const expectedPatch = captureExample(key);
    assert.ok(expectedPatch, 'screenshot maps unambiguously to a documented example');
    assert.equal(capture.patch, expectedPatch, 'matching example patch');
    const capturedPatch = JSON.parse(await fs.readFile(path.join(HERE, expectedPatch), 'utf8'));
    assert.ok(capturedPatch.root.nodes.some(node => DEFINITIONS[node.type]?.name === capture.selectedNode), 'recorded selected node exists in the captured patch');
    assert.ok(Number.isInteger(capture.frameIndex) && capture.frameIndex >= 0, 'recorded animation frame is valid');
    assert.equal(capture.width, width, 'recorded width');
    assert.equal(capture.height, height, 'recorded height');
    assert.equal(capture.sha256, hash, 'recorded image checksum');
    if (graphCaptureKeys.has(key)) assert.equal(capture.view, 'graph', 'tutorial captured in actual graph view');
    if (['svg-stack', 'svg-stack-settings'].includes(key)) assert.equal(capture.view, 'stack', 'export tutorial captured in actual Stack view');
    check(true, '');
  } catch (error) { check(false, `${relative}: missing or invalid screenshot (${error.message}).`); }
}

const expectedDownloads = [manifest.blankExample, ...manifest.nodes.map(n => n.example), ...Object.values(manifest.tutorials).map(t => t.example)];
check(new Set(expectedDownloads).size === 1 + manifest.nodes.length + Object.keys(manifest.tutorials).length, 'Each node and tutorial needs a complete example, plus one blank starter.');
for (const relative of expectedDownloads) {
  const full = path.join(SITE, relative);
  check(referencedPatches.has(full), `Example patch is not linked by the published site: ${relative}.`);
  try {
    const bytes = await fs.readFile(full), patch = JSON.parse(bytes.toString('utf8'));
    assert.equal(patch.app, 'muusia'); assert.equal(patch.v, 1);
    assert.ok(nonempty(patch.name));
    assert.deepEqual(patch.canvas, { W: 297, H: 210 });
    assert.ok(Array.isArray(patch.root.nodes) && Array.isArray(patch.root.edges));
    assert.ok(patch.root.nodes.every(n => DEFINITIONS[n.type] && n.params && typeof n.id === 'number'));
    const nodeIds = new Set(patch.root.nodes.map(n => n.id));
    assert.equal(nodeIds.size, patch.root.nodes.length);
    assert.ok(patch.root.edges.every(e => nodeIds.has(e.from) && nodeIds.has(e.to)));
    assert.deepEqual(bytes, await fs.readFile(path.join(HERE, relative)), 'published download matches its source');
    const key = path.basename(relative, '.muusia.json');
    if (key !== 'blank') {
      assert.ok(examples[key], `known runnable fixture ${key}`);
      assert.ok(evaluateExample({ ...examples[key], patch }).output.paths.length > 0, 'downloaded patch produces drawing paths');
    } else assert.equal(patch.root.nodes.length, 0, 'blank starter is empty');
    check(true, '');
  } catch (error) { check(false, `${relative}: invalid downloadable patch (${error.message}).`); }
}

// Check that lesson 05 actually demonstrates the topology and ordering described in its prose.
const transformLesson = tutorials.find(tutorial => tutorial.id === 'transform-crop-fill');
if (transformLesson) {
  try {
    const tutorialAsset = manifest.tutorials[tutorialAssetKey(transformLesson)];
    const example = examples[path.basename(tutorialAsset.example, '.muusia.json')];
    assert.ok(example, 'lesson has a runnable fixture');
    const evaluated = evaluateExample(example), byType = Object.fromEntries(example.patch.root.nodes.map(node => [node.type, node]));
    const sequence = ['radat', 'move_scale', 'kierto', 'hatch', 'container'];
    for (let index = 0; index < sequence.length; index++) {
      assert.ok(byType[sequence[index]], `lesson contains ${sequence[index]}`);
      if (index) assert.ok(example.patch.root.edges.some(edge => edge.from === byType[sequence[index - 1]].id && edge.to === byType[sequence[index]].id && edge.toPort === 0), 'transforms precede filling, and filling precedes clipping');
    }
    const outputOf = type => evaluated.out[byType[type].id][0];
    const original = outputOf('radat');
    assert.ok(original.paths.length > 0 && original.paths.every(pa => pa.closed && pa.layer === 1), 'source consists of closed blue outlines');
    for (const [beforeType, afterType] of [['radat', 'move_scale'], ['move_scale', 'kierto']]) {
      const before = outputOf(beforeType), after = outputOf(afterType);
      assert.deepEqual(after.paths.map(pa => [pa.closed, pa.layer]), before.paths.map(pa => [pa.closed, pa.layer]), `${afterType} preserves closed states and pen assignments`);
      assert.notDeepEqual(after.paths.map(pa => pa.pts), before.paths.map(pa => pa.pts), `${afterType} visibly changes the example geometry`);
    }
    const rotated = outputOf('kierto'), filled = outputOf('hatch'), clipped = outputOf('container');
    assert.ok(filled.paths.length > rotated.paths.length && filled.paths.some(pa => !pa.closed), 'Hatch Fill adds actual open drawing strokes');
    assert.ok(filled.paths.every(pa => pa.layer === 1), 'the filled shape and its kept outline use the blue pen');
    const cropNode = byType.container, cropParams = cropNode.params;
    assert.equal(cropParams.shape, 'Rectangle');
    assert.equal(cropParams.rot, 0); assert.equal(cropParams.gap, 0); assert.equal(cropParams.keep, 'Inside');
    const bounds = { left: cropParams.cx - cropParams.rw / 2, right: cropParams.cx + cropParams.rw / 2, top: cropParams.cy - cropParams.rh / 2, bottom: cropParams.cy + cropParams.rh / 2 };
    const inside = ([x, y], tolerance = 0) => x >= bounds.left - tolerance && x <= bounds.right + tolerance && y >= bounds.top - tolerance && y <= bounds.bottom + tolerance;
    assert.ok(filled.paths.some(pa => pa.pts.some(point => !inside(point))), 'the input crosses the rectangle, so this lesson demonstrates real cropping');
    assert.ok(clipped.paths.every(pa => pa.pts.every(point => inside(point, 0.001))), 'final drawing stays within the clipping rectangle to 0.001 mm');
    const artwork = clipped.paths.filter(pa => pa.layer === 1), frames = clipped.paths.filter(pa => pa.layer === 0);
    assert.ok(artwork.length > 0 && artwork.every(pa => !pa.closed), 'the cropped blue strokes are open fragments');
    assert.ok(frames.length > 0 && frames.every(pa => pa.closed), 'Draw region adds a separate closed black frame');
    assert.equal(artwork.length + frames.length, clipped.paths.length, 'the lesson introduces only the intended blue artwork and black frame');

    // A reversed order must reproduce the documented failure, not accidentally fill the added frame.
    const cropBeforeFill = DEFINITIONS.container.compute([rotated], { ...cropParams, draw: false }, evaluated.ctx, cropNode);
    assert.ok(cropBeforeFill.paths.length > 0 && cropBeforeFill.paths.every(pa => !pa.closed), 'cropping the outline first leaves only open fragments');
    const misorderedFill = DEFINITIONS.hatch.compute([cropBeforeFill], byType.hatch.params, evaluated.ctx, byType.hatch);
    assert.deepEqual(misorderedFill, cropBeforeFill, 'Hatch Fill cannot add inside hatching to the already clipped open fragments');
    const unwired = DEFINITIONS.container.compute([filled], { ...cropParams, shape: 'Wired region' }, evaluated.ctx, cropNode);
    assert.deepEqual(unwired, filled, 'an absent wired region passes content through without cropping or adding a frame');
    check(true, '');
  } catch (error) { check(false, `Transform, crop and fill lesson contradicts its example (${error.message}).`); }
}

// Lesson 06 depends on numeric wires taking precedence over the visible fallback controls.
const numbersLesson = tutorials.find(tutorial => tutorial.id === 'control-with-numbers');
if (numbersLesson) {
  try {
    const tutorialAsset = manifest.tutorials[tutorialAssetKey(numbersLesson)];
    const example = examples[path.basename(tutorialAsset.example, '.muusia.json')];
    assert.ok(example, 'numeric lesson has a runnable fixture');
    const byType = Object.fromEntries(example.patch.root.nodes.map(node => [node.type, node]));
    for (const type of ['grid', 'arvo', 'satunnainen', 'matem', 'aaltoilu']) assert.ok(byType[type], `numeric lesson contains ${type}`);
    for (const [from, to, port] of [['grid', 'aaltoilu', 0], ['arvo', 'matem', 0], ['satunnainen', 'matem', 1], ['matem', 'aaltoilu', 'p:amp']]) {
      assert.ok(example.patch.root.edges.some(edge => edge.from === byType[from].id && edge.to === byType[to].id && edge.fromPort === 0 && edge.toPort === port), `${from} drives the documented ${to} input`);
    }
    const result = evaluateExample(example), scalar = type => result.out[byType[type].id][0];
    const random = scalar('satunnainen'), value = scalar('arvo'), product = scalar('matem');
    assert.equal(byType.matem.params.op, 'A × B', 'the example uses multiplication');
    assert.ok(random >= byType.satunnainen.params.min && random < byType.satunnainen.params.max, 'Random returns one number inside the chosen interval');
    assert.equal(product, value * random, 'Math multiplies the two connected numeric values');
    assert.equal(result.params[byType.aaltoilu.id].amp, product, 'the Math output drives Wave amplitude');
    const sourcePaths = result.out[byType.grid.id][0].paths;
    assert.equal(result.output.paths.length, sourcePaths.length, 'numeric control changes preserve the number of drawn paths');
    assert.deepEqual(result.output.paths.map(pa => [pa.layer, pa.closed]), sourcePaths.map(pa => [pa.layer, pa.closed]), 'Wave preserves pen assignments and open states');
    assert.notDeepEqual(result.output.paths.map(pa => pa.pts), sourcePaths.map(pa => pa.pts), 'the connected amplitude visibly changes the Grid geometry');

    const ignoredFallbacks = structuredClone(example);
    Object.assign(ignoredFallbacks.patch.root.nodes.find(node => node.type === 'matem').params, { a: -83, b: 97 });
    ignoredFallbacks.patch.root.nodes.find(node => node.type === 'aaltoilu').params.amp = 0;
    const wired = evaluateExample(ignoredFallbacks);
    assert.equal(wired.out[byType.matem.id][0], product, 'wired Math inputs override both fallback values');
    assert.equal(wired.params[byType.aaltoilu.id].amp, product, 'the amplitude wire overrides Wave’s stored manual control');
    assert.deepEqual(wired.output, result.output, 'changing ignored fallback controls leaves the drawing unchanged');

    const changedSeed = structuredClone(example);
    changedSeed.patch.root.nodes.find(node => node.type === 'satunnainen').params.seed = byType.satunnainen.params.seed + 1;
    const variation = evaluateExample(changedSeed);
    const otherRandom = variation.out[byType.satunnainen.id][0];
    assert.notEqual(otherRandom, random, 'the demonstrated seed change chooses a different number');
    assert.ok(otherRandom >= byType.satunnainen.params.min && otherRandom < byType.satunnainen.params.max, 'the new seeded number remains in range');
    assert.equal(variation.out[byType.matem.id][0], value * otherRandom, 'a changed seed propagates through Math');
    assert.equal(variation.params[byType.aaltoilu.id].amp, value * otherRandom, 'a changed seed propagates to the numeric parameter');
    assert.equal(variation.output.paths.length, sourcePaths.length, 'a seed variation preserves drawing path count');
    assert.notDeepEqual(variation.output, result.output, 'the demonstrated seed change affects the resulting waves');
    changedSeed.patch.root.nodes.find(node => node.type === 'satunnainen').params.seed = byType.satunnainen.params.seed;
    assert.deepEqual(evaluateExample(changedSeed).out, result.out, 'restoring the original seed restores all computed outputs');
    assert.deepEqual(evaluateExample(example, { frameIdx: 5, frameCount: 12 }).out, result.out, 'Random does not change just because the animation frame changes');

    const mathExample = examples.matem, mathResult = evaluateExample(mathExample);
    const mathNode = mathExample.patch.root.nodes.find(node => node.type === 'matem');
    const valueNode = mathExample.patch.root.nodes.find(node => node.type === 'arvo');
    assert.ok(mathExample.patch.root.edges.some(edge => edge.from === valueNode.id && edge.to === mathNode.id && edge.toPort === 0), 'Math guide demonstrates a connected A input');
    assert.ok(!mathExample.patch.root.edges.some(edge => edge.to === mathNode.id && edge.toPort === 1), 'Math guide deliberately leaves B unwired');
    assert.equal(mathResult.out[mathNode.id][0], mathResult.out[valueNode.id][0] * mathNode.params.b, 'Math guide uses its unwired B fallback');
    const editedB = structuredClone(mathExample);
    editedB.patch.root.nodes.find(node => node.type === 'matem').params.b = mathNode.params.b + 1;
    assert.equal(evaluateExample(editedB).out[mathNode.id][0], mathResult.out[valueNode.id][0] * (mathNode.params.b + 1), 'editing an unwired fallback changes the result');

    const randomExample = examples.satunnainen, randomResult = evaluateExample(randomExample);
    const randomNode = randomExample.patch.root.nodes.find(node => node.type === 'satunnainen');
    const randomWave = randomExample.patch.root.nodes.find(node => node.type === 'aaltoilu');
    const randomNumber = randomResult.out[randomNode.id][0];
    assert.ok(randomNumber >= randomNode.params.min && randomNumber < randomNode.params.max, 'Random guide value stays inside its own range');
    assert.equal(randomResult.params[randomWave.id].amp, randomNumber, 'Random guide connects its scalar directly to Wave amplitude');
    check(true, '');
  } catch (error) { check(false, `Control a patch with numbers lesson contradicts its example (${error.message}).`); }
}

function geometryBounds(paths) {
  const points = paths.flatMap(pa => pa.pts);
  return [Math.min(...points.map(point => point[0])), Math.min(...points.map(point => point[1])), Math.max(...points.map(point => point[0])), Math.max(...points.map(point => point[1]))];
}
function closeNumbers(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length, `${label}: dimensions`);
  assert.ok(actual.every((number, index) => Math.abs(number - expected[index]) <= tolerance), `${label}: ${actual.join(', ')} instead of ${expected.join(', ')}`);
}
function validatePhysicalDrawing(geometry, tolerance = 1e-9) {
  assert.equal(geometry.paths.length, 5, 'the first physical test has exactly five drawing paths');
  assert.ok(geometry.paths.every(pa => pa.layer === 0), 'the first physical test uses only pen 0');
  const closed = geometry.paths.filter(pa => pa.closed), open = geometry.paths.filter(pa => !pa.closed);
  assert.equal(closed.length, 2, 'only the square and orientation triangle are closed');
  assert.equal(open.length, 3, 'the three separated strokes require real pen lifts');
  const square = closed.find(pa => pa.pts.length === 4), triangle = closed.find(pa => pa.pts.length === 3);
  assert.ok(square && triangle, 'square and triangular direction mark are complete');
  closeNumbers(geometryBounds([square]), [20, 20, 40, 40], tolerance, '20 mm square bounds');
  const sides = square.pts.map((point, index) => Math.hypot(point[0] - square.pts[(index + 1) % 4][0], point[1] - square.pts[(index + 1) % 4][1]));
  closeNumbers(sides, [20, 20, 20, 20], tolerance, 'square side lengths');
  assert.ok(Math.abs(sides.reduce((sum, length) => sum + length, 0) - 80) <= tolerance * 4, 'square perimeter is 80 mm');
  assert.ok(triangle.pts.some(([x, y]) => Math.abs(x - 78) <= tolerance && Math.abs(y - 30) <= tolerance), 'triangle tip points right');
  const basePoints = triangle.pts.filter(([x]) => Math.abs(x - 66) <= tolerance);
  assert.equal(basePoints.length, 2, 'triangle base remains left of its tip');
  assert.ok(basePoints.some(point => point[1] < 30) && basePoints.some(point => point[1] > 30), 'direction mark retains its upright placement');
  const rows = open.map(pa => ({ bounds: geometryBounds([pa]), points: pa.pts })).sort((a, b) => a.bounds[1] - b.bounds[1]);
  for (let index = 0; index < rows.length; index++) {
    const y = [50, 55.25, 60.5][index];
    closeNumbers(rows[index].bounds, [50, y, 79.7, y], tolerance, 'separated horizontal stroke');
    assert.ok(rows[index].points.every(point => Math.abs(point[1] - y) <= tolerance), 'test stroke remains horizontal');
  }
  closeNumbers(geometryBounds(geometry.paths), [20, 20, 79.7, 60.5], tolerance, 'small drawing location on the A4 canvas');
}

const physicalLesson = tutorials.find(tutorial => tutorialAssetKey(tutorial) === 'physical-plot');
if (physicalLesson) {
  try {
    const asset = manifest.tutorials['physical-plot'], example = examples[path.basename(asset.example, '.muusia.json')];
    const { nodes, edges } = example.patch.root;
    assert.deepEqual(nodes.map(node => node.type).sort(), ['container', 'container', 'grid', 'merge', 'move_scale'].sort(), 'the physical test uses only the five documented built-in nodes');
    for (const node of nodes.filter(node => node.type === 'container')) {
      assert.ok(!edges.some(edge => edge.to === node.id), 'the two Container nodes generate their own region outlines without imported geometry');
      assert.equal(node.params.draw, true, 'Draw region emits the actual closed test shape');
    }
    validatePhysicalDrawing(evaluateExample(example).output);
    check(true, '');
  } catch (error) { check(false, `First physical plot lesson contradicts its test drawing (${error.message}).`); }
}

// Inspect the real application's exported geometry, independently of SVG formatting.
function exportedSvgGeometry(xml) {
  const elements = tags(xml), root = elements.find(tag => tag.name === 'svg');
  assert.ok(root, 'SVG root exists');
  assert.equal(root.attributes.width, '297mm', 'full A4 landscape width retained');
  assert.equal(root.attributes.height, '210mm', 'full A4 landscape height retained');
  assert.deepEqual(root.attributes.viewbox?.trim().split(/[\s,]+/).map(Number), [0, 0, 297, 210], 'common full-canvas origin and viewBox');
  assert.ok(!elements.some(tag => /^(?:circle|ellipse|line|polyline|polygon|rect|text|image|use|script|clippath|mask)$/.test(tag.name)), 'only the intended path geometry is exported');
  assert.ok(!elements.some(tag => 'transform' in tag.attributes), 'no additional registration, scale, or mirror transform');
  const paths = [], contexts = [];
  for (const token of xml.matchAll(/<(\/?)([a-z][\w:-]*)\b([^<>]*?)>/gi)) {
    const closing = token[1] === '/', name = token[2].toLowerCase();
    if (closing) { contexts.pop(); continue; }
    const attributes = tags(token[0])[0]?.attributes || {};
    const context = { ...(contexts.at(-1) || {}), ...attributes };
    if (name === 'path') {
      const pen = /\bpen-(\d+)-/.exec(context.id || '')?.[1];
      assert.ok(pen !== undefined, 'path belongs to a labelled pen layer');
      assert.equal(context.fill, 'none', 'paths remain unfilled pen strokes');
      const d = attributes.d || '', values = d.match(/[MLZmlz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
      assert.ok(!/[AaCcHhQqSsTtVv]/.test(d), 'exported polylines can be inspected without approximation');
      const pts = [];
      let command, closed = false;
      for (let i = 0; i < values.length;) {
        if (/^[MLZmlz]$/.test(values[i])) command = values[i++];
        if (command === 'Z') { closed = true; assert.equal(i, values.length, 'one closed subpath per pen path'); break; }
        assert.ok(command === 'M' || command === 'L', 'absolute path coordinates');
        assert.ok(i + 1 < values.length && !/^[A-Za-z]$/.test(values[i]) && !/^[A-Za-z]$/.test(values[i + 1]), 'complete coordinate pair');
        const point = [Number(values[i++]), Number(values[i++])];
        assert.ok(point.every(Number.isFinite), 'finite exported coordinates');
        pts.push(point);
        command = 'L';
      }
      assert.ok(pts.length >= 2, 'nonempty exported stroke');
      paths.push({ pts, closed, layer: Number(pen), color: context.stroke?.toLowerCase() });
    }
    if (!/\/\s*>$/.test(token[0])) contexts.push(context);
  }
  return { paths };
}

function roundedSegments(geometry) {
  const segments = [], rounded = value => Math.round(value * 100) / 100;
  for (const pa of geometry.paths) for (let i = 0; i < pa.pts.length - 1 + (pa.closed ? 1 : 0); i++) {
    const endpoints = [pa.pts[i], pa.pts[(i + 1) % pa.pts.length]].map(point => point.map(rounded).join(',')).sort();
    segments.push(`${pa.layer}:${endpoints.join('|')}`);
  }
  return segments.sort();
}

const exportBundles = Object.entries(manifest.tutorials).filter(([, tutorial]) => tutorial.exportBundle);
for (const [assetKey, tutorial] of exportBundles) {
  const relative = tutorial.exportBundle.src, full = path.join(SITE, relative);
  check(referencedExports.has(full), `${assetKey}: the reference export must be offered as a download.`);
  try {
    const bytes = await fs.readFile(full);
    assert.deepEqual(bytes, await fs.readFile(path.join(HERE, relative)), 'published reference matches actual browser download');
    if (relative.endsWith('.svg')) {
      const geometry = exportedSvgGeometry(bytes.toString('utf8'));
      const fixtureKey = path.basename(tutorial.example, '.muusia.json');
      const original = evaluateExample(examples[fixtureKey]).output;
      assert.deepEqual(roundedSegments(geometry), roundedSegments(original), 'actual SVG preserves every source segment at export precision, independently of path order or direction');
      assert.ok(geometry.paths.every(pa => pa.color === manifest.palette[pa.layer]?.c.toLowerCase()), 'actual SVG uses the recorded source pen colours');
      if (assetKey === 'physical-plot') validatePhysicalDrawing(geometry, 0.011);
      const provenanceRelative = tutorial.exportBundle.provenance || `assets/screenshots/${assetKey}-export.json`;
      const provenanceBytes = await fs.readFile(path.join(HERE, provenanceRelative));
      assert.deepEqual(await fs.readFile(path.join(SITE, provenanceRelative)), provenanceBytes, 'published SVG provenance matches its source');
      const provenance = JSON.parse(provenanceBytes.toString('utf8'));
      assert.equal(provenance.source, 'Actual Muusia browser export');
      assert.equal(provenance.appVersion, manifest.version);
      assert.equal(provenance.patch, tutorial.example);
      assert.equal(provenance.file, relative);
      assert.equal(provenance.sha256, createHash('sha256').update(bytes).digest('hex'), 'SVG checksum matches recorded browser export');
      assert.equal(provenance.patchSha256, createHash('sha256').update(await fs.readFile(path.join(HERE, tutorial.example))).digest('hex'), 'physical test patch matches captured export');
      assert.equal(provenance.selectedNode, 'Merge');
      assert.deepEqual(provenance.canvas, { W: 297, H: 210 });
      for (const source of provenance.sourceFiles || []) await assertExportSourceMatches(source);
      check(true, '');
      continue;
    }
    assert.ok(relative.endsWith('.zip'), 'reference download is a supported SVG or SVG ZIP');
    const entries = unzipSync(bytes), filenames = Object.keys(entries).filter(name => !name.endsWith('/')).sort();
    assert.equal(filenames.length, 2, 'exactly two SVG pen sheets');
    assert.ok(filenames.every(name => /^[^/\\]+-sheet0[12]\.svg$/.test(name)), 'original per-sheet SVG filenames');
    const fixtureKey = path.basename(tutorial.example, '.muusia.json');
    assert.ok(examples[fixtureKey], 'export bundle has a runnable source example');
    const original = evaluateExample(examples[fixtureKey]).output;
    const expectedLayers = [{ layer: 1, color: '#2a56a8', paths: 24 }, { layer: 2, color: '#c23a30', paths: 12 }];
    const exported = [];
    for (let i = 0; i < filenames.length; i++) {
      const file = filenames[i], geometry = exportedSvgGeometry(strFromU8(entries[file])), expectedLayer = expectedLayers[i];
      assert.ok(file.endsWith(`sheet0${i + 1}.svg`), 'files use ascending pen-sheet order');
      assert.equal(geometry.paths.length, expectedLayer.paths, `${file}: complete source layer, without marks or sheet numbers`);
      assert.ok(geometry.paths.every(pa => pa.layer === expectedLayer.layer && pa.color === expectedLayer.color), `${file}: correct pen assignment and colour`);
      const expectedGeometry = { paths: original.paths.filter(pa => pa.layer === expectedLayer.layer) };
      assert.deepEqual(roundedSegments(geometry), roundedSegments(expectedGeometry), `${file}: unchanged registered geometry, without crop, translation, mirror or added marks`);
      exported.push(...geometry.paths);
    }
    assert.deepEqual(roundedSegments({ paths: exported }), roundedSegments(original), 'both files preserve the complete two-colour composition');
    const provenanceRelative = tutorial.exportBundle.provenance || `assets/screenshots/${assetKey}-export.json`;
    const provenanceBytes = await fs.readFile(path.join(HERE, provenanceRelative));
    assert.deepEqual(await fs.readFile(path.join(SITE, provenanceRelative)), provenanceBytes, 'published export provenance matches source');
    const provenance = JSON.parse(provenanceBytes.toString('utf8'));
    assert.equal(provenance.source, 'Actual Muusia browser export');
    assert.equal(provenance.appVersion, manifest.version);
    assert.equal(provenance.patch, tutorial.example);
    assert.equal(provenance.bundle, relative);
    assert.equal(provenance.sha256, createHash('sha256').update(bytes).digest('hex'), 'ZIP checksum matches recorded browser export');
    assert.equal(provenance.patchSha256, createHash('sha256').update(await fs.readFile(path.join(HERE, tutorial.example))).digest('hex'), 'source patch matches captured export');
    assert.equal(provenance.selectedNode, 'Merge');
    assert.equal(provenance.settings.mode, 'pens');
    assert.equal(provenance.settings.margin, 0);
    assert.equal(provenance.settings.mirror, false);
    assert.equal(provenance.settings.numbers, false);
    assert.equal(provenance.settings.drill, 'off');
    assert.deepEqual(provenance.settings.exportedPens, [1, 2]);
    assert.deepEqual(provenance.settings.visiblePens, [1], 'recorded test exported both sheets while Red was hidden in preview');
    assert.deepEqual(provenance.files.map(file => file.name).sort(), filenames);
    for (const file of provenance.files) assert.equal(file.sha256, createHash('sha256').update(entries[file.name]).digest('hex'), `${file.name}: recorded original SVG checksum`);
    for (const source of provenance.sourceFiles || []) await assertExportSourceMatches(source);
    check(true, '');
  } catch (error) { check(false, `${assetKey}: invalid reference SVG export (${error.message}).`); }
}

if (failures.length) {
  console.error(`Muusia Learn validation failed (${failures.length} of ${checks} checks):\n${[...new Set(failures)].map(f => `- ${f}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Muusia Learn validated: ${checks} checks; ${expected.size} reachable English pages, ${tutorials.length} tutorials with real graph screenshots, ${manifest.nodes.length} illustrated node guides, ${captureKeys.length} valid PNG captures, ${expectedDownloads.length} working patch downloads, and ${exportBundles.length} verified reference SVG export(s). Links resolve both at / and /plotter-patcher/.`);
}
