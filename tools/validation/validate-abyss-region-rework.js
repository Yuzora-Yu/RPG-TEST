const fs = require('fs');
const path = require('path');
const { createRuntimeContext, loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '../..');
const failures = [];
const checks = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
  else checks.push(message);
};

function reachable(tiles, start) {
  const passable = (x, y) => {
    const tile = String(tiles?.[y]?.[x] || 'W').toUpperCase();
    return tile !== 'W' && tile !== 'M';
  };
  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x = point.x + dx;
      const y = point.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || !passable(x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

// Map and story master-data validation.
const mapRt = loadMapRuntime(root, { context: { App: { data: { location: { area: 'WORLD' } } } } });
mapRt.context.MAP_IDS = mapRt.context.window.MAP_IDS;
mapRt.context.window = mapRt.context;
mapRt.runFile('abyss_region.js');
mapRt.runFile('story.js', 'globalThis.STORY_MANAGER_DATA = STORY_MANAGER_DATA;');
mapRt.runFile('abyss_story.js');
const c = mapRt.context;

const world = c.WORLD_MAPS?.ABYSS_WORLD;
assert(!!world, '深淵ワールドがWORLD_MAPS正本へ登録されている');
assert(Array.isArray(world?.tiles) && world.tiles.length === 64 && world.tiles.every(row => row.length === 78), '深淵ワールドは78x64で定義されている');
assert(world?.allowBoat === false && world?.allowFlight === false && world?.skyPrismEligible === false, '深淵ワールドでは船・飛行・スカイプリズムが無効である');

const anchors = {
  carmena: [39,57], thunder: [13,49], cemetery: [66,49], vistaSouth: [36,37],
  vistaNorth: [42,33], frozen: [14,22], purgatory: [64,22], legacionSouth: [39,19],
  legacionNorth: [39,17], ridpalm: [39,8]
};
const south = reachable(world.tiles, { x: anchors.carmena[0], y: anchors.carmena[1] });
const middle = reachable(world.tiles, { x: anchors.vistaNorth[0], y: anchors.vistaNorth[1] });
const north = reachable(world.tiles, { x: anchors.legacionNorth[0], y: anchors.legacionNorth[1] });
const has = (set, pair) => set.has(`${pair[0]},${pair[1]}`);
assert(has(south, anchors.thunder) && has(south, anchors.cemetery) && has(south, anchors.vistaSouth), 'カルメナ側から東西第一層とビスタ南口へ到達できる');
assert(!has(south, anchors.vistaNorth), 'ビスタを通らず第一層から第二層へ抜けられない');
assert(has(middle, anchors.frozen) && has(middle, anchors.purgatory) && has(middle, anchors.legacionSouth), 'ビスタ北口から第二層ダンジョンとレガシオン南口へ到達できる');
assert(!has(middle, anchors.legacionNorth), 'レガシオンを通らず北域へ抜けられない');
assert(has(north, anchors.ridpalm) && !has(north, anchors.legacionSouth), 'レガシオン北口からリドパルムへ進め、南側とは分断されている');

const requiredFixedMaps = ['CARMENA','VISTA','LEGACION','LEGACION_PRISON','LEGACION_TEMPLE','LEGACION_THRONE'];
const requiredDungeons = ['THUNDER_DUNES','SCREAMING_CEMETERY','BLACK_ROPE_PYRAMID','MAGIC_WIND_MAUSOLEUM','FROZEN_FOREST','PURGATORY_MOUNTAINS','ICE_PENANCE_ROAD','SCORCHING_OLD_CASTLE','RIDPALM_DREAM_CORRIDOR','JAGOREA_ROOT','CHRONO_ABYSS','FINAL_ALTAR'];
requiredFixedMaps.forEach(key => assert(!!c.FIXED_MAPS?.[key], `${key} 固定MAPが登録されている`));
requiredDungeons.forEach(key => assert(!!c.FIXED_DUNGEON_MAPS?.[key], `${key} ダンジョン正本が登録されている`));

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
  const floors = c.FIXED_DUNGEON_MAPS[key]?.floors || [];
  assert(floors.length === count, `${key} は${count}層構成である`);
  const procedural = floors.filter(f => f.procedural).map(f => Number(f.floor));
  assert(JSON.stringify(procedural) === JSON.stringify(expectedProcedural[key]), `${key} の可変階層構成が仕様通りである`);
  floors.forEach((floor, index) => {
    assert(floor.mapId && floor.floorId, `${key} ${index + 1}層に安定したMAP/FLOOR IDがある`);
    if (index === 0 || index === floors.length - 1) assert(floor.procedural !== true, `${key} ${index + 1}層は固定MAPである`);
  });
});
assert(c.FIXED_DUNGEON_MAPS.RIDPALM_DREAM_CORRIDOR.floors[2].forceMaze === true, 'リドパルム3層は迷路確定である');

