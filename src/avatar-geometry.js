/* Avatar 3D uses the MakeHuman hm08 human basemesh and authored shape targets.
 * The bundled graphical assets are CC0; no MakeHuman application code is used.
 * Source coordinates: X across, Y up, Z front. Output: X across, negative Y front,
 * Z up, full body normalized to one unit. See assets/avatar-makehuman.LICENSE.txt.
 */
import HUMAN from './assets/avatar-makehuman-data.js';

export const AVATAR_DEFAULTS = Object.freeze({
  preset: "Male", seed: 17, variation: 20, height: 100, muscle: 40, softness: 35,
  headSize: 100, neckLength: 100, shoulderWidth: 100, torsoLength: 100,
  chestWidth: 100, chestDepth: 100, breastSize: 45, breastDrop: 35,
  waist: 100, belly: 20, hips: 100, buttocks: 100,
  armLength: 100, armThickness: 100, handSize: 100,
  legLength: 100, thigh: 100, calf: 100, footLength: 100, footWidth: 100,
  asymmetry: 0,
});

const control = (key, label, group, min, max, def, step = 1) => ({ key, label, group, min, max, step, def });
export const AVATAR_CONTROLS = Object.freeze([
  control("variation", "Seed variation %", "Body", 0, 100, 20),
  control("height", "Stature %", "Body", 80, 125, 100),
  control("muscle", "Muscle %", "Body", 0, 100, 40),
  control("softness", "Softness %", "Body", 0, 100, 35),
  control("asymmetry", "Asymmetry %", "Body", 0, 100, 0),
  control("headSize", "Head size %", "Head & neck", 75, 130, 100),
  control("neckLength", "Neck length %", "Head & neck", 60, 150, 100),
  control("shoulderWidth", "Shoulder width %", "Torso", 75, 135, 100),
  control("torsoLength", "Torso length %", "Torso", 75, 130, 100),
  control("chestWidth", "Ribcage width %", "Torso", 75, 140, 100),
  control("chestDepth", "Ribcage depth %", "Torso", 75, 145, 100),
  control("waist", "Waist width %", "Torso", 70, 150, 100),
  control("belly", "Belly fullness %", "Torso", 0, 100, 20),
  control("hips", "Hip width %", "Torso", 75, 145, 100),
  control("buttocks", "Buttock fullness %", "Torso", 65, 155, 100),
  control("breastSize", "Chest / breast fullness %", "Chest", 0, 100, 45),
  control("breastDrop", "Chest / breast drop %", "Chest", 0, 100, 35),
  control("armLength", "Arm length %", "Arms & hands", 75, 125, 100),
  control("armThickness", "Arm thickness %", "Arms & hands", 65, 145, 100),
  control("handSize", "Hand size %", "Arms & hands", 70, 145, 100),
  control("legLength", "Leg length %", "Legs & feet", 80, 130, 100),
  control("thigh", "Thigh fullness %", "Legs & feet", 70, 145, 100),
  control("calf", "Calf fullness %", "Legs & feet", 65, 150, 100),
  control("footLength", "Foot length %", "Legs & feet", 70, 145, 100),
  control("footWidth", "Foot width %", "Legs & feet", 70, 145, 100),
]);

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const cache = new Map();
const BIND_SOURCES = new WeakMap();
const BIND_DATA = new WeakMap();
function random(seed) {
  let a = seed | 0;
  return () => {
    a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function normalizeAvatarParameters(parameters = {}) {
  const p = { ...AVATAR_DEFAULTS, ...parameters };
  p.preset = p.preset === "Female" ? "Female" : "Male";
  p.seed = clamp(Math.round(Number.isFinite(+p.seed) ? +p.seed : 17), -1e9, 1e9);
  for (const c of AVATAR_CONTROLS) p[c.key] = clamp(Number.isFinite(+p[c.key]) ? +p[c.key] : c.def, c.min, c.max);
  return p;
}

// A control changes authored morph weights, never the triangulation or the seed
// stream. Keeping all random variation in parameter space preserves the face,
// fingers and toes of the source model instead of roughening their vertices.
function variedParameters(p) {
  const rng = random(p.seed * 7919 + 733), v = p.variation / 100;
  const q = { ...p };
  for (const c of AVATAR_CONTROLS) {
    if (['variation', 'asymmetry'].includes(c.key)) continue;
    const extent = c.max - c.min;
    const amount = (rng() - .5) * extent * .10 * v;
    q[c.key] = clamp(p[c.key] + amount, c.min, c.max);
  }
  return q;
}
function applyTarget(positions, key, weight) {
  if (Math.abs(weight) < 1e-12) return;
  const target = HUMAN.morphs[key];
  if (!target) return;
  for (let i = 0; i < target.length; i += 4) {
    const offset = target[i] * 3;
    positions[offset] += target[i + 1] * weight;
    positions[offset + 1] += target[i + 2] * weight;
    positions[offset + 2] += target[i + 3] * weight;
  }
}
function signedWeight(value, center, min, max) {
  return value >= center ? (value - center) / (max - center || 1) : (value - center) / (center - min || 1);
}
function applyPair(positions, stem, value, center = 100, min = 70, max = 140, strength = 1) {
  const amount = signedWeight(value, center, min, max) * strength;
  applyTarget(positions, stem + (amount < 0 ? '-decr' : '-incr'), Math.abs(amount));
}
function applyPhysique(positions, sex, property, value, center) {
  const stem = `macrodetails/universal-${sex}-young-`;
  const baseline = stem + 'averagemuscle-averageweight';
  const amount = signedWeight(value, center, 0, 100);
  const edge = property === 'muscle'
    ? (amount < 0 ? 'minmuscle-averageweight' : 'maxmuscle-averageweight')
    : (amount < 0 ? 'averagemuscle-minweight' : 'averagemuscle-maxweight');
  // Extrema are offsets from the same neutral body as the average target.
  applyTarget(positions, baseline, -Math.abs(amount));
  applyTarget(positions, stem + edge, Math.abs(amount));
}
function jointPoint(positions, name, fallback) {
  const group = HUMAN.joints?.['joint-' + name] || HUMAN.joints?.[name];
  const ids = group?.ids;
  if (!ids?.length) return [...fallback];
  const result = [0, 0, 0];
  for (const id of ids) for (let k = 0; k < 3; k++) result[k] += positions[id * 3 + k] / ids.length;
  return result;
}
function meanJoint(positions, name, fallback) {
  const a = jointPoint(positions, 'l-' + name, fallback), b = jointPoint(positions, 'r-' + name, [-fallback[0], fallback[1], fallback[2]]);
  return a.map((v, k) => (v + b[k]) / 2);
}
const BASE_VERTEX_COUNT = HUMAN.vertices.length / 3;
const BASE_INDICES = HUMAN.triangles;
const SKIN_IDS = [...new Set(BASE_INDICES)].sort((a, b) => a - b);
const SKIN_REMAP = new Int32Array(BASE_VERTEX_COUNT); SKIN_REMAP.fill(-1);
SKIN_IDS.forEach((id, i) => { SKIN_REMAP[id] = i; });
const SKIN_INDICES = BASE_INDICES.map(id => SKIN_REMAP[id]);

function deformBody(parameters) {
  const p = variedParameters(parameters), positions = Float64Array.from(HUMAN.vertices);
  const sex = p.preset === 'Female' ? 'female' : 'male';
  const adult = `macrodetails/adult-${sex}`;
  if (!HUMAN.morphs[adult]) throw new Error('Missing bundled MakeHuman adult body target');
  applyTarget(positions, adult, 1);
  applyTarget(positions, `macrodetails/universal-${sex}-young-averagemuscle-averageweight`, 1);
  applyPhysique(positions, sex, 'muscle', p.muscle, 40);
  applyPhysique(positions, sex, 'weight', p.softness, 35);

  for (const [stem, key, min, max, strength = 1] of [
    ['torso/measure-shoulder-dist', 'shoulderWidth', 75, 135],
    ['torso/torso-scale-vert', 'torsoLength', 75, 130],
    ['torso/torso-scale-horiz', 'chestWidth', 75, 140, .72],
    ['torso/torso-scale-depth', 'chestDepth', 75, 145, .85],
    ['torso/measure-waist-circ', 'waist', 70, 150],
    ['hip/hip-scale-horiz', 'hips', 75, 145],
    ['buttocks/buttocks-volume', 'buttocks', 65, 155],
    ['head/head-scale-horiz', 'headSize', 75, 130],
    ['head/head-scale-depth', 'headSize', 75, 130],
    ['head/head-scale-vert', 'headSize', 75, 130],
    ['neck/measure-neck-height', 'neckLength', 60, 150],
    ['arms/measure-upperarm-length', 'armLength', 75, 125],
    ['arms/measure-lowerarm-length', 'armLength', 75, 125],
    ['arms/measure-upperarm-circ', 'armThickness', 65, 145],
    ['legs/measure-upperleg-height', 'legLength', 80, 130],
    ['legs/measure-lowerleg-height', 'legLength', 80, 130],
    ['legs/measure-thigh-circ', 'thigh', 70, 145],
    ['legs/measure-calf-circ', 'calf', 65, 150],
    ['hands/l-hand-scale', 'handSize', 70, 145],
    ['hands/r-hand-scale', 'handSize', 70, 145],
    ['feet/l-foot-scale-depth', 'footLength', 70, 145],
    ['feet/r-foot-scale-depth', 'footLength', 70, 145],
    ['feet/l-foot-scale-horiz', 'footWidth', 70, 145],
    ['feet/r-foot-scale-horiz', 'footWidth', 70, 145],
  ]) applyPair(positions, stem, p[key], 100, min, max, strength);

  const belly = signedWeight(p.belly, 20, 0, 100);
  applyTarget(positions, 'stomach/stomach-tone-' + (belly < 0 ? 'incr' : 'decr'), Math.abs(belly));
  if (sex === 'female') {
    const fullness = signedWeight(p.breastSize, 45, 0, 100);
    applyTarget(positions, 'breast/female-young-averagemuscle-averageweight-' + (fullness < 0 ? 'mincup' : 'maxcup') + '-averagefirmness', Math.abs(fullness));
  } else applyPair(positions, 'torso/torso-muscle-pectoral', p.breastSize, 45, 0, 100, .75);
  const drop = signedWeight(p.breastDrop, 35, 0, 100);
  applyTarget(positions, 'breast/breast-trans-' + (drop < 0 ? 'up' : 'down'), Math.abs(drop) * (sex === 'female' ? .8 : .35));

  // Mild continuous asymmetry is independent of tessellation. The source's
  // detailed face and extremities are retained; no random point displacement.
  let ground = Infinity, crown = -Infinity;
  for (const id of SKIN_IDS) { ground = Math.min(ground, positions[id * 3 + 1]); crown = Math.max(crown, positions[id * 3 + 1]); }
  const height = crown - ground, asym = p.asymmetry / 100;
  for (let i = 0; i < positions.length; i += 3) {
    const fraction = (positions[i + 1] - ground) / height;
    const side = Math.tanh(positions[i] / (height * .035));
    const body = Math.sin(clamp(fraction, 0, 1) * Math.PI);
    positions[i] *= 1 + asym * .045 * side * body;
    positions[i + 2] *= 1 + asym * .025 * side * body;
    positions[i + 1] = ground + (positions[i + 1] - ground) * (p.height / 100);
  }
  return positions;
}

// One Loop subdivision step uses only the asset's closed skin connectivity.
// The edge/vertex stencils are reusable across every body morph and seed.
let LOOP_STENCILS;
function loopStencils() {
  if (LOOP_STENCILS) return LOOP_STENCILS;
  const neighbors = Array.from({ length: SKIN_IDS.length }, () => new Set()), edges = new Map();
  for (let i = 0; i < SKIN_INDICES.length; i += 3) {
    const ids = SKIN_INDICES.slice(i, i + 3);
    for (let k = 0; k < 3; k++) {
      const a = ids[k], b = ids[(k + 1) % 3], opposite = ids[(k + 2) % 3];
      neighbors[a].add(b); neighbors[b].add(a);
      const key = a < b ? a + ':' + b : b + ':' + a;
      if (!edges.has(key)) edges.set(key, { a, b, opposite: [], id: SKIN_IDS.length + edges.size });
      edges.get(key).opposite.push(opposite);
    }
  }
  const indices = [];
  const edgeId = (a, b) => edges.get(a < b ? a + ':' + b : b + ':' + a).id;
  for (let i = 0; i < SKIN_INDICES.length; i += 3) {
    const [a, b, c] = SKIN_INDICES.slice(i, i + 3), ab = edgeId(a, b), bc = edgeId(b, c), ca = edgeId(c, a);
    indices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  LOOP_STENCILS = { neighbors: neighbors.map(set => [...set]), edges: [...edges.values()], indices };
  return LOOP_STENCILS;
}
function subdivide(positions) {
  const { neighbors, edges, indices } = loopStencils(), next = new Array((positions.length / 3 + edges.length) * 3);
  neighbors.forEach((adjacent, id) => {
    const count = adjacent.length, beta = count === 3 ? 3 / 16 : 3 / (8 * count);
    for (let k = 0; k < 3; k++) {
      let sum = 0; for (const n of adjacent) sum += positions[n * 3 + k];
      next[id * 3 + k] = positions[id * 3 + k] * (1 - count * beta) + sum * beta;
    }
  });
  for (const edge of edges) for (let k = 0; k < 3; k++) {
    next[edge.id * 3 + k] = (positions[edge.a * 3 + k] + positions[edge.b * 3 + k]) * 3 / 8
      + (positions[edge.opposite[0] * 3 + k] + positions[edge.opposite[1] * 3 + k]) / 8;
  }
  return { positions: next, indices };
}
function canonicalMesh(source, quality) {
  let positions = SKIN_IDS.flatMap(id => [source[id * 3], -source[id * 3 + 2], source[id * 3 + 1]]), indices = SKIN_INDICES;
  if (quality === 'review') ({ positions, indices } = subdivide(positions));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]); }
  const height = max[2] - min[2], center = min.map((v, k) => (v + max[k]) / 2);
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) positions[i + k] = (positions[i + k] - center[k]) / height;
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    volume += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  if (volume < 0) { indices = [...indices]; for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]; }
  return { positions, indices, height, center, min, max };
}
export function buildAvatarMesh(parameters = {}, options = {}) {
  const p = normalizeAvatarParameters(parameters), quality = options.quality === 'draft' ? 'draft' : 'review';
  const key = JSON.stringify([quality, p]);
  if (cache.has(key)) return cache.get(key);
  const source = deformBody(p), result = canonicalMesh(source, quality), { positions, indices, height, center } = result;
  const toZ = value => (value - center[2]) / height;
  const crown = center[2] + height / 2;
  const skinGround = center[2] - height / 2;
  const knee = meanJoint(source, 'knee', [1.58, -3.69, .32])[1];
  const ankle = meanJoint(source, 'ankle', [2.19, -7.44, -.01])[1];
  const hip = jointPoint(source, 'pelvis', [0, .73, .14])[1];
  const waist = jointPoint(source, 'spine-3', [0, 1.87, .15])[1];
  const chest = jointPoint(source, 'spine-1', [0, 4.33, -.07])[1];
  const shoulder = meanJoint(source, 'shoulder', [1.68, 5.25, .15])[1];
  const chin = jointPoint(source, 'head', [0, 6.97, .16])[1] - height * .035;
  const landmarks = { ground: -.5, crown: .5, ankle: toZ(ankle), knee: toZ(knee), hip: toZ(hip), waist: toZ(waist), chest: toZ(chest), shoulder: toZ(shoulder), chin: toZ(chin),
    bustCut: toZ(mix(waist, chest, .64)), feetCut: toZ(clamp(ankle + height * .024, skinGround + height * .045, crown)) };
  landmarks.bust = landmarks.bustCut + .5; landmarks.feet = landmarks.feetCut + .5;
  const v = new Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const sourceIndex = indices[i] * 3, offset = i * 3;
    v[offset] = positions[sourceIndex]; v[offset + 1] = positions[sourceIndex + 1]; v[offset + 2] = positions[sourceIndex + 2];
  }
  const dims = [(result.max[0] - result.min[0]) / height, (result.max[1] - result.min[1]) / height, 1];
  const mesh = { kind: 'mesh', tri: indices.length / 3, v, dims, vertices: positions, indices, landmarks,
    bounds: { min: [-dims[0] / 2, -dims[1] / 2, -.5], max: [dims[0] / 2, dims[1] / 2, .5] }, parameters: p, quality,
    metadata: { generator: 'avatar3d', version: 2, source: 'MakeHuman hm08', license: 'CC0-1.0', connectedSurface: true, canonicalHeight: 1,
      faceDetail: 'authored', handDetail: 'authored-fingers', sourceMesh: HUMAN.source, subdivision: quality === 'review' ? 'Loop 1' : 'Original skin mesh' } };
  BIND_SOURCES.set(mesh, {source,height,center});
  cache.set(key, mesh); while (cache.size > 4) cache.delete(cache.keys().next().value);
  return mesh;
}

