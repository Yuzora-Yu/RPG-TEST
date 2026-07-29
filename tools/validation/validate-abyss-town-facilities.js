const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapRuntime(root);
const facilityTypes = new Set(['inn', 'shop', 'blacksmith', 'alchemy', 'guild']);
const buildingTiles = new Set(['H', 'V', 'I']);
let facilityCount = 0;

for (const areaKey of ['CARMENA', 'VISTA', 'LEGACION']) {
    const mapDef = context.FIXED_MAPS?.[areaKey];
    if (!mapDef) throw new Error(`Abyss settlement is missing: ${areaKey}`);

    const buildings = [];
    for (let y = 0; y < mapDef.height; y++) {
        for (let x = 0; x < mapDef.width; x++) {
            const tile = mapDef.tiles[y]?.[x];
            if (buildingTiles.has(tile)) buildings.push({ x, y, tile });
        }
    }

    for (let i = 0; i < buildings.length; i++) {
        for (let j = i + 1; j < buildings.length; j++) {
            const dx = Math.abs(buildings[i].x - buildings[j].x);
            const dy = Math.abs(buildings[i].y - buildings[j].y);
            if (Math.max(dx, dy) <= 1) {
                throw new Error(`${areaKey} has adjacent 2x building anchors at (${buildings[i].x},${buildings[i].y}) and (${buildings[j].x},${buildings[j].y}).`);
            }
        }
    }

    const facilities = (mapDef.mapActions || []).filter(action => facilityTypes.has(action?.type));
    for (const action of facilities) {
        facilityCount++;
        if (action.suppressEventMarker !== true) {
            throw new Error(`${areaKey} facility still renders a glowing floor marker: ${action.label || action.type}`);
        }
        const anchor = buildings.find(building =>
            building.x === Number(action.x) && building.y === Number(action.y)
        );
        if (!anchor) {
            throw new Error(`${areaKey} facility action does not coincide with its authored building: ${action.label || action.type}`);
        }
        if (action.type === 'inn' && anchor.tile !== 'I') {
            throw new Error(`${areaKey} inn must use the shared inn tile: ${action.label}`);
        }
    }
}

console.log(`Abyss town facility validation passed: ${facilityCount} actions coincide with separated authored buildings and have no glowing floor markers.`);