const penalties = {
  THUNDER_DUNES: {雷:-50}, BLACK_ROPE_PYRAMID: {雷:-50}, SCREAMING_CEMETERY: {風:-50}, MAGIC_WIND_MAUSOLEUM: {風:-50},
  FROZEN_FOREST: {水:-50}, ICE_PENANCE_ROAD: {水:-50}, PURGATORY_MOUNTAINS: {火:-50}, SCORCHING_OLD_CASTLE: {火:-50},
  RIDPALM_DREAM_CORRIDOR: {光:-50,闇:-50}, JAGOREA_ROOT: {光:-50,闇:-50}, CHRONO_ABYSS: {混沌:-50}
};
Object.entries(penalties).forEach(([key, expected]) => {
  assert(JSON.stringify(c.FIXED_DUNGEON_MAPS[key]?.elementPenalty) === JSON.stringify(expected), `${key} の環境耐性低下が正本に設定されている`);
});

const finalBosses = c.FIXED_DUNGEON_MAPS.FINAL_ALTAR?.bosses || [];
assert(finalBosses.length === 2, '終焉の祭壇に魔柱と深淵王の正式なボス定義がある');
assert(finalBosses[0]?.clearedFlag === 'abyssVegnasisDefeated' && finalBosses[1]?.clearedFlag === 'abyssAzelgaragDefeated', '終盤ボスの再出現防止が進行フラグで定義されている');
const chainActions = c.STORY_MANAGER_DATA?.events?.abyss_vegnasis_clear?.actions || [];
assert(chainActions.some(action => action.type === 'BOSS' && Number(action.value) === 512100 && action.winEventId === 'abyss_azelgarag_clear'), 'ヴェグナシス勝利後にアゼルガラグ戦へ連続移行する');
const firstEntryActions = c.STORY_MANAGER_DATA?.events?.abyss_unsealed?.actions || [];
assert(firstEntryActions.some(action => action.type === 'FLAG' && action.key === 'abyssFirstEntered'), '深淵初回突入を進行フラグへ記録する');
assert(firstEntryActions.some(action => action.type === 'START_FIXED_MAP' && action.value === 'CARMENA') && !firstEntryActions.some(action => action.type === 'START_ABYSS_DUNGEON'), '深淵の魔窟初回イベントはランダム深淵ではなくカルメナへ移動する');

