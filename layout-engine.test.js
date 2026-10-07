import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, choosePlacement, composeLayout, overlapRegions } from './layout-engine.js';

const rect = (x, y, width, height, sectionId) => ({ x, y, width, height, sectionId });

test('four distinct overlap locations remain below the cleanup threshold; five exceed it', () => {
  const lines = Array.from({ length: 5 }, (_, i) => [
    rect(i * 30, 0, 20, 20, 'a'),
    rect(i * 30 + 10, 5, 20, 10, 'b'),
  ]).flat();
  assert.equal(overlapRegions(lines.slice(0, 8)).length, 4);
  assert.equal(overlapRegions(lines.slice(0, 8)).length > LIMITS.overlapLimit, false);
  assert.equal(overlapRegions(lines).length > LIMITS.overlapLimit, true);
});

test('multiple pairs in one location count as one region with every participating section', () => {
  const regions = overlapRegions([
    rect(0, 0, 100, 20, 'a'),
    rect(10, 0, 100, 20, 'b'),
    rect(20, 0, 100, 20, 'c'),
  ]);
  assert.equal(regions.length, 1);
  assert.deepEqual(regions[0], { x: 10, y: 0, width: 100, height: 20, sectionIds: ['a', 'b', 'c'] });
});

test('edge and corner touching source rectangles do not overlap', () => {
  assert.deepEqual(overlapRegions([
    rect(0, 0, 10, 10, 'a'),
    rect(10, 0, 10, 10, 'b'),
    rect(20, 10, 10, 10, 'c'),
  ]), []);
});

test('line rectangles from the same section do not count as collisions', () => {
  assert.deepEqual(overlapRegions([
    rect(0, 0, 100, 100, 'same'),
    rect(10, 10, 100, 100, 'same'),
  ]), []);
});

test('region connectivity uses actual intersections, not their enlarged bounding box', () => {
  // An L-shaped overlap surrounds a separate square without touching it.
  const regions = overlapRegions([
    rect(0, 0, 10, 100, 'a'), rect(0, 0, 100, 10, 'a'),
    rect(0, 0, 100, 100, 'b'),
    rect(50, 50, 10, 10, 'c'),
  ]);
  assert.equal(regions.length, 2);
});

test('connected intersections merge transitively', () => {
  const regions = overlapRegions([
    rect(0, 0, 100, 10, 'a'),
    rect(0, 0, 20, 10, 'b'),
    rect(40, 0, 20, 10, 'b'),
    rect(20, 0, 20, 10, 'b'),
  ]);
  assert.equal(regions.length, 1);
  assert.equal(regions[0].width, 60);
});

test('placement stays inside the padding and uses the grid for many sizes and seeds', () => {
  const columnStep = (LIMITS.width - 2 * LIMITS.padding + LIMITS.gap) / LIMITS.columns;
  const rowStep = (LIMITS.height - 2 * LIMITS.padding + LIMITS.gap) / LIMITS.rows;
  for (const [width, height] of [[141, 190], [613, 400], [LIMITS.width - 2 * LIMITS.padding, LIMITS.height - 2 * LIMITS.padding]]) {
    for (let seed = 0; seed < 100; seed++) {
      const { x, y } = choosePlacement({ width, height, seed });
      assert.ok(x >= LIMITS.padding && y >= LIMITS.padding);
      assert.ok(x + width <= LIMITS.width - LIMITS.padding + 1e-7 && y + height <= LIMITS.height - LIMITS.padding + 1e-7);
      const column = (x - LIMITS.padding) / columnStep;
      const row = (y - LIMITS.padding) / rowStep;
      assert.ok(Math.abs(column - Math.round(column)) < 1e-7);
      assert.ok(Math.abs(row - Math.round(row)) < 1e-7);
    }
  }
});

test('placement prefers a clear location and varies deterministic ties by seed', () => {
  const occupied = [rect(LIMITS.padding, LIMITS.padding, 1500, 800, 'old')];
  const options = { width: 100, height: 100, occupied, seed: 'frame-12' };
  assert.deepEqual(choosePlacement(options), choosePlacement(options));
  const placement = choosePlacement(options);
  assert.equal(overlapRegions([...occupied, { ...placement, width: 100, height: 100, sectionId: 'new' }]).length, 0);
  const locations = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(
    choosePlacement({ width: 100, height: 100, seed }),
  )));
  assert.ok(locations.size > 3);
});

test('oversized and invalid sections fail explicitly', () => {
  for (const [width, height] of [[2000, 100], [100, 1100], [NaN, 100], [0, 100]]) {
    assert.throws(() => choosePlacement({ width, height }), RangeError);
  }
});

function opticalCenter(items, positions) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return items.reduce((center, item, index) => ({
    x: center.x + (positions[index].x + item.inkX) * item.weight / total,
    y: center.y + (positions[index].y + item.inkY) * item.weight / total,
  }), { x: 0, y: 0 });
}

