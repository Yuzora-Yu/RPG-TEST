const fs = require('fs');
const {
  collectReachableCells,
  findTileEffect,
  getTile,
  loadMapRuntime,
  resolveTileEffectMove,
} = require('./validation-helpers');
const {
  createFixedNavigationGraph,
  getNavigationTargets,
} = require('./fixed-navigation-model');

const root = process.cwd();
const mainSource = fs.readFileSync(`${root}/main.js`, 'utf8');
const dungeonSource = fs.readFileSync(`${root}/dungeon.js`, 'utf8');
const { context } = loadMapRuntime(root);
const { FIXED_DUNGEON_MAPS, MapRegistry } = context;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let wallCellsFiltered = 0;
let protectedCellsFiltered = 0;
let iceFloorsChecked = 0;
let explicitStopsChecked = 0;
let navigationStatesChecked = 0;
let importantTargetsChecked = 0;
let switchesChecked = 0;

function getFloorStarts(areaKey, base, floor, def) {
  const starts = [def.entryPoint].filter(Boolean).map(point => ({ x: Number(point.x), y: Number(point.y) }));
  const floorCount = Array.isArray(base.floors) && base.floors.length ? base.floors.length : 1;
  for (let sourceFloor = 1; sourceFloor <= floorCount; sourceFloor += 1) {
    const source = MapRegistry.getFixedDungeonFloor(areaKey, sourceFloor);
    for (const link of source.floorLinks || []) {
      if (Number(link.toFloor) !== floor || !Number.isFinite(Number(link.targetX)) || !Number.isFinite(Number(link.targetY))) continue;
      starts.push({ x: Number(link.targetX), y: Number(link.targetY) });
    }
  }
  return starts.filter((point, index) => starts.findIndex(candidate => candidate.x === point.x && candidate.y === point.y) === index);
}

for (const [areaKey, base] of Object.entries(FIXED_DUNGEON_MAPS)) {
  const floorCount = Array.isArray(base.floors) && base.floors.length ? base.floors.length : 1;
  for (let floor = 1; floor <= floorCount; floor += 1) {
    const def = MapRegistry.getFixedDungeonFloor(areaKey, floor);
    const surfaceEffects = (def.tileEffects || []).filter(effect => effect.type === 'ice' || effect.type === 'poison');
    if (!surfaceEffects.length) continue;

    for (const effect of surfaceEffects) {
      for (const point of effect.excludePoints || []) {
        explicitStopsChecked += 1;
        assert(MapRegistry.isPointInEffect(effect, point.x, point.y), `${areaKey} F${floor}: excluded stop is outside its effect range`);
        assert(MapRegistry.findTileEffect(def, point.x, point.y) === null, `${areaKey} F${floor}: excluded stop still owns an effect`);
      }
      for (let y = 0; y < def.height; y += 1) {
        for (let x = 0; x < def.width; x += 1) {
          if (!MapRegistry.isPointInEffect(effect, x, y)) continue;
          const tile = getTile(def, x, y);
          const runtimeEffect = MapRegistry.findTileEffect(def, x, y);
          if (tile === 'W') {
            wallCellsFiltered += 1;
            assert(runtimeEffect?.type !== effect.type, `${areaKey} F${floor} ${x},${y}: wall still owns ${effect.type}`);
          }
          if (MapRegistry.isProtectedTileEffectCell(def, x, y)) {
            protectedCellsFiltered += 1;
            assert(runtimeEffect?.type !== effect.type, `${areaKey} F${floor} ${x},${y}: protected cell still owns ${effect.type}`);
          }
        }
      }
    }

    if (!surfaceEffects.some(effect => effect.type === 'ice')) continue;
    iceFloorsChecked += 1;

    // Model the directed runtime graph, including sliding, warps, adjacent switches,
    // opened gates, and the walkable tile left after a fixed boss is defeated.
    // Every important target that was reachable without ice must remain reachable,
    // and every reachable state must retain a route back to at least one floor link.
    const starts = getFloorStarts(areaKey, base, floor, def);
    for (const start of starts) {
      if (getTile(def, start.x, start.y) === 'W') continue;
      const withoutIce = createFixedNavigationGraph(def, start, MapRegistry, { disableIce: true });
      const withIce = createFixedNavigationGraph(def, start, MapRegistry);
      assert(withoutIce && withIce, `${areaKey} F${floor}: navigation graph could not be built from ${start.x},${start.y}`);
      navigationStatesChecked += withIce.states.size;
      for (const target of getNavigationTargets(def)) {
        if (!withoutIce.hasPosition(target.reaches)) continue;
        importantTargetsChecked += 1;
        assert(
          withIce.hasPosition(target.reaches),
          `${areaKey} F${floor}: ice removed access from ${start.x},${start.y} to ${target.type} ${target.x},${target.y}`,
        );
      }
      assert(
        withIce.softlockedStates.length === 0,
        `${areaKey} F${floor}: ${withIce.softlockedStates.length} reachable navigation states cannot return to a floor link from ${start.x},${start.y}`,
      );
    }
  }
}