// Content master validation.
const contentRt = createRuntimeContext(root);
contentRt.context.window = contentRt.context;
contentRt.runFile('skills.js', 'globalThis.SKILLS_DATA = window.SKILLS_DATA;');
contentRt.runFile('items.js', 'globalThis.ITEMS_DATA = window.ITEMS_DATA;');
contentRt.runFile('assets.js');
contentRt.runFile('monsters.js');
contentRt.runFile('abyss_content.js');
contentRt.runFile('monster-drop-policy.js');
const cc = contentRt.context;
const regularIds = [...cc.ABYSS_REGION_CONTENT.regularMonsterIds].map(Number);
const bossIds = [...cc.ABYSS_REGION_CONTENT.bossMonsterIds].map(Number);
const regularMonsters = cc.MonsterData.normalBases.filter(monster => regularIds.includes(Number(monster.id)));
const bossMonsters = cc.MonsterData.bossMonsters.filter(monster => bossIds.includes(Number(monster.id)));
assert(regularIds.length === 55 && new Set(regularIds).size === 55, '新規通常モンスター55体が重複なくIDレジストリへ登録されている');
assert(bossIds.length === 22 && new Set(bossIds).size === 22, '新規ボス22体が重複なくIDレジストリへ登録されている');
assert(regularMonsters.length === 55 && regularMonsters.every(monster => cc.MonsterData.allBases.includes(monster)), '通常モンスター55体がmonsters.js正本の通常敵として登録されている');
assert(bossMonsters.length === 22 && bossMonsters.every(monster => monster.isBoss === true), '専用ボス22体がmonsters.js正本の固定ボスとして登録されている');
const allMasterIds = cc.MonsterData.allBases.map(monster => Number(monster.id));
assert(new Set(allMasterIds).size === allMasterIds.length, 'モンスター正本全体にID重複がない');
const contentSource = fs.readFileSync(path.join(root, 'abyss_content.js'), 'utf8');
assert(!/\.push\s*\(/.test(contentSource) && !/MONSTERS_DATA\s*=/.test(contentSource), 'abyss_content.jsはモンスター・アイテム・スキル正本を実行時追加しない');

const dungeonRanks = {
  MAP000038:[86,90], MAP000040:[91,95], MAP000039:[86,90], MAP000041:[91,95],
  MAP000043:[96,100], MAP000045:[101,105], MAP000044:[96,100], MAP000046:[101,105],
  MAP000048:[106,110], MAP000049:[111,115], MAP000050:[116,120]
};
Object.entries(dungeonRanks).forEach(([mapId, [low, high]]) => {
  const monsters = regularMonsters.filter(monster => (monster.habitats || []).some(habitat => habitat.mapId === mapId));
  assert(monsters.length === 5 && new Set(monsters.map(monster => Number(monster.id))).size === 5, `${mapId} に完全新規通常モンスター5体が生息する`);
  assert(monsters.every(monster => Number(monster.rank) >= low && Number(monster.rank) <= high), `${mapId} の新規通常敵Rankが${low}～${high}に収まる`);
});
const allSkills = new Set(cc.SKILLS_DATA.map(skill => Number(skill.id)));
const allItems = new Set(cc.ITEMS_DATA.map(item => Number(item.id)));
const newMonsters = [...regularMonsters, ...bossMonsters];
assert(newMonsters.every(monster => Array.isArray(monster.acts) && monster.acts.length > 0 && monster.acts.every(action => allSkills.has(Number(typeof action === 'object' ? action.id : action)))), '新規モンスターの使用スキルがすべてskills.js正本に存在する');
assert(regularMonsters.every(monster => Number(monster.imageId) === Number(monster.id)), '通常敵はそれぞれ固有の新規画像IDを参照する');
assert(regularMonsters.every(monster => monster.abyssRecruitable === true && Number.isFinite(Number(monster.dropSeed))), '通常敵55体は深淵仲間化対象かつ安定ドロップシードを持つ');
assert(regularMonsters.every(monster => ['normal','rare'].every(slot => allItems.has(Number(monster.drops?.[slot]?.id)))), '通常敵のドロップアイテムが既存ドロップ正本から解決される');
const imageIds = new Set(newMonsters.map(monster => Number(monster.imageId ?? monster.id)));
assert([...imageIds].every(imageId => fs.existsSync(path.join(root, 'assets/monsters', `monster_${String(imageId).padStart(6, '0')}.png`))), '新規モンスターが参照する暫定画像ファイルがすべて存在する');
assert([...imageIds].every(imageId => cc.PRISMA_ASSETS.monsters.files.includes(`assets/monsters/monster_${String(imageId).padStart(6, '0')}.png`)), '新規画像がassets.jsの自動キャッシュ対象へ登録される');
const pillars = bossMonsters.filter(monster => Number(monster.id) >= 512001 && Number(monster.id) <= 512005);
assert(pillars.length === 5 && pillars.every((monster, index) => Number(monster.imageId) === 512000 && monster.linkedBattleGroup === 'vegnasis' && Number(monster.linkedDeathIndex) === index && Number(monster.gutsLevel) >= 10), 'ヴェグナシスは1画像・5攻撃対象・高根性の連結ボスとして正本化されている');
assert(Number(bossMonsters.find(monster => Number(monster.id) === 512100)?.imageId) === 512100 && Number(bossMonsters.find(monster => Number(monster.id) === 512101)?.imageId) === 512101, 'アゼルガラグ第一・第二形態は別の差し替え用画像IDを持つ');
assert(cc.ABYSS_REGION_CONTENT.itemIds.every(id => allItems.has(Number(id))) && allItems.has(701008), '結晶片とオクタプリズマがitems.js正本に存在する');
assert(cc.ABYSS_REGION_CONTENT.skillIds.every(id => allSkills.has(Number(id))) && allSkills.has(700101), '混沌の衣がskills.js正本に存在する');
const expectedVistaPrices = new Map([[600101,18000],[600119,24000],[600200,18000],[600202,22000],[600300,26000],[600400,18000]]);
assert([...expectedVistaPrices].every(([id, price]) => {
  const item = cc.ITEMS_DATA.find(entry => Number(entry.id) === id);
  return item?.shopAvailable === true && Number(item.price) === price;
}), 'ビスタ販売用の技法書6種がitems.js正本で購入可能になっている');

// Runtime migration and environmental modifiers.
function runtimeContext(data) {
  const rt = loadMapRuntime(root, { context: { App: null, Field: null, Dungeon: null, Battle: { active: false }, Menu: {}, DB: { ITEMS: [] }, StoryManager:{getObjectiveText:()=> 'BASE_OBJECTIVE'} } });
  rt.context.MAP_IDS = rt.context.window.MAP_IDS;
  rt.context.window = rt.context;
  rt.runFile('abyss_region.js');
  const App = {
    data,
    calcStats: () => ({ elmRes:{火:0,水:0,風:0,雷:0,光:0,闇:0,混沌:0}, maxHp:100, maxMp:50 }),
    hasMagicBoat: () => true,
    isFlying: () => false,
    useLightWing: () => true,
    useSkyPrismTo: () => ({ok:true}),
    getAllFixedMapDiscoveryEntries: () => [],
    getWorldEncounterProfile: () => null,
    hasItem: id => Number(data.items?.[id] || 0) > 0,
    getChar: () => null,
    log: () => {}, save: () => {}, changeScene: () => {}, clearAction: () => {}
  };
  const Field = {
    x:0,y:0,currentMapData:null,
    getCurrentAreaKey: () => App.data.location.area,
    enterFixedMap: () => {}, executeMapAction: () => {}, isFixedBossDefeatedAt: () => false,
    render: () => {}
  };
  const Dungeon = {
    floor:1,width:0,height:0,map:null,lastGenVariant:null,
    startFixed: () => {}, onBossDefeated: () => {}, buildRandomFloorLayout: () => { throw new Error('not used'); }
  };
  rt.context.App = App; rt.context.Field = Field; rt.context.Dungeon = Dungeon;
  rt.runFile('abyss_runtime.js');
  return rt.context;
}
const completeData = {
  location:{area:'WORLD',x:0,y:0}, items:{}, characters:[], party:[],
  progress:{flags:{abyssStoryCleared:true},unlocked:{},floor:100}, dungeon:{storyMaxFloor:100}, system:{}
};
const completeRt = runtimeContext(completeData);
const canonicalCompleteFlags = ['abyssCarmenaGateCleared','abyssFirstBarrierCleared','abyssSecondBarrierCleared','abyssLegacionNorthGateOpen','abyssVeldDefeated','abyssJasperDefeated','abyssIlluminaciaDefeated','abyssVegnasisDefeated','abyssAzelgaragDefeated','abyssEpilogueSeen','abyssRandomUnlocked'];
assert(canonicalCompleteFlags.every(key => completeData.progress.flags[key] === true), '旧深淵クリア済みセーブが新ルート完了状態へ完全移行する');
assert(completeData.system.abyssRegionSchemaVersion === 2 && completeData.progress.unlocked.dungeonMenu === true, '深淵セーブ移行バージョンとダンジョンメニュー解放が保存される');

const partialData = {
  location:{area:'ABYSS',x:5,y:5}, items:{}, characters:[], party:[],
  progress:{flags:{},unlocked:{},floor:42}, dungeon:{storyMaxFloor:42,map:{}}, system:{}
};
runtimeContext(partialData);
assert(partialData.location.area === 'CARMENA' && partialData.progress.flags.abyssFirstEntered === true, '旧深淵途中セーブはカルメナへ安全に移送される');
assert(partialData.progress.unlocked.dungeonMenu === false && !partialData.progress.flags.abyssRandomUnlocked, '旧途中セーブではクリア後深淵を早期解放しない');

const modifierData = {
  location:{area:'LEGACION',x:0,y:0}, items:{}, characters:[], party:[],
  progress:{flags:{},unlocked:{},abyssSpiritBlessings:{火:true}}, dungeon:{}, system:{abyssRegionSchemaVersion:2},
  battle:{active:false,abyssSpiritElement:'火',abyssSpiritFinalBlessing:true}
};
const modifierRt = runtimeContext(modifierData);
let stats = modifierRt.App.calcStats({charId:101});
assert(stats.environmentalElmRes.火 === 20, '精霊戦終了後は一時的な-50%・+30%が漏れず、恒久+20%だけ残る');
modifierRt.Battle.active = true;
stats = modifierRt.App.calcStats({charId:101});
assert(Number(stats.environmentalElmRes.火 || 0) === 0, '精霊戦中は-50%と恒久+20%と最終戦加護+30%が正しく合算される');



const objectiveData = {
  location:{area:'CARMENA',x:0,y:0}, items:{}, characters:[], party:[],
  progress:{flags:{abyssFirstEntered:true},unlocked:{}}, dungeon:{}, system:{abyssRegionSchemaVersion:2}, battle:{active:false}
};
const objectiveRt = runtimeContext(objectiveData);
const objective = () => objectiveRt.StoryManager.getObjectiveText(objectiveData);
assert(objective()==='カルメナ北門を守る二将を倒そう', '目的表示がカルメナ門番戦を案内する');
Object.assign(objectiveData.progress.flags,{abyssCarmenaGateCleared:true});
assert(objective()==='東西の楔を倒し、第一層の結界を解こう', '目的表示が第一層の二属性ルートを案内する');
Object.assign(objectiveData.progress.flags,{abyssLeonardDefeated:true,abyssEliciaDefeated:true,abyssFirstBarrierCleared:true});
assert(objective()==='ビスタの先で二つの楔を倒そう', '目的表示が第二層の二属性ルートを案内する');
Object.assign(objectiveData.progress.flags,{abyssSyrisDefeated:true,abyssGradDefeated:true,abyssSecondBarrierCleared:true});
assert(objective()==='レガシオンの謁見の間へ向かおう', '目的表示がレガシオン謁見を案内する');
Object.assign(objectiveData.progress.flags,{abyssLegacionNorthGateOpen:true,abyssVeldDefeated:true,abyssJasperDefeated:true,abyssIlluminaciaDefeated:true,abyssVegnasisDefeated:true,abyssAzelgaragDefeated:true,abyssEpilogueSeen:true});
assert(objective()==='終焉の祭壇に残った亀裂を調べよう', '目的表示がクリア後亀裂イベントを案内する');
objectiveData.progress.flags.abyssRandomUnlocked=true;
assert(objective()==='BASE_OBJECTIVE', 'クリア後深淵解放後は既存目的表示へ戻る');

// Procedural floor persistence and bidirectional-link validation.
const proceduralData = {
  location:{area:'BLACK_ROPE_PYRAMID',x:0,y:0}, items:{1:1}, characters:[], party:[],
  progress:{flags:{abyssCarmenaGateCleared:true},unlocked:{},abyssSpiritBlessings:{}}, dungeon:{}, system:{abyssRegionSchemaVersion:2},
  battle:{active:false}
};
const procRt = loadMapRuntime(root, { context: { App: null, Field: null, Dungeon: null, Battle: { active: false }, Menu: {}, DB: { ITEMS: [{id:1,rank:1,type:'HP回復',price:10}] } } });
procRt.context.MAP_IDS = procRt.context.window.MAP_IDS;
procRt.context.window = procRt.context;
procRt.runFile('abyss_region.js');
const procApp = {
  data:proceduralData,
  calcStats: () => ({elmRes:{火:0,水:0,風:0,雷:0,光:0,闇:0,混沌:0},maxHp:100,maxMp:50}),
  hasMagicBoat:()=>true,isFlying:()=>false,useLightWing:()=>true,useSkyPrismTo:()=>({ok:true}),
  getAllFixedMapDiscoveryEntries:()=>[],getWorldEncounterProfile:()=>null,hasItem:()=>false,getChar:()=>null,
  log:()=>{},save:()=>{},changeScene:()=>{},clearAction:()=>{}
};
const procField = {x:0,y:0,currentMapData:null,getCurrentAreaKey:()=>procApp.data.location.area,enterFixedMap:()=>{},executeMapAction:()=>{},isFixedBossDefeatedAt:()=>false,render:()=>{}};
const procDungeon = {
  floor:1,width:0,height:0,map:null,lastGenVariant:null,startFixed:()=>{},onBossDefeated:()=>{},
  buildRandomFloorLayout(){
    this.map = Array.from({length:17}, (_, y) => Array.from({length:25}, (_, x) => (x===0||y===0||x===24||y===16)?'W':'T'));
    this.map[4][4] = 'C'; this.map[12][19] = 'R';
  }
};
procRt.context.App=procApp;procRt.context.Field=procField;procRt.context.Dungeon=procDungeon;
procRt.runFile('abyss_runtime.js');
const procTemplate = procRt.context.FIXED_DUNGEON_MAPS.BLACK_ROPE_PYRAMID.floors[1];
const generatedA = procRt.context.AbyssRegionRuntime.getProceduralFloor('BLACK_ROPE_PYRAMID',2,procTemplate);
const generatedB = procRt.context.AbyssRegionRuntime.getProceduralFloor('BLACK_ROPE_PYRAMID',2,procTemplate);
assert(JSON.stringify(generatedA) === JSON.stringify(generatedB), '同一入場中の可変階層構造・宝箱が保存される');
assert(generatedA.floorLinks.some(link=>Number(link.toFloor)===1) && generatedA.floorLinks.some(link=>Number(link.toFloor)===3), '可変階層から前後の階へ戻れる');
assert(generatedA.chests.length === 2 && generatedA.tiles.some(row=>row.includes('U')) && generatedA.tiles.some(row=>row.includes('D')), '既存深淵生成結果から宝箱と双方向階段を正規生成する');
const oldRun = generatedA.proceduralRunId;
procRt.context.AbyssRegionRuntime.beginDungeonRun('BLACK_ROPE_PYRAMID');
const generatedC = procRt.context.AbyssRegionRuntime.getProceduralFloor('BLACK_ROPE_PYRAMID',2,procTemplate);
assert(Number(generatedC.proceduralRunId) > Number(oldRun), 'ダンジョン再入場時には新しい可変階層ランを開始する');

// Environmental resistance and recruitment coverage across the new region.
procField.currentMapData = procRt.context.FIXED_DUNGEON_MAPS.BLACK_ROPE_PYRAMID.floors[0];
let thunderStats = procRt.context.App.calcStats({charId:101});
assert(thunderStats.environmentalElmRes.雷 === -50, 'ダンジョン環境耐性低下がステータス計算へ反映される');
procField.currentMapData = procRt.context.FIXED_MAPS.CARMENA;
procApp.data.location.area = 'CARMENA';
procApp.data.progress.flags.abyssCarmenaGateCleared = false;
procApp.data.progress.abyssSpiritBlessings = {};
let carmenaStats = procRt.context.App.calcStats({charId:101});
let protectedStats = procRt.context.App.calcStats({charId:306});
assert(['火','水','風','雷','光','闇','混沌'].every(element=>carmenaStats.environmentalElmRes[element]===-100), 'カルメナ汚染は対象者の全属性耐性を-100%する');
assert(Object.keys(protectedStats.environmentalElmRes).length===0, 'シャニーはカルメナ汚染の対象外である');
const recruitAreas = ['ABYSS_WORLD','CARMENA','THUNDER_DUNES','BLACK_ROPE_PYRAMID','VISTA','LEGACION','FINAL_ALTAR','ABYSS'];
assert(recruitAreas.every(area=>procRt.context.AbyssRegionRuntime.isAbyssArea(area)), '新規深淵全域とクリア後ランダム深淵が仲間化許可エリア正本に含まれる');
assert(procRt.context.AbyssRegionRuntime.isAbyssArea('WORLD')===false, '地上世界を深淵魔物仲間化エリアへ含めない');

if (failures.length) {
  console.error(`Abyss region rework validation failed (${failures.length}):`);
  failures.forEach(message => console.error(` - ${message}`));
  process.exit(1);
}
console.log(`Abyss region rework validation passed (${checks.length} checks).`);
