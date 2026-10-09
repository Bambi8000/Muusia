import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tutorials, nodeGuides } from './content.mjs';
import { buildAnimation } from './animation/build.mjs';
import { CATALOG } from '../src/defs/catalog.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../dist/learn');
const manifest = JSON.parse(await fs.readFile(path.join(HERE, 'generated/manifest.json'), 'utf8'));
const nodes = manifest.nodes;
const byKey = Object.fromEntries(nodes.map(n => [n.key, n]));
const legacyTutorialAssets = { 'first-drawing': 'first', 'style-and-stamp': 'stamps', 'two-pen-composition': 'two-pens' };
const tutorialAssetKey = t => t.assetKey || legacyTutorialAssets[t.id] || t.id;
const tutorialAsset = t => {
  const key = tutorialAssetKey(t);
  const asset = manifest.tutorials[key];
  if (!asset) throw new Error(`Missing tutorial assets for ${t.id}: ${key}`);
  return asset;
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categoryNames = {gen:'Generators', mod:'Modifiers', dec:'Decorators', duo:'Combiners', math:'Math'};
const category = n => categoryNames[n.category] || n.category;
const num = n => String(n).padStart(2, '0');
const route = (base, target = '') => `${base}${target ? `${target}/` : ''}index.html`;
const img = (base, src, alt, cls = '', eager = false) => `<img class="${cls}" src="${base}${esc(src)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
const link = (base, target, label, cls = '') => `<a class="${cls}" href="${route(base, target)}"${cls.split(/\s+/).includes('active') ? ' aria-current="page"' : ''}>${label}</a>`;
const arrow = '<span aria-hidden="true">↗</span>';
const nodeLink = (base, key) => byKey[key] ? link(base, `nodes/${key}`, esc(byKey[key].name)) : esc(key);

function header(base, section) {
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="header-inner">
    ${link(base, '', 'Muusia <span class="brand-suffix">/ Learn</span>', 'brand')}
    <nav class="main-nav" aria-label="Main navigation">
      ${link(base, '', 'Overview', `nav-link ${section === 'home' ? 'active' : ''}`)}
      ${link(base, 'tutorials', 'Tutorials', `nav-link ${section === 'tutorials' ? 'active' : ''}`)}
      ${link(base, 'animation', 'Animation', `nav-link ${section === 'animation' ? 'active' : ''}`)}
      ${link(base, 'nodes', 'Node library', `nav-link ${section === 'nodes' ? 'active' : ''}`)}
    </nav><a class="header-action" href="${base}../index.html" target="_blank" rel="noopener">Open Muusia ${arrow}</a>
    </div></header>`;
}

function sidebar(base, current) {
  return `<aside class="sidebar" aria-label="Guide navigation"><div class="sidebar-group"><span class="sidebar-label">Getting started</span>
    ${tutorials.map(t => link(base, `tutorials/${t.id}`, `<span>${num(t.number)}</span> ${esc(t.title)}`, `sidebar-link ${current === t.id ? 'active' : ''}`)).join('')}
    </div><div class="sidebar-group"><span class="sidebar-label">Animation studies</span>${link(base,'animation','Six ways to move','sidebar-link')}${link(base,'animation/combine-movements','Combine two movements','sidebar-link')}${link(base,'animation/node-motion','Motion ideas for every node','sidebar-link')}</div><div class="sidebar-group"><span class="sidebar-label">The node library</span>
    ${nodes.map(n => link(base, `nodes/${n.key}`, esc(n.name), `sidebar-link ${current === n.key ? 'active' : ''}`)).join('')}
    ${link(base, 'nodes', `Browse all ${nodes.length} nodes →`, 'sidebar-link sidebar-all')}</div>
    <div class="sidebar-foot">Muusia v${esc(manifest.version)}<br>${nodes.length} node guides · ${tutorials.length} tutorials</div></aside>`;
}

function mobileContents(items) {
  return `<details class="mobile-contents"><summary>On this page</summary><nav aria-label="Page sections">${items.map(([id,label])=>`<a href="#${id}">${esc(label)}</a>`).join('')}</nav></details>`;
}

function footer(base) {
  return `<footer class="footer"><div class="footer-inner"><span class="footer-wordmark">Muusia / Learn</span><p>User manual · Pilot edition</p><div>${link(base, 'tutorials', 'Start learning')} ${link(base, 'nodes', 'Explore nodes')}<a href="${base}../index.html" target="_blank" rel="noopener">Open Muusia ↗</a><span>Tested with v${esc(manifest.version)}</span></div></div></footer>`;
}

