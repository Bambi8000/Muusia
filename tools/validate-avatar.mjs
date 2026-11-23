/* Run from the repository root: node tools/validate-avatar.mjs.
 * --renderer-only exercises analytic clipping/projection fixtures without mesh generation.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  avatarBounds, clipAvatarMesh, buildAvatarView, drawAvatarCanvas, avatarLineDrawing,
} from '../src/avatar-render.js';

const near = (a, b, message, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${message}: ${a} ≈ ${b}`);
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = p => p.map(v => Math.round(v * 1e8)).join(',');
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const difference = (a, b) => a.map((v, i) => v - b[i]);
let checks = 0;

function inspectMesh(mesh, label, { closed = true, connected = true, allowEmpty = false } = {}) {
  assert.equal(mesh.kind, 'mesh', label + ': mesh contract');
  assert.equal(mesh.v.length, mesh.tri * 9, label + ': triangle count');
  assert.ok(Number.isInteger(mesh.tri) && mesh.tri >= 0 && mesh.tri <= 120000, label + ': triangle budget');
  if (allowEmpty && !mesh.tri) { checks++; return { triangles: 0, volume: 0, components: 0, boundaryEdges: 0 }; }
  assert.ok(mesh.tri > 0, label + ': nonempty');
  const vertices = new Map(), parents = [], edges = new Map();
  let volume = 0, minimumArea = Infinity;
  const root = id => { while (parents[id] !== id) { parents[id] = parents[parents[id]]; id = parents[id]; } return id; };
  const vertex = p => {
    const k = key(p);
    if (!vertices.has(k)) { const id = parents.length; vertices.set(k, id); parents.push(id); }
    return vertices.get(k);
  };
  const join = (a, b) => { a = root(a); b = root(b); if (a !== b) parents[b] = a; };
  for (let i = 0; i < mesh.v.length; i += 9) {
    const [a, b, c] = [0, 3, 6].map(offset => mesh.v.slice(i + offset, i + offset + 3));
    assert.ok([...a, ...b, ...c].every(Number.isFinite), label + ': finite positions');
    const normal = cross(difference(b, a), difference(c, a)), area = Math.hypot(...normal);
    assert.ok(area > 1e-15, label + ': nondegenerate triangle ' + i / 9);
    minimumArea = Math.min(minimumArea, area / 2);
    const ids = [a, b, c].map(vertex);
    join(ids[0], ids[1]); join(ids[1], ids[2]);
    const bc = cross(b, c); volume += a[0] * bc[0] + a[1] * bc[1] + a[2] * bc[2];
    for (let j = 0; j < 3; j++) {
      const A = ids[j], B = ids[(j + 1) % 3], k = A < B ? A + ':' + B : B + ':' + A;
      const edge = edges.get(k) || { count: 0, winding: 0 };
      edge.count++; edge.winding += A < B ? 1 : -1; edges.set(k, edge);
    }
  }
  volume /= 6;
  const bad = [...edges.values()].filter(e => e.count !== 2 || e.winding !== 0);
  const boundaryEdges = [...edges.values()].filter(e => e.count === 1).length;
  if (closed) {
    assert.equal(bad.length, 0, `${label}: closed oppositely wound topology (${boundaryEdges} boundary edges)`);
    assert.ok(volume > 1e-10, label + ': outward positive volume');
  } else assert.ok(boundaryEdges > 0, label + ': intentional open cut boundary');
  const components = new Set(parents.map((_, i) => root(i))).size;
  if (connected) assert.equal(components, 1, label + ': connected skin');
  checks++;
  return { triangles: mesh.tri, vertices: vertices.size, volume, components, boundaryEdges, minimumArea };
}

function boxMesh() {
  const points = [[-.15, -.1, -.5], [.15, -.1, -.5], [.15, .1, -.5], [-.15, .1, -.5],
    [-.15, -.1, .5], [.15, -.1, .5], [.15, .1, .5], [-.15, .1, .5]];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
    [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  return { kind: 'mesh', tri: faces.length, v: faces.flatMap(face => face.flatMap(i => points[i])), dims: [.3, .2, 1], landmarks: { bustCut: .2, feetCut: -.41 } };
}

function checkClip(source, options, label, connected = true) {
  const hash = fingerprint(source.v), out = clipAvatarMesh(source, options);
  assert.equal(fingerprint(source.v), hash, label + ': source unchanged');
  const [lo, hi] = out.cutRange;
  assert.ok(out.v.every((z, i) => i % 3 !== 2 || z >= lo - 1e-8 && z <= hi + 1e-8), label + ': retained vertices respect original cut coordinates');
  for (const section of out.sectionPaths) {
    assert.ok(section.closed, label + ': section outline is closed');
    assert.ok(section.pts.length >= 3, label + ': nonempty section loop');
    for (const p of section.pts) near(p[2], section.plane, label + ': section lies on cut plane');
  }
  const stats = inspectMesh(out, label, { closed: options.cap !== false, connected, allowEmpty: true });
  checks++;
  return { out, stats };
}

const box = boxMesh();
near(inspectMesh(box, 'analytic box').volume, .06, 'analytic box volume');
for (const options of [{ mode: 'Feet' }, { mode: 'Bust' }, { mode: 'Band', cut: .5, band: .2 }, { mode: 'Band', cut: .1, band: .4 }]) {
  const { out, stats } = checkClip(box, options, 'analytic ' + options.mode);
  near(stats.volume, .06 * (out.cutRange[1] - out.cutRange[0]), 'exact clipped box volume');
  near(out.sourceBounds.min[2], -.5, 'source ground preserved');
  near(out.sourceBounds.max[2], .5, 'source crown preserved');
}
checkClip(box, { mode: 'Feet', cap: false }, 'uncapped analytic feet');
for (const options of [{ mode: 'Bust', cut: 1 }, { mode: 'Feet', cut: 0 }, { mode: 'Band', band: 0 }]) {
  const { out } = checkClip(box, options, 'empty cut ' + JSON.stringify(options)); assert.equal(out.tri, 0);
}
const feetBox = clipAvatarMesh(box, { mode: 'Feet' });
near(avatarBounds(feetBox).min[2], -.5, 'feet do not recenter');
near(avatarBounds(feetBox).max[2], -.41, 'feet do not renormalize');
for (const yaw of [0, 90, 180, 270]) {
  const full = buildAvatarView(box, { yaw }), bust = buildAvatarView(box, { yaw, mode: 'Bust' }), feet = buildAvatarView(box, { yaw, mode: 'Feet' });
  assert.deepEqual(full.referenceBounds, bust.referenceBounds, 'bust preserves whole-body framing');
  assert.deepEqual(full.referenceBounds, feet.referenceBounds, 'feet preserve whole-body framing');
  near(full.referenceBounds.max[0] - full.referenceBounds.min[0], Math.hypot(.3, .2), 'yaw does not change framing width');
  for (const view of [full, bust, feet]) {
    assert.ok(view.triangles.length && view.triangles.every(t => t.pts.flat().every(Number.isFinite) && Number.isFinite(t.shade)), 'finite projected triangles');
    assert.deepEqual(view.frameBox, view.referenceBounds);
  }
  checks++;
}
const frontBox = buildAvatarView(box), sideBox = buildAvatarView(box, { yaw: 90 });
near(frontBox.bounds.max[0] - frontBox.bounds.min[0], .3, 'front x dimension');
near(sideBox.bounds.max[0] - sideBox.bounds.min[0], .2, 'side x dimension');
const selectedFeet = buildAvatarView(box, { mode: 'Feet', frame: 'selection' });
assert.ok(selectedFeet.referenceBounds.max[1] - selectedFeet.referenceBounds.min[1] < 1, 'selection framing explicitly zooms');
assert.equal(clipAvatarMesh(null).tri, 0, 'invalid source safely empty');

function renderPixels(mesh, options) {
  let result;
  const context = {
    canvas: { width: 120, height: 180 },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    clearRect() {}, putImageData(data) { result = data.data; },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  };
  const view = drawAvatarCanvas(context, mesh, { width: 120, height: 180, foreground: '#181818', background: '#ffffff', ...options });
  assert.ok(view && result, 'shaded software rendering runs without browser');
  let ink = 0; for (let i = 3; i < result.length; i += 4) if (result[i]) ink++;
  assert.ok(ink > 15, 'visible rendered mesh');
  checks++;
  const shades=new Set();for(let i=0;i<result.length;i+=4)if(result[i+3])shades.add(result[i]+','+result[i+1]+','+result[i+2]);
  return { ink, hash: fingerprint(result), shades:shades.size };
}
renderPixels(box, {});
for(const theme of [{foreground:'#ffffff',background:'#181818'},{foreground:'#181818',background:'#ffffff'}])assert.ok(renderPixels(box,{yaw:28,pitch:16,...theme}).shades>1,'light and dark previews preserve visible surface shading');

const summaries = [];
if (!process.argv.includes('--renderer-only')) {
  const { AVATAR_DEFAULTS, AVATAR_CONTROLS, normalizeAvatarParameters, buildAvatarMesh } = await import('../src/avatar-geometry.js');
  const meshes = {};
  for (const preset of ['Male', 'Female']) {
    const parameters = { ...AVATAR_DEFAULTS, preset }, hash = fingerprint(parameters);
    const mesh = buildAvatarMesh(parameters, { quality: 'review' });
    assert.equal(fingerprint(parameters), hash, 'body generation keeps input parameters unchanged');
    assert.equal(mesh.metadata?.source,'MakeHuman hm08',preset+': authored human source');
    assert.equal(mesh.metadata?.license,'CC0-1.0',preset+': reusable asset licence');
    const stats = inspectMesh(mesh, preset + ' review');
    summaries.push({ preset, ...stats }); meshes[preset] = mesh;
    mesh.dims.forEach((value, axis) => near(value, avatarBounds(mesh).dims[axis], preset + ': truthful source dimensions'));
    near(avatarBounds(mesh).min[2], -.5, preset + ': fixed ground');
    near(avatarBounds(mesh).max[2], .5, preset + ': fixed crown');
    assert.ok(mesh.landmarks.feetCut > -.5 && mesh.landmarks.feetCut < mesh.landmarks.knee, preset + ': feet landmark');
    assert.ok(mesh.landmarks.bustCut > mesh.landmarks.waist && mesh.landmarks.bustCut < mesh.landmarks.chin, preset + ': bust landmark');
    const again = buildAvatarMesh({ ...parameters }, { quality: 'review' });
    assert.equal(fingerprint(mesh.v), fingerprint(again.v), preset + ': deterministic anatomy');
    const bust = checkClip(mesh, { mode: 'Bust' }, preset + ' bust');
    const feet = checkClip(mesh, { mode: 'Feet' }, preset + ' feet', false);
    near(bust.out.cutRange[0], mesh.landmarks.bustCut, preset + ': bust preset follows anatomy');
    near(feet.out.cutRange[1], mesh.landmarks.feetCut, preset + ': feet preset follows anatomy');
    assert.equal(feet.stats.components, 2, preset + ': feet stay separate');
    for (const yaw of [0, 90, 180]) {
      const image = renderPixels(mesh, { yaw });
      assert.ok(image.ink > 500, preset + ': whole-body view visible');
    }
    const front = renderPixels(mesh, { yaw: 0 }), side = renderPixels(mesh, { yaw: 90 }), back = renderPixels(mesh, { yaw: 180 });
    assert.notEqual(front.hash, side.hash, preset + ': real side projection');
    assert.notEqual(front.hash, back.hash, preset + ': front/back anatomy and lighting differ');
    renderPixels(mesh, { mode: 'Bust', yaw: 30, frame: 'selection' });
    renderPixels(mesh, { mode: 'Feet', yaw: 30, frame: 'selection' });
    for (const mode of ['Full body', 'Bust', 'Feet']) {
      const drawing = avatarLineDrawing(mesh, { mode, yaw: 25 }, { W: 210, H: 297, size: 260, margin: 12, pen: 4 });
      assert.ok(drawing.paths.length, preset + ': ' + mode + ' inspection paths');
      assert.ok(drawing.paths.reduce((n, p) => n + p.pts.length, 0) <= 110000, 'inspection point budget');
      for (const path of drawing.paths) {
        assert.equal(path.layer, 4, 'requested inspection pen');
        assert.ok(path.pts.length >= 2 && path.pts.every(p => p.length === 2 && p.every(Number.isFinite)), 'finite 2D inspection points');
        for (const [x, y] of path.pts) assert.ok(x >= 12 - 1e-7 && x <= 198 + 1e-7 && y >= 12 - 1e-7 && y <= 285 + 1e-7, 'inspection stays within margins');
      }
      checks++;
    }
  }
  assert.notEqual(fingerprint(meshes.Male.v), fingerprint(meshes.Female.v), 'male/female presets have different anatomy');
  const base = { ...AVATAR_DEFAULTS, preset: 'Female', variation: 0 }, original = buildAvatarMesh(base, { quality: 'draft' }), baseHash = fingerprint(original.v);
  assert.equal(baseHash, fingerprint(buildAvatarMesh({ ...base, seed: 999 }, { quality: 'draft' }).v), 'zero variation makes seed irrelevant to anatomy');
  assert.notEqual(baseHash, fingerprint(buildAvatarMesh({ ...base, variation: 70, seed: 999 }, { quality: 'draft' }).v), 'seeded variation changes anatomy');
  assert.equal(baseHash, fingerprint(buildAvatarMesh({ ...base, yaw: 90, mode: 'Feet', spacing: .7 }, { quality: 'draft' }).v), 'view and drawing settings never deform body');
  for (const [control, value] of [['headSize', 125], ['breastSize', 90], ['armLength', 120], ['legLength', 125], ['footLength', 140], ['belly', 85]]) {
    const changed = buildAvatarMesh({ ...base, [control]: value }, { quality: 'draft' });
    assert.notEqual(fingerprint(changed.v), baseHash, control + ': geometry changes');
    inspectMesh(changed, control + ' adjustment');
  }
  const footBounds = mesh => {
    const values = [];
    for (let i = 0; i < mesh.v.length; i += 3) if (mesh.v[i + 2] < mesh.landmarks.feetCut) values.push(mesh.v[i + 1]);
    return Math.max(...values) - Math.min(...values);
  };
  assert.ok(footBounds(buildAvatarMesh({ ...base, footLength: 140 }, { quality: 'draft' })) > footBounds(original) * 1.1, 'foot length changes the feet specifically');
  const invalid = normalizeAvatarParameters({ headSize: NaN, footLength: Infinity, chestDepth: -1e6, preset: 'unknown' });
  assert.equal(invalid.preset, 'Male');
  for (const c of AVATAR_CONTROLS) assert.ok(Number.isFinite(invalid[c.key]) && invalid[c.key] >= c.min && invalid[c.key] <= c.max, c.key + ': safe control range');
  const extremes = buildAvatarMesh({ ...base, headSize: 130, shoulderWidth: 75, chestDepth: 145, hips: 145, armThickness: 145, footLength: 145, asymmetry: 75 }, { quality: 'draft' });
  inspectMesh(extremes, 'combined control limits');
  assert.equal(fingerprint(original.v), baseHash, 'later builds never mutate an earlier mesh');
  // The actual Muusia node must keep its full mesh independent of drawing state.
  const { default: avatar } = await import('../src/defs/nodes/avatar3d.js');
  const defaults = Object.fromEntries(avatar.params.map(p => [p.key, p.def]));
  const context = { W: 210, H: 297, frameCount: 48, frameIdx: 0 };
  const run = (patch = {}, clock = {}, style) => {
    const parameters = { ...defaults, ...patch }, before = fingerprint(parameters);
    const result = avatar.compute([style], parameters, { ...context, ...clock });
    assert.equal(fingerprint(parameters), before, 'actual node keeps input parameters unchanged');
    assert.equal(result.length, 3, 'drawing/silhouette/full mesh ports');
    assert.ok(result[0].paths.length && result[1].paths.length, 'actual node inspection preview');
    assert.equal(result[2].kind, 'mesh');
    for (const drawing of result.slice(0, 2)) {
      assert.ok(drawing.paths.reduce((n, p) => n + p.pts.length, 0) <= 110000, 'actual node inspection budget');
      assert.ok(drawing.paths.every(p => p.pts.length >= 2 && p.pts.every(point => point.every(Number.isFinite))), 'actual node finite inspection geometry');
    }
    checks++; return result;
  };
  assert.deepEqual(avatar.outs.map(p => p.type), ['paths', 'paths', 'mesh'], 'actual port compatibility');
  assert.equal(new Set(avatar.params.map(p => p.key)).size, avatar.params.length, 'unique adjustable control keys');
  const originalNode = run(), meshHash = fingerprint(originalNode[2].v);
  for (const patch of [{ view: 'Front' }, { view: 'Side' }, { view: 'Back' }, { view: 'Manual', yaw: 117, pitch: -20, roll: 10 },
    { cutMode: 'Bust' }, { cutMode: 'Feet' }, { cutMode: 'Band', cutHeight: 44, cutPosition: 'Manual' },
    { cutMode: 'Feet', framing: 'Selected region' }, { inspection: 'Mesh edges' }, { area: 'Torso' },
    { motion: 'Manual', animation: 'Rotating bust', phase: .35 }, { motion: 'Timeline', animation: 'Feet slice' }]) {
    assert.equal(fingerprint(run(patch, { frameIdx: 12 })[2].v), meshHash, 'full body mesh unchanged by camera/cut/animation ' + JSON.stringify(patch));
  }
  assert.notEqual(fingerprint(run({ view: 'Front' })[0]), fingerprint(run({ view: 'Side' })[0]), 'node front and side are distinct real views');
  assert.notEqual(fingerprint(run({ cutMode: 'Bust' })[0]), fingerprint(run({ cutMode: 'Feet' })[0]), 'node visible region changes');
  for (const animation of ['Turntable', 'Rotating bust', 'Feet slice']) {
    const a = run({ motion: 'Timeline', animation }, { frameIdx: 12 });
    const b = run({ motion: 'Manual', animation, phase: .25 });
    assert.equal(fingerprint(a), fingerprint(b), 'timeline scrubbing reproduces manual phase ' + animation);
    assert.notEqual(fingerprint(a[0]), fingerprint(run({ motion: 'Timeline', animation }, { frameIdx: 0 })[0]), animation + ': animation moves drawing');
  }
  const off = run({ motion: 'Off' });
  assert.equal(fingerprint(off), fingerprint(run({ motion: 'Off', phase: .8, animation: 'Feet slice' }, { frameIdx: 37 })), 'motion Off ignores timeline and saved animation controls');
  assert.equal(fingerprint(run({ preset: 'Female' })[2].v), fingerprint(buildAvatarMesh({ ...AVATAR_DEFAULTS, preset: 'Female' }, { quality: 'draft' }).v), 'node uses the shared female anatomy');
  assert.equal(fingerprint(run({}, {}, { kind: 'style', mode: 'Dashed', dash: 2, gap: 1, vary: 0, phase: 0, seed: 7 })[2].v), meshHash, 'Style never changes full mesh');
  for (const control of AVATAR_CONTROLS) {
    const descriptor = avatar.params.find(p => p.key === control.key);
    assert.ok(descriptor, 'body control exposed: ' + control.key);
    assert.equal(descriptor.showIf({ ...defaults, area: control.group }), true, control.key + ': visible in matching body area');
  }
  const { default: meshSlice } = await import('../src/defs/nodes/meshslice.js');
  const sliceParameters = Object.fromEntries(meshSlice.params.map(p => [p.key, p.def]));
  const sections = meshSlice.compute([undefined, originalNode[2]], { ...sliceParameters, slices: 5, step: 2 }, context, {});
  assert.ok(sections.paths.length, 'existing Mesh Slice consumes actual avatar mesh');
  assert.ok(sections.paths.every(p => p.pts.every(point => point.every(Number.isFinite))), 'existing Mesh Slice produces finite sections');
  checks++;
}
console.log(JSON.stringify({ checks, meshes: summaries }, null, 2));
console.log(`PASS: ${checks} Avatar cases: connected outward body meshes, deterministic controls, analytic capped cuts, unchanged source scale, stable framing, real projections and finite inspection paths.`);
