const fs = require('fs');
const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '../..');
const failures = [];
const checks = [];
const assert = (condition, message) => (condition ? checks : failures).push(message);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const runtime = loadMapRuntime(root, { context: { App: { data: { location: { area: 'WORLD', worldKey: 'WORLD' } } } } });
runtime.context.window = runtime.context;
runtime.context.MAP_IDS = runtime.context.window.MAP_IDS;
runtime.runFile('story.js', 'globalThis.STORY_MANAGER_DATA = STORY_MANAGER_DATA;');
const c = runtime.context;

const tileAt = (tiles, x, y) => String(tiles?.[y]?.[x] || 'W').toUpperCase();
const isPassable = tile => !['W', 'M'].includes(String(tile).toUpperCase());
const reachable = (tiles, start, blockedTiles = ['W', 'M']) => {
    const queue = [start];
    const seen = new Set([`${start.x},${start.y}`]);
    for (let index = 0; index < queue.length; index++) {
        const point = queue[index];
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
            const next = { x: point.x + dx, y: point.y + dy };
            const key = `${next.x},${next.y}`;
            if (seen.has(key) || blockedTiles.includes(tileAt(tiles, next.x, next.y))) return;
            seen.add(key);
            queue.push(next);
        });
    }
    return seen;
};
const has = (set, point) => set.has(`${point.x},${point.y}`);
const isReachableOrAdjacent = (set, point) => {
    if (!point) return false;
    return [[0,0],[1,0],[-1,0],[0,1],[0,-1]]
        .some(([dx, dy]) => set.has(`${Number(point.x) + dx},${Number(point.y) + dy}`));
};
const assertRectangular = (def, label) => {
    assert(Array.isArray(def?.tiles) && def.tiles.length === Number(def?.height), `${label}: 高さが正本と一致`);
    assert(def?.tiles?.every(row => row.length === Number(def.width)), `${label}: 全行が幅${def?.width}で矩形`);
};
const pointInBounds = (def, point) => Number.isInteger(Number(point?.x)) && Number.isInteger(Number(point?.y))
    && Number(point.x) >= 0 && Number(point.y) >= 0 && Number(point.x) < Number(def.width) && Number(point.y) < Number(def.height);

// 第二ワールド正本。主大陸は町を徒歩で結び、四つの後半迷宮だけを独立区画へ隔離する。
const world = c.WORLD_MAPS?.ABYSS_WORLD;
assert(!!world, '深淵世界がWORLD_MAPS正本に存在');
assert(Array.isArray(world?.tiles) && world.tiles.length === 64 && world.tiles.every(row => row.length === 78), '深淵世界は78x64の静的MAP');
assert(world?.allowBoat === false && world?.allowFlight === false, '深淵世界で船・翼を禁止');
assert(world?.skyPrismEligible === false && !world?.skyPrismDestination, 'ワールドマップである深淵世界そのものはスカイプリズム対象外');
assert(Array.isArray(world?.seaTiles) && world.seaTiles.length === 0
    && ['W', 'M', 'I', 'V'].every(tile => world?.impassableTiles?.includes(tile)), '深淵世界は海タイルを持たず、断崖・山・樹林壁・火山壁を通行不可に定義');
assert(world?.themeKey === 'ABYSS_FIELD' && world?.tileOverrides?.W && world?.tileOverrides?.G, '深淵世界専用の地形描画を正本定義');
['T', 'G', 'H', 'F', 'R', 'L'].forEach(tile => {
    assert(!!world?.tileOverrides?.[tile], `深淵世界の地形${tile}に専用描画を定義`);
    assert(!world?.impassableTiles?.includes(tile) && !world?.seaTiles?.includes(tile), `深淵世界の地形${tile}は歩行可能かつ船へ変化しない`);
});
['I', 'V'].forEach(tile => {
    assert(!!world?.tileOverrides?.[tile] && world?.impassableTiles?.includes(tile), `深淵世界の地形${tile}は専用描画を持つ進行不能帯`);
});
assert(Math.max(...world.tiles.map(row => [...row].filter(tile => tile === 'M').length)) < 40, '深淵世界を横断する人工的な一文字壁列を持たない');
assert(c.ABYSS_REGION_MASTER?.worldKey === 'ABYSS_WORLD', '深淵地域規則がmap.js正本に存在');

