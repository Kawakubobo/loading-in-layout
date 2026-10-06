import { LIMITS, composeLayout, overlapRegions } from './layout-engine.js';

const artboard = document.getElementById('artboard');
const wrap = document.getElementById('canvas-wrap');
const viewport = document.getElementById('viewport');
const composition = document.getElementById('composition');
const fitButton = document.getElementById('fit-view');
const actualButton = document.getElementById('actual-view');
const status = document.getElementById('composition-status');
let actualSize = false;
let sequence = 0;
let sections = [];
let initialized = false;
let pendingFeed;
let cutCount = 0;
let currentSession = null;
let lastEventId = 0;
let eventCount = 0;

function resizeCanvas() {
  const style = getComputedStyle(viewport);
  const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const fitScale = Math.max(0.01, Math.min(width / 1920, height / 1080, 1));
  const scale = actualSize ? 1 : fitScale;
  artboard.style.transform = `scale(${scale})`;
  wrap.style.width = `${1920 * scale}px`;
  wrap.style.height = `${1080 * scale}px`;
  viewport.style.placeItems = actualSize ? 'start' : 'center';
  document.getElementById('zoom-label').textContent = `${Math.round(fitScale * 100)}%`;
}
function setZoom(actual) {
  actualSize = actual;
  fitButton.setAttribute('aria-pressed', String(!actual));
  actualButton.setAttribute('aria-pressed', String(actual));
  resizeCanvas();
}
fitButton.addEventListener('click', () => setZoom(false));
actualButton.addEventListener('click', () => setZoom(true));
new ResizeObserver(resizeCanvas).observe(viewport);
resizeCanvas();

function createText(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className || '';
  node.dataset.ink = '';
  return node;
}
function makeSection(note, id) {
  const section = document.createElement('section');
  section.className = `evolving-section ${note.kind}`;
  section.dataset.sectionId = id;
  section.dataset.active = 'true';
  const label = createText('div', `${String(id).padStart(2, '0')} / ${note.label}`, 'eyebrow');
  section.append(label);
  const heading = createText('h2', note.title);
  heading.style.whiteSpace = 'pre-line';
  heading.id = `section-${id}-title`;
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading);
  for (const paragraph of note.summary.split(/\n\s*\n/)) section.append(createText('p', paragraph));
  section.dataset.eventId = String(note.eventId);
  const column = (LIMITS.width - LIMITS.padding * 2 - LIMITS.gap * (LIMITS.columns - 1)) / LIMITS.columns;
  section.style.width = `${column * note.columns + LIMITS.gap * (note.columns - 1)}px`;
  return section;
}

function inkRectangles() {
  const origin = artboard.getBoundingClientRect();
  const scale = origin.width / LIMITS.width;
  const rects = [];
  for (const section of sections) {
    for (const element of section.node.querySelectorAll('[data-ink]')) {
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const rect of range.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        rects.push({ sectionId: section.id, x: (rect.left - origin.left) / scale, y: (rect.top - origin.top) / scale, width: rect.width / scale, height: rect.height / scale });
      }
    }
  }
  return rects;
}

function clearOverlaps() {
  let regions = overlapRegions(inkRectangles());
  const triggerCount = regions.length;
  const removed = [];
  // A removal can split a connected region, so always measure again.
  while (regions.length > LIMITS.overlapLimit) {
    const involved = new Set(regions.flatMap(region => region.sectionIds));
    const oldest = sections.find(section => !section.active && involved.has(section.id))
      || sections.find(section => involved.has(section.id));
    if (!oldest) break;
    oldest.node.remove();
    sections = sections.filter(section => section !== oldest);
    removed.push(oldest.id);
    regions = overlapRegions(inkRectangles());
  }
  cutCount += removed.length;
  composition.dataset.overlaps = String(regions.length);
  composition.dataset.lastOverlapPeak = String(triggerCount);
  composition.dataset.lastRemoved = removed.join(',');
  composition.dataset.totalCuts = String(cutCount);
  return regions.length;
}

