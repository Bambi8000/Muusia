import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
const HERE = path.dirname(fileURLToPath(import.meta.url));

// Ship the actual node and its used helpers inside a standalone browser module.
// A public Learn page must never depend on the repository's /src development URL.
export async function buildMurmuration(site) {
  const out = path.join(site, 'assets/murmuration');
  await fs.mkdir(out, {recursive: true});
  const bundle = await rolldown({input: path.join(HERE, 'study.js')});
  try { await bundle.write({file: path.join(out, 'study.js'), format: 'esm', minify: true}); }
  finally { await bundle.close(); }
  await fs.copyFile(path.join(HERE, 'study.css'), path.join(out, 'study.css'));
  await fs.copyFile(path.resolve(HERE, '../../docs/murmuration-tracking/follow-one.muusia.json'), path.join(site, 'examples/murmuration-tracking.muusia.json'));
}
