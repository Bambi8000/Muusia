import { useMemo, useState } from "react";

const EVENTS = [
  ["pitstop", "Pitstop"], ["pen-change", "Pen change"], ["pen-up", "Pen up"], ["pen-down", "Pen down"],
  ["dip", "Dip cycle"], ["maintenance", "Maintenance pause"], ["dose", "Ink dose"], ["air", "Air pulse"],
  ["rotation", "Brush rotation"], ["laser-on", "Laser on"], ["laser-off", "Laser off"], ["snippet", "Custom snippet"],
];

export default function EventsPalette({ profile, selectedCount, onClose, onInsert, onContinuous, onRemoveContinuous }) {
  const [kind, setKind] = useState("pitstop");
  const [wrap, setWrap] = useState("auto");
  const [params, setParams] = useState({ message: "service", penIndex: 1, penName: "Pen 1", value: 10, rate: 120, retract: .5, ms: 250, pin: "air_valve", variant: "macro", aim: false, aimAngle: 0, sweep: false, sweepTo: 45, snippet: profile.snippets?.[0]?.text || "", x: 0, y: 0 });
  const set = (key, value) => setParams((current) => ({ ...current, [key]: value }));
  const summary = useMemo(() => EVENTS.find((item) => item[0] === kind)?.[1], [kind]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="dialog event-dialog">
    <h2>Insert event</h2><p>At the selected program position · profile: {profile.name}</p>
    <div className="event-grid">
      <label>Event<select value={kind} onChange={(event) => setKind(event.target.value)}>{EVENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Pen-state wrap<select value={wrap} onChange={(event) => setWrap(event.target.value)}><option value="auto">Auto</option><option value="lift">Lift</option><option value="keep">Keep state</option></select></label>
    </div>
    {(kind === "pitstop" || kind === "maintenance") && <label>Message<input value={params.message} onChange={(event) => set("message", event.target.value)} /></label>}
    {kind === "pen-change" && <div className="field-row"><label>Pen index<input type="number" value={params.penIndex} onChange={(event) => set("penIndex", Number(event.target.value))} /></label><label>Pen name<input value={params.penName} onChange={(event) => set("penName", event.target.value)} /></label></div>}
    {kind === "dose" && <><div className="segmented"><button className={params.variant === "macro" ? "on" : ""} onClick={() => set("variant", "macro")}>Macro</button><button className={params.variant === "raw" ? "on" : ""} onClick={() => set("variant", "raw")}>Raw E</button></div><div className="field-row"><label>Dose µl<input type="number" value={params.value} onChange={(event) => set("value", Number(event.target.value))} /></label>{params.variant === "raw" && <><label>Rate<input type="number" value={params.rate} onChange={(event) => set("rate", Number(event.target.value))} /></label><label>Retract<input type="number" value={params.retract} onChange={(event) => set("retract", Number(event.target.value))} /></label></>}</div></>}
    {(kind === "air" || kind === "dip") && <><div className="field-row"><label>Duration ms<input type="number" value={params.ms} onChange={(event) => set("ms", Number(event.target.value))} /></label>{kind === "air" && <label>Variant<select value={params.variant} onChange={(event) => set("variant", event.target.value)}><option value="macro">Macro</option><option value="raw">Raw pin</option></select></label>}</div>{kind === "air" && <div className="air-options"><label className="check"><input type="checkbox" checked={params.aim} onChange={(event) => set("aim", event.target.checked)} /> Pre-aim nozzle</label>{params.aim && <input aria-label="Aim angle" type="number" value={params.aimAngle} onChange={(event) => set("aimAngle", Number(event.target.value))} />}<label className="check"><input type="checkbox" checked={params.sweep} onChange={(event) => set("sweep", event.target.checked)} /> Sweep during pulse</label>{params.sweep && <input aria-label="Sweep angle" type="number" value={params.sweepTo} onChange={(event) => set("sweepTo", Number(event.target.value))} />}</div>}</>}
    {kind === "rotation" && <div className="field-row"><label>Angle °<input type="number" value={params.value} onChange={(event) => set("value", Number(event.target.value))} /></label><label>Speed<input type="number" value={params.rate} onChange={(event) => set("rate", Number(event.target.value))} /></label></div>}
    {kind === "snippet" && <><label>Snippet<select value={params.snippet} onChange={(event) => set("snippet", event.target.value)}><option value="">Free text</option>{(profile.snippets || []).map((snippet) => <option key={snippet.name} value={snippet.text}>{snippet.name}</option>)}</select></label><label>G-code<textarea value={params.snippet} onChange={(event) => set("snippet", event.target.value)} placeholder="CUSTOM_MACRO X={X} Y={Y} PEN={PEN}" /></label><div className="field-row"><label>X<input type="number" value={params.x} onChange={(event) => set("x", Number(event.target.value))} /></label><label>Y<input type="number" value={params.y} onChange={(event) => set("y", Number(event.target.value))} /></label></div></>}
    <div className="continuous-box"><strong>Continuous ink feed</strong><span>{selectedCount ? `${selectedCount} selected strokes` : "Select strokes first"}</span><label>µl/mm<input type="number" min="0" step="0.01" value={params.feedRate ?? .1} onChange={(event) => set("feedRate", Number(event.target.value))} /></label><button disabled={!selectedCount} onClick={() => onContinuous(params.feedRate ?? .1)}>Apply</button><button disabled={!selectedCount} onClick={onRemoveContinuous}>Remove E</button></div>
    <div className="dialog-actions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => onInsert({ kind, wrap, params })}>Insert {summary}</button></div>
  </div></div>;
}
