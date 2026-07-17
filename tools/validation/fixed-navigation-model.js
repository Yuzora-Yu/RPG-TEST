const DIRECTIONS = [
  [0, -1, 'U'],
  [1, 0, 'R'],
  [0, 1, 'D'],
  [-1, 0, 'L'],
];

function number(value) {
  return Number(value);
}

function samePosition(a, b) {
  return number(a?.x) === number(b?.x) && number(a?.y) === number(b?.y);
}

function createFixedNavigationGraph(mapDef, start, MapRegistry, options = {}) {
  const switches = (mapDef.mapActions || []).filter(action => action?.type === 'switchGate');
  const bosses = mapDef.bosses || [];
  const width = number(mapDef.width || String(mapDef.tiles?.[0] || '').length);
  const height = number(mapDef.height || mapDef.tiles?.length || 0);
  const disableIce = options.disableIce === true;

  const stateKey = state => `${state.x},${state.y},${state.switchMask},${state.bossMask}`;
  const isSwitchPressed = (state, switchId) => switches.some((action, index) =>
    String(action.switchId || `${action.x},${action.y}`) === String(switchId)
      && !!(state.switchMask & (1 << index))
  );
  const isGateOpen = (state, action) => {
    const required = Array.isArray(action.requiredSwitches) && action.requiredSwitches.length
      ? action.requiredSwitches
      : switches
        .filter(candidate => (candidate.gateId || 'gate') === (action.gateId || 'gate'))
        .map(candidate => candidate.switchId || `${candidate.x},${candidate.y}`);
    return required.every(switchId => isSwitchPressed(state, switchId));
  };

  const getTile = (state, x, y) => {
    let tile = String(mapDef.tiles?.[y]?.[x] || 'W').toUpperCase();
    for (const action of switches) {
      if (!isGateOpen(state, action)) continue;
      for (const open of action.opens || []) {
        if (number(open.x) === x && number(open.y) === y) tile = String(open.tile || 'T').toUpperCase();
      }
    }
    const bossIndex = bosses.findIndex(boss => number(boss.x) === x && number(boss.y) === y);
    if (tile === 'B' && bossIndex >= 0 && (state.bossMask & (1 << bossIndex))) tile = 'G';
    return tile;
  };

  const isWalkable = (state, x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const tile = getTile(state, x, y);
    if (['W', 'C', 'R', 'X', 'Y', 'Z'].includes(tile)) return false;
    if (tile === 'B') return false;
    if ((mapDef.chests || []).some(chest => number(chest.x) === x && number(chest.y) === y)) return false;
    if ((mapDef.blockingObjects || []).some(object => object?.active !== false && number(object.x) === x && number(object.y) === y)) return false;
    const action = (mapDef.mapActions || []).find(candidate => number(candidate?.x) === x && number(candidate?.y) === y);
    if (action?.imageKey && action.blocksMovement !== false) return false;
    return true;
  };

  const getEffect = (state, x, y) => {
    let effect = MapRegistry.findTileEffect(mapDef, x, y);
    if (!effect) {
      const open = switches
        .filter(action => isGateOpen(state, action))
        .flatMap(action => Array.isArray(action.opens) ? action.opens : [])
        .find(definition => number(definition?.x) === x && number(definition?.y) === y && definition?.effectType);
      if (open && getTile(state, x, y) === String(open.tile || 'T').toUpperCase()) {
        effect = { ...open, type: String(open.effectType), x, y, switchGenerated: true };
      }
    }
    if (disableIce && effect?.type === 'ice') return null;
    return effect;
  };

  const move = (state, dx, dy) => {
    let x = state.x + dx;
    let y = state.y + dy;
    if (!isWalkable(state, x, y)) return null;

    const effect = getEffect(state, x, y);
    if (effect?.type === 'warp' && Number.isFinite(number(effect.toX)) && Number.isFinite(number(effect.toY))) {
      return { ...state, x: number(effect.toX), y: number(effect.toY) };
    }
    if (effect?.type === 'ice') {
      const maxSlide = Math.max(1, number(effect.maxSlide || 20));
      for (let step = 0; step < maxSlide; step += 1) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (!isWalkable(state, nextX, nextY)) break;
        x = nextX;
        y = nextY;
        const nextEffect = getEffect(state, x, y);
        if (!nextEffect || nextEffect.type !== 'ice') break;
      }
    }
    return { ...state, x, y };
  };

  const getTransitions = state => {
    const transitions = [];
    for (const [dx, dy, operation] of DIRECTIONS) {
      const destination = move(state, dx, dy);
      if (destination) transitions.push({ state: destination, operation });
    }
    switches.forEach((action, index) => {
      if (state.switchMask & (1 << index)) return;
      const distance = Math.abs(state.x - number(action.x)) + Math.abs(state.y - number(action.y));
      const canOperate = action.interactFromAdjacent === true ? distance === 1 : distance === 0;
      if (canOperate) transitions.push({ state: { ...state, switchMask: state.switchMask | (1 << index) }, operation: 'A' });
    });
    bosses.forEach((boss, index) => {
      if (state.bossMask & (1 << index)) return;
      const distance = Math.abs(state.x - number(boss.x)) + Math.abs(state.y - number(boss.y));
      if (distance === 1) transitions.push({ state: { ...state, bossMask: state.bossMask | (1 << index) }, operation: 'B' });
    });
    return transitions;
  };

  const initial = { x: number(start?.x), y: number(start?.y), switchMask: 0, bossMask: 0 };
  if (!Number.isFinite(initial.x) || !Number.isFinite(initial.y)) return null;
  const queue = [initial];
  const states = new Map([[stateKey(initial), initial]]);
  const edges = new Map();
  const previous = new Map();
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index];
    const key = stateKey(state);
    const transitions = getTransitions(state);
    edges.set(key, transitions.map(transition => stateKey(transition.state)));
    for (const transition of transitions) {
      const nextKey = stateKey(transition.state);
      if (states.has(nextKey)) continue;
      states.set(nextKey, transition.state);
      previous.set(nextKey, { key, operation: transition.operation });
      queue.push(transition.state);
    }
  }

  const hasPosition = predicate => [...states.values()].some(predicate);
  const pathTo = predicate => {
    const found = [...states.entries()].find(([, state]) => predicate(state));
    if (!found) return null;
    const operations = [];
    let key = found[0];
    while (previous.has(key)) {
      const entry = previous.get(key);
      operations.push(entry.operation);
      key = entry.key;
    }
    return operations.reverse().join('');
  };

  const goalKeys = [...states.entries()]
    .filter(([, state]) => (mapDef.floorLinks || []).some(link => samePosition(state, link)))
    .map(([key]) => key);
  const reverseEdges = new Map();
  for (const [from, destinations] of edges) {
    for (const destination of destinations) {
      if (!reverseEdges.has(destination)) reverseEdges.set(destination, []);
      reverseEdges.get(destination).push(from);
    }
  }
  const canReturnToLink = new Set(goalKeys);
  const reverseQueue = [...goalKeys];
  for (let index = 0; index < reverseQueue.length; index += 1) {
    for (const previousKey of reverseEdges.get(reverseQueue[index]) || []) {
      if (canReturnToLink.has(previousKey)) continue;
      canReturnToLink.add(previousKey);
      reverseQueue.push(previousKey);
    }
  }

  return {
    edges,
    hasPosition,
    pathTo,
    softlockedStates: [...states.entries()]
      .filter(([key]) => !canReturnToLink.has(key))
      .map(([, state]) => state),
    states,
  };
}

function getNavigationTargets(mapDef) {
  const targets = [];
  for (const link of mapDef.floorLinks || []) {
    targets.push({ type: 'link', x: number(link.x), y: number(link.y), reaches: state => samePosition(state, link) });
  }
  for (const chest of mapDef.chests || []) {
    targets.push({
      type: 'chest', x: number(chest.x), y: number(chest.y),
      reaches: state => Math.abs(state.x - number(chest.x)) + Math.abs(state.y - number(chest.y)) === 1,
    });
  }
  for (const boss of mapDef.bosses || []) {
    targets.push({
      type: 'boss', x: number(boss.x), y: number(boss.y),
      reaches: state => Math.abs(state.x - number(boss.x)) + Math.abs(state.y - number(boss.y)) === 1,
    });
  }
  for (const action of mapDef.mapActions || []) {
    const adjacent = action.interactFromAdjacent === true;
    targets.push({
      type: 'action', x: number(action.x), y: number(action.y),
      reaches: state => adjacent
        ? Math.abs(state.x - number(action.x)) + Math.abs(state.y - number(action.y)) === 1
        : samePosition(state, action),
    });
  }
  return targets;
}

module.exports = {
  createFixedNavigationGraph,
  getNavigationTargets,
};
