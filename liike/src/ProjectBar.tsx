import { useEffect, useRef, useState } from 'react';
import { saveProject, openProject } from './project-archive';
import type { RestoredProject } from './project-archive';
import { projectFilename } from './project';
import type { ProjectState } from './project';
import type { Photo } from './photos';
import { disposePhoto } from './photos';

type Props = { state: ProjectState; photos: Photo[]; disabled: boolean; saveIssue: string; setName: (name: string) => void; onBusy: (busy: boolean) => void; onLoad: (restored: RestoredProject) => void; loaded: boolean };
const sizeLabel = (bytes: number) => bytes < 1_000_000 ? `${Math.ceil(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
export default function ProjectBar({ state, photos, disabled, saveIssue, setName, onBusy, onLoad, loaded }: Props) {
  const input = useRef<HTMLInputElement>(null), active = useRef<AbortController | null>(null), owned = useRef('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [download, setDownload] = useState<{ key: string; url: string; size: number } | null>(null);
  const key = JSON.stringify([state, photos.map(p => [p.id, p.points, p.detection?.settingsKey])]);
  const current = download?.key === key ? download : null;
  useEffect(() => {
    if (owned.current) URL.revokeObjectURL(owned.current);
    owned.current = ''; setDownload(null);
  }, [key]);
  useEffect(() => () => { active.current?.abort(); active.current = null; if (owned.current) URL.revokeObjectURL(owned.current); }, []);
  function start() {
    if (active.current) return null;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); onBusy(true); setError(''); setMessage('');
    return controller;
  }
  function finish(controller: AbortController) {
    if (active.current !== controller) return;
    active.current = null; setBusy(false); onBusy(false);
  }
  function cancel() {
    active.current?.abort(); active.current = null;
    setBusy(false); onBusy(false); setMessage('Cancelled. Your current project is unchanged.');
  }
  async function save() {
    const controller = start(); if (!controller) return;
    try {
      const blob = await saveProject(state, photos, text => { if (active.current === controller) setMessage(text); }, controller.signal);
      if (active.current !== controller) return;
      if (owned.current) URL.revokeObjectURL(owned.current);
      const url = URL.createObjectURL(blob); owned.current = url;
      setDownload({ key, url, size: blob.size }); setMessage('Project file ready. Keep this file to continue later.');
      const link = document.createElement('a'); link.href = url; link.download = projectFilename(state.name);
      document.body.append(link); link.click(); link.remove();
    } catch (err) {
      if (active.current === controller) { setError(err instanceof Error ? err.message : 'Could not save this project.'); setMessage(''); }
    } finally { finish(controller); }
  }
  async function load(file: File) {
    const controller = start(); if (!controller) return;
    try {
      const restored = await openProject(file, text => { if (active.current === controller) setMessage(text); }, controller.signal);
      if (active.current !== controller) { restored.photos.forEach(disposePhoto); return; }
      onLoad(restored); setMessage('Project loaded. Photos, markers and settings restored. Build the sequence when ready.');
    } catch (err) {
      if (active.current === controller) { setError(`${err instanceof Error ? err.message : 'Could not open this project.'} Your current project is unchanged.`); setMessage(''); }
    } finally { finish(controller); }
  }
  return <section className="project-bar" aria-label="Project">
    <div className="project-controls">
      <label className="field project-name"><span>Project name</span><input maxLength={100} value={state.name} disabled={busy} onChange={e => setName(e.target.value)} placeholder="Untitled" /></label>
      <div className="project-buttons"><button className="secondary" disabled={disabled || busy || Boolean(saveIssue)} onClick={() => { void save(); }}>Save project ↓</button><button className="secondary" disabled={disabled || busy} onClick={() => input.current?.click()}>Load project ↑</button>{busy && <button className="secondary" onClick={cancel}>Cancel</button>}</div>
      <input className="sr-only" aria-label="Open Liike project" tabIndex={-1} type="file" accept=".liike,.zip,application/zip" ref={input} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void load(file); }} />
    </div>
    <p className="hint project-help">One file with your original photos, markers, adjustments and sequence. Save before closing or switching projects.</p>
    {saveIssue && <p className="notice">To save: {saveIssue}</p>}
    <div className="project-status" role="status" aria-live="polite">{busy ? message : current ? <><span>{message} {sizeLabel(current.size)}</span><a href={current.url} download={projectFilename(state.name)}>Download project ↓</a></> : <span>{message.startsWith('Project file ready') ? 'Project changed. Save again to keep the latest edits.' : message || (loaded ? 'Project restored. Build the sequence to render your saved look.' : '')}</span>}</div>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
