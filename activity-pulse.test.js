import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('status beats queue in order, ignore stale replay, and cancel on reset', () => {
  const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const timers = new Map();
  let id = 0, overlay;
  const element = () => ({dataset: {}, setAttribute() {}, append() {}, replaceChildren() {}});
  const context = vm.createContext({
    document: {createElement: element}, artboard: {append(node) { overlay = node; }},
    titleCase: value => value, Date,
    setTimeout(fn) { timers.set(++id, fn); return id; },
    clearTimeout(key) { timers.delete(key); },
  });
  vm.runInContext(source.slice(source.indexOf('const activityPulse ='), source.indexOf('function resizeCanvas()')), context);
  const publish = (id, timestamp = new Date().toISOString()) => context.queueActivityPulse({id, title:'Ran Commands',summary:'Checked files.',timestamp});
  const tick = () => { const [key, fn] = timers.entries().next().value; timers.delete(key); fn(); };
  publish(1, '2000-01-01T00:00:00Z');
  assert.equal(timers.size, 0);
  publish(2); publish(3);
  assert.equal(overlay.dataset.eventId, '2');
  assert.equal(timers.size, 1);
  tick(); assert.equal(overlay.hidden, true);
  tick(); assert.equal(overlay.dataset.eventId, '3');
  assert.equal(overlay.hidden, false);
  context.clearActivityPulse();
  assert.equal(timers.size, 0);
  assert.equal(overlay.hidden, true);
  publish(4); assert.equal(overlay.dataset.eventId, '4');
});
