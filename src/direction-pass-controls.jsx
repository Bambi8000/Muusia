import React from "react";
import { DIRECTION_PASSES } from "./direction-pass-export.js";

export default function DirectionPassControls({ outputs, onDownload, gcodeEnabled, crop, error, T, mono }) {
  const counts = DIRECTION_PASSES.map(pass => outputs?.[pass.port]?.paths?.length || 0);
  const any = counts.some(Boolean);
  const button = enabled => ({ padding: "5px 7px", background: T.panel2, color: T.text, border: `1px solid ${T.line}`, borderRadius: 3, fontFamily: mono, fontSize: 10, cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : .45 });
  return <div data-direction-passes="true" style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
    <div style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>Direction passes</div>
    <div style={{ fontSize: 10, color: T.dim, margin: "5px 0" }}>Horizontal {counts[0]} · Vertical {counts[1]} · Other {counts[2]} paths</div>
    <div style={{ fontSize: 10, color: T.text, lineHeight: 1.5, marginBottom: 7 }}>
      Run Horizontal, turn the tool manually 90°, then run Vertical. Keep the paper and origin fixed.
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {DIRECTION_PASSES.filter((_, i) => i < 2 || counts[i]).map(pass => {
        const enabled = gcodeEnabled && counts[pass.port - 1] > 0;
        return <button key={pass.id} disabled={!enabled} onClick={() => onDownload(pass.id, false)} style={button(enabled)}>{pass.label} .gcode</button>;
      })}
      <button disabled={!gcodeEnabled || !any} onClick={() => onDownload("all", false)} style={button(gcodeEnabled && any)}>G-code passes .zip</button>
      {crop.active && <button disabled={!gcodeEnabled || !any || !crop.fits} onClick={() => onDownload("all", true)} style={button(gcodeEnabled && any && crop.fits)}>Test crop passes 1:1 .zip</button>}
    </div>
    {counts[2] > 0 && <div style={{ color: T.terra, fontSize: 10, lineHeight: 1.5, marginTop: 7 }}>Other directions are retained in a separate file. Review their tool orientation.</div>}
    {!gcodeEnabled && <div style={{ color: T.dim, fontSize: 10, marginTop: 7 }}>External SVG profile: choose Horizontal or Vertical in Preview, then use EXPORT SVG.</div>}
    {error && <div role="alert" style={{ color: T.terra, fontSize: 11, marginTop: 7 }}>{error}</div>}
  </div>;
}
