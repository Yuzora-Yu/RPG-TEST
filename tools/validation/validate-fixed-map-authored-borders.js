const fs = require('fs');
const path = require('path');
const { createRuntimeContext } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const runtime = createRuntimeContext(root);
runtime.runFile('map.js', `
globalThis.__BORDER_VALIDATION__ = {
  TILE_THEMES,
  FIXED_TILE_OVERLAYS,
  FIXED_DUNGEON_MAPS,
  AUTHORED_MAP_PROP_PLACEMENTS
};
`);
const data = runtime.context.__BORDER_VALIDATION__;
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const phaserSource = fs.readFileSync(path.join(root, 'phaser-field.js'), 'utf8');
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const plans = {
  BIG_TOWER: { sizes: [[23, 24], [23, 24], [23, 24], [23, 24], [23, 24], [23, 24], [23, 24]], borders: ['F', '^', '^', '^', '^', '^', '^'], blocked: [null, '^', '^', '^', '^', '^', '^'] },
  THUNDER_FORT: { sizes: [[33, 28], [33, 28], [33, 28], [33, 28], [33, 28], [33, 28]], borders: ['THUNDER_ENTRANCES', 'K', 'K', 'K', 'K', 'K'], blocked: ['H', 'K', 'K', 'K', 'K', 'K'] },
  DARK_CASTLE: { sizes: [[33, 30], [33, 30], [33, 30], [33, 30], [33, 30], [33, 30], [33, 30]], borders: ['I', 'K', 'K', 'K', 'K', 'K', 'K'], blocked: [null, 'K', 'K', 'K', 'K', 'K', 'K'] },
  WIND_TEMPLE: { sizes: [[25, 24], [25, 24], [25, 24]], borders: ['F', 'K', 'K'], blocked: [null, 'K', 'K'] },
  LIGHT_PALACE: { sizes: [[35, 30], [35, 30], [35, 30], [35, 30], [27, 19]], borders: ['I', '^', '^', '^', 'W'], blocked: [null, '^', '^', '^', null] },
  DARK_SHRINE_RUINS: { sizes: [[31, 26], [33, 28]], borders: ['I', 'K'], blocked: [null, 'K'] },
};

function expectedEdge(kind, rowIndex, height) {
  if (kind !== 'THUNDER_ENTRANCES') return kind;
  if (rowIndex === 0 || rowIndex === height - 1) return 'H';
  return rowIndex >= 12 && rowIndex <= 16 ? 'F' : 'H';
}

function visitCoordinates(value, callback, pathParts = []) {
  if (!value || typeof value !== 'object') return;
  const isWorldExit = pathParts.at(-1) === 'exitPoint';
  if (!isWorldExit && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))) callback(value, pathParts.join('.'));
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') visitCoordinates(child, callback, pathParts.concat(Array.isArray(value) ? `[${key}]` : key));
  }
}

