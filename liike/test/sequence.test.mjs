import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SEQUENCE, orderedFrames, timelineFrames, moveFrame, playbackPosition } from '../src/sequence.ts';

const frames = ['a', 'b', 'c', 'd'].map(id => ({ id }));
const timeline = patch => timelineFrames(frames, { ...INITIAL_SEQUENCE, ...patch }).map(f => f.id);

test('sequence modes exclude drawings before building a seamless ping-pong loop', () => {
  assert.deepEqual(timeline({}), ['a', 'b', 'c', 'd']);
  assert.deepEqual(timeline({ order: 'Reverse', excluded: ['b'] }), ['d', 'c', 'a']);
  assert.deepEqual(timeline({ order: 'Ping-pong' }), ['a', 'b', 'c', 'd', 'c', 'b']);
  assert.deepEqual(timeline({ order: 'Ping-pong', excluded: ['b'] }), ['a', 'c', 'd', 'c']);
  assert.deepEqual(timeline({ order: 'Ping-pong', excluded: ['b', 'c'] }), ['a', 'd']);
  assert.deepEqual(timeline({ order: 'Ping-pong', excluded: ['b', 'c', 'd'] }), ['a']);
  assert.deepEqual(timeline({ order: 'Ping-pong', excluded: ['a', 'b', 'c', 'd'] }), []);
});

test('manual moves preserve unique drawings and reconcile replaced photos', () => {
  const ids = frames.map(f => f.id);
  assert.deepEqual(moveFrame(ids, 'a', 'd'), ['b', 'c', 'd', 'a']);
  assert.deepEqual(moveFrame(ids, 'd', 'b'), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveFrame(ids, 'missing', 'b'), ids);
  const settings = { ...INITIAL_SEQUENCE, order: 'Manual', manual: ['c', 'removed', 'a', 'c'], excluded: ['a'] };
  assert.deepEqual(orderedFrames(frames, settings).map(f => f.id), ['c', 'a', 'b', 'd']);
  assert.deepEqual(timelineFrames(frames, settings).map(f => f.id), ['c', 'b', 'd']);
  assert.deepEqual(frames.map(f => f.id), ids);
});

test('playback follows elapsed time, holds the last frame for one interval and wraps accurately', () => {
  assert.deepEqual(playbackPosition(0, 999, 12, 12, false), { index: 11, ended: false });
  assert.deepEqual(playbackPosition(0, 1000, 12, 12, false), { index: 11, ended: true });
  assert.deepEqual(playbackPosition(0, 1000, 12, 12, true), { index: 0, ended: false });
  assert.deepEqual(playbackPosition(4, 2500, 12, 12, true), { index: 10, ended: false });
  assert.deepEqual(playbackPosition(0, 1000, 1, 1, false), { index: 0, ended: true });
  assert.deepEqual(playbackPosition(0, 1000, 30, 0, true), { index: 0, ended: true });
});
