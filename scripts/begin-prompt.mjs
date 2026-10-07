import { copyFile, mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { atomicJson, resetActivity, readActivity } from './activity-store.mjs';

export const snapshotFiles = ['index.html', 'styles.css', 'app.js', 'layout-engine.js'];

export async function beginPrompt(projectRoot, { preserveActivity = false } = {}) {
  const snapshotId = randomUUID();
  const snapshots = path.join(projectRoot, 'snapshots');
  const staging = path.join(snapshots, `.staging-${snapshotId}`);
  const reference = path.join(snapshots, 'reference');
  const backup = path.join(snapshots, `.backup-${snapshotId}`);
  const manifestPath = path.join(projectRoot, 'data/reference.json');
  let backedUp = false;
  let installed = false;
  let manifestWritten = false;
  let committed = false;
  let previousManifest;
  await mkdir(staging, { recursive: true });
  try {
    try { previousManifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const copies = await Promise.allSettled(snapshotFiles.map(file => copyFile(path.join(projectRoot, file), path.join(staging, file))));
    const failed = copies.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    try { await rename(reference, backup); backedUp = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(staging, reference);
    installed = true;
    const manifest = { snapshotId, updatedAt: new Date().toISOString() };
    await atomicJson(manifestPath, manifest);
    manifestWritten = true;
    const feed = preserveActivity ? await readActivity(projectRoot) : await resetActivity(projectRoot);
    committed = true;
    return { ...manifest, session: feed.session };
  } catch (error) {
    if (installed) await rm(reference, { recursive: true, force: true });
    if (backedUp) await rename(backup, reference);
    if (manifestWritten) {
      if (previousManifest) await atomicJson(manifestPath, previousManifest);
      else await rm(manifestPath, { force: true });
    }
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (committed) await rm(backup, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = await beginPrompt(projectRoot, { preserveActivity: process.argv.includes('--preserve-activity') });
    console.log(`Reference refreshed: ${result.snapshotId}`);
    console.log(`Activity session: ${result.session}`);
  } catch (error) {
    console.error(`Unable to begin prompt: ${error.message}`);
    process.exitCode = 1;
  }
}
