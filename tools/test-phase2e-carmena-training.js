#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function createContext() {
  const dummyElement = () => ({
    style:{}, dataset:{}, classList:{add(){},remove(){},contains(){return false;}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    setAttribute(){}, getAttribute(){return null;}, innerHTML:'', textContent:'',
    scrollTop:0, scrollHeight:0
  });
  const document = {
    getElementById(){return dummyElement();}, querySelector(){return null;}, querySelectorAll(){return [];},
    createElement(){return dummyElement();}, body:dummyElement(), documentElement:dummyElement(), addEventListener(){}
  };
  const context = {
    console, document, setTimeout, clearTimeout, Math, Date, JSON, Number, String, Array, Object,
    Map, Set, WeakMap, Promise, Intl, structuredClone:global.structuredClone,
    window:null, globalThis:null,
    DB:{SKILLS:[],MONSTERS:[],ITEMS:[],EQUIPS:[],CHARACTERS:[],SYNERGIES:[]},
    CONST:{ELEMENTS:['火','水','風','雷','光','闇','混沌'],SKILL_TREES:{},EXP_BASE:100,RARITY_EXP_MULT:{}},
    App:{data:{progress:{flags:{}},book:{killCounts:{}},party:[],characters:[],battle:{}},getChar(){return null;},save(){return true;}},
    Field:{currentMapData:null}, Dungeon:{}, Menu:{msg(){},confirm(_text,yes){yes?.();}},
    Facilities:{escapeAttr(value){return String(value ?? '');},setupBaseLayout(){},showModal(){},closeModal(){}},
    navigator:{}, localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    Image:function(){return dummyElement();}, Audio:function(){return dummyElement();}
  };
  context.window=context;
  context.globalThis=context;
  vm.createContext(context);
  return context;
}

function load(context,file,suffix='') {
  vm.runInContext(`${read(file)}\n${suffix}`,context,{filename:file});
}

const context=createContext();
load(context,'skills.js');
context.DB.SKILLS=context.SKILLS_DATA;
load(context,'monsters.js','globalThis.MonsterData=MonsterData;');
context.DB.MONSTERS=context.MONSTERS_DATA;
load(context,'abyss_content.js');
load(context,'map.js');
load(context,'story.js');

const carmena=context.FIXED_MAPS.CARMENA;
assert(carmena,'カルメナマスターが見つかりません。');
assert.strictEqual(carmena.entryEventId,'abyss_carmena_arrival_warning');
assert.strictEqual(carmena.entryEventFlag,'abyssCarmenaArrivalWarningSeen');
const hintResident=(carmena.mapActors||[]).find(actor=>actor.actorId==='abyss_carmena_resident_lighthouse');
assert(hintResident,'地上から落ちた住民が配置されていません。');
assert.strictEqual(hintResident.baseTile,'G');
assert(['G','T'].includes(carmena.tiles[hintResident.y][hintResident.x]),'住民が通行不能地形へ配置されています。');
assert(context.STORY_MANAGER_DATA.events.abyss_carmena_arrival_warning,'カルメナ初到着イベントがありません。');
assert(context.STORY_MANAGER_DATA.events.abyss_carmena_resident_lighthouse,'カルメナ住民イベントがありません。');
const arrivalText=context.STORY_MANAGER_DATA.scripts.ABYSS_CARMENA_ARRIVAL_WARNING.map(line=>line.text).join('\n');
assert(arrivalText.includes('プリズムの加護も届かない場所'),'初到着警告が不足しています。');
assert(arrivalText.includes('大きな傷'),'被ダメージ警告が不足しています。');
const residentText=context.STORY_MANAGER_DATA.scripts.ABYSS_CARMENA_RESIDENT_LIGHTHOUSE.map(line=>line.text).join('\n');
for(const phrase of ['大灯台の北','人が入るべきじゃねえ魔境','良い訓練になる','どこにもいけねえ']) {
  assert(residentText.includes(phrase),`住民会話に「${phrase}」がありません。`);
}

for(const file of ['map.js','story.js','monsters.js','battle.js']) {
  assert(!/(^|[^ガ])レオン将軍/m.test(read(file)),`${file}に旧名「レオン将軍」が残っています。`);
}
const glen=context.MonsterData.getMonsterById(302000);
const galeon=context.MonsterData.getMonsterById(302001);
assert.strictEqual(galeon.name,'深淵門将ガレオン');
function validateGeneral(monster,allowedElements) {
  const above=(monster.acts||[]).filter(act=>Number(act.condition)===1);
  const below=(monster.acts||[]).filter(act=>Number(act.condition)===2);
  assert(above.length>=6 && below.length>=6,`${monster.name}のHP帯別行動が不足しています。`);
  for(const act of [...above,...below]) {
    const skill=context.DB.SKILLS.find(entry=>Number(entry.id)===Number(act.id));
    assert(skill,`${monster.name}の技${act.id}が見つかりません。`);
    assert.strictEqual(skill.type,'物理',`${monster.name}に物理以外の技が含まれています: ${skill.name}`);
    assert(!skill.elm || allowedElements.includes(skill.elm),`${monster.name}に指定外属性${skill.elm}があります。`);
  }
  const aboveSingle=above.filter(act=>context.DB.SKILLS.find(skill=>Number(skill.id)===Number(act.id))?.target==='単体')
    .reduce((sum,act)=>sum+Number(act.rate||0),0);
  const aboveAll=above.filter(act=>context.DB.SKILLS.find(skill=>Number(skill.id)===Number(act.id))?.target==='全体')
    .reduce((sum,act)=>sum+Number(act.rate||0),0);
  const debuffRate=above.filter(act=>[143,144].includes(Number(act.id))).reduce((sum,act)=>sum+Number(act.rate||0),0);
  assert(aboveSingle>aboveAll,`${monster.name}のHP50%以上で単体技が優先されていません。`);
  assert(debuffRate>=20 && debuffRate<=40,`${monster.name}のHP50%以上の弱体技比率が不適切です: ${debuffRate}`);
}
validateGeneral(glen,['風','雷','光','混沌']);
validateGeneral(galeon,['水','火','闇','混沌']);

