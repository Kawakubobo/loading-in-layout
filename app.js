import { LIMITS, composeLayout, overlapRegions, reduceLiveActivity, presentationPlan } from './layout-engine.js';

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
let photoHistory = [];

// Public tool events are transient canvas beats, not new result sections.
// Nothing here reads or guesses private reasoning or desktop UI state.
const activityPulse = document.createElement('aside');
activityPulse.className = 'activity-pulse';
activityPulse.hidden = true;
activityPulse.setAttribute('role', 'status');
activityPulse.setAttribute('aria-live', 'polite');
artboard.append(activityPulse);
let pulseQueue = [];
let pulseTimer = 0;
function clearActivityPulse() {
  clearTimeout(pulseTimer);
  pulseTimer = 0;
  pulseQueue = [];
  activityPulse.hidden = true;
  activityPulse.replaceChildren();
}
function playActivityPulse() {
  if (pulseTimer || !pulseQueue.length) return;
  const event = pulseQueue.shift();
  const label = document.createElement('div');
  label.className = 'eyebrow';
  label.textContent = `${String(event.id).padStart(2, '0')} / LIVE ACTIVITY`;
  const heading = document.createElement('h2');
  heading.textContent = titleCase(event.title);
  const detail = document.createElement('p');
  detail.textContent = event.summary;
  const beat = document.createElement('div');
  beat.className = 'activity-pulse-beat';
  beat.append(label, heading, detail);
  activityPulse.replaceChildren(beat);
  activityPulse.dataset.eventId = String(event.id);
  activityPulse.hidden = false;
  // One slow, hard off/on beat. Keep the label readable between cuts.
  pulseTimer = setTimeout(() => {
    activityPulse.hidden = true;
    pulseTimer = setTimeout(() => {
      pulseTimer = 0;
      playActivityPulse();
    }, 200);
  }, 4200);
}
function queueActivityPulse(event) {
  // Historical replay restores results without pretending old tools just ran.
  if (Date.now() - Date.parse(event.timestamp) > 15000) return;
  pulseQueue.push(event);
  playActivityPulse();
}

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

const liveOrbit = document.createElement('aside');
liveOrbit.className = 'live-orbit';
liveOrbit.hidden = true;
liveOrbit.setAttribute('aria-live', 'polite');
liveOrbit.setAttribute('role', 'status');
artboard.append(liveOrbit);
let liveState = null;
let liveExpiryTimer = 0;
const svgNS = 'http://www.w3.org/2000/svg';
function svgElement(name, attrs = {}) {
  const n = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value);
  return n;
}
function renderLiveOrbit() {
  clearTimeout(liveExpiryTimer);
  if (!liveState) { liveOrbit.hidden = true; return; }
  const expired = liveState.status === 'running' && Date.parse(liveState.expiresAt) <= Date.now();
  liveOrbit.hidden = false;
  liveOrbit.dataset.status = expired ? 'stale' : liveState.status;
  const stamp = `${liveState.id}:${expired}`;
  if (liveOrbit.dataset.stamp !== stamp) {
    liveOrbit.dataset.stamp = stamp;
    const running = !expired && liveState.status === 'running';
    const caption = document.createElement('div');
    caption.className = 'eyebrow live-orbit-caption';
    caption.textContent = expired ? 'Awaiting a fresh update' : running ? 'Live / In progress' : liveState.status === 'failed' ? 'Needs attention' : 'Complete';
    const heading = document.createElement('h2');
    heading.className = 'live-orbit-heading';
    heading.textContent = titleCase(liveState.title);
    const svg = svgElement('svg', {viewBox:'0 0 600 600', 'aria-hidden':'true'});
    const labels = (liveState.labels?.length ? liveState.labels : [liveState.title, 'Work in progress']).slice(0,4);
    labels.forEach((label,index) => {
      const radius = 170 + index * 32;
      const ring = svgElement('g', {class:'live-orbit-ring'});
      ring.style.animationDuration = `${38 + index * 13}s`;
      ring.style.animationDirection = index % 2 ? 'reverse' : 'normal';
      const id = `live-circle-${index}`;
      const path = svgElement('path',{id,d:`M 300 ${300-radius} A ${radius} ${radius} 0 1 1 300 ${300+radius} A ${radius} ${radius} 0 1 1 300 ${300-radius}`, fill:'none'});
      const text = svgElement('text', {'font-size':'25', 'letter-spacing':'-0.5'});
      const tp = svgElement('textPath',{href:`#${id}`,textLength:Math.round(2*Math.PI*radius),lengthAdjust:'spacing'});
      const phrase = `${titleCase(label)} · `;
      tp.textContent = phrase.repeat(Math.max(2,Math.floor(2*Math.PI*radius/(phrase.length*12))));
      text.append(tp);ring.append(path,text);svg.append(ring);
    });
    const detail = document.createElement('p');detail.className = 'live-orbit-detail';detail.textContent = liveState.summary;
    liveOrbit.replaceChildren(caption,svg,heading,detail);
    liveOrbit.setAttribute('aria-label', `${caption.textContent}: ${liveState.title}. ${liveState.summary}`);
  }
  if (!expired && liveState.status === 'running') liveExpiryTimer = setTimeout(renderLiveOrbit,Math.max(1,Date.parse(liveState.expiresAt)-Date.now()));
}
function applyLiveEvent(event) {
  liveState = reduceLiveActivity(liveState,event);
  renderLiveOrbit();
}

