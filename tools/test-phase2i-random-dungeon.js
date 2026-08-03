#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadMapRuntime } = require('./validation/validation-helpers');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function dummyElement() {
  return {
    style:{}, dataset:{}, classList:{add(){},remove(){},contains(){return false;}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    setAttribute(){}, getAttribute(){return null;}, getContext(){return {};},
    getBoundingClientRect(){return {left:0,top:0,width:320,height:320};},
    children:[], innerHTML:'', textContent:'', disabled:false
  };
}

function createMainContext() {
  const document = {
    getElementById(){ return dummyElement(); }, querySelector(){ return null; }, querySelectorAll(){ return []; },
    createElement(){ return dummyElement(); }, body:dummyElement(), documentElement:dummyElement(), addEventListener(){}
  };
  const window = {
    JOB_SKILLS:{}, CHARACTERS_DATA:[], ITEMS_DATA:[], EQUIP_MASTER:[], addEventListener(){},
    requestAnimationFrame(callback){ return callback?.(); }, setTimeout, clearTimeout, document,
    innerWidth:320, innerHeight:640
  };
  const context = {
    window, document, console, setTimeout, clearTimeout, Math:Object.create(Math), Date, JSON, Number, String, Array, Object,
    Map, Set, WeakMap, WeakSet, Promise, Intl, structuredClone:global.structuredClone,
    DB:{CHARACTERS:[],SKILLS:[],ITEMS:[],EQUIPS:[],SYNERGIES:[],MONSTERS:[],OPT_RULES:[]},
    CONST:{SKILL_TREES:{},EXP_BASE:100,RARITY_EXP_MULT:{},ELEMENTS:['火','水','風','雷','光','闇','混沌'],PLUS_RATES:{1:0,2:0,3:0}},
    navigator:{}, localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    Image:function Image(){return dummyElement();}, Audio:function Audio(){return dummyElement();},
    Field:{currentMapData:null,getCurrentAreaKey(){return 'WORLD';},getBattleBg(){return 'battle_bg_field';}},
    Dungeon:{}, MapRegistry:{getActiveWorldKey(){return 'WORLD';}}, PassiveSkill:{getSumValue(){return 0;}}, globalThis:null,
    ABYSS_REGION_MASTER:{elements:['火','水','風','雷','光','闇','混沌'],protectedCarmenaCharacterIds:[]}
  };
  context.globalThis = context;
  Object.assign(window, context);
  vm.createContext(context);
  vm.runInContext(`${read('abyss_content.js')}`, context, {filename:'abyss_content.js'});
  vm.runInContext(`${read('main.js')}\nglobalThis.App=App;`, context, {filename:'main.js'});
  return context;
}

