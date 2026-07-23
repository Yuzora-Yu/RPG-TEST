const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapRuntime(root);
const targets = [
  'BIG_TOWER',
  'THUNDER_FORT',
  'DARK_CASTLE',
  'WIND_TEMPLE',
  'LIGHT_PALACE',
  'DARK_SHRINE_RUINS',
];
const coordinateKeys = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'toX', 'toY', 'targetX', 'targetY',
  'minX', 'minY', 'maxX', 'maxY',
]);

function visit(value, pathParts, rows) {
  if (!value || typeof value !== 'object') return;
  const fields = Object.keys(value).filter(key => coordinateKeys.has(key));
  if (fields.length) {
    rows.push({
      path: pathParts.join('.'),
      coordinates: Object.fromEntries(fields.map(key => [key, value[key]])),
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== 'object') continue;
    visit(child, pathParts.concat(Array.isArray(value) ? `[${key}]` : key), rows);
  }
}

for (const areaKey of targets) {
  const dungeon = context.FIXED_DUNGEON_MAPS[areaKey];
  if (!dungeon) throw new Error(`${areaKey}: missing`);
  const rows = [];
  visit(dungeon, [areaKey], rows);
  console.log(`\n## ${areaKey}`);
  for (const row of rows) console.log(`${row.path} ${JSON.stringify(row.coordinates)}`);
}
