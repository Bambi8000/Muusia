(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const state = { source: 'receipt', receipts: [], selected: 0, health: null, jobs: [] };

  async function api(path, options = {}) {
    const response = await fetch(path, options);
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || `Server returned ${response.status}`);
    return value;
  }

  function message(value, error = false) {
    const target = $('#preview-message'); target.textContent = value; target.classList.toggle('error', error);
  }

  function setView(view) {
    $$('.view').forEach(node => node.classList.toggle('hidden', node.id !== `${view}-view`));
    $$('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.view === view));
    $('#page-title').textContent = { dashboard: 'Dashboard', queue: 'Print queue', settings: 'Settings' }[view];
  }

  function setSource(source) {
    state.source = source;
    $$('.source-tabs button').forEach(node => node.setAttribute('aria-selected', String(node.dataset.source === source)));
    $$('.source-form').forEach(node => node.classList.toggle('hidden', node.dataset.form !== source));
  }

  function decode(data) {
    const binary = atob(data), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function encode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }

  function receiptFromCanvas(canvas, name, dither = false) {
    const { width, height } = canvas;
    if (width !== 512 || height < 1 || height > 4096) throw new Error('Receipt must be 512 dots wide and at most 4096 rows high.');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = context.getImageData(0, 0, width, height).data, count = width * height;
    const shades = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const alpha = rgba[i * 4 + 3] / 255;
      shades[i] = (rgba[i * 4] * .2126 + rgba[i * 4 + 1] * .7152 + rgba[i * 4 + 2] * .0722) * alpha + 255 * (1 - alpha);
    }
    const packed = new Uint8Array(count / 8);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = y * width + x, old = shades[index], black = old < 160;
      if (black) packed[index >> 3] |= 0x80 >> (index & 7);
      if (!dither) continue;
      const error = old - (black ? 0 : 255);
      if (x + 1 < width) shades[index + 1] += error * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) shades[index + width - 1] += error * 3 / 16;
        shades[index + width] += error * 5 / 16;
        if (x + 1 < width) shades[index + width + 1] += error / 16;
      }
    }
    return { format: 'muusia-receipt', version: 1, width, height, data: encode(packed), cut: true, name };
  }

  function previewCurrent() {
    const item = state.receipts[state.selected], canvas = $('#preview-canvas'), empty = $('#preview-empty');
    const selected = Boolean(item);
    canvas.classList.toggle('visible', selected); empty.classList.toggle('hidden', selected);
    $('#queue-current').disabled = !selected || !state.health?.ready;
    $('#queue-all').classList.toggle('hidden', state.receipts.length < 2);
    $('#queue-all').disabled = !selected || !state.health?.ready;
    $('#frame-picker').classList.toggle('hidden', state.receipts.length < 2);
    if (!item) { $('#preview-title').textContent = 'Nothing selected'; $('#preview-size').textContent = '—'; return; }
    $('#preview-title').textContent = item.name || `Frame ${state.selected + 1}`;
    $('#preview-size').textContent = `${item.width} × ${item.height} dots`;
    $('#frame-position').textContent = `${state.selected + 1} of ${state.receipts.length}`;
    $('#cut-after').checked = item.cut !== false;
    const picker = $('#frame-select'); picker.replaceChildren();
    state.receipts.forEach((receipt, i) => { const option = new Option(receipt.name || `Frame ${i + 1}`, String(i)); picker.add(option); });
    picker.value = String(state.selected);
    const pixels = decode(item.data);
    canvas.width = item.width; canvas.height = item.height;
    const context = canvas.getContext('2d'); const image = context.createImageData(item.width, item.height);
    for (let y = 0; y < item.height; y++) for (let x = 0; x < item.width; x++) {
      const bit = pixels[y * 64 + (x >> 3)] & (0x80 >> (x & 7));
      const offset = (y * item.width + x) * 4, level = bit ? 0 : 255;
      image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = level;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }

  function stage(receipts, note) {
    state.receipts = receipts; state.selected = 0;
    previewCurrent(); message(note || `${receipts.length} receipt${receipts.length === 1 ? '' : 's'} ready to inspect.`);
    setView('dashboard');
  }

  async function inspectReceipt(file) {
    if (!file) return;
    try {
      message('Reading receipt file…');
      const value = await api('/api/inspect', { method: 'POST', body: await file.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream', 'X-Muusia-Filename': encodeURIComponent(file.name) } });
      stage(value.receipts, `${value.receipts.length} receipt${value.receipts.length === 1 ? '' : 's'} checked. Preview before queuing.`);
    } catch (error) { message(error.message, true); }
  }

  async function inspectImage(file) {
    if (!file) return;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose PNG, JPEG or WebP.');
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(bitmap.height / bitmap.width * 512);
        if (canvas.height > 4096) throw new Error('This image is too tall for one receipt. Crop it before importing.');
        const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        stage([receiptFromCanvas(canvas, file.name, $('#image-dither').checked)], 'Image converted to thermal dots. Check the preview before queuing.');
      } finally { bitmap.close(); }
    } catch (error) { message(error.message, true); }
  }

  function makeText() {
    try {
      const title = $('#text-title').value.trim(), body = $('#text-body').value.trim();
      if (!title && !body) throw new Error('Enter a title or some text first.');
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 4096;
      const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 512, 4096);
      context.fillStyle = '#000'; let y = 28;
      if (title) { context.font = 'bold 28px sans-serif'; for (const line of wrap(context, title, 464)) { context.fillText(line, 24, y); y += 35; } y += 14; }
      context.font = '18px sans-serif';
      for (const paragraph of body.split('\n')) {
        if (!paragraph) { y += 16; continue; }
        for (const line of wrap(context, paragraph, 464)) { context.fillText(line, 24, y); y += 25; }
      }
      y += 20; if (y > 4096) throw new Error('Text is too long for one receipt.');
      const output = document.createElement('canvas'); output.width = 512; output.height = Math.max(72, y);
      output.getContext('2d').drawImage(canvas, 0, 0, 512, output.height, 0, 0, 512, output.height);
      stage([receiptFromCanvas(output, title || 'Text receipt')], 'Text is ready to print.');
    } catch (error) { message(error.message, true); }
  }

  function wrap(context, text, maxWidth) {
    const words = text.split(/\s+/), lines = []; let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > maxWidth) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function makeTest() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 760;
    const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 512, 760); c.fillStyle = '#000'; c.strokeStyle = '#000';
    c.font = 'bold 22px monospace'; c.fillText('MUUSIA / EPSON TEST', 18, 34); c.font = '12px monospace'; c.fillText('512 DOT THERMAL / 1-BIT OUTPUT', 18, 53);
    for (let step = 1; step <= 4; step++) { const x0 = 20 + (step - 1) * 122; c.font = '11px monospace'; c.fillText(`${step} DOT`, x0, 85); for (let x = x0; x < x0 + 94; x += step + 1) c.fillRect(x, 98, step, 100); }
    for (let step = 2; step <= 5; step++) { const y0 = 224 + (step - 2) * 54; c.fillText(`${step} PX`, 20, y0 + 12); for (let x = 78; x < 494; x += step * 2) c.fillRect(x, y0, 1, 40); for (let y = y0; y < y0 + 40; y += step * 2) c.fillRect(78, y, 416, 1); }
    c.lineWidth = 1; for (let radius = 16; radius <= 94; radius += 8) { c.beginPath(); c.arc(128, 550, radius, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); }
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let i = 0; i < 5; i++) { const x0 = 20 + i * 96, threshold = i * 4; c.fillText(`${i * 25}%`, x0, 650); for (let y = 662; y < 707; y++) for (let x = x0; x < x0 + 82; x++) if (bayer[((y & 3) << 2) | (x & 3)] < threshold) c.fillRect(x, y, 1, 1); }
    for (let i = 0; i < 8; i++) if (i % 2 === 0) c.fillRect(20 + i * 59, 729, 50, 13);
    stage([receiptFromCanvas(canvas, 'Epson thermal test card')], 'Test card ready. Printing will use test file mode until the Epson is connected.');
  }

  async function queueReceipt(item, cut) {
    return api('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: item.name || 'Receipt', width: item.width, height: item.height, data: item.data, cut }) });
  }

  async function addToQueue(all) {
    if (!state.health?.ready) { message('Printer output is unavailable. Enable test file mode or connect the Epson.', true); return; }
    const items = all ? state.receipts : [state.receipts[state.selected]]; if (!items.length || !items[0]) return;
    const cut = $('#cut-after').checked; let added = 0;
    $('#queue-current').disabled = $('#queue-all').disabled = true;
    try {
      for (const item of items) { await queueReceipt(item, cut); added++; }
      message(`${added} job${added === 1 ? '' : 's'} added to the queue.`);
    } catch (error) { message(`${added} queued. ${error.message}`, true); }
    finally { await refresh(); previewCurrent(); }
  }

  async function cutPaper() {
    if (!state.health?.ready) return;
    const button = $('#cut-only'); button.disabled = true;
    try {
      await api('/api/cut', { method: 'POST' });
      message('Cut command added to the queue. TM-T88V leaves a small edge tab.');
      await refresh();
    } catch (error) { message(error.message, true); }
    finally { button.disabled = !state.health?.ready; }
  }

  function jobElement(job) {
    const row = document.createElement('div'); row.className = 'job-row';
    const icon = document.createElement('span'); icon.className = 'job-icon'; icon.textContent = job.kind === 'cut' ? '✂' : '▤'; row.append(icon);
    const info = document.createElement('div'); const title = document.createElement('div'); title.className = 'job-name'; title.textContent = job.name || 'Receipt';
    const meta = document.createElement('div'); meta.className = 'job-meta'; meta.textContent = `${job.kind === 'cut' ? 'Cutter command' : `${job.width || 512} × ${job.height} dots`} · ${new Date(job.createdAt * 1000).toLocaleTimeString()}${job.error ? ` · ${job.error}` : ''}`;
    info.append(title, meta); row.append(info);
    const actions = document.createElement('div'); actions.className = 'job-actions'; const status = document.createElement('span'); status.className = `job-status ${job.status}`; status.textContent = job.status; actions.append(status);
    if (job.kind !== 'cut') { const preview = document.createElement('button'); preview.textContent = 'Preview'; preview.addEventListener('click', async () => { try { const receipt = await api(`/api/jobs/${job.id}/receipt`); stage([{ ...receipt, name: job.name }], 'Loaded a previous job for preview.'); } catch (error) { message(error.message, true); setView('dashboard'); } }); actions.append(preview); }
    if (job.status === 'queued') { const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.addEventListener('click', async () => { try { await api(`/api/jobs/${job.id}`, { method: 'DELETE' }); await refresh(); } catch (error) { message(error.message, true); setView('dashboard'); } }); actions.append(cancel); }
    row.append(actions); return row;
  }

  function renderJobs() {
    for (const [selector, items] of [['#recent-jobs', state.jobs.slice(0, 5)], ['#all-jobs', state.jobs]]) {
      const container = $(selector); container.replaceChildren();
      if (!items.length) { const empty = document.createElement('div'); empty.className = 'empty-list'; empty.textContent = 'No print jobs yet.'; container.append(empty); }
      else items.forEach(job => container.append(jobElement(job)));
    }
  }

  async function refresh() {
    try {
      const [health, listing] = await Promise.all([api('/health'), api('/api/jobs')]);
      state.health = health; state.jobs = listing.jobs;
      const queued = listing.jobs.filter(job => job.status === 'queued').length;
      const printing = listing.jobs.filter(job => job.status === 'printing').length;
      const done = listing.jobs.filter(job => job.status === 'done').length;
      $('#printer-state').textContent = health.ready ? health.mode === 'test file' ? 'Test mode' : 'Ready' : 'Offline';
      $('#printer-detail').textContent = health.mode === 'test file' ? 'ESC/POS written to a file' : health.device;
      $('#queue-state').textContent = `${queued + printing} job${queued + printing === 1 ? '' : 's'}`;
      $('#done-state').textContent = `${done} job${done === 1 ? '' : 's'}`;
      $('#mode-pill').textContent = health.mode === 'test file' ? 'TEST FILE MODE' : health.ready ? 'USB READY' : 'USB OFFLINE';
      $('#mode-pill').classList.toggle('ready', health.ready); $('#mode-pill').classList.toggle('offline', !health.ready);
      $('#queue-pill').textContent = `${queued} queued`; $('#nav-count').textContent = queued;
      $('#sidebar-dot').classList.add('online'); $('#sidebar-status').textContent = 'Connected'; $('#sidebar-subtitle').textContent = health.mode === 'test file' ? 'Test output active' : health.ready ? 'USB printer ready' : 'Printer offline';
      $('#settings-mode').textContent = health.mode; $('#settings-device').textContent = health.mode === 'test file' ? 'Local test output file' : health.device;
      renderJobs();
      $('#queue-current').disabled = !state.receipts.length || !health.ready;
      $('#queue-all').disabled = !state.receipts.length || !health.ready;
      $('#cut-only').disabled = !health.ready;
    } catch (error) {
      state.health = null;
      $('#printer-state').textContent = 'Offline';
      $('#printer-detail').textContent = 'Print server unavailable';
      $('#mode-pill').textContent = 'SERVER OFFLINE';
      $('#mode-pill').classList.remove('ready'); $('#mode-pill').classList.add('offline');
      $('#sidebar-dot').classList.remove('online'); $('#sidebar-status').textContent = 'Disconnected';
      $('#sidebar-subtitle').textContent = 'Check the local tunnel';
      $('#queue-current').disabled = true; $('#queue-all').disabled = true; $('#cut-only').disabled = true;
    }
  }

  $$('.nav-item, .link-button[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('.source-tabs button').forEach(button => button.addEventListener('click', () => setSource(button.dataset.source)));
  $('#receipt-file').addEventListener('change', event => { inspectReceipt(event.target.files[0]); event.target.value = ''; });
  $('#image-file').addEventListener('change', event => { inspectImage(event.target.files[0]); event.target.value = ''; });
  $('#make-text').addEventListener('click', makeText); $('#make-test').addEventListener('click', makeTest);
  $('#frame-select').addEventListener('change', event => { state.selected = Number(event.target.value); previewCurrent(); });
  $('#queue-current').addEventListener('click', () => addToQueue(false)); $('#queue-all').addEventListener('click', () => addToQueue(true));
  $('#cut-only').addEventListener('click', cutPaper);
  $('#refresh-jobs').addEventListener('click', refresh);
  $('#server-address').textContent = location.origin;
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 3000);
})();