const area = key => c.STORY_DATA.areas[key];
const firstEntrance = key => {
    const def = area(key);
    const entry = Array.isArray(def?.entrances) ? def.entrances[0] : null;
    return { x: Number(entry?.x ?? def?.centerX), y: Number(entry?.y ?? def?.centerY) };
};
const carmena = firstEntrance('CARMENA');
const thunder = firstEntrance('THUNDER_DUNES');
const cemetery = firstEntrance('SCREAMING_CEMETERY');
const pyramid = firstEntrance('BLACK_ROPE_PYRAMID');
const mausoleum = firstEntrance('MAGIC_WIND_MAUSOLEUM');
const vistaSouth = area('VISTA').entrances.find(entry => entry.entryKey === 'southwest');
const vistaNorth = area('VISTA').entrances.find(entry => entry.entryKey === 'northeast');
const frozen = firstEntrance('FROZEN_FOREST');
const purgatory = firstEntrance('PURGATORY_MOUNTAINS');
const iceRoad = firstEntrance('ICE_PENANCE_ROAD');
const oldCastle = firstEntrance('SCORCHING_OLD_CASTLE');
const legacionSouth = area('LEGACION').entrances.find(entry => entry.entryKey === 'south');
const legacionNorth = area('LEGACION').entrances.find(entry => entry.entryKey === 'north');
const ridpalm = firstEntrance('RIDPALM_DREAM_CORRIDOR');
const southReach = reachable(world.tiles, carmena, world.impassableTiles);
const middleReach = reachable(world.tiles, vistaNorth, world.impassableTiles);
const northReach = reachable(world.tiles, legacionNorth, world.impassableTiles);
const rearPockets = [
    { name: '雷霆砂丘奥区画', exit: { x: 6, y: 44 }, destination: pyramid },
    { name: '叫喚の墓地奥区画', exit: { x: 72, y: 54 }, destination: mausoleum },
    { name: '極寒樹林奥区画', exit: { x: 6, y: 27 }, destination: iceRoad },
    { name: '煉獄山脈奥区画', exit: { x: 71, y: 28 }, destination: oldCastle }
];
[['雷霆砂丘', thunder], ['叫喚の墓地', cemetery], ['ビスタ南西門', vistaSouth]]
    .forEach(([name, point]) => assert(has(southReach, point), `カルメナ側大陸から${name}へ徒歩到達可能`));
assert(!has(southReach, vistaNorth) && !has(southReach, frozen) && !has(southReach, legacionSouth),
    'ビスタを通らず南側大陸から中部大陸へ迂回不能');
[['極寒樹林', frozen], ['煉獄山脈', purgatory], ['レガシオン南門', legacionSouth]]
    .forEach(([name, point]) => assert(has(middleReach, point), `ビスタ北東側大陸から${name}へ徒歩到達可能`));
assert(!has(middleReach, vistaSouth) && !has(middleReach, legacionNorth) && !has(middleReach, ridpalm),
    'ビスタへ戻るかレガシオンを通らず、中部大陸から南北へ迂回不能');
assert(has(northReach, ridpalm) && !has(northReach, legacionSouth) && !has(northReach, vistaNorth),
    'レガシオン北側からリドパルムへ進めるが、中部大陸へ城外迂回不能');
