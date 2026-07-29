const path = require('path');
const crypto = require('crypto');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '../..');
const runtime = loadMapRuntime(root, { context: { App: { data: { location: { area: 'WORLD', worldKey: 'WORLD' } } } } });
const maps = runtime.context.FIXED_DUNGEON_MAPS;
const keys = [
    'THUNDER_DUNES', 'SCREAMING_CEMETERY', 'BLACK_ROPE_PYRAMID', 'MAGIC_WIND_MAUSOLEUM',
    'FROZEN_FOREST', 'PURGATORY_MOUNTAINS', 'ICE_PENANCE_ROAD', 'SCORCHING_OLD_CASTLE',
    'RIDPALM_DREAM_CORRIDOR', 'JAGOREA_ROOT', 'CHRONO_ABYSS', 'FINAL_ALTAR'
];
const passable = tile => !['W', 'M'].includes(String(tile || 'W').toUpperCase());
const tileAt = (tiles, x, y) => String(tiles?.[y]?.[x] || 'W').toUpperCase();
const reach = (tiles, start) => {
    const queue = [start];
    const seen = new Set([`${start.x},${start.y}`]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
        const point = queue[cursor];
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const x = point.x + dx;
            const y = point.y + dy;
            const key = `${x},${y}`;
            if (seen.has(key) || !passable(tileAt(tiles, x, y))) continue;
            seen.add(key);
            queue.push({ x, y });
        }
    }
    return seen;
};
const near = (seen, point) => [[0,0],[1,0],[-1,0],[0,1],[0,-1]]
    .some(([dx, dy]) => seen.has(`${Number(point.x) + dx},${Number(point.y) + dy}`));
const hashes = new Map();
const problems = [];

for (const key of keys) {
    const def = maps[key];
    const floors = def?.floors || [def];
    floors.forEach((floor, index) => {
        if (!floor || floor.procedural) return;
        const label = `${key}:${index + 1}`;
        const hash = crypto.createHash('sha256').update((floor.tiles || []).join('\n')).digest('hex').slice(0, 12);
        const prior = hashes.get(hash) || [];
        prior.push(label);
        hashes.set(hash, prior);
        const start = floor.entryPoint || { x: 0, y: 0 };
        const seen = reach(floor.tiles, start);
        const total = (floor.tiles || []).reduce((sum, row) => sum + [...row].filter(passable).length, 0);
        const targets = [
            ...(floor.floorLinks || []).map((point, targetIndex) => ({ ...point, kind: `floorLink${targetIndex + 1}` })),
            ...(floor.bosses || []).map((point, targetIndex) => ({ ...point, kind: `boss${targetIndex + 1}` })),
            ...(floor.mapActions || []).map((point, targetIndex) => ({ ...point, kind: `action${targetIndex + 1}` })),
            ...(floor.chests || []).map((point, targetIndex) => ({ ...point, kind: `chest${targetIndex + 1}` }))
        ].filter(point => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
        const unreachable = targets.filter(point => !near(seen, point));
        const authoredMarkers = [];
        floor.tiles.forEach((row, y) => [...row].forEach((tile, x) => {
            if (['S', 'D', 'U', 'B'].includes(tile)) authoredMarkers.push({ tile, x, y });
        }));
        authoredMarkers.forEach(marker => {
            const owned = marker.tile === 'B'
                ? (floor.bosses || []).some(point => Number(point.x) === marker.x && Number(point.y) === marker.y)
                : [...(floor.floorLinks || []), ...(floor.mapActions || [])]
                    .some(point => Number(point.x) === marker.x && Number(point.y) === marker.y);
            if (!owned) problems.push(`${label}: orphan ${marker.tile} marker (${marker.x},${marker.y})`);
        });
        if (seen.size !== total) problems.push(`${label}: reachable ${seen.size}/${total} passable tiles`);
        unreachable.forEach(point => problems.push(`${label}: ${point.kind} (${point.x},${point.y}) unreachable`));
        if (!Array.isArray(floor.chests) || floor.chests.length < 2) problems.push(`${label}: authored fixed floor needs at least two chests`);
        (floor.chests || []).forEach((chest, chestIndex) => {
            if (!passable(tileAt(floor.tiles, Number(chest.x), Number(chest.y)))) problems.push(`${label}: chest${chestIndex + 1} is not placed on passable floor`);
        });
        (floor.bosses || []).forEach((boss, bossIndex) => {
            if ((floor.floorLinks || []).some(link => Number(link.x) === Number(boss.x) && Number(link.y) === Number(boss.y))) {
                problems.push(`${label}: boss${bossIndex + 1} conflicts with a floor link`);
            }
        });
        console.log(`${label.padEnd(34)} hash=${hash} reachable=${seen.size}/${total} targets=${targets.length}`);
    });
}

for (const [hash, labels] of hashes) {
    if (labels.length > 1) problems.push(`duplicate ${hash}: ${labels.join(', ')}`);
}

if (problems.length) {
    console.error('\nProblems:');
    problems.forEach(problem => console.error(` - ${problem}`));
    process.exitCode = 1;
} else {
    console.log('\nAll authored Abyss fixed floors are connected and unique.');
}
