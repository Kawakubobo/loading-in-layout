import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function atomicJson(filename, value) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(filename), { recursive: true });
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, filename);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function validateEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Activity must be a JSON object.');
  for (const [key, max] of [['title', 160], ['summary', 4000]]) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) {
      throw new TypeError(`${key} must be a nonempty string of at most ${max} characters.`);
    }
  }
  if (!['tool', 'progress'].includes(input.kind)) throw new TypeError('kind must be tool or progress.');
  return { title: input.title.trim(), summary: input.summary.trim(), kind: input.kind };
}

export async function readActivity(projectRoot) {
  const feed = JSON.parse(await readFile(path.join(projectRoot, 'data/activity.json'), 'utf8'));
  if (typeof feed.session !== 'string' || !feed.session || !Array.isArray(feed.events)) throw new TypeError('Invalid activity feed.');
  let lastId = 0;
  for (const event of feed.events) {
    validateEvent(event);
    if (!Number.isSafeInteger(event.id) || event.id <= lastId || typeof event.timestamp !== 'string' || !Number.isFinite(Date.parse(event.timestamp))) {
      throw new TypeError('Activity events must have increasing IDs and valid timestamps.');
    }
    lastId = event.id;
  }
  return feed;
}

async function withStoreLock(projectRoot, action) {
  const directory = path.join(projectRoot, 'data');
  const lock = path.join(directory, '.activity.lock');
  await mkdir(directory, { recursive: true });
  const deadline = Date.now() + 5000;
  while (true) {
    try { await mkdir(lock); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error('The activity store is busy; retry the command.');
      await delay(20);
    }
  }
  try { return await action(); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

function emptyFeed() { return { session: randomUUID(), events: [] }; }

export async function ensureActivityStore(projectRoot) {
  return withStoreLock(projectRoot, async () => {
    try { return await readActivity(projectRoot); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const feed = emptyFeed();
      await atomicJson(path.join(projectRoot, 'data/activity.json'), feed);
      return feed;
    }
  });
}

export async function resetActivity(projectRoot) {
  return withStoreLock(projectRoot, async () => {
    const feed = emptyFeed();
    await atomicJson(path.join(projectRoot, 'data/activity.json'), feed);
    return feed;
  });
}

export async function appendActivity(projectRoot, input) {
  const event = validateEvent(input);
  return withStoreLock(projectRoot, async () => {
    let feed;
    try { feed = await readActivity(projectRoot); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      feed = emptyFeed();
    }
    const next = { id: (feed.events.at(-1)?.id ?? 0) + 1, ...event, timestamp: new Date().toISOString() };
    feed.events.push(next);
    await atomicJson(path.join(projectRoot, 'data/activity.json'), feed);
    return next;
  });
}
