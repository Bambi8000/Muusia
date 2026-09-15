import { validateSettings } from './layout.ts';
import type { CaptureMode, SheetSettings } from './layout';
import { validateAdjustments } from './adjustments.ts';
import type { Adjustments } from './adjustments';
import type { SequenceSettings } from './sequence';
import type { ExportOptions } from './export-plan';
import type { MarkerPoints, Photo } from './photos';

export const PROJECT_VERSION = 2;
export const MAX_PROJECT_BYTES = 256 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
// Originals are now decoded one at a time. This includes 24–32 typical 12 MP close-ups.
export const MAX_PROJECT_PIXELS = 400_000_000;
export const MAX_PROJECT_PHOTOS = 64;
export type ProjectState = { name: string; settings: SheetSettings; adjustments: Adjustments; sequence: SequenceSettings; exportOptions: ExportOptions; resolution: number; stabilize: boolean };
export type ProjectPhoto = { id: string; name: string; path: string; type: string; size: number; lastModified: number; width: number; height: number; points: MarkerPoints; registrationMode: CaptureMode; settingsKey: string; sha256: string };
export type ProjectDocument = ProjectState & { format: 'liike-project'; version: 2; photos: ProjectPhoto[] };
const fail = (message: string): never => { throw new Error(message); };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('Invalid project structure.');
const string = (value: unknown, name: string, max = 200): string => typeof value === 'string' && value.length <= max ? value : fail(`Invalid ${name} in project.`);
const number = (value: unknown, name: string, min: number, max: number, integer = false): number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)) ? value : fail(`Invalid ${name} in project.`);
const boolean = (value: unknown, name: string): boolean => typeof value === 'boolean' ? value : fail(`Invalid ${name} in project.`);
function choice<T extends string>(value: unknown, name: string, values: readonly T[]): T { return typeof value === 'string' && values.includes(value as T) ? value as T : fail(`Invalid ${name} in project.`); }