rearPockets.forEach(({ name, exit, destination }) => {
    assert(!has(southReach, exit) && !has(middleReach, exit) && !has(northReach, exit)
        && !has(southReach, destination) && !has(middleReach, destination) && !has(northReach, destination), `${name}は三大陸から徒歩で侵入不能`);
    const pocketReach = reachable(world.tiles, exit, world.impassableTiles);
    assert(has(pocketReach, destination), `${name}の奥口から後半ダンジョンへ到達可能`);
    assert(!has(pocketReach, carmena) && !has(pocketReach, vistaNorth) && !has(pocketReach, legacionNorth), `${name}から三大陸へ地形上の抜け道がない`);
});
const rearComponentKeys = rearPockets.map(({ exit }) => [...reachable(world.tiles, exit, world.impassableTiles)].sort().join('|'));
assert(new Set(rearComponentKeys).size === 4, '四つの奥口区画は互いにも接続しない独立地形');
assert(area('VISTA').entryRequiredFlag === 'abyssFirstBarrierCleared', 'カルメナ側からビスタ南西門へ歩けるが、第一層結界中は入場不可');
assert(area('LEGACION').entryRequiredFlag === 'abyssSecondBarrierCleared', 'ビスタ北東側からレガシオン南門へ歩けるが、第二層結界中は入場不可');
const authoredWorldEntrances = Object.values(c.STORY_DATA.areas).flatMap(def => Array.isArray(def?.entrances)
    ? def.entrances
    : (Number.isFinite(Number(def?.centerX)) && Number.isFinite(Number(def?.centerY)) ? [{ x: def.centerX, y: def.centerY }] : []));
assert(rearPockets.every(({ exit }) => !authoredWorldEntrances.some(entry => Number(entry.x) === exit.x && Number(entry.y) === exit.y)),
    '四つのダンジョン奥口は独立したエリア入口やスカイプリズム登録地点にしない');

// 町・城・固定施設の正本。
['CARMENA', 'VISTA', 'VISTA_UNDERPASS', 'LEGACION', 'LEGACION_PRISON', 'LEGACION_TEMPLE', 'LEGACION_THRONE',
    'LEGACION_UPPER_GALLERY', 'LEGACION_WEST_TOWER', 'LEGACION_EAST_TOWER'].forEach(key => {
    const def = c.FIXED_MAPS[key];
    assert(!!def, `${key}: FIXED_MAPS正本に存在`);
    assertRectangular(def, key);
    [...(def?.mapActions || []), ...(def?.bosses || []), ...(def?.worldExits || [])].forEach((point, index) => {
        assert(pointInBounds(def, point), `${key}: 配置${index + 1}がMAP範囲内`);
    });
    const entryPoints = Object.values(def?.entryPoints || { default: def?.entryPoint }).filter(Boolean);
    const entryReach = new Set(entryPoints.flatMap(point => [...reachable(def?.tiles, point)]));
    [...(def?.mapActions || []), ...(def?.bosses || []), ...(def?.worldExits || [])].forEach((point, index) => {
        assert(isReachableOrAdjacent(entryReach, point), `${key}: 配置${index + 1}へ入口から到達または隣接可能`);
    });
});
const carmenaMap = c.FIXED_MAPS.CARMENA;
['CARMENA', 'VISTA', 'LEGACION'].forEach(key => {
    const def = c.FIXED_MAPS[key];
    const buildings = def.tiles.flatMap((row, y) => [...row].map((tile, x) => ({ tile, x, y })))
        .filter(point => point.tile === 'H' || point.tile === 'V');
    buildings.forEach((building, index) => buildings.slice(index + 1).forEach(other => {
        const adjacent = Math.abs(building.x - other.x) <= 1 && Math.abs(building.y - other.y) <= 1;
        assert(!adjacent, `${key}: 2倍描画の家タイル同士に最低1マスの間隔を確保`);
    }));
});
assert(carmenaMap.mapActions?.some(action => action.type === 'inn') && carmenaMap.mapActions?.some(action => action.type === 'shop'),
    'カルメナの宿・道具屋は地上町と共通の施設ロジックを使用');
assert(c.FIXED_MAPS.VISTA.mapActions?.some(action => action.type === 'inn') && c.FIXED_MAPS.VISTA.mapActions?.some(action => action.type === 'shop'),
    'ビスタの宿・店は地上町と共通の施設ロジックを使用');
assert(['blacksmith', 'alchemy', 'guild'].every(type => c.FIXED_MAPS.LEGACION.mapActions?.some(action => action.type === type)),
    'レガシオンの鍛冶・錬金・ギルドは共通施設ロジックを使用');
