import { NODE_RECENCY } from './defs/node-recency-data.js';

// Both rows are [node key, definition, ...]. Unknown/custom nodes remain
// discoverable after the dated built-ins; absence is never today's date.
export function compareNodeRecency(a, b, history = NODE_RECENCY) {
  return (history[b[0]]?.order || 0) - (history[a[0]]?.order || 0)
    || a[1].name.localeCompare(b[1].name) || a[0].localeCompare(b[0]);
}
export function nodeRecencyLabel(key, history = NODE_RECENCY) {
  return history[key]?.date ? 'Updated ' + history[key].date : 'Update date unavailable';
}