/** Read only known fields. Project data is never executable or a URL to fetch. */
export function parseProject(value: unknown): ProjectDocument {
  const p = object(value);
  if (p.format !== 'liike-project') fail('This is not a Liike project. Choose a file saved with Save project.');
  if (p.version !== 1 && p.version !== PROJECT_VERSION) fail('This project version is not supported. Update Liike and try again.');
  const legacy = p.version === 1;
  const s = object(p.settings);
  const settings: SheetSettings = {
    W: number(s.W, 'sheet width', 41, 100000), H: number(s.H, 'sheet height', 41, 100000),
    cols: number(s.cols, 'columns', 1, 6, true), rows: number(s.rows, 'rows', 1, 6, true),
    margin: number(s.margin, 'margin', 0, 100000), gap: number(s.gap, 'gap', 0, 100000), markSize: number(s.markSize, 'marker size', 8, 15),
    order: choice(s.order, 'frame order', ['Row-major', 'Column-major', 'Boustrophedon']), total: number(s.total, 'total frames', 1, Number.MAX_SAFE_INTEGER, true),
    crop: choice(s.crop, 'crop', ['Frame window', 'Full cell']), pad: number(s.pad, 'padding', 0, 100), paperTone: choice<'light' | 'dark'>(s.paperTone, 'paper color', ['light', 'dark']),
    captureMode: legacy ? 'sheet' : choice<CaptureMode>(s.captureMode, 'capture mode', ['sheet', 'frames']),
    clearance: legacy ? 0 : number(s.clearance, 'plot clearance', 0, 10), trim: legacy ? 0 : number(s.trim, 'border trim', 0, 10),
  };
  const issues = validateSettings(settings); if (issues.length) fail(issues[0]!);
  const a = object(p.adjustments);
  const adjustments: Adjustments = {
    flatten: boolean(a.flatten, 'paper flatten'), whiteBalance: boolean(a.whiteBalance, 'white balance'), autoAdjust: boolean(a.autoAdjust, 'auto adjust'),
    sharpenEnabled: boolean(a.sharpenEnabled, 'sharpen'), sharpen: number(a.sharpen, 'sharpen strength', 0, 100),
    black: number(a.black, 'black point', 0, 120), white: number(a.white, 'white point', 135, 255), gamma: number(a.gamma, 'gamma', .3, 3), saturation: number(a.saturation, 'saturation', 0, 200),
    thresholdEnabled: boolean(a.thresholdEnabled, 'ink threshold'), threshold: number(a.threshold, 'ink cutoff', 0, 255),
  };
  validateAdjustments(adjustments);
  if (!Array.isArray(p.photos) || p.photos.length > MAX_PROJECT_PHOTOS) fail(`A project can contain up to ${MAX_PROJECT_PHOTOS} photos.`);
  const ids = new Set<string>(), paths = new Set<string>();
  let bytes = 0, pixels = 0;
  const photos: ProjectPhoto[] = (p.photos as unknown[]).map(item => {
    const f = object(item), id = string(f.id, 'photo identifier', 80), path = string(f.path, 'photo path', 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) fail('Duplicate or invalid photo identifier.');
    if (!/^photos\/[0-9]{4}\.(jpg|png|webp)$/.test(path) || paths.has(path)) fail('Duplicate or invalid photo path.');
    ids.add(id); paths.add(path);
    const type = choice(f.type, 'photo type', ['image/jpeg', 'image/png', 'image/webp']);
    if (!path.endsWith(type === 'image/jpeg' ? '.jpg' : type === 'image/png' ? '.png' : '.webp')) fail('Photo type does not match its path.');
    const width = number(f.width, 'photo width', 1, 65535, true), height = number(f.height, 'photo height', 1, 65535, true);
    const size = number(f.size, 'photo size', 1, MAX_PHOTO_BYTES, true);
    bytes += size; pixels += width * height;
    if (bytes > MAX_PROJECT_BYTES || pixels > MAX_PROJECT_PIXELS) fail('This project is too large to open safely. Use fewer or smaller sheet photos.');
    if (!Array.isArray(f.points) || f.points.length !== 4) fail('Each photo needs four marker slots.');
    const points = (f.points as unknown[]).map(point => {
      if (point === null) return null;
      const q = object(point); return { x: number(q.x, 'marker X', 0, width), y: number(q.y, 'marker Y', 0, height) };
    }) as MarkerPoints;
    // Incomplete or crossing assignments are valid editable work in progress.
    const sha256 = string(f.sha256, 'photo checksum', 64);
    if (!/^[a-f0-9]{64}$/.test(sha256)) fail('Invalid photo checksum in project.');
    return { id, path, type, size, width, height, points, sha256, registrationMode: legacy ? 'sheet' : choice(f.registrationMode, 'registration mode', ['sheet', 'frames']), name: string(f.name, 'photo name', 255), lastModified: number(f.lastModified, 'photo date', 0, Number.MAX_SAFE_INTEGER, true), settingsKey: string(f.settingsKey, 'marker settings', 200) };
  });
  const q = object(p.sequence);
  const references = (value: unknown): string[] => {
    if (!Array.isArray(value) || value.length > MAX_PROJECT_PHOTOS * 36) fail('Invalid frame references in project.');
    const result = (value as unknown[]).map(v => {
      const id = string(v, 'frame reference', 85), split = id.lastIndexOf(':');
      if (!ids.has(id.slice(0, split)) || !/^(0|[1-9][0-9]*)$/.test(id.slice(split + 1)) || Number(id.slice(split + 1)) >= (settings.captureMode === 'frames' ? 1 : settings.cols * settings.rows)) fail('A sequence frame refers to an unknown photo or cell.');
      return id;
    });
    if (new Set(result).size !== result.length) fail('Duplicate frame references in project.');
    return result;
  };
  const sequence: SequenceSettings = { order: choice(q.order, 'sequence order', ['Original', 'Reverse', 'Ping-pong', 'Manual']), manual: references(q.manual), excluded: references(q.excluded), fps: number(q.fps, 'speed', 1, 30, true), loop: boolean(q.loop, 'loop') };
  const e = object(p.exportOptions);
  const exportOptions: ExportOptions = { format: choice(e.format, 'export format', ['gif', 'video', 'png']), longSide: number(e.longSide, 'export size', 0, 2160, true), dither: boolean(e.dither, 'dither'), loops: number(e.loops, 'repeats', 1, 20, true), quality: choice(e.quality, 'quality', ['Standard', 'High']), videoFormat: choice(e.videoFormat, 'video format', ['auto', 'webm']) };
  if (exportOptions.longSide !== 0 && exportOptions.longSide < 64) fail('Invalid export size in project.');
  const resolution = number(p.resolution, 'resolution', 64, 2160, true);
  if (![480, 720, 1080, 2160].includes(resolution)) fail('Unsupported frame resolution in project.');
  return { format: 'liike-project', version: PROJECT_VERSION, name: string(p.name, 'project name', 100).trim() || 'Untitled', settings, adjustments, sequence, exportOptions, resolution, stabilize: boolean(p.stabilize, 'stabilization'), photos };
}

/** Keep pending choices for extra photos, discard references to removed photos/cells. */
export function currentSequence(sequence: SequenceSettings, settings: SheetSettings, photos: Pick<Photo, 'id'>[]): SequenceSettings {
  const valid = new Set(photos.flatMap(p => Array.from({ length: settings.captureMode === 'frames' ? 1 : settings.cols * settings.rows }, (_, cell) => `${p.id}:${cell}`)));
  const keep = (ids: string[]) => [...new Set(ids.filter(id => valid.has(id)))];
  return { ...sequence, manual: keep(sequence.manual), excluded: keep(sequence.excluded) };
}
export function remapSequence(sequence: SequenceSettings, ids: Map<string, string>): SequenceSettings {
  const remap = (ref: string) => { const at = ref.lastIndexOf(':'); return `${ids.get(ref.slice(0, at))!}${ref.slice(at)}`; };
  return { ...sequence, manual: sequence.manual.map(remap), excluded: sequence.excluded.map(remap) };
}
export const projectFilename = (name: string) => `${name.trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80).trim() || 'Liike'}.liike`;