const generals = carmenaMap.bosses || [];
assert(generals.length === 2, 'カルメナ北門に左右二将を配置');
assert(generals.every(boss => boss.defeatGroupId === 'carmena_gate_generals' && boss.startEventId === 'abyss_carmena_gate_battle'), '左右どちらも同一イベント・撃破グループ');
assert(generals[0]?.mapSpriteMonsterId !== generals[1]?.mapSpriteMonsterId, '左右の将軍は別MAP画像');
assert(generals.every(boss => boss.clearedFlag === 'abyssCarmenaGateCleared'), '勝利後は二将とも共通フラグで消滅');
assert(carmenaMap.worldExits?.some(exit => exit.requiredFlag === 'abyssCarmenaGateCleared'), '北出口は二将撃破まで閉鎖');
const blackSpring = carmenaMap.mapActions?.find(action => action.type === 'returnPortal');
assert(blackSpring?.fallbackAreaKey === 'ABYSS_FIELD' && blackSpring?.fallbackWorldKey === 'WORLD' && blackSpring?.useSavedReturnPoint === false, '黒い泉は深淵の魔窟外縁へ戻る正式なワールド間帰還口');
assert(pointInBounds(carmenaMap, carmenaMap.skyPrismEntryPoint), 'カルメナのスカイプリズム到着点は町内部');
const vistaMap = c.FIXED_MAPS.VISTA;
assert(vistaMap.worldExits?.length === 2 && vistaMap.worldExits.every(exit => tileAt(vistaMap.tiles, exit.x, exit.y) === 'S'), 'ビスタ南西口・北東口を実際の出口タイルとして配置');
assert(vistaMap.mapActions?.filter(action => action.target === 'VISTA_UNDERPASS').length === 2, 'ビスタ南北区は二つの地下通路口で接続');
const vistaSouthReach = reachable(vistaMap.tiles, vistaMap.entryPoints.southwest);
const vistaNorthReach = reachable(vistaMap.tiles, vistaMap.entryPoints.northeast);
assert(!has(vistaSouthReach, vistaMap.entryPoints.northeast) && !has(vistaNorthReach, vistaMap.entryPoints.southwest), 'ビスタ地上は南北が分断され、地下通路の横断が必須');
const vistaUnderpass = c.FIXED_MAPS.VISTA_UNDERPASS;
assert(has(reachable(vistaUnderpass.tiles, vistaUnderpass.entryPoints.south), vistaUnderpass.entryPoints.north), 'ビスタ地下通路で南北を横断可能');
const abyssZones = c.FIELD_ENCOUNTER_ZONES.filter(zone => zone.worldKey === 'ABYSS_WORLD');
assert(abyssZones.length === 3 && abyssZones.every(zone => zone.rect && Number(zone.rank) >= 86), '深淵世界全域をRank86以上の三段階エンカウント帯で被覆');
const legacionMap = c.FIXED_MAPS.LEGACION;
const gallery = c.FIXED_MAPS.LEGACION_UPPER_GALLERY;
assert(legacionMap.mapActions?.some(action => action.target === 'LEGACION_UPPER_GALLERY')
    && gallery.mapActions?.some(action => action.target === 'LEGACION_THRONE'), 'レガシオンは城内一階から上層回廊を経て謁見の間へ進む');
assert(gallery.mapActions?.some(action => action.target === 'LEGACION_WEST_TOWER')
    && gallery.mapActions?.some(action => action.target === 'LEGACION_EAST_TOWER'), 'レガシオン上層回廊から東西二塔へ接続');

