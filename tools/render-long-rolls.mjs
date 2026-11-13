import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ribbon from "../src/defs/nodes/ribbon.js";
import kaisla from "../src/defs/nodes/kaisla.js";
import { EXAMPLES } from "../src/examples.js";
import { PENS_DEFAULT, pathLength } from "../src/defs/helpers.js";

const out = resolve(process.argv[2] || "output/long-rolls");
await mkdir(out, { recursive: true });
const records = [], cards = [];
for (const [index, example] of EXAMPLES.filter(ex => /^(Ribbon · One metre|Kaisla ·)/.test(ex.name)).entries()) {
  const graph = example.make(type => Object.fromEntries((type === "kaisla" ? kaisla : ribbon).params.map(p => [p.key, p.def])));
  const node = graph.nodes[0], def = node.type === "kaisla" ? kaisla : ribbon;
  const { W, H } = example.canvas, { paths } = def.compute([], node.params, example.canvas);
  const id = ["ribbon-pleats-1m", "ribbon-channels-1m", "kaisla-1m", "kaisla-3m"][index];
  const body = paths.map(p => `<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i) => `${i ? 'L' : 'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}${p.closed ? ' Z' : ''}"/>`).join('\n');
  await writeFile(`${out}/${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><title>${example.name}</title><g fill="none" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`);
  await writeFile(`${out}/${id}.muusia.json`, JSON.stringify({app:"muusia",v:1,name:example.name,canvas:example.canvas,root:graph},null,2)+'\n');
  records.push({ id, name: example.name, canvas: example.canvas, paths: paths.length, points: paths.reduce((s,p)=>s+p.pts.length,0), inkMetres: paths.reduce((s,p)=>s+pathLength(p.pts,p.closed),0)/1000 });
  cards.push(`<article><h2>${example.name}</h2><p>${W} × ${H} mm · <a href="${id}.muusia.json" download>Muusia</a> · <a href="${id}.svg" download>SVG</a></p><img src="${id}.svg" alt="${example.name}"></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="fi"><meta charset="utf-8"><title>Pitkät kuviot — Muusia</title><style>*{box-sizing:border-box}body{margin:0;background:#e9e6df;color:#23242a;font:14px/1.5 system-ui;padding:24px}h1{font:36px Georgia;margin:0}header{margin-bottom:20px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}article{background:#f5f3ee;padding:16px;text-align:center}h2{font:19px Georgia;min-height:48px;margin:0}a{color:inherit}img{display:block;height:900px;width:auto;margin:20px auto 0;background:white;box-shadow:0 4px 18px #0002}</style><header><h1>Pitkät nauhat ja kaislat</h1><p>Uusien aloitusesimerkkien todelliset piirtojäljet. Pituus 1 m / 3 m.</p></header><main>${cards.join('')}</main></html>`);
console.log(records);