for (const [areaKey, plan] of Object.entries(plans)) {
  const dungeon = data.FIXED_DUNGEON_MAPS[areaKey];
  assert(dungeon, `${areaKey}: master missing`);
  if (!dungeon) continue;
  assert(dungeon.floors.length === plan.sizes.length, `${areaKey}: floor count mismatch`);
  dungeon.floors.forEach((floor, floorIndex) => {
    const [width, height] = plan.sizes[floorIndex];
    const kind = plan.borders[floorIndex];
    assert(floor.width === width && floor.height === height, `${areaKey} F${floorIndex + 1}: expected ${width}x${height}, got ${floor.width}x${floor.height}`);
    assert(floor.tiles.length === height, `${areaKey} F${floorIndex + 1}: tile row count mismatch`);
    floor.tiles.forEach((row, y) => {
      assert(row.length === width, `${areaKey} F${floorIndex + 1}: row ${y} width mismatch`);
      const edge = expectedEdge(kind, y, height);
      if (y === 0 || y === height - 1) assert(row === edge.repeat(width), `${areaKey} F${floorIndex + 1}: row ${y} border mismatch`);
      else assert(row[0] === edge && row[width - 1] === edge, `${areaKey} F${floorIndex + 1}: row ${y} side border mismatch`);
    });
    assert(floor.tiles[1] === floor.tiles[2], `${areaKey} F${floorIndex + 1}: second top row must repeat the former top-edge tile row`);
    const blocked = plan.blocked[floorIndex];
    if (blocked) assert((floor.impassableTiles || []).includes(blocked), `${areaKey} F${floorIndex + 1}: ${blocked} must be impassable`);

    visitCoordinates(floor, (point, pointPath) => {
      assert(point.x >= 0 && point.x < width && point.y >= 0 && point.y < height, `${areaKey} F${floorIndex + 1}: ${pointPath} is out of range (${point.x},${point.y})`);
    }, [`${areaKey}.floors[${floorIndex}]`]);

    for (const link of floor.floorLinks || []) {
      if (!Number.isInteger(Number(link.toFloor))) continue;
      const target = dungeon.floors[Number(link.toFloor) - 1];
      assert(target, `${areaKey} F${floorIndex + 1}: missing target floor ${link.toFloor}`);
      if (target) assert(link.targetX >= 0 && link.targetX < target.width && link.targetY >= 0 && link.targetY < target.height, `${areaKey} F${floorIndex + 1}: target coordinate is out of range`);
    }
  });
}

const thunderWorldExits = data.FIXED_DUNGEON_MAPS.THUNDER_FORT.floors[0].floorLinks.filter(link => link.exitPoint).map(link => link.exitPoint);
assert(thunderWorldExits.length === 2
  && thunderWorldExits[0].x === 45 && thunderWorldExits[0].y === 36
  && thunderWorldExits[1].x === 47 && thunderWorldExits[1].y === 36,
'THUNDER_FORT: world exitPoint coordinates must not shift');

const overlaySigns = data.FIXED_TILE_OVERLAYS.DEFAULT_DUNGEON || {};
for (const sign of ['F', 'H', 'I', 'K', '^']) assert(!overlaySigns[sign], `border sign ${sign} must not create a dungeon overlay`);
for (const [themeKey, signs] of Object.entries({
  BIG_TOWER: ['F', '^'], THUNDER_FORT: ['F', 'H', 'K'], DARK_CASTLE: ['I', 'K'],
  WIND_TEMPLE: ['F', 'K'], LIGHT_PALACE: ['I', '^'], DARK_SHRINE_RUINS: ['I', 'K'],
})) for (const sign of signs) {
  assert(data.TILE_THEMES[themeKey]?.[sign], `${themeKey}: tile theme ${sign} missing`);
  assert(data.TILE_THEMES[themeKey]?.[sign]?.terrain === true, `${themeKey}: exterior ${sign} must render on the terrain layer`);
}

const props = Object.fromEntries((data.AUTHORED_MAP_PROP_PLACEMENTS || []).map(prop => [prop.id, prop]));
for (const [id, x, y] of [['carpet-thunder-final', 14, 6], ['carpet-light-final', 16, 8], ['carpet-dark-final', 14, 4]]) {
  assert(props[id]?.x === x && props[id]?.y === y, `${id}: authored placement must move to (${x},${y})`);
}

assert(mainSource.includes('} else if (outOfBounds) {')
  && mainSource.includes('tile = Field.getRenderedTileForDraw(tx, ty, mapW, mapH, Field.getCurrentAreaKey())')
  && mainSource.includes('mtile = Field.getRenderedTileForDraw(mtx, mty, mapW, mapH, Field.getCurrentAreaKey())'),
'Canvas/HTML small minimaps must extend the nearest fixed-map edge tile outside the authored bounds');
assert(phaserSource.includes('outsideFixedMap && !field.currentMapData?.isFixed')
  && phaserSource.includes('field.getRenderedTileForDraw(tx, ty, mapSize.width, mapSize.height, areaKey)'),
'Phaser small minimap must extend the nearest fixed-map edge tile outside the authored bounds');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Fixed-map authored border validation passed: 6 facilities, 30 floors, top-2/other-edge-1 borders, all in-map coordinates and world exits checked.');
