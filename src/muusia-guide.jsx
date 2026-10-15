import React, { useLayoutEffect, useMemo, useState } from "react";
import { GUIDE_TOPICS, describeNode, inspectPatch, preparePlot, searchGuide } from "./muusia-guide.js";

const fmt = value => typeof value === "number" ? String(Math.round(value * 100) / 100) : Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? value ? "On" : "Off" : String(value ?? "—");
export default function MuusiaGuide({ level, node, defs, catalog, results, pvals, canvas, ps, sampleNode, samplePS, crop, profile, directionNode, directionOutputs, routeOpt, preserveDir, cropControls, passControls, toolbarRef, onClose, onSelect, onAdd, onSample, onMachine, onHelp, T, mono, disp }) {
  const [tab, setTab] = useState("node"), [query, setQuery] = useState(""), [topicId, setTopicId] = useState(null);
  const [top, setTop] = useState(92);
  useLayoutEffect(() => {
    const update = () => setTop((toolbarRef.current?.getBoundingClientRect().bottom || 80) + 12);
    update();
    const observer = new ResizeObserver(update);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [toolbarRef]);
  const description = useMemo(() => describeNode(node, level, defs, catalog, results, pvals), [node, level, defs, catalog, results, pvals]);
  const issues = useMemo(() => inspectPatch(level, defs, results, node?.id), [level, defs, results, node?.id]);
  const plot = useMemo(() => preparePlot({ ps, samplePS, canvas, crop, profile, directionOutputs }), [ps, samplePS, canvas, crop, profile, directionOutputs]);
  const matches = useMemo(() => searchGuide(query, defs, catalog), [query, defs, catalog]);
  const topic = GUIDE_TOPICS.find(t => t.id === topicId);
  const button = { background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 5, color: T.text, padding: "6px 9px", fontFamily: mono, fontSize: 11, cursor: "pointer" };
  const card = { border: `1px solid ${T.line}`, background: T.panel2, borderRadius: 7, padding: 12, marginBottom: 10 };
  const small = { color: T.dim, fontSize: 11, lineHeight: 1.6, overflowWrap: "anywhere" };
  const heading = { fontFamily: disp, fontSize: 13, fontWeight: 700, margin: "0 0 7px", color: T.text };
  const peerButton = (id, label) => id == null ? <span>{label}</span> : <button style={{ ...button, padding: "2px 5px", color: T.accent }} onClick={() => onSelect(id)}>{label}</button>;
  const issueCards = (items, select) => items.map(item => <div key={item.id} style={{ ...card, borderColor: T.terra + "66" }}>
    <h3 style={{ ...heading, color: T.terra }}>{item.title}</h3><div style={small}>{item.text}</div>
    {select && item.nodeId != null && <div style={{ marginTop: 7 }}>{peerButton(item.nodeId, "Show node")}</div>}
  </div>);
  return <aside aria-label="Muusia Guide" onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); onClose(); } }} style={{ position: "fixed", zIndex: 95, top, bottom: 12, right: 12, width: "clamp(340px, 34vw, 420px)", maxWidth: "calc(100vw - 24px)", display: "flex", flexDirection: "column", overflow: "hidden", background: T.panel, border: `1px solid ${T.accent}77`, borderRadius: 10, boxShadow: "0 12px 45px #0008", fontFamily: mono }}>
    <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><h2 style={{ ...heading, flex: 1, margin: 0, fontSize: 17 }}>Muusia Guide</h2><button style={button} aria-label="Close Muusia Guide" onClick={onClose}>×</button></div>
      <div style={{ ...small, margin: "4px 0 10px" }}>Help for your current patch. Select a node to follow its settings and wires.</div>
      <input aria-label="Search Muusia Guide" value={query} onChange={e => { setQuery(e.target.value); setTopicId(null); }} placeholder="Find a node or a guide…" style={{ width: "100%", padding: "8px 10px", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 5, color: T.text, fontFamily: mono, fontSize: 12 }} />
      <div role="tablist" aria-label="Guide sections" style={{ display: "flex", gap: 5, marginTop: 10 }}>
        {[["node", "Selected node"], ["patch", "Check patch"], ["plot", "Prepare a plot"]].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id && !query && !topic} aria-controls="muusia-guide-panel" id={`muusia-guide-tab-${id}`} style={{ ...button, flex: 1, padding: "7px 3px", background: tab === id ? T.accent + "22" : T.panel2, borderColor: tab === id ? T.accent : T.line }} onClick={() => { setTab(id); setQuery(""); setTopicId(null); }}>{label}</button>)}
      </div>
    </div>
    <div id="muusia-guide-panel" role={!query && !topic ? "tabpanel" : "region"} aria-labelledby={!query && !topic ? `muusia-guide-tab-${tab}` : undefined} aria-label={query ? "Guide search results" : topic ? topic.title : undefined} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}>
      {query && <>
        <h3 style={heading}>Muusia matches</h3>
        {!matches.length && <div style={small}>No Muusia matches. Try a node name, “test crop”, “pen layers” or “ruudukko”.</div>}
        {matches.map(match => <div key={`${match.kind}-${match.id}`} style={card}><h3 style={heading}>{match.title}</h3>
          <div style={{ ...small, marginBottom: 8 }}>{match.kind === "topic" ? match.steps[0] : (catalog[match.id]?.t || defs[match.id]?.desc || "Node reference").slice(0, 190)}</div>
          {match.kind === "topic" ? <button style={button} onClick={() => { setQuery(""); setTopicId(match.id); }}>Read guide</button> : <>
            {level.nodes.some(n => n.type === match.id) && <button style={{ ...button, marginRight: 6 }} onClick={() => { onSelect(level.nodes.find(n => n.type === match.id).id); setQuery(""); setTab("node"); }}>Show in patch</button>}
            <button style={button} onClick={() => { onAdd(match.id); setQuery(""); setTab("node"); }}>Add {match.title}</button>
          </>}
        </div>)}
      </>}
      {!query && topic && <div style={card}><h3 style={heading}>{topic.title}</h3><ol style={{ ...small, margin: 0, paddingLeft: 20 }}>{topic.steps.map((step, i) => <li key={i} style={{ marginBottom: 9 }}>{step}</li>)}</ol></div>}
      {!query && !topic && tab === "node" && <>
        {!description ? <div style={card}><h3 style={heading}>Select a node in your patch</h3><div style={small}>Its description, current settings and connections will appear here.</div></div> : <>
          <div style={card}><div style={{ ...small, color: T.accent }}>{description.category}</div><h3 style={{ ...heading, marginTop: 3 }}>{description.name}</h3><div style={{ ...small, color: T.text }}>{description.description}</div></div>
          {description.lesson && <details style={card}><summary style={{ ...heading, cursor: "pointer" }}>Guided example</summary><div style={small}>{description.lesson.useWhen}</div><ol style={{ ...small, paddingLeft: 20 }}>{description.lesson.recipe.map((step, i) => <li key={i} style={{ marginBottom: 7 }}>{step}</li>)}</ol></details>}
          <div style={card}><h3 style={heading}>Inputs</h3>{!description.inputs.length && <div style={small}>This node has no data inputs.</div>}
            {description.inputs.map((input, i) => <div key={i} style={{ ...small, marginBottom: 6 }}><strong style={{ color: T.text }}>{input.label}</strong> · {input.type}<br />{peerButton(input.peerId, input.connection)}</div>)}
            <h3 style={{ ...heading, marginTop: 12 }}>Outputs</h3>{description.outputs.map((output, i) => <div key={i} style={{ ...small, marginBottom: 7 }}><strong style={{ color: T.text }}>{output.label}</strong> · {output.type}{output.count != null ? ` · ${output.count} paths` : output.value != null ? ` · ${fmt(output.value)}` : ""}
              {output.connections.map((c, j) => <div key={j}>{peerButton(c.peerId, c.name)} → {c.target}</div>)}</div>)}
          </div>
          {!!description.parameters.length && <details style={card}><summary style={{ ...heading, cursor: "pointer" }}>Current settings · {description.parameters.filter(p => p.active || p.wired).length}</summary>
            {description.parameters.filter(p => p.active || p.wired).map(p => <div key={p.key} style={{ ...small, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}><strong style={{ color: T.text }}>{p.label}</strong>: {fmt(p.value)}
              {p.wired && <div>Controlled by {peerButton(p.peerId, p.source)}{!p.validWire && <span style={{ color: T.terra }}> · no finite number; stored value is used</span>}</div>}
              {!p.active && <div>Setting for another mode</div>}
              {p.boolean && <div>Below 0.5: Off · 0.5 or above: On{p.wired ? " · edit the source node" : " · edit on the node card"}</div>}
              {p.numeric && <div>Range {fmt(p.min)}…{fmt(p.max)}{p.wired ? " · edit the source node" : " · edit on the node card"}</div>}
            </div>)}
          </details>}
          <div style={small}>Descriptions come from Muusia's node reference. Settings and connections follow the live patch.</div>
        </>}
      </>}
      {!query && !topic && tab === "patch" && <>
        <div style={card}><h3 style={heading}>Current level · {level.nodes.length} nodes · {level.edges.length} wires</h3><div style={small}>Checks data and parameter wires in the level you are editing. Open a group to check its internal patch.</div></div>
        {issueCards(issues, true)}
        {!issues.length && <div style={card}><h3 style={heading}>No structural issues found here</h3><div style={small}>Wire endpoints and types match, and no feedback loop was found. Free inputs may be optional; they are shown in Selected node.</div></div>}
        <div style={card}><h3 style={heading}>Follow the drawing</h3><div style={small}>Choose a node below, then follow its input connections in Selected node. A modifier's effect is easiest to see by comparing its output with the node feeding it.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>{level.nodes.map(n => <button key={n.id} style={{ ...button, color: n.id === node?.id ? T.accent : T.text }} onClick={() => { onSelect(n.id); setTab("node"); }}>{defs[n.type]?.name || n.type} #{n.id}</button>)}</div>
        </div>
      </>}
      {!query && !topic && tab === "plot" && <>
        <div style={card}><h3 style={heading}>{plot.passes ? "Direction pass ZIP" : "Drawing"} · {plot.sample ? "Test crop · 1:1" : "Full artwork"} · {fmt(plot.paper.W)} × {fmt(plot.paper.H)} mm</h3><div style={small}>Full export: {node ? `${defs[node.type]?.name || node.type} #${node.id}` : "select a node"}
          {plot.passes && directionNode && <div>Pass ZIP source: {defs[directionNode.type]?.name || directionNode.type} #{directionNode.id} · all directions</div>}
          {crop.active && <div>Test crop source: {sampleNode ? `${defs[sampleNode.type]?.name || sampleNode.type} #${sampleNode.id}` : "select a node"}{sampleNode?.id !== node?.id ? " · locked Focus watch" : ""}</div>}
          <div>{plot.info.paths} paths · {plot.info.points} points · {plot.info.pens.length} pen layers</div>
          {plot.info.bounds && <div>Paper XY: X {fmt(plot.info.bounds.minX)}…{fmt(plot.info.bounds.maxX)}, Y {fmt(plot.info.bounds.minY)}…{fmt(plot.info.bounds.maxY)} mm</div>}
          {plot.sample && <div>Blank margin: {fmt(crop.margin)} mm on every edge</div>}
        </div></div>
        {issueCards(plot.issues, false)}
        <div style={card}><h3 style={heading}>{profile.name || "Machine profile"}</h3><div style={small}>
          <div>{plot.gcode ? "G-code workflow" : "External SVG workflow"} · {plot.knownArea ? `${fmt(profile.workW)} × ${fmt(profile.workH)} mm work area` : "work area is not set"}</div>
          {plot.gcode ? <><div>Origin X {fmt(profile.originX)} · Y {fmt(profile.originY)} mm</div><div>Flip Y: {profile.flipY ? "On · machine Y up" : "Off · drawing Y down"}</div>{plot.fit === true && <div style={{ color: T.value }}>Drawn XY geometry fits this work area.</div>}<div>This comparison covers path coordinates. Review the generated start/end and maintenance moves separately.</div></> : <div>Export SVG and choose placement and pen height in your plotter's own program.</div>}
          <div>Optimize route: {routeOpt ? "On" : "Off"} · Preserve direction: {preserveDir ? "On" : "Off"}</div>
        </div><button style={{ ...button, marginTop: 8 }} onClick={onMachine}>Open Machine Setup</button></div>
        {plot.passes && <div style={card}><h3 style={heading}>Manual direction passes</h3><div style={small}>{plot.sample ? "Sample" : "Full artwork"}: Horizontal {plot.passes[0]} · Vertical {plot.passes[1]} · Other {plot.passes[2]}. Run Horizontal, raise and turn the tool 90°, then run Vertical. Use the pass ZIP to keep the directions separate.</div>
          {plot.sample && <div style={{ ...small, marginTop: 8 }}>The individual .gcode buttons and G-code passes .zip export the full artwork. Test crop passes 1:1 .zip exports this sample.</div>}
          {passControls}</div>}
        <div style={card}><h3 style={heading}>Prepare a sample</h3><div style={small}>Keep original millimetres. Choose paper, move the frame, leave a blank border and export at actual size / 100%.</div>
          {!crop.active && plot.suggestedPaper && <button style={{ ...button, marginTop: 8 }} onClick={() => onSample(plot.suggestedPaper)}>Enable {plot.suggestedPaper.startsWith("a4") ? "A4" : "A3"} sample</button>}
          {!crop.active && !plot.suggestedPaper && <div style={{ ...small, marginTop: 7 }}>A4 / A3 sample paper is larger than this canvas. Use the full drawing for a small test, or choose a larger artwork canvas.</div>}
          {cropControls}
        </div>
      </>}
      {!query && <div style={{ marginTop: 16 }}><h3 style={heading}>Step-by-step guides</h3><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{GUIDE_TOPICS.map(t => <button key={t.id} style={button} onClick={() => setTopicId(t.id)}>{t.title}</button>)}</div></div>}
    </div>
    <div style={{ padding: "9px 14px", borderTop: `1px solid ${T.line}`, flexShrink: 0 }}><button style={button} onClick={onHelp}>Help & examples</button><span style={{ ...small, marginLeft: 10 }}>Follows your live patch</span></div>
  </aside>;
}
