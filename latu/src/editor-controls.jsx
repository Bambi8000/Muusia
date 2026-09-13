import { useEffect, useRef } from "react";

const ICONS = {
  open: "M3 7h6l2 2h10l-3 11H3V7Zm0 0V4h6l2 3h8v2",
  save: "M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8",
  combine: "M4 4h10v10H4zM10 17v3h10V10h-3M17 3v5M14.5 5.5h5",
  undo: "M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6",
  redo: "m15 5 6 6-6 6m6-6H10a6 6 0 0 0-6 6",
  select: "m5 3 14 10-7 1-3 7L5 3Z",
  box: "M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5",
  pen: "m4 16-1 5 5-1L21 7l-4-4L4 16Zm10-10 4 4",
  measure: "m3 16 13-13 5 5L8 21l-5-5Zm8-8 3 3m-7 1 3 3m5-11 3 3",
  page: "M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6",
  chevron: "m8 10 4 4 4-4",
  settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  copy: "M9 9h12v12H9V9ZM5 15H3V3h12v2",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  plus: "M12 4v16M4 12h16",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6",
};

export function Icon({ name }) {
  return <svg className="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}

export function ActionMenu({ label, icon, compact = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const outside = (event) => { if (ref.current && !ref.current.contains(event.target)) ref.current.open = false; };
    const escape = (event) => {
      if (event.key !== "Escape" || !ref.current?.open) return;
      event.stopPropagation(); ref.current.open = false; ref.current.querySelector("summary").focus();
    };
    document.addEventListener("pointerdown", outside);
    ref.current.addEventListener("keydown", escape);
    const element = ref.current;
    return () => { document.removeEventListener("pointerdown", outside); element.removeEventListener("keydown", escape); };
  }, []);
  return <details className={`action-menu${compact ? " compact" : ""}`} ref={ref} onToggle={(event) => {
    if (!event.currentTarget.open) return;
    for (const menu of event.currentTarget.ownerDocument.querySelectorAll(".action-menu[open]")) {
      if (menu !== event.currentTarget) menu.open = false;
    }
  }}>
    <summary aria-label={label} title={label}>{icon && <Icon name={icon} />}{!compact && label}<Icon name="chevron" /></summary>
    <div className="menu-popover" onClick={(event) => {
      if (event.target.closest("button:not(:disabled)")) ref.current.open = false;
    }}>{children}</div>
  </details>;
}

export function SelectionInspector({ strokes, points, events, sections, locked, move, onMoveChange, actions }) {
  const hasSelection = strokes > 0 || events > 0;
  return <section className="selection-inspector" aria-label="Selection tools">
    <div className="inspector-heading"><h2>Selection</h2>{hasSelection && <button className="quiet" onClick={actions.clear}>Clear</button>}</div>
    {!hasSelection ? <>
      <p className="selection-empty">Select a path on the canvas or a file group below to move and edit it.</p>
      <p className="selection-tip">Shift-click adds to your selection. Use Box select for a larger area.</p>
      <button className="quiet paste-button" disabled={locked} onClick={actions.paste}><Icon name="copy" /> Paste strokes</button>
    </> : <>
      <div className="selection-summary">{points ? `${points} point${points === 1 ? "" : "s"}` : `${strokes} stroke${strokes === 1 ? "" : "s"}`}{events > 0 && ` · ${events} event${events === 1 ? "" : "s"}`}</div>
      {locked && <p className="selection-tip">Editing is paused during playback, measuring or an unsafe G-code mode.</p>}
      {strokes > 0 && <>
        <div className="inspector-label">Move {points ? "points" : "selection"}<span>mm</span></div>
        <div className="move-fields">{["x", "y"].map((axis) => <label key={axis}><b>{axis.toUpperCase()}</b><input aria-label={`Move ${axis.toUpperCase()}`} type="number" step="0.1" value={move[axis]} disabled={locked} onChange={(event) => onMoveChange({ ...move, [axis]: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); actions.move(); } }} /></label>)}</div>
        <button className="move-action" disabled={locked} onClick={() => actions.move()}>Apply move</button>
        <p className="selection-tip">+X right · +Y {actions.yUp ? "up" : "down"}</p>
        <div className="inspector-label">Stroke tools</div>
        <div className="selection-actions">
          <button disabled={locked} onClick={actions.scale}>Scale / rotate…</button>
          <button disabled={locked} onClick={actions.reverse}>Reverse</button>
          {strokes === 1 && <><button disabled={locked} onClick={actions.insert}>+ Point</button><button disabled={locked} onClick={actions.split}>Split stroke</button></>}
          {strokes >= 2 && <button disabled={locked} onClick={actions.optimize}>Optimize route</button>}
          {strokes === 2 && <button disabled={locked || points > 0 && points !== 2} onClick={actions.join}>Join endpoints</button>}
        </div>
        {strokes === 2 && <p className="selection-tip">Shift-click one endpoint on each path, then Join endpoints.</p>}
        <label className="inspector-label" htmlFor="selection-pen">Move strokes to pen</label>
        <select id="selection-pen" aria-label="Move selected strokes to pen" value="" disabled={locked} onChange={(event) => { if (event.target.value !== "") actions.pen(event.target.value); }}><option value="">Choose pen…</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.penIndex}: {section.name}</option>)}</select>
      </>}
      <div className="selection-clipboard">
        {strokes > 0 && <button className="quiet" onClick={actions.copy}><Icon name="copy" /> Copy</button>}
        <button className="quiet" disabled={locked} onClick={actions.paste}>Paste</button>
        <button className="danger quiet" disabled={locked || points > 1} onClick={actions.delete}><Icon name="trash" /> Delete</button>
      </div>
    </>}
  </section>;
}