// --- 属性結晶片を全仲間耐性の正本にする ---
{
  const context = createMainContext();
  const App = context.App;
  App.data = {
    progress:{flags:{},abyssSpiritBlessings:{}}, items:{701001:1}, characters:[], party:[],
    battle:{active:false}, location:{area:'WORLD'}, dungeon:{}, system:{}, book:{killCounts:{}}, stats:{}, inventory:[]
  };
  const futureAlly = {charId:999999,name:'後加入テスト'};
  assert.strictEqual(App.getEnvironmentalElementModifiers(futureAlly)['火'], 20, '火の結晶片が未加入を含む全仲間へ20%耐性を付与しません。');
  assert.strictEqual(App.getEnvironmentalElementModifiers(futureAlly)['水'], 0, '未所持属性へ耐性が付与されました。');
  App.data.progress.abyssSpiritBlessings['水'] = true;
  const migration = App.migrateSpiritFragmentResistanceSourceV1(App.data);
  assert.strictEqual(migration.changed, true, '旧加護フラグから結晶片を補填できません。');
  assert.strictEqual(App.data.items[701002], 1);
  assert.strictEqual(App.getEnvironmentalElementModifiers(futureAlly)['水'], 20);
  assert.strictEqual(App.migrateSpiritFragmentResistanceSourceV1(App.data).applied, false, '結晶片移行が二度実行されました。');

  const oldEx = {id:'old-ex',name:'【EX】旧装備+3',data:{hp:1000,mp:200,atk:500,def:400,spd:300,mag:450,mdef:350,elmRes:20},opts:[{key:'atk'}],traits:[{id:1,level:5}],locked:true};
  App.data.inventory = [oldEx];
  const exMigration = App.migrateSpecialBossEquipmentBalanceV1(App.data);
  assert.strictEqual(exMigration.changed, true);
  assert.strictEqual(oldEx.data.hp, 550);
  assert.strictEqual(oldEx.data.atk, 275);
  assert.strictEqual(oldEx.data.elmRes, 20, 'EX調整で基礎7能力以外を変更しました。');
  assert.strictEqual(oldEx.opts.length, 1);
  assert.strictEqual(oldEx.traits.length, 1);
  assert.strictEqual(oldEx.locked, true);
  assert.strictEqual(App.migrateSpecialBossEquipmentBalanceV1(App.data).applied, false, 'EX装備移行が二度実行されました。');
}

