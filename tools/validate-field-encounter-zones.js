const fs = require('fs');
const vm = require('vm');

const root = process.cwd();
const context = {
  console,
  window: {},
  tileEntry: (img, color) => ({ img, color }),
};
context.globalThis = context;
vm.createContext(context);

const mapCode = fs.readFileSync(`${root}/map.js`, 'utf8');
vm.runInContext(`${mapCode}\nglobalThis.__MAPS__ = { MAP_DATA, FIELD_ENCOUNTER_ZONES, STORY_DATA, FIXED_DUNGEON_MAPS, MapRegistry };`, context, { filename: 'map.js' });
const charactersCode = fs.readFileSync(`${root}/characters.js`, 'utf8');
vm.runInContext(charactersCode, context, { filename: 'characters.js' });
const itemsCode = fs.readFileSync(`${root}/items.js`, 'utf8');
vm.runInContext(itemsCode, context, { filename: 'items.js' });
const monstersCode = fs.readFileSync(`${root}/monsters.js`, 'utf8');
vm.runInContext(monstersCode, context, { filename: 'monsters.js' });
const questsCode = fs.readFileSync(`${root}/quests.js`, 'utf8');
vm.runInContext(questsCode, context, { filename: 'quests.js' });
const dungeonCode = fs.readFileSync(`${root}/dungeon.js`, 'utf8');

const { MAP_DATA, FIELD_ENCOUNTER_ZONES, STORY_DATA, FIXED_DUNGEON_MAPS, MapRegistry } = context.__MAPS__;
const QUEST_DATA = context.window.QUEST_DATA;
const CHARACTERS_DATA = context.window.CHARACTERS_DATA;
const ITEMS_DATA = context.window.ITEMS_DATA;
const getMonsterById = context.window.MonsterData?.getMonsterById;
const mapH = MAP_DATA.length;
const mapW = MAP_DATA[0].length;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isLand(tile) {
  const upper = String(tile || '').toUpperCase();
  return upper && upper !== 'W' && upper !== 'M';
}

function isConnected(fromX, fromY, toX, toY, maxSteps = 80) {
  const sx = ((Number(fromX) % mapW) + mapW) % mapW;
  const sy = ((Number(fromY) % mapH) + mapH) % mapH;
  const tx = ((Number(toX) % mapW) + mapW) % mapW;
  const ty = ((Number(toY) % mapH) + mapH) % mapH;
  if (sx === tx && sy === ty) return true;
  if (!isLand(MAP_DATA[sy]?.[sx]) || !isLand(MAP_DATA[ty]?.[tx])) return false;

  const queue = [{ x: sx, y: sy, d: 0 }];
  const seen = new Set([`${sx},${sy}`]);
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi];
    if (p.d >= maxSteps) continue;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = ((p.x + dx) % mapW + mapW) % mapW;
      const ny = ((p.y + dy) % mapH + mapH) % mapH;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !isLand(MAP_DATA[ny]?.[nx])) continue;
      if (nx === tx && ny === ty) return true;
      seen.add(key);
      queue.push({ x: nx, y: ny, d: p.d + 1 });
    }
  }
  return false;
}

function getProfile(x, y) {
  const matches = FIELD_ENCOUNTER_ZONES.filter(zone => {
    if (zone.rect) {
      return x >= Number(zone.rect.x1) && x <= Number(zone.rect.x2) && y >= Number(zone.rect.y1) && y <= Number(zone.rect.y2);
    }
    const dx = x - Number(zone.centerX || 0);
    const dy = y - Number(zone.centerY || 0);
    const radius = Number(zone.radius || 0);
    if (!(radius > 0 && Math.sqrt(dx * dx + dy * dy) <= radius)) return false;
    return isConnected(x, y, zone.centerX, zone.centerY, Math.ceil(radius * 4) + 20);
  });
  const candidates = matches.length > 0
    ? matches
    : FIELD_ENCOUNTER_ZONES.filter(zone => isConnected(x, y, zone.centerX, zone.centerY, Math.ceil(Number(zone.radius || 0) * 4) + 20));

  let best = null;
  let bestScore = Infinity;
  candidates.forEach(zone => {
    const dx = x - Number(zone.centerX || 0);
    const dy = y - Number(zone.centerY || 0);
    const score = Math.sqrt(dx * dx + dy * dy) - (Number(zone.priority || 0) * 8);
    if (score < bestScore) {
      best = zone;
      bestScore = score;
    }
  });
  return best;
}

const startSamples = [
  { x: 58, y: 64, label: 'start center' },
  { x: 58, y: 65, label: 'start exit' },
  { x: 59, y: 64, label: 'near start/light-radius edge' },
];

startSamples.forEach(p => {
  const profile = getProfile(p.x, p.y);
  assert(profile?.id === 'START_PLAINS', `${p.label}: expected START_PLAINS, got ${profile?.id || 'none'}`);
  assert(!isConnected(p.x, p.y, 67, 48, 100), `${p.label}: should be separated from LIGHT_PALACE_GROVE by sea/mountains`);
});

const lightProfile = getProfile(67, 48);
assert(lightProfile?.id === 'LIGHT_PALACE_GROVE', `light center: expected LIGHT_PALACE_GROVE, got ${lightProfile?.id || 'none'}`);

const trialProfile = getProfile(2, 2);
assert(trialProfile?.id === 'TRIAL_ISLAND_FIELD', `trial island: expected TRIAL_ISLAND_FIELD, got ${trialProfile?.id || 'none'}`);
assert(Number(trialProfile.rank) === 100, `trial island: expected rank 100, got ${trialProfile.rank}`);
assert(trialProfile.rareMonsters?.some(m => Number(m.id) === 200203 && Number(m.rate) === 0.05), 'trial island: missing 5% Metal Lord rare monster');

