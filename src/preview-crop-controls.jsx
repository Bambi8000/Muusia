import React from "react";
import { TEST_PAPERS } from "./preview-crop.js";

export default function PreviewCropControls({ active, rect, onChange, onDownload, hasPaths, gcodeEnabled, error, T, mono }) {
  const input = { background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, padding: "4px 6px", fontSize: 11, fontFamily: mono, minWidth: 0 };
  const button = enabled => ({ ...input, cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.45 });
  return <div style={{ marginTop: 10 }}>
    <button type="button" aria-pressed={active} onClick={() => onChange({ active: !active })}
      title="Select an A4 or A3 sample of the full drawing, without scaling"
      style={{ ...button(true), background: active ? T.accent : T.panel2, color: active ? "#0D1117" : T.text }}>
      Test crop {active ? "· 1:1" : ""}
    </button>
    {active && <div style={{ paddingTop: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        Paper
        <select aria-label="Test paper" value={rect.id} onChange={e => onChange({ paper: e.target.value })} style={{ ...input, flex: 1 }}>
          {TEST_PAPERS.map(p => <option key={p.id} value={p.id}>{p.label} · {p.w} × {p.h} mm</option>)}
        </select>
      </label>
      <div style={{ display: "flex", gap: 12, marginTop: 7 }}>
        {["x", "y"].map(key => <label key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, flex: 1 }}>
          {key.toUpperCase()} mm
          <input aria-label={`Test crop ${key.toUpperCase()} mm`} type="number" min={0} step={0.1} value={Math.round(rect[key] * 10) / 10}
            onChange={e => onChange({ [key]: Number(e.target.value) })} style={{ ...input, width: 70, flex: 1 }} />
        </label>)}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginTop: 7 }}>
        Margin mm
        <input aria-label="Test crop margin mm" type="number" min={0} max={rect.maxMargin} step={0.5} value={rect.margin}
          onChange={e => onChange({ margin: Number(e.target.value) })} style={{ ...input, width: 65 }} />
        <span style={{ color: T.dim, fontSize: 10 }}>on all edges</span>
      </label>
      <div style={{ fontSize: 10, color: T.text, marginTop: 7 }}>
        Drawing area {(rect.w - 2 * rect.margin).toFixed(1)} × {(rect.h - 2 * rect.margin).toFixed(1)} mm · 1:1
      </div>
      <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5, margin: "7px 0" }}>
        {rect.fits ? "Drag the paper frame or click the area to sample. The inner frame is the drawing area. Exports leave the margin blank and keep original millimetres." : "This paper is larger than the drawing canvas. Choose a smaller paper or a larger canvas."}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["svg", "dxf", "gcode"].map(kind => {
          const enabled = rect.fits && hasPaths && (kind !== "gcode" || gcodeEnabled);
          return <button type="button" key={kind} disabled={!enabled} onClick={() => onDownload(kind)} style={button(enabled)}
            title={kind === "gcode" && !gcodeEnabled ? "External SVG profile: use SVG test 1:1 in your plotter software" : "Download the selected sample at its original size"}>
            {kind === "gcode" ? "G-code" : kind.toUpperCase()} test 1:1
          </button>;
        })}
      </div>
      {error && <div role="alert" style={{ color: T.terra, fontSize: 11, marginTop: 7 }}>{error}</div>}
    </div>}
  </div>;
}