// --- ランダムダンジョン正式マスター・既存マップ流用・冒険者 ---
{
  let context;
  const items = Array.from({length:12}, (_,i) => ({id:i+1,name:`道具${i+1}`,type:'道具',price:100+i*10,rank:1}));
  items.push({id:50001,name:'特性書テスト',type:'特性書',price:1000,rank:1});
  const runtime = loadMapRuntime(ROOT, {context:{
    console, Math:Object.create(Math), setTimeout, clearTimeout, window:{},
    DB:{ITEMS:items,MONSTERS:[]}, PassiveSkill:{getSumValue:()=>0},
    Field:{x:2,y:2,currentMapData:null,getCurrentAreaKey:()=> 'ABYSS',getCurrentProgressMapKey:()=> 'ABYSS',refreshCurrentAction(){},render(){}},
    App:{
      data:{location:{area:'ABYSS'},progress:{floor:20,mapChanges:{},fixedDungeonKeys:{}},dungeon:{abyssMode:'random'},battle:{},items:{},inventory:[],party:[],gold:0,book:{monsters:[],killCounts:{}}},
      log(){}, save(){return true;}, changeScene(){}, clearAction(){}, setAction(){}, getChar(){return null;},
      createEquipByFloor(_source,floor,plus){return {id:`eq-${floor}-${plus}`,name:`装備R${floor}+${plus}`,data:{},opts:[],traits:[],plus};}
    }
  }});
  context = runtime.context;
  runtime.runFile('abyss_content.js');
  runtime.runFile('dungeon.js', 'globalThis.Dungeon=Dungeon;');
  const Dungeon = context.Dungeon;
  Dungeon.floor = 21;

  const master = context.ABYSS_REGION_CONTENT.randomDungeonPhase2IMaster;
  assert.deepStrictEqual(Array.from(master.adventurer.outcomes, entry => [entry.id, entry.rate]), [
    ['equipment',0.30],['duel',0.30],['shop',0.20],['hunters',0.10],['rareAmbush',0.10]
  ]);
  assert.strictEqual(master.angelTrial.enemyCount, 3);
  assert.strictEqual(master.angelTrial.statMultiplier, 1.35);
  assert.strictEqual(master.abyssRift.rewardPlus, 3);

  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0), 'equipment');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.299999), 'equipment');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.30), 'duel');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.599999), 'duel');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.60), 'shop');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.799999), 'shop');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.80), 'hunters');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.899999), 'hunters');
  assert.strictEqual(Dungeon.resolveAdventurerOutcome(0.90), 'rareAmbush');

  const sequence = [0.01,0,0, 0.99,0,0.999, 0.99,0,0.5, 0.99,0,0.25, 0.99,0,0.75];
  const shop = Dungeon.buildAdventurerShopConfig(() => sequence.shift() ?? 0.5);
  assert.strictEqual(shop.entries.length, 5);
  assert.strictEqual(new Set(shop.itemIds).size, 5);
  assert.strictEqual(shop.entries[0].id, 50001, '5%特性書枠を強制した時に特性書が選ばれません。');
  for (const entry of shop.entries) {
    const item = items.find(candidate => candidate.id === entry.id);
    assert(entry.price >= Math.floor(item.price * 0.5));
    assert(entry.price <= Math.floor(item.price * 3));
  }

  // 既存マップ流用カテゴリとランダム階段。
  const plan = Dungeon.rollRandomFloorPlan(21, 0.55);
  assert.strictEqual(plan.category, 'reused');
  assert(plan.reusedSource, '流用可能な既存マップが見つかりません。');
  Dungeon.applyRandomFloorPlan(plan);
  assert.strictEqual(Dungeon.generateReusedMapFloor(plan), true);
  assert.strictEqual(Dungeon.collectTiles(Dungeon.map, ['S']).length, 1);
  assert.strictEqual(Dungeon.getUnreachableTraversableFloorTiles(Dungeon.getProgressionReachableCells()).length, 0);

  context.App.data.dungeon = {abyssMode:'random'};
  Dungeon.floor = 21;
  assert.strictEqual(Dungeon.rollRandomFloorModifier(0).id, 'dangerTreasure');
  assert.strictEqual(Dungeon.rollRandomFloorModifier(0.05).id, 'rareSurge');
  assert.strictEqual(Dungeon.rollRandomFloorModifier(0.09).id, 'storyBossEcho');
  assert.strictEqual(Dungeon.rollRandomFloorModifier(0.12), null);

  // 候補の安全距離が足りなくても、到達可能床から補って5体出す。
  Dungeon.width = 10; Dungeon.height = 10;
  Dungeon.map = Array.from({length:10}, (_,y) => Array.from({length:10}, (_,x) => (x===0||y===0||x===9||y===9) ? 'W' : 'T'));
  context.Field.x = 5; context.Field.y = 5;
  context.App.data.dungeon = {abyssMode:'random'};
  Dungeon.getSpecialSpawnCandidates = () => [{x:1,y:1}];
  Dungeon.getProgressionReachableCells = () => Dungeon.floodFill(Dungeon.map, 5, 5, tile => tile !== 'W');
  const hunters = Dungeon.spawnRandomHunters();
  assert.strictEqual(hunters.length, 5);
  assert(hunters.every(hunter => hunter.speed === 1.5));
  assert(hunters.every(hunter => hunter.enemyCount === 3));
  assert(hunters.every(hunter => hunter.targetFloor === Dungeon.getBalanceFloor() + 20), 'ハンターが階層+20相当ではありません。');
  assert.strictEqual(Dungeon.completeRandomHunterBattle({id:hunters[0].id}), true);
  assert.strictEqual(hunters[0].active, false);
  assert.strictEqual(Dungeon.completeRandomHunterBattle({id:hunters[0].id}), false, '同じハンター討伐が二重適用されました。');

  // 天使の試練は勝利時に3回だけ永続能力を上げ、同じ状態を再適用しない。
  const trialMember = {uid:'p1',name:'試練者',hp:100,mp:20,atk:10,def:10,mag:10,mdef:10,spd:10};
  context.App.data.party = ['p1'];
  context.App.getChar = uid => uid === 'p1' ? trialMember : null;
  context.App.data.battle = {angelTrial:{id:'angel-test',rewardCount:3}};
  const oldRandom = context.Math.random;
  context.Math.random = () => 0;
  const angelLogs = Dungeon.completeAngelTrialIfNeeded();
  context.Math.random = oldRandom;
  assert.strictEqual(angelLogs.length,3,'天使の試練報酬が3回付与されません。');
  assert.strictEqual(trialMember.hp,109,'天使の試練の永続能力上昇が反映されません。');
  assert.strictEqual(context.App.data.battle.angelTrial,null);
  assert.strictEqual(context.App.data.battle.angelTrialOutcome.applied,true);
  assert.deepStrictEqual(Array.from(Dungeon.completeAngelTrialIfNeeded()),[],'天使の試練報酬が二重適用されました。');

  // 深淵の亀裂は+3装備を一度だけ確定し、受取待ちを保存する。
  let riftCreateArgs = null;
  context.App.data.inventory = [];
  context.App.data.dungeon = {
    abyssMode:'random',
    abyssRift:{active:true,rewardId:'rift-test',targetFloor:31,targetBalanceFloor:131,x:2,y:2},
    completedRiftRewardIds:[]
  };
  context.App.data.battle = {riftRewardId:'rift-test',riftDisplayFloor:31,riftFloor:131,riftRewardPlus:3};
  context.App.createEquipByFloor = (source,floor,plus) => {
    riftCreateArgs = {source,floor,plus};
    return {id:'rift-eq',name:'亀裂装備+3',plus,data:{},opts:[],traits:[]};
  };
  assert.strictEqual(Dungeon.completeAbyssRift(),true,'深淵の亀裂報酬を確定できません。');
  assert.deepStrictEqual(riftCreateArgs,{source:'rift',floor:131,plus:3});
  assert.strictEqual(context.App.data.inventory.length,1);
  assert.strictEqual(context.App.data.dungeon.pendingRiftReward.rewardId,'rift-test');
  assert.strictEqual(Dungeon.completeAbyssRift(),false,'同じ亀裂報酬が二重付与されました。');
}

