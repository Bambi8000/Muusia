import def from '../../src/defs/nodes/murmuration.js';
import { MURMURATION_SETTINGS } from './settings.mjs';

const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const $ = id => document.getElementById(`herd-${id}`);
const cache = new Map();
let frame = 0, playing = false, visible = false, pen = 'all', last = 0;

function render() {
  const count = +$('count').value, kind = $('kind').value, ground = $('ground').value;
  for (const [id, camera] of [['group', 'Follow group'], ['animal', 'Follow animal']]) {
    const key = [count, kind, ground, frame, camera].join('|');
    let paths = cache.get(key);
    if (!paths) {
      paths = def.compute([], {...defaults, ...MURMURATION_SETTINGS, behaviour: kind,
        time: frame / count, camera, ground}, {W: 297, H: 210, frameIdx: frame, frameCount: count}).paths;
      cache.set(key, paths);
    }
    $(id).innerHTML = paths.filter(p => pen === 'all' || p.layer === +pen).map(p =>
      `<path d="M${p.pts.map(q => q.map(v => v.toFixed(3)).join(',')).join('L')}${p.closed ? 'Z' : ''}" fill="none" stroke="${p.layer === 2 ? '#c23a30' : '#283631'}" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round"/>`
    ).join('');
  }
  $('counter').textContent = `Frame ${frame + 1} / ${count}`;
  $('frame').value = frame;
}
function playback(value) {
  playing = value;
  $('play').textContent = playing ? 'Pause' : 'Play';
}
$('play').onclick = () => playback(!playing);
$('frame').oninput = e => { playback(false); frame = +e.target.value; render(); };
for (const id of ['kind', 'count', 'ground']) $(id).onchange = () => {
  frame = 0; cache.clear(); $('frame').max = +$('count').value - 1; render();
};
for (const button of document.querySelectorAll('[data-herd-pen]')) button.onclick = () => {
  pen = button.dataset.herdPen;
  document.querySelectorAll('[data-herd-pen]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
};
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe($('study'));
function tick(now) {
  if (playing && visible && !document.hidden && now - last > 140) {
    frame = (frame + 1) % +$('count').value;
    render(); last = now;
  }
  requestAnimationFrame(tick);
}
render(); requestAnimationFrame(tick);
