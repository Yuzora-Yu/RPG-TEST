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
runtime.runFile('abyss_story.js');
const c = runtime.context;

const tileAt = (tiles, x, y) => String(tiles?.[y]?.[x] || 'W').toUpperCase();
const isPassable = tile => !['W', 'M'].includes(String(tile).toUpperCase());
const reachable = (tiles, start) => {
    const queue = [start];
    const seen = new Set([`${start.x},${start.y}`]);
    for (let index = 0; index < queue.length; index++) {
        const point = queue[index];
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
            const next = { x: point.x + dx, y: point.y + dy };
            const key = `${next.x},${next.y}`;
            if (seen.has(key) || !isPassable(tileAt(tiles, next.x, next.y))) return;
            seen.add(key);
            queue.push(next);
        });
    }
    return seen;
};
const has = (set, point) => set.has(`${point.x},${point.y}`);
const assertRectangular = (def, label) => {
    assert(Array.isArray(def?.tiles) && def.tiles.length === Number(def?.height), `${label}: 高さが正本と一致`);
    assert(def?.tiles?.every(row => row.length === Number(def.width)), `${label}: 全行が幅${def?.width}で矩形`);
};
const pointInBounds = (def, point) => Number.isInteger(Number(point?.x)) && Number.isInteger(Number(point?.y))
    && Number(point.x) >= 0 && Number(point.y) >= 0 && Number(point.x) < Number(def.width) && Number(point.y) < Number(def.height);

// 第二ワールド正本と、都市を通らなければ越えられない三層構造。
const world = c.WORLD_MAPS?.ABYSS_WORLD;
assert(!!world, '深淵世界がWORLD_MAPS正本に存在');
assert(Array.isArray(world?.tiles) && world.tiles.length === 64 && world.tiles.every(row => row.length === 78), '深淵世界は78x64の静的MAP');
assert(world?.allowBoat === false && world?.allowFlight === false, '深淵世界で船・翼を禁止');
assert(world?.skyPrismEligible === true && Number.isFinite(Number(world?.skyPrismDestination?.x)) && Number.isFinite(Number(world?.skyPrismDestination?.y)), '深淵世界をスカイプリズム移動先として定義');
assert(Array.isArray(world?.seaTiles) && world.seaTiles.length === 0 && world?.impassableTiles?.includes('W') && world?.impassableTiles?.includes('M'), '深淵世界は海タイルを持たず、断崖と山を通行不可に定義');
assert(world?.themeKey === 'ABYSS_FIELD' && world?.tileOverrides?.W && world?.tileOverrides?.G, '深淵世界専用の地形描画を正本定義');
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
const vistaSouth = area('VISTA').entrances.find(entry => entry.entryKey === 'southwest');
const vistaNorth = area('VISTA').entrances.find(entry => entry.entryKey === 'northeast');
const frozen = firstEntrance('FROZEN_FOREST');
const purgatory = firstEntrance('PURGATORY_MOUNTAINS');
const legacionSouth = area('LEGACION').entrances.find(entry => entry.entryKey === 'south');
const legacionNorth = area('LEGACION').entrances.find(entry => entry.entryKey === 'north');
const ridpalm = firstEntrance('RIDPALM_DREAM_CORRIDOR');
const southReach = reachable(world.tiles, carmena);
const middleReach = reachable(world.tiles, vistaNorth);
const northReach = reachable(world.tiles, legacionNorth);
assert(has(southReach, thunder) && has(southReach, cemetery) && has(southReach, vistaSouth), 'カルメナ側から東西第一層とビスタ南口へ到達可能');
assert(!has(southReach, vistaNorth), 'ビスタを通らず第二層へ迂回不可');
assert(has(middleReach, frozen) && has(middleReach, purgatory) && has(middleReach, legacionSouth), 'ビスタ北口から第二層二方面とレガシオン南口へ到達可能');
assert(!has(middleReach, legacionNorth), 'レガシオンを通らず北域へ迂回不可');
assert(has(northReach, ridpalm) && !has(northReach, legacionSouth), 'レガシオン北口からリドパルムへ進み、南側とは分断');

// 町・城・固定施設の正本。
['CARMENA', 'VISTA', 'LEGACION', 'LEGACION_PRISON', 'LEGACION_TEMPLE', 'LEGACION_THRONE'].forEach(key => {
    const def = c.FIXED_MAPS[key];
    assert(!!def, `${key}: FIXED_MAPS正本に存在`);
    assertRectangular(def, key);
    [...(def?.mapActions || []), ...(def?.bosses || []), ...(def?.worldExits || [])].forEach((point, index) => {
        assert(pointInBounds(def, point), `${key}: 配置${index + 1}がMAP範囲内`);
    });
});
const carmenaMap = c.FIXED_MAPS.CARMENA;
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
const abyssZones = c.FIELD_ENCOUNTER_ZONES.filter(zone => zone.worldKey === 'ABYSS_WORLD');
assert(abyssZones.length === 3 && abyssZones.every(zone => zone.rect && Number(zone.rank) >= 86), '深淵世界全域をRank86以上の三段階エンカウント帯で被覆');

