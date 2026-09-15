import { Zip, ZipPassThrough, strToU8, strFromU8, unzipSync } from 'fflate';
import { parseProject, currentSequence, remapSequence, PROJECT_VERSION, MAX_PROJECT_BYTES, MAX_PHOTO_BYTES, MAX_PROJECT_PHOTOS, MAX_PROJECT_PIXELS } from './project.ts';
import type { ProjectDocument, ProjectPhoto, ProjectState } from './project';
import { loadPhoto, disposePhoto } from './photos.ts';
import type { Photo } from './photos';

export type ProjectProgress = (message: string) => void;
export type RestoredProject = { project: ProjectDocument; photos: Photo[] };
const check = (signal?: AbortSignal) => signal?.throwIfAborted();
const checksum = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(v => v.toString(16).padStart(2, '0')).join('');
const mime = (file: File) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg';

/** Store original image bytes, with no re-encoding or base64 inflation. */
export async function saveProject(state: ProjectState, photos: Photo[], progress: ProjectProgress = () => {}, signal?: AbortSignal): Promise<Blob> {
  check(signal);
  if (photos.length > MAX_PROJECT_PHOTOS || photos.reduce((n, p) => n + p.width * p.height, 0) > MAX_PROJECT_PIXELS) throw new Error('This project is too large to save. Use fewer or smaller sheet photos.');
  if (photos.some(p => !p.file || p.file.size > MAX_PHOTO_BYTES) || photos.reduce((n, p) => n + p.file.size, 0) > MAX_PROJECT_BYTES - 1024 * 1024) throw new Error('Project photos must be under 40 MB each and 255 MB in total. Use smaller photos.');
  const metadata: ProjectPhoto[] = photos.map((photo, i) => {
    const type = mime(photo.file), ext = type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';
    return { id: photo.id, name: photo.name, path: `photos/${String(i + 1).padStart(4, '0')}.${ext}`, type, size: photo.file.size, lastModified: photo.file.lastModified, width: photo.width, height: photo.height, points: photo.points.map(p => p && { ...p }) as Photo['points'], registrationMode: photo.registrationMode ?? 'sheet', settingsKey: photo.detection?.settingsKey ?? '', sha256: '0'.repeat(64) };
  });
  // Validate and copy the snapshot before the first asynchronous operation.
  const document = parseProject({ ...state, settings: { ...state.settings, paperTone: state.settings.paperTone ?? 'light', captureMode: state.settings.captureMode ?? 'sheet', clearance: state.settings.clearance ?? 0, trim: state.settings.trim ?? 0 }, sequence: currentSequence(state.sequence, state.settings, photos), format: 'liike-project', version: PROJECT_VERSION, photos: metadata });
  const chunks: BlobPart[] = [];
  let failure: Error | null = null, finished = false;
  const zip = new Zip((error, bytes, final) => { if (error) failure = error; else chunks.push(new Uint8Array(bytes)); finished = final; });
  const add = (name: string, bytes: Uint8Array) => { const entry = new ZipPassThrough(name); zip.add(entry); entry.push(bytes, true); if (failure) throw failure; };
  try {
    for (let i = 0; i < photos.length; i++) {
      check(signal); progress(`Saving photo ${i + 1} of ${photos.length}…`);
      const bytes = new Uint8Array(await photos[i]!.file.arrayBuffer());
      document.photos[i]!.sha256 = await checksum(bytes);
      check(signal); add(document.photos[i]!.path, bytes);
    }
    add('project.json', strToU8(JSON.stringify(document, null, 2)));
    zip.end();
    if (failure) throw failure;
    if (!finished) throw new Error('The project file could not be completed.');
    check(signal);
    return new Blob(chunks, { type: 'application/zip' });
  } finally { zip.terminate(); }
}

export async function readProject(file: Blob, signal?: AbortSignal): Promise<{ project: ProjectDocument; files: File[] }> {
  check(signal);
  if (file.size > MAX_PROJECT_BYTES) throw new Error('This project is larger than 256 MB. Open a smaller project.');
  let entries: ReturnType<typeof unzipSync>;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer()); check(signal);
    let size = 0;
    const names = new Set<string>();
    // Check directory entries before allocating any expanded image data.
    unzipSync(bytes, { filter: entry => {
      const allowed = entry.name === 'project.json' || /^photos\/[0-9]{4}\.(jpg|png|webp)$/.test(entry.name);
      if (!allowed || names.has(entry.name)) throw new Error('Unexpected or duplicate file in project.');
      names.add(entry.name); size += entry.originalSize;
      if (names.size > MAX_PROJECT_PHOTOS + 1 || size > MAX_PROJECT_BYTES || entry.originalSize > (entry.name === 'project.json' ? 1024 * 1024 : MAX_PHOTO_BYTES)) throw new Error('Project contents exceed the size limit.');
      if (![0, 8].includes(entry.compression)) throw new Error('Unsupported project compression.');
      return false;
    } });
    if (!names.has('project.json')) throw new Error('The project settings are missing.');
    entries = unzipSync(bytes);
  } catch (error) {
    check(signal);
    const detail = error instanceof Error && !('code' in error) ? error.message : 'The file may be damaged or incomplete.';
    throw new Error(`Could not read this Liike project. ${detail}`);
  }
  let json: unknown;
  try { json = JSON.parse(strFromU8(entries['project.json']!)); }
  catch { throw new Error('The project settings are damaged or incomplete.'); }
  const project = parseProject(json), files: File[] = [];
  if (Object.keys(entries).length !== project.photos.length + 1) throw new Error('Project photos do not match the saved settings.');
  for (const photo of project.photos) {
    check(signal);
    const bytes = entries[photo.path];
    if (!bytes || bytes.length !== photo.size) throw new Error(`Missing or incomplete photo: ${photo.name}`);
    if (await checksum(bytes) !== photo.sha256) throw new Error(`The saved photo is damaged: ${photo.name}`);
    files.push(new File([new Uint8Array(bytes)], photo.name, { type: photo.type, lastModified: photo.lastModified }));
    delete entries[photo.path];
  }
  check(signal);
  return { project, files };
}

/** Stage all photos before handing over ownership. Failure leaves the current session intact. */
export async function openProject(file: Blob, progress: ProjectProgress = () => {}, signal?: AbortSignal, decoder: typeof loadPhoto = loadPhoto, dispose: typeof disposePhoto = disposePhoto): Promise<RestoredProject> {
  progress('Reading project…');
  const { project, files } = await readProject(file, signal), photos: Photo[] = [], ids = new Map<string, string>();
  try {
    for (let i = 0; i < files.length; i++) {
      check(signal); progress(`Opening photo ${i + 1} of ${files.length}…`);
      const photo = await decoder(files[i]!); photos.push(photo); check(signal);
      const saved = project.photos[i]!;
      if (photo.width !== saved.width || photo.height !== saved.height) throw new Error(`Photo dimensions do not match the project: ${saved.name}`);
      ids.set(saved.id, photo.id);
      photo.points = saved.points;
      photo.registrationMode = saved.registrationMode;
      photo.detection = { status: 'edited', settingsKey: saved.settingsKey, message: saved.registrationMode === 'frames' ? 'Restored frame corners. Check the crop before extracting.' : 'Restored marker positions. Check the frame windows before extracting.' };
    }
    check(signal);
    return { project: { ...project, photos: project.photos.map(p => ({ ...p, id: ids.get(p.id)! })), sequence: remapSequence(project.sequence, ids) }, photos };
  } catch (error) { photos.forEach(dispose); throw error; }
}