function measureSection(section) {
  const origin = section.node.getBoundingClientRect();
  const scale = artboard.getBoundingClientRect().width / LIMITS.width;
  let weight = 0;
  let momentX = 0;
  let momentY = 0;
  for (const element of section.node.querySelectorAll('[data-ink]')) {
    const style = getComputedStyle(element);
    const density = Number(style.fontWeight) >= 600 ? 1.35 : 1;
    const range = document.createRange();
    range.selectNodeContents(element);
    for (const rect of range.getClientRects()) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const mass = rect.width * rect.height / (scale * scale) * density;
      weight += mass;
      momentX += ((rect.left + rect.width / 2 - origin.left) / scale) * mass;
      momentY += ((rect.top + rect.height / 2 - origin.top) / scale) * mass;
    }
  }
  return {
    id: section.id,
    width: parseFloat(section.node.style.width),
    height: Math.ceil(origin.height / scale),
    weight,
    inkX: weight ? momentX / weight : origin.width / scale / 2,
    inkY: weight ? momentY / weight : origin.height / scale / 2,
  };
}

function rebalanceActive() {
  const active = sections.filter(section => section.active);
  if (!active.length) return;
  const column = (LIMITS.width - LIMITS.padding * 2 - LIMITS.gap * (LIMITS.columns - 1)) / LIMITS.columns;
  for (const section of active) {
    const display = section.node.classList.contains('display');
    const columns = active.length === 1 ? (display ? 8 : 6) : (display ? 6 : 5);
    section.node.style.width = `${column * columns + LIMITS.gap * (columns - 1)}px`;
  }
  const measurements = active.map(measureSection);
  const placements = composeLayout({ items: measurements, seed: sequence });
  for (const point of placements) {
    const section = active.find(item => item.id === point.id);
    const measure = measurements.find(item => item.id === point.id);
    section.node.style.left = `${point.x}px`;
    section.node.style.top = `${point.y}px`;
    section.bounds = { x: point.x, y: point.y, width: measure.width, height: measure.height };
  }
  const totalWeight = measurements.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight) {
    composition.dataset.balanceX = String(placements.reduce((sum, point) => {
      const item = measurements.find(measure => measure.id === point.id);
      return sum + (point.x + item.inkX) * item.weight;
    }, 0) / totalWeight);
    composition.dataset.balanceY = String(placements.reduce((sum, point) => {
      const item = measurements.find(measure => measure.id === point.id);
      return sum + (point.y + item.inkY) * item.weight;
    }, 0) / totalWeight);
  }
}

function appendSection(note) {
  sequence++;
  // Retire the earliest before placement so only two preceding sections
  // reserve space for the third. Retired sections stay visible until crowded.
  const remembered = sections.filter(section => section.active);
  while (remembered.length >= LIMITS.rememberedSections) {
    const retired = remembered.shift();
    retired.active = false;
    retired.node.dataset.active = 'false';
  }
  const node = makeSection(note, sequence);
  node.style.visibility = 'hidden';
  composition.append(node);
  sections.push({ id: sequence, active: true, node, bounds: null });
  rebalanceActive();
  node.style.visibility = '';
  let overlapCount = clearOverlaps();
  // Cleanup can remove an active item when it is the only remaining collision.
  // If that changes the group, compose the survivors again in the same frame.
  for (let attempt = 0; attempt < LIMITS.rememberedSections; attempt++) {
    const activeBefore = sections.filter(section => section.active).length;
    if (activeBefore === Math.min(sequence, LIMITS.rememberedSections)) break;
    rebalanceActive();
    overlapCount = clearOverlaps();
    if (sections.filter(section => section.active).length === activeBefore) break;
  }
  const activeCount = sections.filter(section => section.active).length;
  status.textContent = `${activeCount} active · ${sections.length} visible · ${overlapCount} overlap${overlapCount === 1 ? '' : 's'}`;
  composition.dataset.step = String(sequence);
  composition.dataset.activeCount = String(activeCount);
  composition.dataset.visibleCount = String(sections.length);
  const announcement = document.getElementById('evolution-announcement');
  announcement.textContent = `Section ${sequence}: ${note.title.replaceAll('\n', ' ').replace(/[.!?]$/, '')}. ${activeCount} active sections. ${overlapCount} overlap areas.`;
}

