import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appendActivity, ensureActivityStore, readActivity, resetActivity } from './scripts/activity-store.mjs';
import { beginPrompt, snapshotFiles } from './scripts/begin-prompt.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'layout-activity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const event = title => ({ title, summary: 'A visible progress update about the requested work.', kind: 'tool' });

test('concurrent publications persist every event in a replayable ordered session', async t => {
  const root = await fixture(t);
  const initial = await ensureActivityStore(root);
  await Promise.all(Array.from({ length: 8 }, (_, i) => appendActivity(root, event(`Tool ${i}`))));
  const replay = await readActivity(root);
  assert.equal(replay.session, initial.session);
  assert.deepEqual(replay.events.map(item => item.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(replay.events.map(item => item.title)).size, 8);
  assert.ok(replay.events.every(item => Number.isFinite(Date.parse(item.timestamp))));
  assert.deepEqual(await ensureActivityStore(root), replay);
});

test('invalid publications do not change persisted activity', async t => {
  const root = await fixture(t);
  await appendActivity(root, event('Read files'));
  const before = await readActivity(root);
  for (const invalid of [null, {}, { ...event(''), title: ' ' }, { ...event('Test'), kind: 'random' }, { ...event('Test'), summary: 4 }]) {
    await assert.rejects(appendActivity(root, invalid), TypeError);
  }
  assert.deepEqual(await readActivity(root), before);
});

test('starting a session clears replay and restarts event numbering', async t => {
  const root = await fixture(t);
  await appendActivity(root, event('Before'));
  const previous = await readActivity(root);
  const fresh = await resetActivity(root);
  assert.notEqual(fresh.session, previous.session);
  assert.deepEqual(fresh.events, []);
  assert.equal((await appendActivity(root, event('After'))).id, 1);
});

test('reference files remain frozen until the next prompt refresh', async t => {
  const root = await fixture(t);
  for (const file of snapshotFiles) await writeFile(path.join(root, file), `first ${file}`);
  await appendActivity(root, event('Old prompt'));
  const first = await beginPrompt(root);
  await writeFile(path.join(root, 'app.js'), 'second app.js');
  assert.equal(await readFile(path.join(root, 'snapshots/reference/app.js'), 'utf8'), 'first app.js');
  assert.deepEqual((await readActivity(root)).events, []);
  await appendActivity(root, event('New prompt'));
  const second = await beginPrompt(root);
  assert.notEqual(second.snapshotId, first.snapshotId);
  assert.notEqual(second.session, first.session);
  assert.equal(await readFile(path.join(root, 'snapshots/reference/app.js'), 'utf8'), 'second app.js');
  assert.equal(JSON.parse(await readFile(path.join(root, 'data/reference.json'), 'utf8')).snapshotId, second.snapshotId);
  assert.deepEqual((await readActivity(root)).events, []);
});

test('an incomplete source leaves the previous reference and session intact', async t => {
  const root = await fixture(t);
  for (const file of snapshotFiles) await writeFile(path.join(root, file), `first ${file}`);
  const first = await beginPrompt(root);
  await appendActivity(root, event('Kept update'));
  await rm(path.join(root, 'app.js'));
  await assert.rejects(beginPrompt(root), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(root, 'snapshots/reference/app.js'), 'utf8'), 'first app.js');
  assert.equal(JSON.parse(await readFile(path.join(root, 'data/reference.json'), 'utf8')).snapshotId, first.snapshotId);
  assert.equal((await readActivity(root)).events.length, 1);
});