const summitProfile = getProfile(89, 77);
assert(summitProfile?.id === 'SUMMIT_TEMPLE_FIELD', `summit temple: expected SUMMIT_TEMPLE_FIELD, got ${summitProfile?.id || 'none'}`);
assert(Number(summitProfile.rank) === 150, `summit temple: expected rank 150, got ${summitProfile.rank}`);
assert(summitProfile.rareMonsters?.some(m => Number(m.id) === 200203 && Number(m.rate) === 0.05), 'summit temple: missing 5% Metal Lord rare monster');

[
  ['BIG_TOWER', 1, 200201],
  ['BIG_TOWER', 2, 200201],
  ['BIG_TOWER', 3, 200201],
  ['BIG_TOWER', 4, 200201],
  ['BIG_TOWER', 5, 200202],
  ['BIG_TOWER', 6, 200202],
  ['BIG_TOWER', 7, 200202],
  ['THUNDER_FORT', 1, 200201],
  ['THUNDER_FORT', 2, 200201],
  ['THUNDER_FORT', 3, 200201],
  ['THUNDER_FORT', 4, 200201],
  ['LIGHT_PALACE', 1, 200202],
  ['LIGHT_PALACE', 2, 200202],
  ['LIGHT_PALACE', 3, 200202],
  ['LIGHT_PALACE', 4, 200202],
  ['SEABED_TEMPLE', 1, 200201],
  ['SEABED_TEMPLE', 2, 200201],
  ['SEABED_TEMPLE', 3, 200201],
  ['DARK_CASTLE', 1, 200202],
  ['DARK_CASTLE', 2, 200202],
  ['DARK_CASTLE', 3, 200202],
  ['DARK_CASTLE', 4, 200202],
  ['DARK_CASTLE', 5, 200202],
  ['DARK_CASTLE', 6, 200202],
  ['DARK_CASTLE', 7, 200202],
].forEach(([area, floor, rareId]) => {
  const def = MapRegistry.getFixedDungeonFloor(area, floor);
  assert(def, `${area} F${floor}: missing floor`);
  assert(def.rareMonsters?.some(m => Number(m.id) === rareId && Number(m.rate) === 0.05), `${area} F${floor}: missing 5% rare monster ${rareId}`);
});

[
  ['FOREST_WIND_HOLE', 79, 44],
  ['CRENA_LIMESTONE_CAVE', 74, 16],
  ['DARK_SHRINE_RUINS', 37, 47],
  ['GREZELIA_FORBIDDEN', 38, 59],
].forEach(([area, x, y]) => {
  assert(STORY_DATA.areas[area], `${area}: missing story area`);
  assert(Number(STORY_DATA.areas[area].centerX) === x && Number(STORY_DATA.areas[area].centerY) === y, `${area}: wrong world coordinate`);
  assert(FIXED_DUNGEON_MAPS[area], `${area}: missing fixed dungeon`);
  assert(MapRegistry.getFixedDungeonFloor(area, 1), `${area}: missing first floor`);
});

assert(QUEST_DATA && typeof QUEST_DATA === 'object', 'QUEST_DATA missing');
Object.entries(QUEST_DATA).forEach(([questId, quest]) => {
  assert(quest.name && quest.objective, `${questId}: missing name/objective`);
  (quest.rewardAllies || []).forEach(charId => {
    assert(CHARACTERS_DATA.some(c => Number(c.id) === Number(charId)), `${questId}: reward ally ${charId} is not in characters.js`);
  });
  (quest.rewardItems || []).forEach(item => {
    const itemId = Number(item.id || item.itemId);
    assert(ITEMS_DATA.some(i => Number(i.id) === itemId), `${questId}: reward item ${itemId} is not in items.js`);
  });
});

function isFixedWalkable(def, x, y) {
  if (!def || x < 0 || y < 0 || x >= Number(def.width) || y >= Number(def.height)) return false;
  const tile = String(def.tiles?.[y]?.[x] || 'W').toUpperCase();
  return tile !== 'W';
}

Object.entries(FIXED_DUNGEON_MAPS).forEach(([area, base]) => {
  const floorCount = Array.isArray(base.floors) ? base.floors.length : 1;
  for (let floor = 1; floor <= floorCount; floor++) {
    const def = MapRegistry.getFixedDungeonFloor(area, floor);
    (def.tileEffects || []).forEach((effect, index) => {
      const label = `${area} F${floor} tileEffects[${index}]`;
      assert(effect.type !== 'angel', `${label}: trial angels must be randomly spawned, not fixed`);
      assert(isFixedWalkable(def, Number(effect.x), Number(effect.y)), `${label}: effect is not on walkable tile`);
      if (effect.type === 'warp') {
        assert(isFixedWalkable(def, Number(effect.toX), Number(effect.toY)), `${label}: warp target is not walkable`);
      }
      if (effect.type === 'hunter' || effect.type === 'angel') {
        (effect.monsterIds || [effect.monsterId]).filter(Boolean).forEach(id => {
          assert(typeof getMonsterById === 'function' && getMonsterById(Number(id)), `${label}: monster ${id} is missing`);
        });
      }
    });
  }
});

assert(/trialAngelSpawnRate:\s*0\.05\b/.test(dungeonCode), 'trial angel spawn rate must remain 5%');
assert(/trialAngelMinFloor:\s*50\b/.test(dungeonCode), 'random-dungeon trial angels must start at floor 50');
assert(/trialAngelMinEncounterRank:\s*50\b/.test(dungeonCode), 'fixed-dungeon trial angels must require encounter rank 50');

console.log('Field encounter zone validation passed. Terrain-separated zones, rare metals, new dungeons, quests, items, and tile effects are valid.');
