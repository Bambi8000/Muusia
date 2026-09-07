import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

const setFocusLines = StateEffect.define();
const focusLines = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setFocusLines)) continue;
      const decorations = [];
      if (effect.value.hover != null && effect.value.hover < transaction.state.doc.lines) {
        decorations.push(Decoration.line({ class: "cm-hover-line" }).range(transaction.state.doc.line(effect.value.hover + 1).from));
      }
      if (effect.value.selected != null && effect.value.selected < transaction.state.doc.lines) {
        decorations.push(Decoration.line({ class: "cm-selected-line" }).range(transaction.state.doc.line(effect.value.selected + 1).from));
      }
      if (effect.value.playback != null && effect.value.playback < transaction.state.doc.lines) {
        decorations.push(Decoration.line({ class: "cm-playback-line" }).range(transaction.state.doc.line(effect.value.playback + 1).from));
      }
      return Decoration.set(decorations, true);
    }
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function lineClasses(parsed) {
  return StateField.define({
    create(state) {
      return buildLineDecorations(state, parsed);
    },
    update(value, transaction) {
      return transaction.docChanged ? buildLineDecorations(transaction.state, null) : value.map(transaction.changes);
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

function buildLineDecorations(state, parsed) {
  const ranges = [];
  for (let number = 1; number <= state.doc.lines; number += 1) {
    const line = state.doc.line(number);
    const kind = parsed?.lines[number - 1]?.op.kind || classifyRaw(line.text);
    ranges.push(Decoration.line({ class: `cm-gcode-${kind}` }).range(line.from));
  }
  return Decoration.set(ranges, true);
}

function classifyRaw(text) {
  const value = text.trim().toUpperCase();
  if (!value) return "blank";
  if (value.startsWith(";")) return "comment";
  if (/^G0?0\b/.test(value) || /^G0?1\b/.test(value)) return "move";
  if (/^(SET_SERVO|PEN_UP|PEN_DOWN)\b/.test(value)) return "servo";
  if (/^(M0|M00|M1|M01|PAUSE)\b/.test(value)) return "pause";
  if (/^(G4|G04)\b/.test(value)) return "dwell";
  return "other";
}

export default function TextView({ value, parsed, hoveredLine, selectedLine, playbackLine, autoFollow, onHoverLine, onSelectLine, onChange }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const initialValue = useRef(value);
  const initialParsed = useRef(parsed);
  const applyingExternal = useRef(false);
  const callbacks = useRef({ onHoverLine, onSelectLine, onChange });
  callbacks.current = { onHoverLine, onSelectLine, onChange };

  useEffect(() => {
    const hoverHandler = EditorView.domEventHandlers({
      mousemove(event, view) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        callbacks.current.onHoverLine(pos == null ? null : view.state.doc.lineAt(pos).number - 1);
      },
      mouseleave() { callbacks.current.onHoverLine(null); },
      mousedown(event, view) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos != null) callbacks.current.onSelectLine(view.state.doc.lineAt(pos).number - 1);
      },
    });
    const state = EditorState.create({
      doc: initialValue.current,
      extensions: [
        basicSetup, history(), keymap.of([...defaultKeymap, ...historyKeymap]), focusLines,
        lineClasses(initialParsed.current), hoverHandler, EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternal.current) callbacks.current.onChange(update.state.doc.toString());
        }),
        EditorView.theme({
          "&": { height: "100%", background: "#161a20", color: "#cdd5df", fontSize: "12px" },
          ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.55" },
          ".cm-content": { caretColor: "#78a9ff", padding: "12px 0 40px" },
          ".cm-gutters": { background: "#11151a", color: "#596473", border: "none" },
          ".cm-activeLine, .cm-activeLineGutter": { background: "#202832" },
          ".cm-hover-line": { background: "rgba(86, 156, 214, .12)" },
          ".cm-selected-line": { background: "rgba(245, 158, 11, .17)", boxShadow: "inset 2px 0 #f59e0b" },
          ".cm-playback-line": { background: "rgba(52, 211, 153, .13)", boxShadow: "inset 2px 0 #34d399" },
          ".cm-gcode-comment, .cm-gcode-header": { color: "#6f8c79" },
          ".cm-gcode-move": { color: "#a9c7e8" },
          ".cm-gcode-servo, .cm-gcode-zmove": { color: "#d7a1ef" },
          ".cm-gcode-pause": { color: "#ffc66d", fontWeight: "600" },
          ".cm-gcode-dwell": { color: "#84b7ad" },
          ".cm-gcode-other": { textDecoration: "underline wavy rgba(234, 179, 8, .45)" },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value.replace(/\r\n?|\n/g, "\n")) return;
    applyingExternal.current = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    applyingExternal.current = false;
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setFocusLines.of({ hover: hoveredLine, selected: selectedLine, playback: playbackLine }) });
    const followLine = autoFollow && playbackLine != null ? playbackLine : selectedLine;
    if (followLine != null && followLine < view.state.doc.lines) {
      const line = view.state.doc.line(followLine + 1);
      view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
    }
  }, [hoveredLine, selectedLine, playbackLine, autoFollow]);

  return <div className="text-view" ref={hostRef} aria-label="G-code editor" />;
}
