import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MICROBES_STUDIES = ['living-microscope', 'single-cell', 'swimming-bacteria', 'specimen-collection'];

export async function buildMicrobes(site) {
  const out = path.join(site, 'assets/microbes');
  await fs.mkdir(out, {recursive: true});
  // Share the reviewed local player and bundle the actual node for static hosting.
  const bundle = await rolldown({input: path.resolve(HERE, '../../docs/microbes/study.js')});
  try { await bundle.write({file: path.join(out, 'study.js'), format: 'esm', minify: true}); }
  finally { await bundle.close(); }
  await fs.copyFile(path.join(HERE, 'study.css'), path.join(out, 'study.css'));
  for (const id of MICROBES_STUDIES) {
    await fs.copyFile(path.resolve(HERE, `../../docs/microbes/${id}.muusia.json`), path.join(site, `examples/microbes-${id}.muusia.json`));
  }
}