// ダンジョン構成・属性環境・固定階。
const requiredDungeons = [
    'THUNDER_DUNES', 'SCREAMING_CEMETERY', 'BLACK_ROPE_PYRAMID', 'MAGIC_WIND_MAUSOLEUM',
    'FROZEN_FOREST', 'PURGATORY_MOUNTAINS', 'ICE_PENANCE_ROAD', 'SCORCHING_OLD_CASTLE',
    'RIDPALM_DREAM_CORRIDOR', 'JAGOREA_ROOT', 'CHRONO_ABYSS', 'FINAL_ALTAR'
];
const abyssThemeSources = {
    THUNDER_DUNES: 'THUNDER_FORT', BLACK_ROPE_PYRAMID: 'THUNDER_FORT',
    SCREAMING_CEMETERY: 'FORBIDDEN_FOREST', MAGIC_WIND_MAUSOLEUM: 'DARK_SHRINE_RUINS',
    FROZEN_FOREST: 'FORBIDDEN_FOREST', ICE_PENANCE_ROAD: 'SEABED_TEMPLE',
    PURGATORY_MOUNTAINS: 'FIRE_VILLAGE', SCORCHING_OLD_CASTLE: 'DARK_CASTLE',
    RIDPALM_DREAM_CORRIDOR: 'LIGHT_PALACE', JAGOREA_ROOT: 'DARK_SHRINE_RUINS', CHRONO_ABYSS: 'DARK_CASTLE'
};
Object.entries(abyssThemeSources).forEach(([key, themeKey]) => {
    assert(c.FIXED_DUNGEON_MAPS[key]?.themeKey === themeKey && !!c.TILE_THEMES?.[themeKey], `${key}: 既存${themeKey}マップチップを暫定流用`);
});
requiredDungeons.forEach(key => assert(!!c.FIXED_DUNGEON_MAPS[key], `${key}: FIXED_DUNGEON_MAPS正本に存在`));
const expectedFloors = {
    BLACK_ROPE_PYRAMID: 6, MAGIC_WIND_MAUSOLEUM: 6, ICE_PENANCE_ROAD: 6,
    SCORCHING_OLD_CASTLE: 6, RIDPALM_DREAM_CORRIDOR: 6, JAGOREA_ROOT: 5, CHRONO_ABYSS: 7
};
const expectedProcedural = {
    BLACK_ROPE_PYRAMID: [2,3,4,5], MAGIC_WIND_MAUSOLEUM: [2,3,4,5],
    ICE_PENANCE_ROAD: [2,3,4,5], SCORCHING_OLD_CASTLE: [2,3,4,5],
    RIDPALM_DREAM_CORRIDOR: [2,3,4,5], JAGOREA_ROOT: [2,3,4], CHRONO_ABYSS: [2,3,4,5,6]
};
Object.entries(expectedFloors).forEach(([key, count]) => {
    const floors = c.FIXED_DUNGEON_MAPS[key].floors || [];
    assert(floors.length === count, `${key}: ${count}層構成`);
    const proceduralFloors = floors.map((floor, index) => floor.procedural ? index + 1 : null).filter(Boolean);
    assert(JSON.stringify(proceduralFloors) === JSON.stringify(expectedProcedural[key]), `${key}: 可変階の位置が仕様通り`);
    [floors[0], floors[floors.length - 1]].forEach((floor, index) => {
        assert(floor?.procedural !== true, `${key}: ${index ? '最終' : '入口'}階は固定MAP`);
        assertRectangular(floor, `${key} ${index ? '最終' : '入口'}階`);
        const entryReach = reachable(floor.tiles, floor.entryPoint);
        const targets = [...(floor.floorLinks || []), ...(floor.bosses || []), ...(floor.mapActions || []), ...(floor.chests || [])];
        const passableCount = floor.tiles.reduce((sum, row) => sum + [...row].filter(isPassable).length, 0);
        assert(entryReach.size === passableCount, `${key}: ${index ? '最終' : '入口'}固定階に到達不能な床・部屋がない`);
        assert(targets.every(point => isReachableOrAdjacent(entryReach, point)), `${key}: ${index ? '最終' : '入口'}固定階の出口・ボス・宝箱へ到達可能`);
        assert(Array.isArray(floor.chests) && floor.chests.length >= 2, `${key}: ${index ? '最終' : '入口'}固定階に探索用宝箱を配置`);
        assert((floor.chests || []).every(chest => isPassable(tileAt(floor.tiles, chest.x, chest.y))), `${key}: ${index ? '最終' : '入口'}固定階の宝箱を床上へ配置`);
        assert((floor.bosses || []).every(boss => !(floor.floorLinks || []).some(link => Number(link.x) === Number(boss.x) && Number(link.y) === Number(boss.y))), `${key}: ${index ? '最終' : '入口'}固定階でボスと移動先が競合しない`);
    });
});
['THUNDER_DUNES', 'SCREAMING_CEMETERY', 'FROZEN_FOREST', 'PURGATORY_MOUNTAINS'].forEach(key => {
    const def = c.FIXED_DUNGEON_MAPS[key];
    const floors = def.floors || [def];
    floors.forEach((floor, index) => {
        const entryReach = reachable(floor.tiles, floor.entryPoint);
        const passableCount = floor.tiles.reduce((sum, row) => sum + [...row].filter(isPassable).length, 0);
        assert(entryReach.size === passableCount, `${key}:${index + 1}に到達不能な床・部屋がない`);
        assert([...(floor.floorLinks || []), ...(floor.chests || [])].every(point => isReachableOrAdjacent(entryReach, point)), `${key}:${index + 1}の出口・宝箱へ到達可能`);
        assert(Array.isArray(floor.chests) && floor.chests.length >= 2, `${key}:${index + 1}に探索用宝箱を配置`);
    });
});
const crossingContracts = {
    THUNDER_DUNES: ['abyssThunderDunesCrossed', 6, 44],
    SCREAMING_CEMETERY: ['abyssScreamingCemeteryCrossed', 72, 54],
    FROZEN_FOREST: ['abyssFrozenForestCrossed', 6, 27],
    PURGATORY_MOUNTAINS: ['abyssPurgatoryMountainsCrossed', 71, 28]
};
Object.entries(crossingContracts).forEach(([key, [flag, x, y]]) => {
    const def = c.FIXED_DUNGEON_MAPS[key];
    const links = (def.floors || [def]).flatMap(floor => floor.floorLinks || []);
    const farExit = links.find(link => link.setFlag === flag);
    assert(!!farExit && farExit.to === 'EXIT' && !farExit.toDungeon, `${key}: 奥口は後半ダンジョンへ直結せず世界へ出る`);
    assert(Number(farExit?.exitPoint?.x) === x && Number(farExit?.exitPoint?.y) === y && farExit?.exitPoint?.worldKey === 'ABYSS_WORLD', `${key}: 奥口は深淵世界の反対側へ着地`);
});
const authoredFixedHashes = [];
requiredDungeons.forEach(key => {
    const def = c.FIXED_DUNGEON_MAPS[key];
    (def.floors || [def]).forEach((floor, index) => {
        if (!floor?.procedural) authoredFixedHashes.push(`${floor.tiles.join('\n')}`);
    });
});
assert(new Set(authoredFixedHashes).size === authoredFixedHashes.length, '深淵の固定階に同一レイアウト流用がない');
assert(c.FIXED_DUNGEON_MAPS.RIDPALM_DREAM_CORRIDOR.floors[2].forceMaze === true, 'リドパルム3層は迷路確定');
const penalties = {
    THUNDER_DUNES:{雷:-20}, BLACK_ROPE_PYRAMID:{雷:-20}, SCREAMING_CEMETERY:{風:-20}, MAGIC_WIND_MAUSOLEUM:{風:-20},
    FROZEN_FOREST:{水:-20}, ICE_PENANCE_ROAD:{水:-20}, PURGATORY_MOUNTAINS:{火:-20}, SCORCHING_OLD_CASTLE:{火:-20},
    RIDPALM_DREAM_CORRIDOR:{光:-20,闇:-20}, JAGOREA_ROOT:{光:-20,闇:-20}, CHRONO_ABYSS:{混沌:-20}
};
Object.entries(penalties).forEach(([key, expected]) => {
    assert(JSON.stringify(c.FIXED_DUNGEON_MAPS[key].elementPenalty) === JSON.stringify(expected), `${key}: 属性耐性低下を正本定義`);
});

