export const LIMITS = Object.freeze({
  width: 1920,
  height: 1080,
  padding: 24,
  gap: 16,
  columns: 12,
  rows: 5,
  rememberedSections: 3,
  overlapLimit: 4,
});

function validRect(rect) {
  return rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 0 && rect.height > 0;
}

function intersection(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}

function connected(a, b) {
  return a.x <= b.x + b.width && b.x <= a.x + a.width
    && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/** Count connected physical overlap areas, rather than every colliding pair. */
export function overlapRegions(rects) {
  const lines = rects.filter(validRect);
  const intersections = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].sectionId === lines[j].sectionId) continue;
      const overlap = intersection(lines[i], lines[j]);
      if (overlap) intersections.push({
        ...overlap,
        sectionIds: [lines[i].sectionId, lines[j].sectionId],
      });
    }
  }

  // Keep the original intersections for connectivity checks: the bounding box
  // of an L-shaped region can otherwise accidentally absorb a separate region.
  const visited = new Set();
  const regions = [];
  for (let i = 0; i < intersections.length; i++) {
    if (visited.has(i)) continue;
    const component = [i];
    visited.add(i);
    const ids = new Set();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let cursor = 0; cursor < component.length; cursor++) {
      const current = intersections[component[cursor]];
      current.sectionIds.forEach(id => ids.add(id));
      left = Math.min(left, current.x);
      top = Math.min(top, current.y);
      right = Math.max(right, current.x + current.width);
      bottom = Math.max(bottom, current.y + current.height);
      for (let j = 0; j < intersections.length; j++) {
        if (!visited.has(j) && connected(current, intersections[j])) {
          visited.add(j);
          component.push(j);
        }
      }
    }
    regions.push({ x: left, y: top, width: right - left, height: bottom - top, sectionIds: [...ids] });
  }
  return regions;
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) {
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  }
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Place a measured section at a grid start, preferring the least occupied area. */
export function choosePlacement({ width, height, occupied = [], seed = 0 }) {
  const { padding, gap, columns, rows } = LIMITS;
  const usableWidth = LIMITS.width - padding * 2;
  const usableHeight = LIMITS.height - padding * 2;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
      || width > usableWidth || height > usableHeight) {
    throw new RangeError('Section dimensions must fit inside the canvas padding.');
  }
  const columnStep = (usableWidth + gap) / columns;
  const rowStep = (usableHeight + gap) / rows;
  const obstacles = occupied.filter(validRect);
  const random = seededRandom(seed);
  let best = null;
  for (let row = 0; row < rows; row++) {
    const y = padding + row * rowStep;
    if (y + height > LIMITS.height - padding + 1e-7) continue;
    for (let column = 0; column < columns; column++) {
      const x = padding + column * columnStep;
      if (x + width > LIMITS.width - padding + 1e-7) continue;
      const candidate = { x, y, width, height };
      const cost = obstacles.reduce((area, rect) => {
        const overlap = intersection(candidate, rect);
        return area + (overlap ? overlap.width * overlap.height : 0);
      }, 0);
      const tieBreak = random();
      if (!best || cost < best.cost - 1e-7
          || (Math.abs(cost - best.cost) <= 1e-7 && tieBreak < best.tieBreak)) {
        best = { x, y, cost, tieBreak };
      }
    }
  }
  return { x: best.x, y: best.y };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function measuredItem(item) {
  const { padding, width: canvasWidth, height: canvasHeight } = LIMITS;
  if (!item || !Number.isFinite(item.width) || !Number.isFinite(item.height)
      || item.width <= 0 || item.height <= 0
      || item.width > canvasWidth - padding * 2 || item.height > canvasHeight - padding * 2) {
    throw new RangeError('Section dimensions must fit inside the canvas padding.');
  }
  const weight = item.weight ?? item.width * item.height;
  const inkX = item.inkX ?? item.width / 2;
  const inkY = item.inkY ?? item.height / 2;
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(inkX)
      || !Number.isFinite(inkY) || inkX < 0 || inkX > item.width || inkY < 0 || inkY > item.height) {
    throw new RangeError('Text weight and its local ink centroid must be valid.');
  }
  return { ...item, weight, inkX, inkY, placements: [{ id: item.id, x: 0, y: 0 }] };
}

/** Join two measured groups, keeping their optical centers on a shared axis. */
function joinGroups(a, b, axis, { alignStart = false, diagonal = 0 } = {}) {
  const horizontal = axis === 'x';
  const along = horizontal ? 'inkX' : 'inkY';
  const across = horizontal ? 'inkY' : 'inkX';
  const size = horizontal ? 'width' : 'height';
  const available = LIMITS[size] - LIMITS.padding * 2;
  const minimum = a[size] - a[along] + b[along] + LIMITS.gap;
  // The half-canvas rhythm keeps small sections separated and large ones readable.
  const distance = Math.max(minimum, Math.min((available + LIMITS.gap) / 2,
    available - a[along] - (b[size] - b[along])));
  const crossDistance = diagonal * (LIMITS.height - LIMITS.padding * 2) / 2;
  const first = horizontal
    ? { x: -a[along], y: alignStart ? 0 : -a[across] }
    : { x: alignStart ? 0 : -a[across], y: -a[along] };
  const second = horizontal
    ? { x: distance - b[along], y: alignStart ? 0 : crossDistance - b[across] }
    : { x: alignStart ? 0 : -b[across], y: distance - b[along] };
  const left = Math.min(first.x, second.x);
  const top = Math.min(first.y, second.y);
  first.x -= left;
  second.x -= left;
  first.y -= top;
  second.y -= top;
  const weight = a.weight + b.weight;
  return {
    width: Math.max(first.x + a.width, second.x + b.width),
    height: Math.max(first.y + a.height, second.y + b.height),
    inkX: ((first.x + a.inkX) * a.weight + (second.x + b.inkX) * b.weight) / weight,
    inkY: ((first.y + a.inkY) * a.weight + (second.y + b.inkY) * b.weight) / weight,
    weight,
    placements: [
      ...a.placements.map(position => ({ ...position, x: position.x + first.x, y: position.y + first.y })),
      ...b.placements.map(position => ({ ...position, x: position.x + second.x, y: position.y + second.y })),
    ],
  };
}

