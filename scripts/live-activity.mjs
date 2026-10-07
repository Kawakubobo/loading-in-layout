import { appendActivity } from './activity-store.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
let input = ''; for await (const chunk of process.stdin) input += chunk;
const event = JSON.parse(input);
if(event.status === 'running') event.expiresAt = new Date(Date.now() + 10*60*1000).toISOString();
const result = await appendActivity(root, {kind:'tool', ...event});
console.log(`Live ${result.status}: ${result.title} (${result.id})`);
