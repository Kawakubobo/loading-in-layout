import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendActivity } from './activity-store.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const event = await appendActivity(projectRoot, JSON.parse(input));
  console.log(`Published activity ${event.id}: ${event.title}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
