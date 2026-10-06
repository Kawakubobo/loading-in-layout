import { randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendActivity } from './activity-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = randomInt(1, 2147483647);
let state = seed;
const random = () => ((state = Math.imul(1664525, state) + 1013904223 >>> 0) / 4294967296);
const integer = (max) => Math.floor(random() * max);
const sample = (count, max = 100) => Array.from({ length: count }, () => integer(max));
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const round = (value) => Number(value.toFixed(3));
const shuffle = (values) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = integer(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
const operations = [
  ['Shuffle a sequence', () => {
    const input = Array.from({ length: 12 }, (_, i) => i + 1);
    const output = shuffle(input);
    return `Shuffled twelve integers: ${output.join(', ')}. All twelve values remain present; only their order changed.`;
  }],
  ['Sort random numbers', () => {
    const values = sample(18); const sorted = [...values].sort((a, b) => a - b);
    return `Sorted an eighteen-number sample. The smallest value is ${sorted[0]} and the largest is ${sorted.at(-1)}. In ascending order: ${sorted.join(', ')}.`;
  }],
  ['Find prime numbers', () => {
    const limit = 60 + integer(80);
    const primes = Array.from({ length: limit - 1 }, (_, i) => i + 2).filter(n => {
      for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
      return true;
    });
    return `Checked integers from 2 through ${limit}. Found ${primes.length} primes: ${primes.join(', ')}. Each candidate was tested only up to its square root.`;
  }],
  ['Average a signal', () => {
    const values = sample(30, 1000).map(v => v / 10);
    const average = mean(values); const deviation = Math.sqrt(mean(values.map(v => (v - average) ** 2)));
    return `Measured thirty random samples. Mean: ${round(average)}. Population standard deviation: ${round(deviation)}. Minimum: ${Math.min(...values)}. Maximum: ${Math.max(...values)}.\n\nThe mean describes the sample’s central level; the deviation measures its spread. This longer result also exercises paragraph spacing beneath a tool title.`;
  }],
  ['Trace a random walk', () => {
    let x = 0; let y = 0; const points = [[x, y]];
    for (let i = 0; i < 24; i++) { const direction = integer(4); x += direction === 0 ? 1 : direction === 1 ? -1 : 0; y += direction === 2 ? 1 : direction === 3 ? -1 : 0; points.push([x, y]); }
    return `Took twenty-four unit steps. The walk finished at (${x}, ${y}), ${round(Math.hypot(x, y))} units from its starting point. It visited ${new Set(points.map(p => p.join(','))).size} distinct positions.`;
  }],
  ['Rotate coordinates', () => {
    const x = integer(100); const y = integer(100); const angle = integer(360); const r = angle * Math.PI / 180;
    return `Rotated (${x}, ${y}) by ${angle} degrees around the origin. The resulting point is (${round(x * Math.cos(r) - y * Math.sin(r))}, ${round(x * Math.sin(r) + y * Math.cos(r))}). Its distance from the origin remains ${round(Math.hypot(x, y))}.`;
  }],
  ['Snap positions to a grid', () => {
    const values = sample(8, 1920); const snapped = values.map(v => Math.round(v / 8) * 8);
    return `Snapped eight positions to an 8 px interval: ${values.map((v, i) => `${v} → ${snapped[i]}`).join('; ')}. The largest correction was ${Math.max(...values.map((v, i) => Math.abs(v - snapped[i])))} px.`;
  }],
  ['Count repeated values', () => {
    const values = sample(60, 6); const counts = Array.from({ length: 6 }, (_, i) => values.filter(v => v === i).length);
    return `Counted sixty random values across six bins. Frequencies: ${counts.map((n, i) => `${i}: ${n}`).join(' / ')}. The counts sum to ${counts.reduce((a, b) => a + b, 0)}.`;
  }],
  ['Blend two colors', () => {
    const a = sample(3, 256); const b = sample(3, 256); const t = random();
    const hex = values => '#' + values.map(v => v.toString(16).padStart(2, '0')).join('');
    return `Interpolated ${hex(a)} and ${hex(b)} at ${Math.round(t * 100)}%. The RGB result is ${hex(a.map((v, i) => Math.round(v + (b[i] - v) * t)))}. This test changes text content only.`;
  }],
  ['Roll two hundred dice', () => {
    const rolls = sample(200, 6).map(n => n + 1); const counts = Array.from({ length: 6 }, (_, i) => rolls.filter(v => v === i + 1).length);
    return `Rolled a simulated six-sided die two hundred times. Counts for faces one through six: ${counts.join(', ')}. The average roll was ${round(mean(rolls))}.`;
  }],
  ['Sample a sine wave', () => {
    const amplitude = 1 + integer(9); const values = Array.from({ length: 9 }, (_, i) => round(amplitude * Math.sin(i * Math.PI / 4)));
    return `Sampled one full sine-wave cycle with amplitude ${amplitude}. Nine equally spaced samples: ${values.join(', ')}.`;
  }],
  ['Build a Fibonacci sequence', () => {
    const count = 10 + integer(8); const values = [0, 1]; while (values.length < count) values.push(values.at(-1) + values.at(-2));
    return `Generated ${count} Fibonacci numbers: ${values.join(', ')}. Each new value is the sum of the previous two.`;
  }],
  ['Normalize a vector', () => {
    const vector = sample(3, 20).map(v => v + 1); const length = Math.hypot(...vector); const unit = vector.map(v => v / length);
    return `Normalized the vector (${vector.join(', ')}). The unit vector is (${unit.map(round).join(', ')}), with length ${round(Math.hypot(...unit))}.`;
  }],
  ['Find the median', () => {
    const values = sample(21, 500).sort((a, b) => a - b);
    return `Sorted twenty-one values. The median is ${values[10]}; ten values sit on each side. The full sample ranges from ${values[0]} to ${values.at(-1)}.`;
  }],
  ['Calculate a convex hull', () => {
    const points = Array.from({ length: 14 }, () => [integer(100), integer(100)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = input => { const out = []; for (const p of input) { while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop(); out.push(p); } return out.slice(0, -1); };
    const hull = [...half(points), ...half([...points].reverse())];
    return `Generated fourteen points and calculated their outer convex boundary. The hull has ${hull.length} vertices: ${hull.map(p => `(${p.join(', ')})`).join(', ')}. Points inside that boundary are excluded from the hull.`;
  }],
  ['Reverse a word list', () => {
    const words = shuffle(['margin', 'space', 'column', 'rhythm', 'shape', 'balance']);
    return `Input: ${words.join(' · ')}.\n\nReversed: ${[...words].reverse().join(' · ')}.`;
  }],
  ['Estimate a circle area', () => {
    let inside = 0; const count = 5000;
    for (let i = 0; i < count; i++) { const x = random(); const y = random(); if (x * x + y * y <= 1) inside++; }
    const estimate = inside / count * 4;
    return `Sampled ${count.toLocaleString('en-US')} points in a unit square; ${inside.toLocaleString('en-US')} fell inside the quarter circle. The resulting estimate of π is ${round(estimate)}. Absolute error: ${round(Math.abs(estimate - Math.PI))}. This is a random estimate, not an exact calculation.`;
  }],
  ['Measure text lengths', () => {
    const words = shuffle(['alignment', 'white', 'counterbalance', 'spacing', 'grid', 'composition']);
    return `Measured six labels: ${words.map(w => `${w} (${w.length})`).join(', ')}. The longest contains ${Math.max(...words.map(w => w.length))} letters; the shortest contains ${Math.min(...words.map(w => w.length))}.`;
  }],
  ['Reduce a matrix', () => {
    const rows = Array.from({ length: 4 }, () => sample(4, 10));
    return `Generated a four-by-four matrix. Row sums: ${rows.map(r => r.reduce((a, b) => a + b, 0)).join(', ')}. Column sums: ${rows[0].map((_, i) => rows.reduce((sum, r) => sum + r[i], 0)).join(', ')}. The total of all sixteen entries is ${rows.flat().reduce((a, b) => a + b, 0)}.`;
  }],
  ['Check a palindrome', () => {
    const text = shuffle(['Never odd or even', 'A man a plan a canal Panama', 'Was it a car or a cat I saw'])[0]; const clean = text.toLowerCase().replace(/[^a-z]/g, '');
    return `Checked “${text}”. After removing spaces and ignoring case, it ${clean === [...clean].reverse().join('') ? 'reads the same' : 'does not read the same'} in both directions.`;
  }],
  ['Partition a sample', () => {
    const values = sample(24); const even = values.filter(v => v % 2 === 0); const odd = values.filter(v => v % 2 !== 0);
    return `Partitioned twenty-four values into ${even.length} even and ${odd.length} odd numbers. Even: ${even.join(', ')}. Odd: ${odd.join(', ')}.`;
  }],
  ['Interpolate positions', () => {
    const a = integer(300); const b = 600 + integer(600); const values = Array.from({ length: 7 }, (_, i) => round(a + (b - a) * i / 6));
    return `Calculated seven equally spaced positions between ${a} and ${b}: ${values.join(', ')}. The interval is ${round((b - a) / 6)}.`;
  }],
  ['Generate a histogram', () => {
    const values = sample(120); const bins = Array.from({ length: 5 }, (_, i) => values.filter(v => v >= i * 20 && v < (i + 1) * 20).length);
    return `Binned 120 values into five ranges: ${bins.map((n, i) => `${i * 20}–${i * 20 + 19}: ${n}`).join('; ')}.\n\nThis result uses two paragraphs. The title, counts, and explanation are all produced by this function run; the canvas receives them as one activity entry and recomposes the most recent sections.`;
  }],
  ['Measure grid proportions', () => {
    const width = (1920 - 48 - 16 * 11) / 12; const height = (1080 - 48 - 16 * 4) / 5;
    return `Calculated the canvas grid: ${round(width)} px per column and ${round(height)} px per row. Sixty cells occupy ${round(60 * width * height)} square pixels, with the rest reserved for outer padding and gutters.`;
  }],
];

const count = process.argv[2] === undefined ? operations.length : Number(process.argv[2]);
if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new RangeError('Test count must be an integer from 1 to 1000.');
console.log(`Starting ${count} function calls. Seed: ${seed}. Interval: 2.5 seconds.`);
const ordered = Array.from({ length: Math.ceil(count / operations.length) }, () => shuffle(operations)).flat().slice(0, count);
for (let i = 0; i < ordered.length; i++) {
  const [title, execute] = ordered[i];
  const result = execute();
  const event = await appendActivity(root, { kind: 'tool', title, summary: `Test activity ${i + 1}/${ordered.length}. ${result}` });
  console.log(`${i + 1}/${ordered.length} · event ${event.id} · ${title}`);
  if (i < ordered.length - 1) await delay(2500);
}
console.log(`Completed ${ordered.length} real local function calls. No further activity is scheduled.`);