const finalBosses = c.FIXED_DUNGEON_MAPS.FINAL_ALTAR.bosses || [];
assert(finalBosses.length === 1 && finalBosses[0].clearedFlag === 'abyssAzelgaragDefeated'
    && finalBosses[0].startEventId === 'abyss_final_altar_encounter'
    && Array.isArray(finalBosses[0].mapSpriteVariants)
    && finalBosses[0].mapSpriteVariants.some(state => state.requiredFlag === 'abyssVegnasisDefeated' && Number(state.monsterId) === 302100),
    '終焉の祭壇MAPは単一ボスマスをヴェグナシス段階／アゼルガラグ段階で共有する');
assert(finalBosses.every(boss => !!boss.startEventId), '終焉の祭壇ボス開始イベントをMAP正本から参照');
const chain = c.STORY_MANAGER_DATA.events.abyss_vegnasis_clear.actions || [];
assert(chain.some(action => action.type === 'BOSS' && Number(action.value) === 302100 && action.winEventId === 'abyss_azelgarag_clear'), 'ヴェグナシス後にアゼルガラグへ連戦');

const prismTrials = Object.values(c.FIXED_DUNGEON_MAPS).flatMap(def => (def.floors || [def]))
    .flatMap(floor => floor?.mapActions || [])
    .filter(action => action.type === 'elementalTrialPrism');