const typingJobs = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const typingMask = typeof Highlight === 'function' && CSS.highlights ? new Highlight() : null;
if (typingMask) CSS.highlights.set('untyped', typingMask);
let typingFrame = 0;

function stopTyping() {
  cancelAnimationFrame(typingFrame);
  typingFrame = 0;
  for (const node of typingJobs.keys()) delete node.dataset.typing;
  typingJobs.clear();
  typingMask?.clear();
}
reducedMotion.addEventListener('change', event => { if (event.matches) stopTyping(); });

function advanceTyping(now) {
  typingFrame = 0;
  for (const [node, job] of typingJobs) {
    if (!node.isConnected) {
      typingMask.delete(job.range);
      typingJobs.delete(node);
      continue;
    }
    // Catch up after background tabs without scheduling a backlog of timers.
    const count = Math.max(0, Math.min(job.ends.length, Math.floor((now - job.started) / job.interval)));
    if (count > job.shown) {
      job.shown = count;
      let offset = job.ends[count - 1];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (offset <= textNode.length) { job.range.setStart(textNode, offset); break; }
        offset -= textNode.length;
      }
      node.dataset.typedCharacters = String(count);
    }
    if (count === job.ends.length) {
      typingMask.delete(job.range);
      typingJobs.delete(node);
      delete node.dataset.typing;
    }
  }
  if (typingJobs.size) typingFrame = requestAnimationFrame(advanceTyping);
}

function typeSection(section) {
  if (!typingMask || reducedMotion.matches || !section.isConnected) return;
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const started = performance.now();
  let titleDuration = 0;
  let bodyDuration = 0;
  const nodes = [...section.querySelectorAll('[data-ink]')];
  // Schedule the title first even though the caption precedes it in the DOM.
  nodes.sort((a, b) => Number(b.tagName === 'H2') - Number(a.tagName === 'H2'));
  for (const node of nodes) {
    const ends = Array.from(segmenter.segment(node.textContent), item => item.index + item.segment.length);
    if (!ends.length) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const base = node.tagName === 'H2' ? 32 : node.tagName === 'P' ? 14 : 24;
    const interval = base * (0.8 + Math.random() * 0.4);
    if (node.tagName === 'H2') titleDuration = ends.length * interval;
    const delay = node.tagName === 'P' ? titleDuration + bodyDuration : 0;
    if (node.tagName === 'P') bodyDuration += ends.length * interval;
    typingMask.add(range);
    typingJobs.set(node, { range, ends, interval, started: started + delay, shown: 0 });
    node.dataset.typing = 'true';
    node.dataset.typingInterval = interval.toFixed(2);
    node.dataset.typingDelay = delay.toFixed(2);
    node.dataset.typedCharacters = '0';
  }
  if (!typingFrame && typingJobs.size) typingFrame = requestAnimationFrame(advanceTyping);
}