// Every section comes from a published activity event. No timer, demo deck,
// synthetic entries, or direct access to the assistant's internal analysis.
function chunksOf(text, limit = 900) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    const boundary = remaining.lastIndexOf(' ', limit);
    const end = boundary > limit / 2 ? boundary : limit;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function applyFeed(feed) {
  if (!feed || typeof feed.session !== 'string' || !Array.isArray(feed.events)) return;
  if (!initialized) { pendingFeed = feed; return; }
  if (feed.session !== currentSession) {
    composition.replaceChildren();
    sections = [];
    sequence = 0;
    cutCount = 0;
    lastEventId = 0;
    eventCount = 0;
    currentSession = feed.session;
    composition.dataset.session = currentSession;
    status.textContent = '0 active · 0 visible · 0 overlaps';
  }
  for (const event of feed.events) {
    if (!Number.isInteger(event.id) || event.id <= lastEventId || typeof event.title !== 'string' || typeof event.summary !== 'string') continue;
    const parts = chunksOf(event.summary);
    for (let i = 0; i < parts.length; i++) {
      const display = sequence % 3 === 0 && event.title.length <= 32 && parts.length === 1;
      appendSection({
        kind: display ? 'display' : 'note',
        label: event.kind === 'tool' ? 'TOOL ACTIVITY' : 'PROGRESS UPDATE',
        title: event.title,
        summary: parts[i],
        columns: display ? 8 : 5,
        eventId: event.id,
      });
    }
    lastEventId = event.id;
    eventCount++;
  }
  composition.dataset.lastEventId = String(lastEventId);
  document.getElementById('feed-state').textContent = `Public progress · ${eventCount} update${eventCount === 1 ? '' : 's'}`;
}

fetch('/version.json').then(response => {
  if (!response.ok) throw new Error('Version information is unavailable.');
  return response.json();
}).then(version => {
  const reference = version.mode === 'reference';
  document.getElementById('version-label').textContent = reference ? '/ Reference' : '/ Working';
  document.title = `Loading in Layout — ${reference ? 'Reference' : 'Working'}`;
  document.getElementById(reference ? 'reference-link' : 'working-link').setAttribute('aria-current', 'page');
  document.getElementById('snapshot-label').textContent = reference ? 'Fixed layout code · live activity' : 'Current layout code · live activity';
  artboard.dataset.version = version.mode;
  artboard.dataset.snapshot = version.snapshotId || 'working';
}).catch(error => console.error(error.message));

const events = new EventSource('/events');
events.addEventListener('open', () => {
  document.getElementById('connection-dot').classList.add('connected');
  document.getElementById('connection-text').textContent = 'Connected';
});
events.addEventListener('activity', (event) => {
  try { applyFeed(JSON.parse(event.data)); } catch (error) { console.error('Could not display the activity update.', error); }
});
events.addEventListener('reload', () => location.reload());
events.addEventListener('error', () => {
  document.getElementById('connection-dot').classList.remove('connected');
  document.getElementById('connection-text').textContent = 'Reconnecting';
});

Promise.all([
  document.fonts.load('400 14px "TWK Lausanne"'),
  document.fonts.load('600 128px "TWK Lausanne"'),
]).then(() => {
  initialized = true;
  if (pendingFeed) { applyFeed(pendingFeed); pendingFeed = null; }
}).catch(error => {
  status.textContent = 'The local typeface could not load. Reload to try again.';
  console.error('Could not initialize the composition.', error);
});