function assertClearComposition(items, positions) {
  const rectangles = positions.map((position, index) => ({ ...items[index], ...position }));
  for (const item of rectangles) {
    assert.ok(item.x >= LIMITS.padding && item.y >= LIMITS.padding, `${item.id} starts within the canvas`);
    assert.ok(item.x + item.width <= LIMITS.width - LIMITS.padding + 1e-7, `${item.id} fits horizontally`);
    assert.ok(item.y + item.height <= LIMITS.height - LIMITS.padding + 1e-7, `${item.id} fits vertically`);
  }
  for (let i = 0; i < rectangles.length; i++) {
    for (let j = i + 1; j < rectangles.length; j++) {
      const a = rectangles[i];
      const b = rectangles[j];
      assert.ok(a.x + a.width + LIMITS.gap <= b.x + 1e-7 || b.x + b.width + LIMITS.gap <= a.x + 1e-7
        || a.y + a.height + LIMITS.gap <= b.y + 1e-7 || b.y + b.height + LIMITS.gap <= a.y + 1e-7,
      `${a.id} and ${b.id} have a clear ${LIMITS.gap}px separation`);
    }
  }
}

test('a solitary section centers its visible ink rather than its empty column box', () => {
  const items = [{ id: 'solo', width: 928, height: 300, weight: 100, inkX: 380, inkY: 100 }];
  const positions = composeLayout({ items });
  const center = opticalCenter(items, positions);
  assert.ok(Math.abs(center.x - 960) < 10);
  assert.ok(Math.abs(center.y - 540) <= 0.5);
  assert.notEqual(positions[0].x + items[0].width / 2, 960);
  assertClearComposition(items, positions);
});

test('two equally weighted sections oppose each other across the center', () => {
  const items = ['a', 'b'].map(id => ({ id, width: 770, height: 180,
    weight: 100, inkX: 310, inkY: 75 }));
  for (let seed = 0; seed < 20; seed++) {
    const positions = composeLayout({ items, seed });
    const centers = positions.map((position, i) => position.x + items[i].inkX);
    const center = opticalCenter(items, positions);
    assert.ok(Math.min(...centers) < 700 && Math.max(...centers) > 1200);
    assert.ok(Math.abs(center.x - 960) < 10);
    assert.ok(Math.abs(positions[0].y - positions[1].y) <= 1);
    assertClearComposition(items, positions);
  }
});

test('a heavy section counterbalances two smaller sections on the opposite side', () => {
  const items = [
    { id: 'heavy', width: 770, height: 300, weight: 200, inkX: 340, inkY: 130 },
    { id: 'small-a', width: 600, height: 150, weight: 100, inkX: 260, inkY: 60 },
    { id: 'small-b', width: 600, height: 150, weight: 100, inkX: 260, inkY: 60 },
  ];
  for (let seed = 0; seed < 20; seed++) {
    const positions = composeLayout({ items, seed });
    const center = opticalCenter(items, positions);
    assert.ok(Math.abs(center.x - 960) < 50);
    assert.ok(Math.abs(center.y - 540) < 1);
    assert.ok(Math.abs(positions[1].x - positions[2].x) < 1);
    assert.ok(Math.abs(positions[0].x - positions[1].x) > 700);
    assert.ok(positions[0].y > Math.min(positions[1].y, positions[2].y));
    assert.ok(positions[0].y < Math.max(positions[1].y, positions[2].y));
    assertClearComposition(items, positions);
  }
});

test('balanced layouts remain deterministic and readable at the renderer column widths', () => {
  const columnWidth = (LIMITS.width - 2 * LIMITS.padding - (LIMITS.columns - 1) * LIMITS.gap) / LIMITS.columns;
  const span = count => count * columnWidth + (count - 1) * LIMITS.gap;
  for (const [width, height] of [[span(5), 350], [span(6), 360], [300, 500]]) {
    for (let seed = 0; seed < 12; seed++) {
      const items = ['a', 'b', 'c'].map((id, i) => ({ id, width, height,
        weight: 100 + i * 80, inkX: width * 0.42, inkY: height * 0.45 }));
      const positions = composeLayout({ items, seed });
      assert.deepEqual(positions, composeLayout({ items, seed }));
      assert.deepEqual(positions.map(position => position.id), ['a', 'b', 'c']);
      assertClearComposition(items, positions);
      assert.ok(Math.abs(opticalCenter(items, positions).x - 960) < 150);
    }
  }
});

test('composition validates counts, dimensions, weights, and optical centers', () => {
  assert.deepEqual(composeLayout({ items: [] }), []);
  for (const item of [
    { width: 2000, height: 100 }, { width: 100, height: 0 },
    { width: 100, height: 100, weight: NaN }, { width: 100, height: 100, weight: -1 },
    { width: 100, height: 100, inkX: 101 }, { width: 100, height: 100, inkY: -1 },
  ]) assert.throws(() => composeLayout({ items: [{ id: 'bad', ...item }] }), RangeError);
  assert.throws(() => composeLayout({ items: ['a', 'b', 'c', 'd']
    .map(id => ({ id, width: 100, height: 100 })) }), RangeError);
  assert.throws(() => composeLayout({ items: ['same', 'same']
    .map(id => ({ id, width: 100, height: 100 })) }), RangeError);
});
