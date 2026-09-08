import { reorderSection } from "./model.js";

export default function Outline({ doc, selectedLine, selectedStrokeIds, onSelectLine, onSelectGroup, onReorder }) {
  return <aside className="outline">
    {!!doc.groups?.length && <>
      <div className="rail-title">FILE GROUPS</div>
      <div className="group-list">{doc.groups.map((group) => {
        const selected = group.strokeIds.length > 0 && group.strokeIds.every((id) => selectedStrokeIds.includes(id));
        const pens = new Set(group.strokeIds.map((id) => doc.strokes[id]?.penIndex).filter((value) => value != null));
        return <button key={group.id} className={`group-row${selected ? " active" : ""}`} onClick={(event) => onSelectGroup(group.strokeIds, event.shiftKey)} title="Select and move this imported file as one group"><span>▣</span><strong>{group.name}</strong><small>{group.strokeIds.length} strokes · {pens.size} pens</small></button>;
      })}</div>
    </>}
    <div className="rail-title">PROGRAM</div>
    {doc.sections.map((section) => {
      const items = [
        ...section.strokeIds.map((id) => ({ type: "stroke", value: doc.strokes[id], line: doc.strokes[id].lineStart })),
        ...section.eventIds.map((id) => ({ type: "event", value: doc.events[id], line: doc.events[id].lineStart })),
      ].sort((a, b) => a.line - b.line);
      return <details key={section.id} open>
        <summary><span className="pen-dot" style={{ background: doc.strokes.find((stroke) => stroke.sectionId === section.id)?.color }} />{section.name}<small>{section.strokeIds.length}</small></summary>
        {items.map((item) => <button key={`${item.type}-${item.value.id}`} draggable={item.type === "stroke"} data-stroke={item.type === "stroke" ? item.value.id : undefined} className={(item.type === "stroke" ? selectedStrokeIds.includes(item.value.id) : selectedLine != null && selectedLine >= (item.value.lineStart ?? item.line) && selectedLine <= (item.value.lineEnd ?? item.line)) ? "active" : ""} onClick={(event) => onSelectLine(item.line, { additive: event.shiftKey })}
          onDragStart={(event) => item.type === "stroke" && event.dataTransfer.setData("application/x-latu-stroke", String(item.value.id))}
          onDragOver={(event) => { if (item.type === "stroke") event.preventDefault(); }}
          onDrop={(event) => {
            if (item.type !== "stroke") return; event.preventDefault();
            const dragged = Number(event.dataTransfer.getData("application/x-latu-stroke"));
            const order = [...section.strokeIds]; const from = order.indexOf(dragged), to = order.indexOf(item.value.id);
            if (from < 0 || to < 0 || from === to) return;
            order.splice(from, 1); order.splice(to, 0, dragged); onReorder(reorderSection(doc, section.id, order));
          }}>
          <span>{item.type === "stroke" ? "⌁" : "◇"}</span>
          {item.type === "stroke" ? `Stroke ${item.value.id + 1}` : item.value.label}
          <small>L{item.line + 1}</small>
        </button>)}
      </details>;
    })}
  </aside>;
}