function permutations(items) {
  if (items.length < 2) return [items];
  return items.flatMap((item, i) => permutations(items.filter((_, j) => i !== j))
    .map(rest => [item, ...rest]));
}

function positionGroup(group, itemsById, snap) {
  const { width, height, padding, gap, columns } = LIMITS;
  const step = (width - padding * 2 + gap) / columns;
  const offsetX = clamp(width / 2 - group.inkX, padding, width - padding - group.width);
  const offsetY = clamp(height / 2 - group.inkY, padding, height - padding - group.height);
  return group.placements.map(position => {
    const item = itemsById.get(position.id);
    const maxX = width - padding - item.width;
    let x = clamp(position.x + offsetX, padding, maxX);
    if (snap) {
      const column = clamp(Math.round((x - padding) / step), 0,
        Math.floor((maxX - padding) / step + 1e-7));
      x = padding + column * step;
    }
    const maxY = height - padding - item.height;
    return { id: item.id, x, y: clamp(Math.round(position.y + offsetY), padding, maxY) };
  });
}

function compositionCost(positions, itemsById) {
  const { width, height, padding, gap, columns } = LIMITS;
  const step = (width - padding * 2 + gap) / columns;
  const rects = positions.map(position => ({ ...itemsById.get(position.id), ...position }));
  const totalWeight = rects.reduce((sum, item) => sum + item.weight, 0);
  let centroidX = 0;
  let centroidY = 0;
  let leftWeight = 0;
  let alignment = 0;
  for (const item of rects) {
    const proportion = item.weight / totalWeight;
    const inkX = item.x + item.inkX;
    centroidX += inkX * proportion;
    centroidY += (item.y + item.inkY) * proportion;
    // Approximate the visible text extent around its measured center, excluding
    // empty column width so a short paragraph is not treated as a full solid box.
    const inkWidth = Math.max(1, Math.min(item.width, item.inkX * 2, (item.width - item.inkX) * 2));
    leftWeight += clamp((width / 2 - (inkX - inkWidth / 2)) / inkWidth, 0, 1) * proportion;
    const column = (item.x - padding) / step;
    alignment += Math.abs(column - Math.round(column)) / rects.length;
  }
  let collisions = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap = intersection({ ...a, width: a.width + gap, height: a.height + gap },
        { ...b, width: b.width + gap, height: b.height + gap });
      if (overlap) collisions += 1 + overlap.width * overlap.height / (width * height);
    }
  }
  return collisions * 1e6
    + ((centroidX - width / 2) / (width / 2 - padding)) ** 2 * 10000
    + ((centroidY - height / 2) / (height / 2 - padding)) ** 2 * 10000
    + (leftWeight - 0.5) ** 2 * 400
    + alignment * 8;
}

/**
 * Compose the newest one to three sections as one balanced arrangement.
 * `weight` is visible text mass; `inkX`/`inkY` are its local optical centroid.
 * Dimensions and centroids are measured by the renderer after text wrapping.
 * Historical sections deliberately do not participate in this composition.
 */
export function composeLayout({ items, seed = 0 }) {
  if (!Array.isArray(items) || items.length > LIMITS.rememberedSections) {
    throw new RangeError('A composition accepts at most three measured sections.');
  }
  if (!items.length) return [];
  if (new Set(items.map(item => item?.id)).size !== items.length) {
    throw new RangeError('Each section must have a unique id.');
  }
  const measured = items.map(measuredItem);
  const itemsById = new Map(measured.map(item => [item.id, item]));
  const templates = [];
  if (measured.length === 1) templates.push({ group: measured[0], preference: 0 });
  for (const [a, b, c] of measured.length > 1 ? permutations(measured) : []) {
    if (!c) {
      templates.push(
        { group: joinGroups(a, b, 'x'), preference: 0 },
        { group: joinGroups(a, b, 'y'), preference: 2 },
        { group: joinGroups(a, b, 'x', { diagonal: 1 }), preference: 4 },
        { group: joinGroups(a, b, 'x', { diagonal: -1 }), preference: 4 },
      );
    } else {
      const verticalPair = joinGroups(b, c, 'y', { alignStart: true });
      const horizontalPair = joinGroups(b, c, 'x');
      templates.push(
        { group: joinGroups(a, verticalPair, 'x'), preference: 0 },
        { group: joinGroups(verticalPair, a, 'x'), preference: 0 },
        { group: joinGroups(a, horizontalPair, 'y'), preference: 2 },
        { group: joinGroups(horizontalPair, a, 'y'), preference: 2 },
      );
    }
  }
  const random = seededRandom(seed);
  let best = null;
  for (const { group, preference } of templates) {
    for (const snap of [true, false]) {
      const positions = positionGroup(group, itemsById, snap);
      const cost = compositionCost(positions, itemsById) + preference;
      const tieBreak = random();
      if (!best || cost < best.cost - 1e-7
          || (Math.abs(cost - best.cost) <= 1e-7 && tieBreak < best.tieBreak)) {
        best = { positions, cost, tieBreak };
      }
    }
  }
  const byId = new Map(best.positions.map(position => [position.id, position]));
  return measured.map(item => byId.get(item.id));
}