assert(prismTrials.length === 6 && new Set(prismTrials.map(action => action.element)).size === 6, '地上の六属性プリズムへ個別の精霊試練を配置');
prismTrials.forEach(action => {
    assert(action.requiredFlags?.includes('abyssSpiritPrismKnown') && action.requiredFlags.length === 2, `${action.element}精霊試練は神官案内と元のプリズム復旧を両方要求`);
    assert(Number(action.bossByElement?.[action.element]) >= 502000 && Number(action.rewardItemByElement?.[action.element]) > 0, `${action.element}精霊試練の専用ボスと結晶片を正本参照`);
});

// 旧ランタイム差し替えを読み込まず、コア実装が契約を所有する。
const indexSource = read('index.html');
const mapSource = read('map.js');
const mapsLogicSource = read('maps_logic.js');
const dungeonSource = read('dungeon.js');
const mainSource = read('main.js');
const battleSource = read('battle.js');
const abyssStorySource = read('story.js');
const storyLogicSource = read('story_logic.js');
const itemsSource = read('items.js');
const swSource = read('sw.js');
assert(!/abyss_region\.js|abyss_runtime\.js|abyss_battle\.js/.test(indexSource), '旧深淵ランタイム3ファイルをHTMLから撤去');
assert(['abyss_region.js', 'abyss_runtime.js', 'abyss_battle.js'].every(file => !fs.existsSync(path.join(root, file))) && !/abyss_region\.js|abyss_runtime\.js|abyss_battle\.js/.test(swSource), '旧深淵上書きモジュール3件とキャッシュ参照を削除');
assert(/getOrCreateFixedProceduralFloor/.test(mapsLogicSource) && /getOrCreateFixedProceduralFloor/.test(dungeonSource), '可変階をMapRegistryとDungeonの正式契約へ統合');
assert(/fixedProceduralRunIds/.test(dungeonSource) && /toFloor:\s*Number\(floorNo\)\s*-\s*1/.test(dungeonSource), '同一探索中の保存・再入場再生成・前階帰還を実装');
assert(/type\s*!==\s*'スキル書'/.test(itemsSource) && /type\s*!==\s*'特性書'/.test(itemsSource) && /isRandomChestRewardEligible/.test(dungeonSource), 'ランダム宝箱からスキル書・特性書を除外');
assert(/Dungeon\.map\[y\]\[x\]\s*=\s*'T';[\s\S]{0,240}Dungeon\.saveMapData\(\);[\s\S]{0,120}Field\.render\(\);/.test(dungeonSource), 'ランダム宝箱は報酬分岐より前に床化して保存');
assert(/const targetMarker = Number\(link\.toFloor\) < currentFloor \? 'D' : 'U'/.test(dungeonSource)
    && /String\(nextDef\.tiles\[y\]/.test(dungeonSource), '固定階と可変階の往復は進行方向に対応する階段へ着地');
assert(/openedChest[\s\S]{0,220}shouldRemoveOpenedFixedChest[\s\S]{0,220}getOpenedFixedChestBaseTile/.test(mainSource)
    && /isFixedChestOpenedAt\(x, y\)[\s\S]{0,220}shouldRemoveOpenedFixedChest/.test(mainSource),
    '開封済み固定宝箱を描画・現在地・移動判定で床として通行可能にする');
assert(/App\.data\.location\.area = targetWorldKey/.test(mainSource) && /skyPrismEntryPoint/.test(mainSource), 'スカイプリズムで第二ワールドとカルメナ内部へ正式移動');
assert(/getEnvironmentalElementModifiers/.test(mainSource) && /environmentalElmRes/.test(mainSource), '環境耐性をApp.calcStats正本へ統合');
assert(/migrateAbyssRegionSave/.test(mainSource) && /abyssRegionSchemaVersion\s*=\s*7/.test(mainSource) && /abyssThunderDunesCrossed/.test(mainSource), '適用済み旧セーブの横断フラグ・座標移行をApp.loadへ統合');
assert(/abyssVegnasisIds/.test(battleSource) && /ABYSS_AZELGARAG_TRANSFORM/.test(battleSource), '特殊終盤戦をBattle正本へ統合');
assert(/retainedVegnasisVisual/.test(battleSource) && /retainedVegnasisVisual \|\| document\.createElement\('img'\)/.test(battleSource), 'ヴェグナシス共有画像ノードを再描画ごとに追加せず再利用');
assert(!/DB\.MONSTERS\s*=|DB\.MONSTERS\.(?:push|splice)|Object\.assign\(\s*DB\.MONSTERS/.test(battleSource), '特殊戦闘がモンスター正本を実行時に書き換えない');
assert(/completeAbyssElementalTrial/.test(battleSource) && /abyssAllSpiritTrialsCleared/.test(battleSource), '六属性試練の結晶片・耐性加護・全制覇報酬を勝利処理へ接続');
assert(!/suppressFixedBossDefeat[\s\S]{0,1200}fixedTrialRewardItemId/.test(dungeonSource), '精霊試練報酬をDungeon固定ボス後処理で重複加算しない');
assert(/ABYSS_FIRST_BARRIER_CLEAR/.test(abyssStorySource) && /ABYSS_SECOND_BARRIER_CLEAR/.test(abyssStorySource), '第一・第二結界解除の専用会話を作成');
assert(/getCurrentAbyssEquipOptionElements/.test(mainSource)
    && /rule\.key === 'elmAtk' \|\| rule\.key === 'elmRes'/.test(mainSource)
    && /const weight = isPreferredElement \? 3 : 1/.test(mainSource),
    'Abyss matching elemental attack/resistance options use triple draw weight');
assert((mainSource.match(/App\.pickEquipOptionRule\(allowedKeys\)/g) || []).length === 2,
    'Both equipment generation paths share the Abyss elemental option draw');
const abyssScripts = c.STORY_MANAGER_DATA?.scripts || {};
[
    ['ABYSS_LEONARD', '黒雷のレナード'],
    ['ABYSS_ELICIA', '死風のエリシア'],
    ['ABYSS_SYRIS', '極零のシーリス'],
    ['ABYSS_GRAD', '焦熱のグラド'],
    ['ABYSS_VELD', '昏迷の黒騎士ヴェルド'],
    ['ABYSS_JASPER', '妄執の神官ジャスパー'],
    ['ABYSS_ILLUMINACIA', '混沌姫イルミナシア'],
    ['ABYSS_VEGNASIS', '死幻の魔柱ヴェグナシス'],
    ['ABYSS_AZELGARAG', '深淵王アゼルガラグ']
].forEach(([scriptId, expectedName]) => {
    const text = (abyssScripts[scriptId] || []).map(line => `${line.name || ''}${line.text || ''}`).join('\n');
    assert(text.includes(expectedName), `${scriptId}は現在のボス名「${expectedName}」で会話を構成`);
});
assert(/reconcileDerivedProgressFlags/.test(storyLogicSource), 'FLAG更新直後に派生結界フラグを再計算');
assert(/abyssChronoGateOpened/.test(mapSource) && /setFlagOnUse/.test(mainSource) && /次元牢獄クロノアビスの最深部へ進もう/.test(storyLogicSource), '封印門使用後の進行フラグと目的文を更新');

if (failures.length) {
    console.error(`Abyss region rework validation failed (${failures.length}):`);
    failures.forEach(message => console.error(` - ${message}`));
    process.exit(1);
}
console.log(`Abyss region rework validation passed (${checks.length} checks).`);