function document(title, description, body, base, section, current = null) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#e9e9e5"><meta name="description" content="${esc(description)}"><title>${esc(title)} · Muusia Learn</title><link rel="icon" href="${base}../favicon.svg"><link rel="stylesheet" href="${base}site.css"><script src="${base}site.js" defer></script></head><body>
    ${header(base, section)}${current ? `<div class="page-shell">${sidebar(base, current)}<main class="main-content" id="main">${body}</main></div>` : `<main class="main-content wide-content" id="main">${body}</main>`}${footer(base)}</body></html>`;
}

function figure(base, src, alt, caption, cls = '', eager = false) {
  return `<figure class="figure ${cls}"><a href="${base}${esc(src)}" target="_blank" rel="noopener" aria-label="Enlarge: ${esc(alt)}">${img(base, src, alt, '', eager)}</a><figcaption class="figure-caption"><span>${caption}</span><a href="${base}${esc(src)}" target="_blank" rel="noopener">Enlarge ${arrow}</a></figcaption></figure>`;
}

function lessonCard(base, t) {
  const assets = tutorialAsset(t);
  return `<a class="lesson-card" href="${route(base, `tutorials/${t.id}`)}"><div class="lesson-art">${img(base, assets.output, `Finished drawing from ${t.title}`)}<span class="lesson-number">${num(t.number)}</span></div><div class="lesson-body"><div class="lesson-meta"><span>${esc(t.level)}</span><span>${esc(t.duration)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><span class="card-link">Start tutorial <span aria-hidden="true">→</span></span></div></a>`;
}

function nodeCard(base, n, i = 0) {
  const guide = nodeGuides[n.key];
  const searchable = `${n.name} ${category(n)} ${guide.summary} ${guide.useWhen} ${(n.tags || []).join(' ')}`;
  return `<a class="node-card" href="${route(base, `nodes/${n.key}`)}" data-node-card data-category="${esc(category(n))}" data-search="${esc(searchable.toLowerCase())}"><div class="node-art">${img(base, n.output, `${n.name} example output`)}<span class="node-index">${num(i + 1)}</span></div><div class="node-body"><span class="node-category">${esc(category(n))}</span><h3>${esc(n.name)} <span aria-hidden="true">↗</span></h3><p>${esc(guide.summary)}</p></div></a>`;
}

function animationIndex(base) {
  return `<section class="section" id="animation-studies"><div class="index-heading"><h2>Animation studies</h2><small>Watch · change · plot</small></div><p>Explore movement beyond rotation, combine animated branches, and plan a 24–48-frame loop on paper. These English studies include working previews, seven downloadable projects and a complete node-by-node survey.</p><nav class="node-directory" aria-label="Animation studies">
    ${link(base,'animation','<span>01</span><strong>Six ways to move</strong><small>Waves, surfaces, fragments, letters and volume</small>','directory-link')}
    ${link(base,'animation/combine-movements','<span>02</span><strong>Combine two movements</strong><small>Falling Grid Hairs + rotating Solids</small>','directory-link')}
    ${link(base,'animation/node-motion','<span>03</span><strong>Motion ideas for every node</strong><small>310 proposals · eight experiments · paper workflow</small>','directory-link')}
    </nav><p class="library-scope">Examples use actual node geometry. The survey distinguishes existing controls from proposed features; physical animation plotting is still to be tested.</p></section>`;
}

function home() {
  const base = './';
  const body = `<header class="manual-intro"><span class="eyebrow">USER MANUAL / v${esc(manifest.version)}</span><h1 class="article-title">Drawing with nodes.</h1><p class="article-summary">Build a patch, understand its controls, and take a drawing from Muusia to SVG. Start with a lesson or look up a node.</p></header>
    <div class="manual-index"><section class="index-lessons"><div class="index-heading"><h2>Tutorials</h2><small>${num(tutorials[0].number)}—${num(tutorials.at(-1).number)} / Follow in order or choose a project</small></div><div class="lesson-list">${tutorials.map(t=>lessonCard(base,t)).join('')}</div></section>
    <section class="index-reference"><div class="index-heading"><h2>Node reference</h2><small>${nodes.length} illustrated guides</small></div><nav class="node-directory" aria-label="Node reference">${nodes.map((n,i)=>link(base,`nodes/${n.key}`,`<span>${num(i+1)}</span><strong>${esc(n.name)}</strong><small>${esc(category(n))}</small>`,'directory-link')).join('')}</nav>${link(base,'nodes','Search and filter all guides →','text-link')}</section></div>
    ${animationIndex(base)}
    <section class="workbench-feature"><div class="workbench-heading"><div><span class="eyebrow">INSIDE MUUSIA</span><h2>Grid → Wave</h2></div><p>Two nodes from the first lesson. The blue wire carries paths; Wave bends the lines from Grid.</p>${link(base,'tutorials/first-drawing','Open lesson 01 →','text-link')}</div>${figure(base,'assets/screenshots/tutorial-first.png','Grid and Wave connected in the actual Muusia workspace','The first lesson’s patch, shown in Muusia. Select Wave to preview and export the result.','screenshot',true)}</section>`;
  return document('User manual', 'Muusia tutorials and node reference, with actual application screenshots and downloadable example patches.',body,base,'home');
}

function tutorialsIndex() {
  const base = '../';
  return document('Tutorials',`${tutorials.length} practical Muusia tutorials: ${tutorials.map(t => t.title).join("; ")}.`, `<div class="article-header"><span class="eyebrow">LEARN / ${tutorials.length} TUTORIALS</span><h1 class="article-title">Tutorials</h1><p class="article-summary">Build a drawing step by step. Each lesson includes the exact settings, a working patch and an SVG result.</p></div><div class="lesson-grid">${tutorials.map(t=>lessonCard(base,t)).join('')}</div>${animationIndex(base)}<section class="section"><div class="info-grid"><div class="info-card"><h2>Everything you need</h2><p>A browser with Muusia open. Each lesson includes a downloadable patch and a drawing you can export as SVG.</p></div><div class="info-card"><h2>Make it your own</h2><p>Try the small experiments at the end of each lesson. A seed, a spacing or a different connection can open up a whole new drawing.</p></div><div class="info-card"><h2>Already know the basics?</h2><p>Go straight to the illustrated node guides for controls, connections, comparisons and practical examples.</p>${link(base,'nodes','Explore the node library →')}</div></div></section>`,base,'tutorials');
}

function library() {
  const base = '../';
  const cats = [...new Set(nodes.map(category))];
  return document('Node library',`Explore ${nodes.length} Muusia nodes with screenshots, parameter comparisons and downloadable examples.`,`<div class="article-header"><span class="eyebrow">REFERENCE / ${nodes.length} GUIDES</span><h1 class="article-title">Node reference</h1><p class="article-summary">Look up a node, inspect its real controls and compare the effects of different settings.</p></div><div class="library-tools"><label class="search-field"><span aria-hidden="true">⌕</span><span class="sr-only">Search node guides</span><input type="search" id="node-search" placeholder="Search name, function or technique…" autocomplete="off"></label><div class="filter-bar" aria-label="Filter nodes by category">${['All nodes',...cats].map((c,i)=>`<button type="button" class="filter-button ${i===0?'active':''}" data-filter="${i===0?'all':esc(c)}" aria-pressed="${i===0}">${esc(c)}</button>`).join('')}</div></div><div class="library-count"><p class="result-count" role="status" aria-live="polite">${nodes.length} node guides</p><span>Muusia v${esc(manifest.version)}</span></div><div class="node-grid">${nodes.map((n,i)=>nodeCard(base,n,i)).join('')}</div><div class="empty-state hidden" id="empty-state"><h2>No matching nodes yet.</h2><p>Try “wave”, “lines”, “pen” or choose another category.</p><button type="button" class="button button-ghost" id="reset-search">Clear search and filters</button></div><p class="library-scope">This first collection covers ${nodes.length} of Muusia’s ${Object.keys(CATALOG).length} catalog nodes. Every guide includes a working example. The collection will grow.</p>`,base,'nodes');
}

function downloads(base, asset, note = '', options = {}) {
  return `<section class="download-panel" id="downloads"><div><span class="eyebrow">TRY IT IN MUUSIA</span><h2>Example files</h2><p>Download a patch, open Muusia and choose <strong>Load</strong>. Save your current work first. After loading, select the final node to see the drawing.${note ? ` ${esc(note)}` : ''}</p></div><div class="download-actions"><a class="button button-primary" href="${base}${esc(asset.example)}" download>Download example <span aria-hidden="true">↓</span></a>${options.startMode === 'example' ? '' : `<a class="button button-ghost" href="${base}examples/blank.muusia.json" download>Blank A4 starter ↓</a>`}${asset.exportBundle ? `<a class="button button-ghost" href="${base}${esc(asset.exportBundle.src)}" download>${esc(asset.exportBundle.label)} <span aria-hidden="true">↓</span></a>` : ''}</div></section>`;
}

function questions(items) {
  return `<div class="questions">${(items||[]).map(q=>`<details class="details"><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</div>`;
}

function tutorialPage(t, index) {
  const base = '../../';
  const a = tutorialAsset(t);
  const startsWithExample = t.startMode === 'example';
  const outputStepsTitle = t.outputStepsTitle || 'Drawing stages';
  const contents = [
    ['before-you-start', 'Before you start'],
    ...(t.quickReference?.length ? [['quick-reference', 'Quick reference']] : []),
    ...(t.showOutputSteps && a.steps?.length ? [['output-files', outputStepsTitle]] : []),
    ...t.steps.map((s,i) => [`step-${i+1}`, `${num(i+1)} ${s.title}`]),
    ['experiment', 'Try a variation'],
    ['downloads', 'Example files'],
    ...(t.sources?.length ? [['sources', 'Further reading']] : []),
  ];
  const startCopy = startsWithExample
    ? 'Download the complete example below, then use <strong>Load</strong> to open the prepared drawing. Save any current work before loading.'
    : 'Download the blank A4 starter below, then use <strong>Load</strong> to begin with a clean canvas.';
  const startFile = startsWithExample ? a.example : 'examples/blank.muusia.json';
  const startLabel = startsWithExample ? 'Download complete example' : 'Download blank starter';
  const quickReference = t.quickReference?.length ? `<section class="section quick-reference" id="quick-reference"><div class="index-heading"><h2>Quick reference</h2><small>For experienced users</small></div><table class="reference-table"><caption class="sr-only">Settings and file choices for this workflow</caption><tbody>${t.quickReference.map(row => `<tr><th scope="row">${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`).join('')}</tbody></table></section>` : '';
  const outputSteps = t.showOutputSteps && a.steps?.length ? `<section class="section" id="output-files"><h2>${esc(outputStepsTitle)}</h2><div class="comparison-grid output-comparison">${a.steps.map(step => `<figure class="comparison-card"><a href="${base}${esc(step.src)}" target="_blank" rel="noopener" aria-label="Enlarge: ${esc(step.label)}">${img(base,step.src,`${t.title}: ${step.label}`)}</a><figcaption>${esc(step.label)}</figcaption></figure>`).join('')}</div></section>` : '';
  const sources = t.sources?.length ? `<section class="section further-reading" id="sources"><h2>Further reading</h2><ul>${t.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)} ${arrow}</a></li>`).join('')}</ul></section>` : '';
  const body = `<div class="breadcrumbs">${link(base,'tutorials','Tutorials')}<span>/</span><span>Lesson ${num(t.number)}</span></div><header class="article-header"><span class="eyebrow">${num(t.number)} / Learn by making</span><h1 class="article-title">${esc(t.title)}</h1><p class="article-summary">${esc(t.summary)}</p><div class="metadata"><span>${esc(t.duration)}</span><span>${esc(t.level)}</span><span>A4 · 297 × 210 mm</span></div></header>
    ${mobileContents(contents)}
    ${figure(base,t.overviewImage || a.output,`The finished ${t.title.toLowerCase()} project`,t.overviewCaption || (startsWithExample ? 'The complete drawing used in this workflow. Load the example patch to follow along.' : 'The drawing you will make. Every line comes from your patch.'),'output-figure',true)}
    <div class="article-layout"><article class="article-body"><section class="section" id="before-you-start"><h2>Before you start</h2><p>${esc(t.prerequisite)}</p><ul class="learn-list">${t.learn.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="callout"><span class="callout-label">Keep Muusia open alongside this guide</span><p><a href="${base}../index.html" target="_blank" rel="noopener">Open Muusia ↗</a> in a separate tab. ${startCopy}</p><a href="${base}${esc(startFile)}" download>${startLabel} ↓</a></div></section>
    ${t.validationNote ? `<div class="callout"><span class="callout-label">Validation status</span><p>${esc(t.validationNote)}</p></div>` : ''}
    ${quickReference}
    ${figure(base,t.graphScreenshot || `assets/screenshots/tutorial-${tutorialAssetKey(t)}.png`,`${t.title}: the connected nodes in Muusia`,'The complete patch in Muusia. These are the actual nodes and controls used in this lesson.','screenshot graph-screenshot')}
    ${outputSteps}
    ${t.steps.map((s,i)=>`<section class="step" id="step-${i+1}"><div class="step-number">${num(i+1)}</div><div class="step-body"><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p>${s.image ? figure(base,s.image,s.imageAlt || `${t.title}: ${s.title}`,esc(s.imageCaption || 'Muusia’s actual controls and preview.'),'screenshot') : ''}${s.checkpoint ? `<div class="checkpoint"><span>Look for this</span><p>${esc(s.checkpoint)}</p></div>` : ''}${s.tip ? `<p class="step-tip"><strong>Try this.</strong> ${esc(s.tip)}</p>` : ''}</div></section>`).join('')}
    <section class="section" id="experiment"><span class="eyebrow">A little further</span><h2>Try a variation</h2><p>${esc(t.experiment)}</p></section>
    <section class="section" id="troubleshooting"><h2>If something looks different</h2>${questions(t.troubleshooting)}</section>${downloads(base,a,'',{startMode:t.startMode})}
    <section class="section" id="nodes"><h2>Meet the nodes in this lesson</h2><div class="related-links">${t.nodeKeys.map(k=>nodeLink(base,k)).join('')}</div></section>
    ${sources}
    ${index < tutorials.length-1 ? `<div class="prev-next"><span class="eyebrow">Next tutorial</span>${link(base,`tutorials/${tutorials[index+1].id}`,`${esc(tutorials[index+1].title)} →`)}</div>` : `<div class="prev-next"><span class="eyebrow">Keep exploring</span>${link(base,'nodes','Find your next node →')}</div>`}
    </article><nav class="toc" aria-label="On this page"><span class="sidebar-label">In this lesson</span>${contents.map(([id,label])=>`<a href="#${id}">${esc(label)}</a>`).join('')}</nav></div>`;
  return document(t.title,t.summary,body,base,'tutorials',t.id);
}

function ports(n, guide) {
  const rows = (pins, direction) => (pins||[]).map((p,i)=>`<div class="port-row"><span class="port-dot ${esc(p.type)}" aria-hidden="true"></span><strong>${esc(p.label||p.name||(direction==='Input'?`In ${i+1}`:'Out'))}</strong><span>${direction} · ${esc(p.type)}</span></div>`).join('');
  return `<div class="ports">${rows(n.inputs,'Input')}${rows(n.outputs,'Output')}</div>${guide.portNotes ? `<p>${esc(guide.portNotes)}</p>` : ''}`;
}

function paramTable(n) {
  const pretty = v => Array.isArray(v)?v.join(', '):typeof v === 'boolean' ? (v ? 'On' : 'Off') : String(v ?? '—');
  return `<details class="details full-reference"><summary>All controls <span>${n.params.length} ${n.params.length === 1 ? 'control' : 'controls'}</span></summary>${n.params.length ? `<div class="table-wrap"><table class="reference-table"><caption>Control labels and defaults from Muusia v${esc(manifest.version)}. Slider limits can be customized in Node setup.</caption><thead><tr><th scope="col">Control</th><th scope="col">Default</th><th scope="col">Range / choices</th></tr></thead><tbody>${n.params.map(p=>`<tr><th scope="row">${esc(p.label)}${p.conditional?`<small>${esc(p.visibilityNote||'Shown in the relevant mode.')}</small>`:''}</th><td>${esc(pretty(p.def??p.default))}</td><td>${esc(p.options?pretty(p.options):p.min!==undefined?`${p.min} to ${p.max}${p.step!==undefined?` · step ${p.step}`:''}`:p.type==='pen'?'Pen 0–11':p.type==='check'?'On / Off':p.type==='file'?'Choose a file':p.type==='seed'?'Integer seed':'—')}</td></tr>`).join('')}</tbody></table></div>` : '<p>Frame has no controls on its card. Set the frame count and playhead in Muusia’s ANIMATE panel.</p>'}</details>`;
}

function nodePage(n) {
  const base='../../', g=nodeGuides[n.key];
  const screenshotCaption = g.screenshotCaption || (['viiva','arvo','frame'].includes(n.key)
    ? `The working patch in Muusia, with its driving connection visible.${n.key==='frame'?' Red dashed guides are preview overlays, not exported lines.':''}`
    : `Shown in Focus mode (F). Press Esc to return to the full patch.${n.key==='polystudio'?' Red dashed guides are preview overlays, not exported lines.':''}`);
  const body=`<div class="breadcrumbs">${link(base,'nodes','Node library')}<span>/</span><span>${esc(category(n))}</span></div><header class="article-header"><span class="eyebrow">${esc(category(n))} / Node guide</span><h1 class="article-title">${esc(n.name)}</h1><p class="article-summary">${esc(g.summary)}</p><div class="metadata"><span class="badge">${esc(category(n))}</span><span>Tested in Muusia v${esc(manifest.version)}</span></div></header>
    ${mobileContents([['when','When to use it'],['connections','Connections'],['try','Try it'],['controls','Key controls'],['compare','Compare results'],['pitfalls','Things to know'],['downloads','Download example']])}
    ${figure(base,n.output,`${n.name} demonstration drawing`,esc(g.outputCaption||'Made with the downloadable example patch below.'),'output-figure',true)}
    <div class="article-layout"><article class="article-body"><section class="section" id="when"><h2>When to use it</h2><p>${esc(g.useWhen)}</p>${g.exportNote?`<aside class="callout"><span class="callout-label">SVG / DXF export</span><p>${esc(g.exportNote)}</p></aside>`:''}</section><section class="section" id="connections"><h2>Connections</h2>${ports(n,g)}
    ${figure(base,`assets/screenshots/${n.key}.png`,`${n.name} in Muusia, showing its actual controls and preview`,esc(screenshotCaption),'screenshot')}
    </section><section class="section" id="try"><h2>Try it in a small patch</h2><ol class="recipe-list">${g.recipe.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></section><section class="section" id="controls"><h2>Key controls</h2><div class="controls-list">${g.controls.map(c=>`<div class="control-item"><h3>${esc(c.name)}</h3><p>${esc(c.text)}</p></div>`).join('')}</div>${paramTable(n)}</section>
    <section class="section" id="compare"><span class="eyebrow">Look closer</span><h2>Compare settings</h2>${g.comparisonIntro?`<p>${esc(g.comparisonIntro)}</p>`:''}<div class="comparison-grid">${(n.comparisons||[]).map(c=>`<figure class="comparison-card"><a href="${base}${esc(c.src)}" target="_blank" rel="noopener">${img(base,c.src,`${n.name}: ${c.label}`)}</a><figcaption>${esc(c.label)}</figcaption></figure>`).join('')}</div></section>
    <section class="section" id="pitfalls"><h2>Notes</h2>${questions(g.pitfalls)}</section>${downloads(base,n,n.key==='frame'?'Set ANIMATE to 12 frames; frame count is not saved in patch files.':'')}
    <section class="section" id="related"><h2>Related guides</h2>${['frame','merge','grid','aaltoilu'].includes(n.key)?`<p>Try animated examples in the ${link(base,'animation','animation gallery')} or learn to ${link(base,'animation/combine-movements','combine different movements')}.</p>`:''}<div class="related-links">${g.related.map(k=>nodeLink(base,k)).join('')}</div>${g.tutorials.length?`<p class="related-tutorials">Use it in a tutorial: ${g.tutorials.map(id=>{const t=tutorials.find(x=>x.id===id);return t?link(base,`tutorials/${id}`,esc(t.title)):'';}).filter(Boolean).join(' · ')}</p>`:''}</section></article><nav class="toc" aria-label="On this page"><span class="sidebar-label">In this guide</span><a href="#when">When to use it</a><a href="#connections">Connections</a><a href="#try">Try it</a><a href="#controls">Key controls</a><a href="#compare">Compare results</a><a href="#pitfalls">Things to know</a><a href="#downloads">Download example</a></nav></div>`;
  return document(n.name,g.summary,body,base,'nodes',n.key);
}

await fs.mkdir(OUT,{recursive:true});
await Promise.all(['assets','examples'].map(dir=>fs.cp(path.join(HERE,dir),path.join(OUT,dir),{recursive:true})));
await Promise.all(['site.css','site.js'].map(file=>fs.copyFile(path.join(HERE,file),path.join(OUT,file))));
const pages = [['',home()],['tutorials',tutorialsIndex()],['nodes',library()],...tutorials.map((t,i)=>[`tutorials/${t.id}`,tutorialPage(t,i)]),...nodes.map(n=>[`nodes/${n.key}`,nodePage(n)])];
for(const [slug,html] of pages){await fs.mkdir(path.join(OUT,slug),{recursive:true});await fs.writeFile(path.join(OUT,slug,'index.html'),html);}
const studyCount = await buildAnimation(OUT);
console.log(`Built Muusia Learn: ${pages.length + studyCount} pages, ${studyCount} animation studies, ${tutorials.length} tutorials, ${nodes.length} node guides → dist/learn`);