// --- 戦闘生成・楔・EX正式報酬 ---
{
  const context = {
    console, Math:Object.create(Math), Date, JSON, Number, String, Array, Object, Map, Set, WeakMap, WeakSet, Promise, Intl,
    setTimeout, clearTimeout, document:{getElementById(){return null;}}, window:null, globalThis:null,
    CONST:{ELEMENTS:['火','水','風','雷','光','闇','混沌']},
    DB:{ITEMS:[{id:98,name:'災厄の楔'}],MONSTERS:[],SKILLS:[]},
    PassiveSkill:{getSumValue(){return 0;}}, Field:{currentMapData:null}, Dungeon:{getAbyssMode(){return 'random';}},
    App:{data:{location:{area:'ABYSS'},progress:{floor:120},dungeon:{abyssMode:'random',floor:120},battle:{abyssMode:'random',abyssFloor:120,abyssBalanceFloor:220},items:{},inventory:[],book:{killCounts:{}},gems:0}}
  };
  context.window=context; context.globalThis=context;
  context.Monster = class Monster { constructor(base){ Object.assign(this, JSON.parse(JSON.stringify(base))); } };
  vm.createContext(context);
  vm.runInContext(read('abyss_content.js'), context, {filename:'abyss_content.js'});
  vm.runInContext(`${read('battle.js')}\nglobalThis.Battle=Battle;`, context, {filename:'battle.js'});
  const Battle = context.Battle;
  Battle.log = () => {};
  Battle.applyMapEnemyBoost = () => {};
  const deepCalls = [];
  Battle.createDeepNormalEnemy = (floor, options={}) => {
    deepCalls.push({floor,options});
    return {id:100,baseId:100,name:'深層敵',hp:100,baseMaxHp:100,mp:10,baseMaxMp:10,atk:10,def:10,spd:10,mag:10,mdef:10,baseStats:{atk:10,def:10,spd:10,mag:10,mdef:10},exp:10,gold:10};
  };

  context.App.data.battle = {abyssMode:'random',abyssFloor:20,abyssBalanceFloor:120,angelTrial:{targetFloor:135,enemyCount:3,statMultiplier:1.35,enemyBoost:{}}};
  let enemies = Battle.generateNewEnemies(false);
  assert.strictEqual(enemies.length, 3);
  assert(deepCalls.slice(-3).every(call => call.floor === 135 && call.options.statMultiplier === 1.35));

  context.App.data.battle = {abyssMode:'random',abyssFloor:20,abyssBalanceFloor:120,isRiftBattle:true,riftFloor:130,riftEnemyCount:3,riftStatMultiplier:1.25};
  enemies = Battle.generateNewEnemies(true);
  assert.strictEqual(enemies.length, 3);
  assert(enemies.every(enemy => enemy.riftStatMultiplier === 1.25));
  assert(enemies.every(enemy => enemy.hp === 125 && enemy.atk === 12));

  Battle.getMonsterBaseById = id => ({id:Number(id),name:'深淵門将ガレオン',hp:1000,mp:100,atk:100,def:100,spd:100,mag:100,mdef:100,isBoss:true});
  Battle.createDeepFloorMonster = (base,floor,isBoss) => ({...base,baseId:base.id,generatedFloor:floor,isBoss,phaseTransition:{monsterId:999}});
  context.App.data.battle = {abyssMode:'random',abyssFloor:20,abyssBalanceFloor:120,randomAdventurerDuel:{bossId:302001,targetFloor:130}};
  enemies = Battle.generateNewEnemies(true);
  assert.strictEqual(enemies.length,1);
  assert.strictEqual(enemies[0].baseId,302001);
  assert.strictEqual(enemies[0].generatedFloor,130);
  assert.strictEqual(enemies[0].phaseTransition,undefined);

  context.App.data.battle = {abyssMode:'random',abyssFloor:20,abyssBalanceFloor:120,randomHunter:{targetFloor:140,enemyCount:3}};
  enemies = Battle.generateNewEnemies(false);
  assert.strictEqual(enemies.length,3);
  assert(deepCalls.slice(-3).every(call => call.floor === 140));

  context.MonsterData = {tryGenerateRareMonster(){return {id:777,name:'レア',hp:100,mp:10,atk:10,def:10,spd:10,mag:10,mdef:10,isRare:true};}};
  context.window.MonsterData = context.MonsterData;
  context.App.data.battle = {abyssMode:'random',abyssFloor:20,abyssBalanceFloor:120,randomRareAmbush:{targetFloor:120,enemyCount:5}};
  enemies = Battle.generateNewEnemies(false);
  assert.strictEqual(enemies.length,5);
  assert(enemies.every(enemy => enemy.isRare && enemy.isRandomRareAmbushEnemy));

  let ordinaryRareOptions = null;
  context.MonsterData.tryGenerateRareMonster = (_rank, options) => {
    ordinaryRareOptions = options;
    return {id:778,name:'通常抽選レア',hp:120,mp:12,atk:12,def:12,spd:12,mag:12,mdef:12,isRare:true};
  };
  Battle.createMonsterFromBase = base => ({...base,baseId:base.id,baseMaxHp:base.hp,baseMaxMp:base.mp,baseStats:{atk:base.atk,def:base.def,spd:base.spd,mag:base.mag,mdef:base.mdef}});
  context.App.data.battle = {abyssMode:'random',abyssFloor:20,abyssBalanceFloor:120,rareEncounterRateMultiplier:2};
  enemies = Battle.generateNewEnemies(false);
  assert.strictEqual(enemies.length,1);
  assert.strictEqual(enemies[0].isRare,true,'通常レア抽選でレア個体が拒否されました。');
  assert.strictEqual(ordinaryRareOptions.rateMultiplier,2,'レアモンスター2倍フロアの倍率が抽選へ渡っていません。');

  Battle.createStoryBossEchoEnemy = floor => ({id:301010,baseId:301010,name:'残響',hp:200,baseMaxHp:200,isBoss:false,isStoryBossEcho:true,generatedFloor:floor});
  context.Math.random = () => 0;
  context.App.data.battle = {abyssMode:'random',abyssFloor:20,abyssBalanceFloor:120,storyBossEchoFloor:true,randomDungeonModifier:{normalStatMultiplier:1.15,hpNormalMultiplier:2}};
  enemies = Battle.generateNewEnemies(false);
  assert.strictEqual(enemies.length,1);
  assert.strictEqual(enemies[0].isBoss,false);

  // 101階以降の通常ボスだけ10%。
  context.App.data = {location:{area:'ABYSS'},progress:{floor:101},dungeon:{abyssMode:'random',floor:101},battle:{isBossBattle:true,abyssMode:'random',abyssFloor:101},items:{},inventory:[],book:{killCounts:{}}};
  let drops=[];
  let wedge = Battle.applyEndlessBossWedgeDrop(drops,{random:()=>0.099999});
  assert.strictEqual(wedge.granted,true);
  assert.strictEqual(context.App.data.items[98],1);
  assert.strictEqual(drops.length,1);
  context.App.data.items={}; drops=[];
  wedge = Battle.applyEndlessBossWedgeDrop(drops,{random:()=>0.10});
  assert.strictEqual(wedge.granted,false,'10%境界値で楔が付与されました。');
  context.App.data.battle.abyssFloor=100;
  assert.strictEqual(Battle.applyEndlessBossWedgeDrop([], {random:()=>0}).eligible,false);
  context.App.data.battle={isBossBattle:true,isSpecialBoss:true,abyssMode:'random',abyssFloor:150};
  assert.strictEqual(Battle.applyEndlessBossWedgeDrop([], {random:()=>0}).eligible,false,'専用ボスへ楔追加ドロップが誤適用されました。');

  // EX装備は報酬階層を400で打ち止め、基礎7能力だけ55%。
  const specialBase = {
    id:902000,name:'ギルガメッシュ',specialBossRules:{
      statScalePerDefeat:0.2,requiredItemId:null,consumeRequiredItemOnVictory:false,gemReward:0,
      recruitBaseRate:0,recruitRatePerDefeat:0,recruitMaxRate:1,
      guaranteedEquipment:{plus:3,minRarities:['UR','EX'],namePrefix:'【EX】',baseStatScale:0.55,rewardFloorBase:250,rewardFloorPerDefeat:5,rewardFloorCap:400,valueMultiplier:1}
    }
  };
  Battle.getMonsterBaseById = id => Number(id)===902000 ? specialBase : null;
  context.App.data = {location:{area:'ABYSS'},progress:{floor:1},dungeon:{},battle:{battleId:'ex-test'},items:{},inventory:[],book:{killCounts:{}},gems:0,characters:[]};
  let requestedFloor=0;
  const outcome = Battle.applySpecialBossVictoryOutcome({id:902000,baseId:902000}, {
    completedDefeats:100,drops:[],createEquipment(floor){requestedFloor=floor;return {name:'試験装備+3',val:100,data:{hp:1000,mp:200,atk:500,def:400,spd:300,mag:450,mdef:350,elmRes:20},opts:[{key:'atk'}],traits:[{id:1,level:5}]};}
  });
  assert.strictEqual(requestedFloor,400);
  assert.strictEqual(outcome.equipmentRewardFloor,400);
  assert.strictEqual(outcome.equipmentBaseStatScale,0.55);
  const ex=context.App.data.inventory[0];
  assert.strictEqual(ex.data.hp,550);
  assert.strictEqual(ex.data.atk,275);
  assert.strictEqual(ex.data.elmRes,20);
  assert.strictEqual(ex.opts.length,1);
  assert.strictEqual(ex.traits.length,1);
}

console.log('Phase2I random dungeon, spirit fragment, wedge, and EX equipment regression tests passed.');