// ダンジョン構成・属性環境・固定階。
const requiredDungeons = [
    'THUNDER_DUNES', 'SCREAMING_CEMETERY', 'BLACK_ROPE_PYRAMID', 'MAGIC_WIND_MAUSOLEUM',
    'FROZEN_FOREST', 'PURGATORY_MOUNTAINS', 'ICE_PENANCE_ROAD', 'SCORCHING_OLD_CASTLE',
    'RIDPALM_DREAM_CORRIDOR', 'JAGOREA_ROOT', 'CHRONO_ABYSS', 'FINAL_ALTAR'
];
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
    });
});
assert(c.FIXED_DUNGEON_MAPS.RIDPALM_DREAM_CORRIDOR.floors[2].forceMaze === true, 'リドパルム3層は迷路確定');
const penalties = {
    THUNDER_DUNES:{雷:-50}, BLACK_ROPE_PYRAMID:{雷:-50}, SCREAMING_CEMETERY:{風:-50}, MAGIC_WIND_MAUSOLEUM:{風:-50},
    FROZEN_FOREST:{水:-50}, ICE_PENANCE_ROAD:{水:-50}, PURGATORY_MOUNTAINS:{火:-50}, SCORCHING_OLD_CASTLE:{火:-50},
    RIDPALM_DREAM_CORRIDOR:{光:-50,闇:-50}, JAGOREA_ROOT:{光:-50,闇:-50}, CHRONO_ABYSS:{混沌:-50}
};
Object.entries(penalties).forEach(([key, expected]) => {
    assert(JSON.stringify(c.FIXED_DUNGEON_MAPS[key].elementPenalty) === JSON.stringify(expected), `${key}: 属性耐性低下を正本定義`);
});

const finalBosses = c.FIXED_DUNGEON_MAPS.FINAL_ALTAR.bosses || [];
assert(finalBosses.length === 2 && finalBosses[0].clearedFlag === 'abyssVegnasisDefeated' && finalBosses[1].clearedFlag === 'abyssAzelgaragDefeated', '終焉の祭壇の二連戦ボスと消滅フラグが整合');
assert(finalBosses.every(boss => !!boss.startEventId), '終焉の祭壇ボス開始イベントをMAP正本から参照');
const chain = c.STORY_MANAGER_DATA.events.abyss_vegnasis_clear.actions || [];
assert(chain.some(action => action.type === 'BOSS' && Number(action.value) === 302100 && action.winEventId === 'abyss_azelgarag_clear'), 'ヴェグナシス後にアゼルガラグへ連戦');

// 旧ランタイム差し替えを読み込まず、コア実装が契約を所有する。
const indexSource = read('index.html');
const mapsLogicSource = read('maps_logic.js');
const dungeonSource = read('dungeon.js');
const mainSource = read('main.js');
const battleSource = read('battle.js');
const itemsSource = read('items.js');
const swSource = read('sw.js');
assert(!/abyss_region\.js|abyss_runtime\.js|abyss_battle\.js/.test(indexSource), '旧深淵ランタイム3ファイルをHTMLから撤去');
assert(['abyss_region.js', 'abyss_runtime.js', 'abyss_battle.js'].every(file => !fs.existsSync(path.join(root, file))) && !/abyss_region\.js|abyss_runtime\.js|abyss_battle\.js/.test(swSource), '旧深淵上書きモジュール3件とキャッシュ参照を削除');
assert(/getOrCreateFixedProceduralFloor/.test(mapsLogicSource) && /getOrCreateFixedProceduralFloor/.test(dungeonSource), '可変階をMapRegistryとDungeonの正式契約へ統合');
assert(/fixedProceduralRunIds/.test(dungeonSource) && /toFloor:\s*Number\(floorNo\)\s*-\s*1/.test(dungeonSource), '同一探索中の保存・再入場再生成・前階帰還を実装');
assert(/type\s*!==\s*'スキル書'/.test(itemsSource) && /type\s*!==\s*'特性書'/.test(itemsSource) && /isRandomChestRewardEligible/.test(dungeonSource), 'ランダム宝箱からスキル書・特性書を除外');
assert(/if \(opened\) \{\s*tile = String\(chestDef\?\.baseTile \|\| 'T'\)/s.test(mainSource), '開封済み固定宝箱を床として通行可能にする');
assert(/App\.data\.location\.area = targetWorldKey/.test(mainSource) && /skyPrismEntryPoint/.test(mainSource), 'スカイプリズムで第二ワールドとカルメナ内部へ正式移動');
assert(/getEnvironmentalElementModifiers/.test(mainSource) && /environmentalElmRes/.test(mainSource), '環境耐性をApp.calcStats正本へ統合');
assert(/migrateAbyssRegionSave/.test(mainSource) && /abyssRegionSchemaVersion\s*=\s*4/.test(mainSource), '適用済み旧セーブの移行をApp.loadへ統合');
assert(/abyssVegnasisIds/.test(battleSource) && /ABYSS_AZELGARAG_TRANSFORM/.test(battleSource), '特殊終盤戦をBattle正本へ統合');

if (failures.length) {
    console.error(`Abyss region rework validation failed (${failures.length}):`);
    failures.forEach(message => console.error(` - ${message}`));
    process.exit(1);
}
console.log(`Abyss region rework validation passed (${checks.length} checks).`);
