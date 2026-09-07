import { useRef, useState } from "react";
import { DEFAULT_PROFILE, normalizeProfile } from "./profile.js";

const NUMBER_FIELDS = [
  ["workW", "Work width"], ["workH", "Work height"], ["originX", "Origin X"], ["originY", "Origin Y"],
  ["servoUp", "Servo up"], ["servoDown", "Servo down"], ["penUp", "Bed pen up"], ["penDown", "Bed pen down"],
  ["zFeed", "Z feed"], ["zHop", "Z hop"], ["penDelayDown", "Settle down ms"], ["penDelayUp", "Settle up ms"],
  ["feedDraw", "Draw feed"], ["feedTravel", "Travel feed"], ["dipX", "Dip X"], ["dipY", "Dip Y"],
  ["dipZ", "Dip Z"], ["dipEvery", "Dip every mm"], ["dipDwell", "Dip dwell ms"], ["maintEvery", "Maintenance every mm"],
  ["maintX", "Park X"], ["maintY", "Park Y"], ["rotThresh", "Rotation threshold"], ["laserOffX", "Laser offset X"], ["laserOffY", "Laser offset Y"],
];

export default function ProfileManager({ profiles, activeId, onChange, onActivate, onClose, onExport }) {
  const [selectedId, setSelectedId] = useState(activeId);
  const inputRef = useRef(null);
  const index = Math.max(0, profiles.findIndex((item) => item.id === selectedId));
  const profile = profiles[index] || profiles[0];
  const update = (patch) => onChange(profiles.map((item, i) => i === index ? { ...item, ...patch } : item));
  const move = (delta) => { const next = [...profiles], target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(next); };
  const importJson = async (file) => {
    try {
      const data = JSON.parse(await file.text()); const incoming = Array.isArray(data) ? data : data.machines || (data.prof ? [data.prof] : []);
      if (incoming.length) {
        const normalized = incoming.map(normalizeProfile);
        const next = data.prof ? [...profiles.filter((item) => item.id !== normalized[0].id), normalized[0]] : normalized;
        onChange(next); setSelectedId(normalized[0].id);
      }
    } catch { /* Invalid imports leave profiles untouched. */ }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="dialog profile-dialog">
    <div className="profile-head"><div><h2>Machine profiles</h2><p>Templates and machine-state vocabulary</p></div><button onClick={onClose}>Close</button></div>
    <div className="profile-layout"><aside className="profile-list">{profiles.map((item) => <button key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => setSelectedId(item.id)}><span>{item.name}</span>{item.id === activeId && <small>ACTIVE</small>}</button>)}<button onClick={() => { const created = normalizeProfile({ ...DEFAULT_PROFILE, id: `profile-${Date.now()}`, name: "New profile" }); onChange([...profiles, created]); setSelectedId(created.id); }}>＋ New profile</button></aside>
      <section className="profile-form">
        <div className="profile-actions"><button onClick={() => { const copy = normalizeProfile({ ...profile, id: `profile-${Date.now()}`, name: `${profile.name} copy` }); onChange([...profiles, copy]); setSelectedId(copy.id); }}>Duplicate</button><button onClick={() => move(-1)}>↑</button><button onClick={() => move(1)}>↓</button><button disabled={profiles.length < 2} onClick={() => { const next = profiles.filter((_, i) => i !== index); onChange(next); setSelectedId(next[0].id); }}>Delete</button><button className="primary" onClick={() => onActivate(profile.id)}>Use profile</button></div>
        <label>Name<input value={profile.name} onChange={(event) => update({ name: event.target.value })} /></label><label>Notes<textarea value={profile.notes || ""} onChange={(event) => update({ notes: event.target.value })} /></label>
        <div className="profile-subhead">Core commands</div><div className="field-row"><label>Z mode<select value={profile.zMode} onChange={(event) => update({ zMode: event.target.value })}><option value="servo">Servo</option><option value="bed">Bed Z</option></select></label><label>Pause command<input value={profile.pauseCmd} onChange={(event) => update({ pauseCmd: event.target.value })} /></label><label>Servo name<input value={profile.servoName} onChange={(event) => update({ servoName: event.target.value })} /></label></div>
        <div className="profile-numbers">{NUMBER_FIELDS.map(([key, label]) => <label key={key}>{label}<input type="number" value={profile[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} /></label>)}</div>
        <div className="profile-checks">{[["flipY", "Flip Y"], ["zHopOn", "Z-hop"], ["rotOn", "Rotation"], ["dipOn", "Dip cycles"], ["maintOn", "Maintenance"], ["maintPark", "Maintenance park"], ["laserOn", "Laser"], ["canvasCheckOn", "Canvas check"]].map(([key, label]) => <label className="check" key={key}><input type="checkbox" checked={!!profile[key]} onChange={(event) => update({ [key]: event.target.checked })} />{label}</label>)}</div>
        <div className="profile-subhead">Templates</div><label>Rotation stepper<input value={profile.rotStepper} onChange={(event) => update({ rotStepper: event.target.value })} /></label><label>Maintenance message<input value={profile.maintMsg} onChange={(event) => update({ maintMsg: event.target.value })} /></label><label>Moonraker URL<input value={profile.moonrakerUrl} onChange={(event) => update({ moonrakerUrl: event.target.value })} /></label><label>Dose template<textarea value={profile.doseTemplate} onChange={(event) => update({ doseTemplate: event.target.value })} /></label><label>Air template<textarea value={profile.airTemplate} onChange={(event) => update({ airTemplate: event.target.value })} /></label><label>Laser on command<textarea value={profile.laserOnCmd} onChange={(event) => update({ laserOnCmd: event.target.value })} /></label><label>Laser off command<textarea value={profile.laserOffCmd} onChange={(event) => update({ laserOffCmd: event.target.value })} /></label><label>Start G-code<textarea value={profile.startG} onChange={(event) => update({ startG: event.target.value })} /></label><label>End G-code<textarea value={profile.endG} onChange={(event) => update({ endG: event.target.value })} /></label>
        <div className="profile-subhead">Snippet library</div><div className="snippet-list">{(profile.snippets || []).map((snippet, snippetIndex) => <div key={snippetIndex}><input aria-label="Snippet name" value={snippet.name} onChange={(event) => update({ snippets: profile.snippets.map((item, i) => i === snippetIndex ? { ...item, name: event.target.value } : item) })} /><textarea aria-label="Snippet G-code" value={snippet.text} onChange={(event) => update({ snippets: profile.snippets.map((item, i) => i === snippetIndex ? { ...item, text: event.target.value } : item) })} /><button onClick={() => update({ snippets: profile.snippets.filter((_, i) => i !== snippetIndex) })}>Delete</button></div>)}<button onClick={() => update({ snippets: [...(profile.snippets || []), { name: "New snippet", text: "CUSTOM_MACRO X={X} Y={Y} PEN={PEN}" }] })}>＋ Add snippet</button></div>
        <div className="profile-io"><button onClick={() => onExport(profile)}>Export selected</button><button onClick={() => onExport(null)}>Export all JSON</button><button onClick={() => inputRef.current.click()}>Import JSON</button><input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files[0] && importJson(event.target.files[0])} /></div>
      </section></div>
  </div></div>;
}
