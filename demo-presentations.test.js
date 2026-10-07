import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PRESENTATIONS, DEMO_PRESENTATIONS, presentationPlan } from './layout-engine.js';
import { appendActivity, readActivity, validateEvent } from './scripts/activity-store.mjs';

const photo = id => ({ id, image: { src: `/example/photo-${id}.jpg`, alt: `Photo ${id}`, width: 1500, height: 1000 } });
test('photo beats select the newest real images without mutating history', () => {
  const history = [photo(1), photo(2), photo(3)];
  const original = structuredClone(history);
  assert.deepEqual(presentationPlan('photo-stack', history).photos.map(p => p.event.id), [2, 3]);
  assert.deepEqual(presentationPlan('photo-hero', history).photos.map(p => p.event.id), [3]);
  assert.deepEqual(history, original);
  const [a, b] = presentationPlan('photo-stack', history).photos;
  assert.ok(a.x + a.width > b.x && a.y + a.height > b.y, 'photographs intentionally overlap');
});
test('empty and single-photo histories need no invented or duplicated imagery', () => {
  for (const mode of ['photo-stack', 'photo-hero']) {
    assert.equal(presentationPlan(mode, []).mode, 'staggered');
    assert.equal(presentationPlan(mode, [photo(1)]).photos.length, 1);
  }
  assert.equal(presentationPlan('ordinary'), null);
});
test('all image frames remain inside the artboard and text beats do not inherit photos', () => {
  for (const mode of DEMO_PRESENTATIONS) {
    const plan = presentationPlan(mode, [photo(1), photo(2)]);
    for (const frame of plan.photos) {
      assert.ok(frame.x >= 40 && frame.y >= 40);
      assert.ok(frame.x + frame.width <= 1880 && frame.y + frame.height <= 1040);
    }
    if (!mode.startsWith('photo-')) assert.equal(plan.photos.length, 0);
  }
});
test('every named presentation survives persistence and rejects unsupported names', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'demo-presets-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const event = { kind:'progress', title:'Actual result', summary:'Verified output.' };
  for (const presentation of PRESENTATIONS) await appendActivity(root, {...event, presentation});
  assert.deepEqual((await readActivity(root)).events.map(e => e.presentation), PRESENTATIONS);
  assert.throws(() => validateEvent({...event, presentation:'random-demo'}));
});