// Switches are physical devices: they use an authored theme image, are marked on
// both minimaps, block their own tile, and can be operated from an adjacent tile.
for (const [areaKey, base] of Object.entries(FIXED_DUNGEON_MAPS)) {
  if (!Array.isArray(base?.floors)) continue;
  for (let floor = 1; floor <= base.floors.length; floor += 1) {
    const def = MapRegistry.getFixedDungeonFloor(areaKey, floor);
    const switches = (def.mapActions || []).filter(action => action?.type === 'switchGate');
    if (!switches.length) continue;
    const starts = getFloorStarts(areaKey, base, floor, def);
    const graphs = starts.map(start => createFixedNavigationGraph(def, start, MapRegistry)).filter(Boolean);
    for (const action of switches) {
      switchesChecked += 1;
      assert(action.imageKey && action.imageKey !== 'overlay_dungeon_event', `${areaKey} F${floor} ${action.x},${action.y}: switch still uses the generic event image`);
      assert(action.blocksMovement === true, `${areaKey} F${floor} ${action.x},${action.y}: switch does not block its occupied tile`);
      assert(action.interactFromAdjacent === true, `${areaKey} F${floor} ${action.x},${action.y}: switch is not adjacent-interactable`);
      assert(/^#[0-9a-f]{6}$/i.test(String(action.minimapColor || '')), `${areaKey} F${floor} ${action.x},${action.y}: switch has no explicit minimap color`);
      const target = getNavigationTargets({ ...def, mapActions: [action] }).find(candidate => candidate.type === 'action');
      assert(graphs.some(graph => graph.hasPosition(target.reaches)), `${areaKey} F${floor} ${action.x},${action.y}: no entrance can approach switch`);
    }
  }
}

const synthetic = {
  width: 7,
  height: 3,
  tiles: ['WWWWWWW', 'WTTTDWW', 'WWWWWWW'],
  floorLinks: [{ x: 4, y: 1, toFloor: 2 }],
  tileEffects: [{ type: 'ice', rect: { x1: 1, y1: 1, x2: 5, y2: 1 } }],
};
assert(findTileEffect(synthetic, 4, 1) === null, 'synthetic stair inherited ice effect');
const stop = resolveTileEffectMove(synthetic, 2, 1, 1, 0);
assert(stop.x === 4 && stop.y === 1, `ice did not stop on protected stair (${stop.x},${stop.y})`);

const crenaF1 = MapRegistry.getFixedDungeonFloor('CRENA_LIMESTONE_CAVE', 1);
const crenaWarpA = findTileEffect(crenaF1, 8, 10);
const crenaWarpB = findTileEffect(crenaF1, 19, 9);
assert(crenaWarpA?.type === 'warp' && crenaWarpA.toX === 19 && crenaWarpA.toY === 9, 'Crena Cave F1 first crystal warp is not restored');
assert(crenaWarpB?.type === 'warp' && crenaWarpB.toX === 8 && crenaWarpB.toY === 10, 'Crena Cave F1 return crystal warp is not restored');
assert(!(crenaF1.tileEffects || []).some(effect => effect.type === 'ice'), 'Crena Cave F1 still contains an unintended ice effect');

const crenaF2 = MapRegistry.getFixedDungeonFloor('CRENA_LIMESTONE_CAVE', 2);
const crenaF2WarpA = findTileEffect(crenaF2, 3, 5);
const crenaF2WarpB = findTileEffect(crenaF2, 24, 14);
assert(crenaF2WarpA?.type === 'warp' && crenaF2WarpA.toX === 24 && crenaF2WarpA.toY === 14, 'Crena Cave B2 first crystal warp is not paired with the return crystal');
assert(crenaF2WarpB?.type === 'warp' && crenaF2WarpB.toX === 3 && crenaF2WarpB.toY === 5, 'Crena Cave B2 return crystal warp is not reciprocal');

const crenaF3 = MapRegistry.getFixedDungeonFloor('CRENA_LIMESTONE_CAVE', 3);
const crenaF3Graph = createFixedNavigationGraph(crenaF3, crenaF3.entryPoint, MapRegistry);
const crenaF3Forward = (crenaF3.floorLinks || []).find(link => Number(link.toFloor) === 4);
const crenaF3Return = (crenaF3.floorLinks || []).find(link => Number(link.toFloor) === 2);
const crenaF3Switches = (crenaF3.mapActions || []).filter(action => action?.type === 'switchGate');
assert(crenaF3.tiles?.[10]?.slice(13, 16) === 'WWW', 'Crena Cave B3 central barrier is open before its switches');
assert(crenaF3Graph && !crenaF3Graph.hasPosition(state => state.switchMask === 0 && Number(state.x) === Number(crenaF3Forward?.x) && Number(state.y) === Number(crenaF3Forward?.y)), 'Crena Cave B3 can reach B4 without operating switches');
assert(crenaF3Graph?.hasPosition(state => state.switchMask === 3 && Number(state.x) === Number(crenaF3Forward?.x) && Number(state.y) === Number(crenaF3Forward?.y)), 'Crena Cave B3 cannot reach B4 after operating both switches');
assert(crenaF3Switches.some(action => Number(action.x) === 5 && Number(action.y) === 6), 'Crena Cave B3 left switch is not in the new upper-left chamber');
assert(crenaF3Graph?.hasPosition(state => Math.abs(state.x - 5) + Math.abs(state.y - 6) === 1), 'Crena Cave B3 upper-left switch chamber is not reachable');
assert(crenaF3Switches.every(action => (action.opens || []).length === 1 && Number(action.opens[0].x) === 14 && Number(action.opens[0].y) === 10 && action.opens[0].effectType === 'ice'), 'Crena Cave B3 gate does not replace only the central wall with ice');
assert(crenaF3Return && crenaF3.tiles?.[crenaF3Return.y]?.[crenaF3Return.x] === 'U', 'Crena Cave B3 return staircase has no visible upward stair tile');

const crenaF4 = MapRegistry.getFixedDungeonFloor('CRENA_LIMESTONE_CAVE', 4);
const crenaF4Return = (crenaF4.floorLinks || []).find(link => Number(link.toFloor) === 3);
assert(crenaF4Return && crenaF4.tiles?.[crenaF4Return.y]?.[crenaF4Return.x] === 'U', 'Crena Cave B4 return staircase has no visible upward stair tile');

assert(mainSource.includes('getMiniMapTileColor:'), 'minimap color policy is not centralized');
assert(mainSource.includes("themeKey === 'DARK_CASTLE'"), 'dark-castle minimap contrast override is missing');
assert(mainSource.includes('isAdjacentInteractableMapAction:'), 'adjacent map-action interaction policy is missing');
assert(mainSource.includes('action.interactFromAdjacent === true'), 'explicit adjacent switch interaction is missing');
assert(mainSource.includes('getRuntimeTileEffectAt:'), 'switch-generated floor effects have no centralized runtime resolver');
assert(mainSource.includes('definition?.effectType'), 'switch-generated floor effects are not restored from saved map changes');
assert(dungeonSource.includes("if (!nextEffect || nextEffect.type !== 'ice') break;"), 'ice still slides beyond its contiguous surface');
assert(dungeonSource.includes('Field.getRuntimeTileEffectAt'), 'ice continuation ignores switch-generated floor effects');
assert(wallCellsFiltered > 0, 'test data did not exercise wall/effect overlap');
assert(explicitStopsChecked > 0, 'test data did not exercise an authored surface-effect stop');

console.log(`Minimap/hazard safety passed. Wall cells filtered: ${wallCellsFiltered}. Protected cells filtered: ${protectedCellsFiltered}. Explicit stops: ${explicitStopsChecked}. Ice floors checked: ${iceFloorsChecked}.`);
console.log(`Directed navigation states: ${navigationStatesChecked}. Important targets: ${importantTargetsChecked}. Adjacent switches: ${switchesChecked}.`);
