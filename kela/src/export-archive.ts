import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import { exportManifest, pngName } from './export-plan.ts';
import type { ExportPlan } from './export-plan';

export async function pngArchive(plan: ExportPlan, read: (index: number) => Promise<Uint8Array>, progress: (done: number) => void): Promise<Blob> {
  const chunks: BlobPart[] = [];
  let failure: Error | null = null, finished = false;
  const zip = new Zip((error, data, final) => { if (error) failure = error; else chunks.push(new Uint8Array(data)); finished = final; });
  const add = (name: string, data: Uint8Array) => { const entry = new ZipPassThrough(name); zip.add(entry); entry.push(data, true); if (failure) throw failure; };
  for (let i = 0; i < plan.frames.length; i++) { add(pngName(i), await read(i)); progress(i + 1); }
  add('sequence.json', strToU8(JSON.stringify(exportManifest(plan), null, 2)));
  zip.end();
  if (failure) throw failure;
  if (!finished) throw new Error('The PNG archive could not be finalized.');
  return new Blob(chunks, { type: 'application/zip' });
}