/** Morphed bind data lives outside the public serializable triangle payload. */
export function getAvatarBindData(mesh) {
  if(BIND_DATA.has(mesh))return BIND_DATA.get(mesh);
  const state=BIND_SOURCES.get(mesh);
  if(!state)throw new Error('Avatar posing needs an anatomy mesh from buildAvatarMesh.');
  const {source,height,center}=state;
  const sourceToCanonical=p=>[(p[0]-center[0])/height,(-p[2]-center[1])/height,(p[1]-center[2])/height];
  const sourcePositions=new Float64Array(source.length);
  for(let id=0;id<source.length/3;id++)sourcePositions.set(sourceToCanonical(source.subarray(id*3,id*3+3)),id*3);
  const positions=SKIN_IDS.flatMap(id=>[sourcePositions[id*3],sourcePositions[id*3+1],sourcePositions[id*3+2]]);
  const joints={};
  for(const [name,group]of Object.entries(HUMAN.joints||{})){
    const point=[0,0,0];for(const id of group.ids)for(let k=0;k<3;k++)point[k]+=sourcePositions[id*3+k]/group.ids.length;
    joints[name]=point;
  }
  const result={positions,sourcePositions,sourceVertexIds:SKIN_IDS,indices:SKIN_INDICES,joints,sourceToCanonical};
  BIND_DATA.set(mesh,result);return result;
}

/** Refine the already posed coarse surface in the unchanged bind coordinates. */
export function refineAvatarPoseSurface(mesh,coarsePositions){
  if(coarsePositions.length!==SKIN_IDS.length*3)throw new Error('Unexpected avatar bind vertex count.');
  return mesh.quality==='review'?subdivide(coarsePositions).positions:Array.from(coarsePositions);
}