const trainingMaster=context.ABYSS_REGION_CONTENT.storyBossTrainingMaster;
const difficulties=context.ABYSS_REGION_CONTENT.storyBossTrainingDifficulties;
assert(trainingMaster.length>=16,'訓練所の正式ボスマスターが不足しています。');
assert.deepStrictEqual(Array.from(difficulties,v=>Number(v.strengthFloor)),[101,151,201,301]);
const legacion=context.FIXED_MAPS.LEGACION;
const trainingAction=(legacion.mapActions||[]).find(action=>action.type==='bossTraining');
assert(trainingAction,'レガシオンに訓練所導線がありません。');
assert.notDeepStrictEqual([trainingAction.x,trainingAction.y],[15,25],'育成所と訓練所が重複しています。');
assert.notDeepStrictEqual([trainingAction.x,trainingAction.y],[38,33],'格闘場予定地と訓練所が重複しています。');
assert.strictEqual(legacion.tiles[trainingAction.y][trainingAction.x],'H','訓練所入口が施設タイルではありません。');

context.Monster=class Monster {
  constructor(base){
    Object.assign(this,JSON.parse(JSON.stringify(base||{})));
    this.hp=Number(base?.hp||1); this.mp=Number(base?.mp||0); this.mdef=Number(base?.mdef||base?.mag||1);
    this.baseMaxHp=this.hp; this.baseMaxMp=this.mp;
    this.baseStats={atk:Number(base?.atk||1),def:Number(base?.def||1),spd:Number(base?.spd||1),mag:Number(base?.mag||1)};
    this.traits=JSON.parse(JSON.stringify(base?.traits||[]));
    this.resists=JSON.parse(JSON.stringify(base?.resists||{}));
    this.elmRes=JSON.parse(JSON.stringify(base?.elmRes||{}));
  }
};
load(context,'passiveSkill.js','globalThis.PassiveSkill=PassiveSkill;');
load(context,'battle.js','globalThis.Battle=Battle;');
context.Battle.log=()=>{};
context.Battle.initBattleStatus=()=>{};
context.App.data={
  progress:{floor:1,flags:{firePrismRestored:true}},
  location:{area:'LEGACION'}, dungeon:{}, book:{killCounts:{301010:1}},
  battle:{active:false,isBossBattle:true,storyBossTraining:{trainingId:'surface_glad',opponentName:'炎楔のグラド',monsterIds:[301010],strengthFloor:151}}
};
const generated=context.Battle.generateNewEnemies(true,null);
assert.strictEqual(generated.length,1);
assert.strictEqual(generated[0].baseId,301010);
assert.strictEqual(generated[0].generatedFloor,151);
assert.strictEqual(generated[0].deepEnhancementVersion,2);
assert.strictEqual(generated[0].exp,0);
assert.strictEqual(generated[0].gold,0);
assert.strictEqual(generated[0].drops,null);
for(const original of glen ? [] : []) void original;
const glad=context.MonsterData.getMonsterById(301010);
for(const act of glad.acts) assert(generated[0].acts.some(current=>Number(current.id)===Number(act.id)),'訓練生成で元技が失われています。');

load(context,'boss_training.js','globalThis.BossTraining=BossTraining;');
const hero={uid:'p1',currentHp:321,currentMp:45};
context.App.data={
  progress:{flags:{firePrismRestored:true}},book:{killCounts:{301010:1}},party:['p1'],characters:[hero],battle:{}
};
context.App.getChar=uid=>uid==='p1'?hero:null;
context.App.calcStats=()=>({maxHp:500,maxMp:100});
context.App.changeScene=scene=>{context.__scene=scene;};
context.BossTraining.startBattle(trainingMaster.find(entry=>entry.id==='surface_glad'),difficulties[0]);
assert.strictEqual(context.__scene,'battle');
assert.strictEqual(context.App.data.battle.suppressFixedBossDefeat,true);
assert.strictEqual(context.App.data.battle.storyBossTraining.partySnapshot[0].currentHp,321);
assert.strictEqual(context.App.data.battle.storyBossTraining.strengthFloor,101);

const battleSource=read('battle.js');
for(const contract of [
  'const rewardResultEnemies = isTrainingBattle ? [] : defeatedResultEnemies',
  '!isTrainingBattle && typeof App.noteQuestKills',
  '!isTrainingBattle && typeof App.noteBattleVictory',
  'storyBossTraining: trainingJournalContext',
  'Battle.restoreStoryBossTrainingPartyState()',
  '訓練戦のため報酬・討伐記録は発生しない'
]) assert(battleSource.includes(contract),`訓練戦の非進行契約が不足しています: ${contract}`);

const mainSource=read('main.js');
assert(mainSource.includes("sceneId === 'boss-training'"),'訓練所シーン初期化がありません。');
assert(mainSource.includes("action.type === 'bossTraining'"),'訓練所マップアクションがありません。');
const indexSource=read('index.html');
assert(indexSource.includes('id="boss-training-scene"'),'訓練所シーンDOMがありません。');
assert(indexSource.includes('src="boss_training.js"'),'訓練所スクリプトが読み込まれていません。');

console.log(`Phase2Eカルメナ・訓練所検証: OK（訓練対象 ${trainingMaster.length} / 難易度 ${difficulties.length}）`);