function createText(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className || '';
  node.dataset.ink = '';
  return node;
}
function wrapCopy(text, indent = 0) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const count = value => [...segmenter.segment(value)].length;
  const context = document.createElement('canvas').getContext('2d');
  context.font = '400 18px "Neue Haas Grotesk Display"';
  const measure = value => context.measureText(value).width;
  const column = (LIMITS.width - 2 * LIMITS.padding - (LIMITS.columns - 1) * LIMITS.gap) / LIMITS.columns;
  const width = 3 * column + 2 * LIMITS.gap;
  const words = text.trim().split(/\s+/).filter(Boolean);
  // Split unusually long tokens without breaking emoji or combining marks.
  const tokens = [];
  for (const word of words) {
    let part = '';
    for (const { segment } of segmenter.segment(word)) {
      if (part && (count(part + segment) > 60 || measure(part + segment) > width - indent)) {
        tokens.push({ text: part, space: false }); part = '';
      }
      part += segment;
    }
    if (part) tokens.push({ text: part, space: true });
  }
  const cache = new Map();
  function solve(index) {
    if (index === tokens.length) return { cost: 0, lines: [] };
    if (cache.has(index)) return cache.get(index);
    const available = width - (index === 0 ? indent : 0);
    let line = '', best = null;
    for (let end = index; end < tokens.length; end++) {
      line += (end > index && tokens[end - 1].space ? ' ' : '') + tokens[end].text;
      const length = measure(line);
      if (count(line) > 60 || length > available) break;
      const rest = solve(end + 1);
      if (!rest) continue;
      const last = end === tokens.length - 1;
      const orphan = last && end === index && index > 0;
      // Fill non-final lines naturally instead of shortening the first line
      // to equalize it with the last. A normal short final line is allowed.
      const ragCost = last ? Math.max(0, width * 0.28 - length) ** 2
        : (available - length) ** 2 * (index === 0 ? 2 : 1);
      const cost = rest.cost + ragCost + width ** 2
        + (orphan ? width ** 2 * 12 : 0);
      if (!best || cost < best.cost) best = { cost, lines: [line, ...rest.lines] };
    }
    cache.set(index, best);
    return best;
  }
  return solve(0)?.lines.join('\n') || text;
}
function titleCase(text) {
  const minorWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'on', 'per', 'to', 'vs', 'via']);
  const words = [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)];
  let index = 0;
  return text.replace(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu, (word, offset) => {
    const position = index++;
    // Preserve acronyms and intentional names such as API, GitHub, and iPhone.
    if (/\p{Lu}/u.test(word.slice(1))) return word;
    const lower = word.toLocaleLowerCase('en');
    const afterColon = position > 0 && /:\s*$/.test(text.slice(words[position - 1].index + words[position - 1][0].length, offset));
    if (position > 0 && position < words.length - 1 && !afterColon && minorWords.has(lower)) return lower;
    return lower.replace(/^\p{L}/u, letter => letter.toLocaleUpperCase('en'));
  });
}
function makeSection(note, id) {
  const section = document.createElement('section');
  section.className = `evolving-section ${note.kind}`;
  section.dataset.sectionId = id;
  section.dataset.active = 'true';
  const label = createText('div', `${String(id).padStart(2, '0')} / ${note.label}`, 'eyebrow');
  section.append(label);
  if (note.image && /^\/example\/[a-zA-Z0-9_-]+\.jpg$/.test(note.image.src)) {
    const image = document.createElement('img');
    image.className = 'activity-image';
    image.alt = note.image.alt;
    image.width = note.image.width;
    image.height = note.image.height;
    const scale = Math.min(755 / image.width, 440 / image.height);
    image.style.width = `${image.width * scale}px`;
    image.style.height = `${image.height * scale}px`;
    image.src = note.image.src;
    section.append(image);
  }
  const heading = createText('h2', titleCase(note.title));
  heading.style.whiteSpace = 'pre-line';
  heading.id = `section-${id}-title`;
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading);
  const paragraphs = note.summary.trim().split(/\n\s*\n/);
  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    const copy = paragraph.trim().replace(/\s+/g, ' ');
    section.append(createText('p', wrapCopy(copy, paragraphIndex > 0 ? 36 : 0)));
  }
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
    for (const element of section.node.querySelectorAll('[data-ink], .activity-image')) {
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const rect of element.matches('.activity-image') ? [element.getBoundingClientRect()] : range.getClientRects()) {
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
  for (const element of section.node.querySelectorAll('[data-ink], .activity-image')) {
    const style = getComputedStyle(element);
    const density = Number(style.fontWeight) >= 600 ? 1.35 : 1;
    const range = document.createRange();
    range.selectNodeContents(element);
    for (const rect of element.matches('.activity-image') ? [element.getBoundingClientRect()] : range.getClientRects()) {
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
    const image = section.node.querySelector('.activity-image');
    if (image) {
      const originalWidth = Number(image.getAttribute('width'));
      const originalHeight = Number(image.getAttribute('height'));
      const imageScale = Math.min(parseFloat(section.node.style.width) / originalWidth, 440 / originalHeight);
      image.style.width = `${originalWidth * imageScale}px`;
      image.style.height = `${originalHeight * imageScale}px`;
      const canvasScale = artboard.getBoundingClientRect().width / LIMITS.width;
      const otherHeight = section.node.getBoundingClientRect().height / canvasScale - originalHeight * imageScale;
      const availableHeight = Math.max(1, LIMITS.height - 2 * LIMITS.padding - otherHeight - 2);
      if (originalHeight * imageScale > availableHeight) {
        image.style.height = `${availableHeight}px`;
        image.style.width = `${availableHeight * originalWidth / originalHeight}px`;
      }
    }
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

function offsetNewOverlap(id) {
  const current = sections.find(section => section.id === id);
  if (!current?.bounds) return;
  const collisions = overlapRegions(inkRectangles()).filter(region => region.sectionIds.includes(id));
  const collidedIds = new Set(collisions.flatMap(region => region.sectionIds).filter(other => other !== id));
  const photoLayer = current.node.querySelector('.activity-image');
  const anchor = photoLayer
    ? [...sections].reverse().find(section => section.id !== id && section.node.querySelector('.activity-image'))
    : [...sections].reverse().find(section => collidedIds.has(section.id));
  if (!anchor?.bounds) return;
  const step = (LIMITS.width - 2 * LIMITS.padding + LIMITS.gap) / LIMITS.columns;
  const anchorColumn = Math.round((anchor.bounds.x - LIMITS.padding) / step);
  const maxX = LIMITS.width - LIMITS.padding - current.bounds.width;
  // Keep the overlap as a layered trace, offset by two columns; reverse at edges.
  for (const direction of [1, -1]) {
    const x = LIMITS.padding + (anchorColumn + direction * 2) * step;
    if (x < LIMITS.padding || x > maxX) continue;
    current.node.style.left = `${x}px`;
    current.node.dataset.overlapOffsetColumns = String(direction * 2);
    current.node.dataset.overlapAnchor = String(anchor.id);
    current.bounds.x = x;
    if (photoLayer) {
      const y = Math.max(LIMITS.padding, Math.min(anchor.bounds.y + 64,
        LIMITS.height - LIMITS.padding - current.bounds.height));
      current.node.style.top = `${y}px`;
      current.bounds.y = y;
    }
    break;
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
  offsetNewOverlap(sequence);
  let overlapCount = clearOverlaps();
  // Cleanup can remove an active item when it is the only remaining collision.
  // If that changes the group, compose the survivors again in the same frame.
  for (let attempt = 0; attempt < LIMITS.rememberedSections; attempt++) {
    const activeBefore = sections.filter(section => section.active).length;
    if (activeBefore === Math.min(sequence, LIMITS.rememberedSections)) break;
    rebalanceActive();
    offsetNewOverlap(sequence);
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
  typeSection(node);
}

// Explicit emphasis events sit above the composition and last until the next event.
function showPhotoPair(positions) {
  photoHistory.slice(-2).forEach((event, index) => {
    const node = makeSection({ kind: 'note', label: 'PHOTO STUDY', title: event.title,
      summary: event.summary, image: event.image, columns: 3, eventId: event.id }, `pair-${event.id}`);
    node.classList.add('presentation-copy');
    node.dataset.collagePosition = positions[index];
    composition.append(node);
  });
}

function showOvertext(event) {
  const layer = document.createElement('section');
  layer.className = 'overtext';
  composition.classList.toggle('overtext-collage', photoHistory.length > 0);
  showPhotoPair(['lower', 'upper']);
  layer.setAttribute('aria-label', 'Emphasis');
  const heading = createText('h2', titleCase(event.title));
  let lines = heading.textContent.split('\n');
  if (lines.length === 1 && lines[0].length > 26) {
    const words = lines[0].split(/\s+/);
    if (words.length > 1) {
      let best = 1;
      for (let i = 1; i < words.length; i++) {
        if (Math.abs(words.slice(0,i).join(' ').length - words.slice(i).join(' ').length)
          < Math.abs(words.slice(0,best).join(' ').length - words.slice(best).join(' ').length)) best = i;
      }
      lines = [words.slice(0,best).join(' '), words.slice(best).join(' ')];
    }
  }
  heading.textContent = lines.join('\n');
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = '400 260px "Neue Haas Grotesk Display"';
  const widest = Math.max(...lines.map(line => measure.measureText(line).width - Math.max(0,[...line].length-1)*5.2));
  heading.style.fontSize = `${Math.min(360, 260 * 2040 / Math.max(1, widest))}px`;
  layer.append(heading);
  const description = document.createElement('p');
  description.className = 'sr-only';
  description.textContent = event.summary;
  layer.append(description);
  composition.append(layer);
  document.getElementById('evolution-announcement').textContent = `${event.title} ${event.summary}`;
  typeSection(layer);
}

// Every section comes from a published activity event. No timer, demo deck,
// synthetic entries, or direct access to the assistant's internal analysis.
function showDemoPresentation(event) {
  const plan = presentationPlan(event.presentation, photoHistory);
  if (!plan) return false;
  const layer = document.createElement('section');
  layer.className = `demo-presentation demo-${plan.mode}`;
  layer.setAttribute('aria-label', event.title);
  for (const { event: photo, x, y, width, height } of plan.photos) {
    const image = document.createElement('img');
    image.src = photo.image.src;
    image.alt = photo.image.alt;
    image.className = 'demo-photo';
    Object.assign(image.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
    layer.append(image);
  }
  const heading = createText('h2', titleCase(event.title), 'demo-title');
  if (plan.mode === 'staggered') {
    const words = heading.textContent.split(/\s+/);
    const lines = [];
    while (words.length) lines.push(words.splice(0, Math.ceil(words.length / (3 - lines.length))).join(' '));
    heading.textContent = '';
    lines.forEach((line, index) => {
      const span = document.createElement('span');
      span.textContent = line + (index < lines.length - 1 ? '\n' : '');
      heading.append(span);
    });
  }
  layer.append(heading);
  const copy = document.createElement('div');
  copy.className = 'demo-copy';
  copy.append(createText('div', 'PROGRESS UPDATE', 'eyebrow'));
  event.summary.trim().split(/\n\s*\n/).forEach((paragraph, index) => {
    copy.append(createText('p', wrapCopy(paragraph.replace(/\s+/g, ' '), index ? 36 : 0)));
  });
  layer.append(copy);
  composition.append(layer);
  // Fit real titles; long copy falls back to the measured ordinary layout.
  let size = plan.mode === 'type-echo' ? 310 : plan.mode === 'staggered' ? 180 : 136;
  heading.style.fontSize = `${size}px`;
  while (heading.scrollHeight > 530 && size > 56) {
    size -= 4;
    heading.style.fontSize = `${size}px`;
  }
  if (heading.scrollHeight > 530 || copy.scrollHeight > 340) { layer.remove(); return false; }
  if (plan.mode === 'type-echo') {
    // Repeat only the actual published title, as decorative echoes of one update.
    [[40, 24], [970, 215], [660, 380], [1125, 550], [195, 960]].forEach(([x, y]) => {
      const echo = createText('div', heading.textContent, 'demo-echo');
      echo.setAttribute('aria-hidden', 'true');
      Object.assign(echo.style, { left: `${x}px`, top: `${y}px` });
      layer.append(echo);
    });
  }
  composition.classList.add('demo-active');
  status.textContent = `${plan.mode} · ${plan.photos.length} photo${plan.photos.length === 1 ? '' : 's'}`;
  document.getElementById('evolution-announcement').textContent = `${event.title}. ${event.summary}`;
  typeSection(layer);
  return true;
}

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
    stopTyping();
    clearActivityPulse();
    liveState = null;
    renderLiveOrbit();
    composition.replaceChildren();
    composition.classList.remove('overtext-collage', 'editorial-spread', 'demo-active');
    sections = [];
    photoHistory = [];
    sequence = 0;
    cutCount = 0;
    lastEventId = 0;
    eventCount = 0;
    currentSession = feed.session;
    composition.dataset.session = currentSession;
    status.textContent = '0 active · 0 visible · 0 overlaps';
    document.getElementById('evolution-announcement').textContent = '';
  }
  for (const event of feed.events) {
    if (!Number.isInteger(event.id) || event.id <= lastEventId || typeof event.title !== 'string' || typeof event.summary !== 'string') continue;
    if (event.kind === 'tool') {
      if (event.status) applyLiveEvent(event);
      else queueActivityPulse(event);
      lastEventId = event.id;
      eventCount++;
      continue;
    }
    composition.querySelector('.overtext')?.remove();
    composition.querySelector('.demo-presentation')?.remove();
    composition.querySelectorAll('.presentation-copy').forEach(node => node.remove());
    if (event.image) photoHistory = [...photoHistory, event].slice(-2);
    composition.classList.remove('overtext-collage', 'editorial-spread', 'demo-active');
    for (const section of sections) delete section.node.dataset.collagePosition;
    if (showDemoPresentation(event)) {
      lastEventId = event.id;
      eventCount++;
      continue;
    }
    if (event.presentation === 'overtext') {
      showOvertext(event);
      lastEventId = event.id;
      eventCount++;
      continue;
    }
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
        image: i === 0 ? event.image : null,
      });
    }
    if (event.presentation === 'editorial') {
      composition.classList.add('editorial-spread');
      showPhotoPair(['lead', 'side']);
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
  liveOrbit.classList.remove('disconnected');
});
events.addEventListener('activity', (event) => {
  try { applyFeed(JSON.parse(event.data)); } catch (error) { console.error('Could not display the activity update.', error); }
});
events.addEventListener('reload', () => location.reload());
events.addEventListener('error', () => {
  document.getElementById('connection-dot').classList.remove('connected');
  document.getElementById('connection-text').textContent = 'Reconnecting';
  liveOrbit.classList.add('disconnected');
});

Promise.all([
  document.fonts.load('400 14px "Neue Haas Grotesk Display"'),
  document.fonts.load('400 128px "Neue Haas Grotesk Display"'),
]).then(() => {
  initialized = true;
  if (pendingFeed) { applyFeed(pendingFeed); pendingFeed = null; }
}).catch(error => {
  status.textContent = 'The local typeface could not load. Reload to try again.';
  console.error('Could not initialize the composition.', error);
});
