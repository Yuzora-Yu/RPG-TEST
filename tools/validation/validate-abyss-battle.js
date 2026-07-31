const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const failures = [];
const checks = [];
const assert = (condition, message) => condition ? checks.push(message) : failures.push(message);

(async () => {
  const conversations = [];
  const logs = [];
  const monsterBases = new Map([
    [302101, {id:302101,name:'深淵王アゼルガラグ・終極',hp:342000,mp:6700,atk:2920,def:2710,spd:1960,mag:3050,mdef:2790,acts:[166,245,700101,315]}],
    [302080, {id:302080,gutsLevel:10,linkedDeathIndex:0}],
    [302081, {id:302081,gutsLevel:10,linkedDeathIndex:1}]
  ]);
  let Battle = {
    active:false,auto:true,phase:'init',enemies:[],party:[],
    startInputPhase(){ this.phase='input'; },
    init(){ this.active=true; },
    tryGutsSurvive(){ return false; },
    decideEnemyAction(enemy){ return enemy.acts?.[0] ?? null; },
    updateDeadState(){
      this.enemies.forEach(enemy=>{ if(Number(enemy.hp||0)<=0) enemy.isDead=true; });
    },
    renderEnemies(){},
    getMonsterBaseById(id){ return monsterBases.get(Number(id)) || null; },
    createMonsterFromBase(base){ return {baseId:base.id,id:base.id,name:base.name,hp:base.hp,mp:base.mp,baseMaxHp:base.hp,baseMaxMp:base.mp,baseStats:{atk:base.atk,def:base.def,spd:base.spd,mag:base.mag,mdef:base.mdef},acts:[...(base.acts||[])],isDead:false}; },
    updateAutoButton(){},
    log(message){ logs.push(String(message)); },
    getEl(){ return null; },
    resolveMonsterImage(){ return null; }
  };
  const App = {
    data:{battle:{active:true,fixedBossId:302100},progress:{abyssSpiritBlessings:{}},items:{701008:1}},
    ensureAbyssRegionProgress(){
      this.data.progress=this.data.progress||{};
      this.data.progress.abyssSpiritBlessings=this.data.progress.abyssSpiritBlessings||{};
      return this.data.progress;
    },
    save(){}
  };
  let ItemRuntime = {
    isBattleUsable(){ return false; },
    getBattleTargetType(){ return 'single'; },
    applyBattleItem(){ return {handled:false}; }
  };
  const context = {
    console, Promise, setTimeout, clearTimeout,
    Battle, App, ItemRuntime,
    DB:{ITEMS:[
      {id:701001,name:'火の結晶片'},{id:701006,name:'闇の結晶片'},{id:701008,name:'オクタプリズマ'}
    ]},
    STORY_MANAGER_DATA:{scripts:{}},
    StoryManager:{
      async showConversation(key){ conversations.push(key); },
      endConversation(){}
    },
    MonsterData:{getMonsterById:id=>monsterBases.get(Number(id))||null},
    GRAPHICS:{images:{}},
    document:{getElementById(){return null;},createElement(){return {style:{},className:'',appendChild(){}};}},
  };
  context.window=context; context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(`${fs.readFileSync(path.join(root,'battle.js'),'utf8')}\nglobalThis.Battle = Battle;`, context, {filename:'battle.js'});
  Battle = context.Battle;
  Battle.getMonsterBaseById = id => monsterBases.get(Number(id)) || null;
  Battle.createMonsterFromBase = base => ({baseId:base.id,id:base.id,name:base.name,hp:base.hp,mp:base.mp,baseMaxHp:base.hp,baseMaxMp:base.mp,baseStats:{atk:base.atk,def:base.def,spd:base.spd,mag:base.mag,mdef:base.mdef},acts:[...(base.acts||[])],isDead:false});
  Battle.updateAutoButton = () => {};
  Battle.renderEnemies = () => {};
  Battle.renderPartyStatus = () => {};
  Battle.refreshPartyFormationAuras = () => {};
  Battle.log = message => logs.push(String(message));
  vm.runInContext(fs.readFileSync(path.join(root,'item_runtime.js'),'utf8'), context, {filename:'item_runtime.js'});
  ItemRuntime = context.ItemRuntime;

  // Azelgarag phase transition must replace the enemy without normal victory processing.
  Battle.party=[{uid:'p1',hp:1,mp:0,baseMaxHp:1000,baseMaxMp:250,isDead:true,battleStatus:{buffs:{},debuffs:{},ailments:{}}}];
  Battle.enemies=[{baseId:302100,id:302100,name:'深淵王アゼルガラグ',hp:0,mp:100,baseMaxHp:200000,baseMaxMp:6000,isDead:false}];
  Battle.updateDeadState();
  assert(Number(Battle.enemies[0]?.baseId)===302101 && App.data.battle.fixedBossId===302101, '第一形態HP0時に勝利扱いせず第二形態へ置換する');
  assert(Battle.party[0].hp===1000 && Battle.party[0].mp===250 && Battle.party[0].isDead===false, '第二形態移行時に味方HP・MP・戦闘不能を全回復する');
  assert(['atk','def','spd','mag','mdef'].every(key=>Battle.party[0].battleStatus.buffs[key]?.val===1.3), '光の神の加護で全能力バフを付与する');
  await Battle.awaitPendingBattleEvent();
  assert(conversations.includes('ABYSS_AZELGARAG_TRANSFORM'), '第二形態移行会話を戦闘中イベントとして実行する');

  // Octaprism must be battle-limited, non-consumable, and seal the three designated skills.
  App.data.battle={active:true,fixedBossId:302101,abyssOctaprismUsed:false};
  Battle.enemies=[Battle.createMonsterFromBase(monsterBases.get(302101))];
  const octaResult=ItemRuntime.applyBattleItem({Battle,App,item:{id:701008},command:{actor:{name:'シャニー'}}});
  const finalEnemy=Battle.enemies[0];
  assert(octaResult.handled===true && octaResult.consumed===false && App.data.battle.abyssOctaprismUsed===true, 'オクタプリズマはアゼルガラグ戦のみ一度だけ非消費で発動する');
  assert(['atk','def','spd','mag','mdef'].every(key=>finalEnemy.battleStatus.debuffs[key]?.val===0.7), 'オクタプリズマが深淵王の全能力を低下させる');
  assert([166,245,700101].every(id=>finalEnemy.abyssSealedSkillIds.includes(id)), 'ラグナロク・カオスショック・混沌の衣を封印する');
  finalEnemy.acts=[166,1,245];
  assert(Battle.decideEnemyAction(finalEnemy)?.type==='enemy_attack' && finalEnemy.acts.length===3, '封印スキルを行動候補から一時除外し、元データを破壊しない');
  assert(ItemRuntime.isBattleUsable({id:701008})===false, '使用後のオクタプリズマは再使用できない');

  // Vagnasis fallen-part hook must strengthen remaining targets but only heal 20% max HP.
  App.data.battle={active:true,fixedBossId:[302080,302081]};
  const fallen={baseId:302080,id:302080,name:'雷柱レナード',hp:0,mp:0,baseMaxHp:1000,baseMaxMp:100,isDead:false,linkedDeathIndex:0};
  const remaining={baseId:302081,id:302081,name:'風柱エリシア',hp:200,mp:30,baseMaxHp:1000,baseMaxMp:100,isDead:false,baseStats:{atk:100,def:100,spd:100,mag:100,mdef:100},atk:100,def:100,spd:100,mag:100,mdef:100};
  Battle.enemies=[fallen,remaining];
  Battle.updateDeadState();
  assert(fallen.isDead===true && fallen.abyssFallHandled===true, '魔柱1対象の撃破を一度だけ確定する');
  assert(remaining.baseMaxHp===1180 && remaining.hp===436 && remaining.baseMaxMp===112 && remaining.mp===112, '対象撃破ごとに残存魔柱を強化し、HP回復を最大HPの20%に抑える');
  assert(['atk','def','spd','mag','mdef'].every(key=>remaining.baseStats[key]===118), '残存魔柱の各能力を段階強化する');
  assert(Battle.phase==='battle_event', '魔柱撃破と同時に入力・オート進行を戦闘イベント状態へ停止する');
  await Battle.awaitPendingBattleEvent();
  assert(conversations.includes('ABYSS_VEGNASIS_FALL_1'), '魔柱撃破ごとの戦闘中会話を実行する');

  // Auto battle must pause during queued conversations and restore afterward.
  Battle.auto=true;
  Battle.enemies=[{baseId:302080,id:302080,hp:0,isDead:false,linkedDeathIndex:0},{baseId:302081,id:302081,hp:10,isDead:false,baseMaxHp:10,baseMaxMp:1,baseStats:{atk:1,def:1,spd:1,mag:1,mdef:1}}];
  Battle.updateDeadState();
  assert(Battle.auto===false, '戦闘中イベント開始時にオートを一時停止する');
  await Battle.awaitPendingBattleEvent();
  assert(Battle.auto===true, '戦闘中イベント終了後にオート状態を復元する');

  // Every elemental trial must award its shard once and the sixth grants Octaprisma.
  App.data.items={};
  App.data.progress={flags:{},abyssSpiritBlessings:{}};
  App.data.battle={fixedTrialElement:'火',abyssSpiritElement:'火',fixedTrialRewardItemId:701001,fixedTrialCompletionItemId:701008,fixedTrialRequiredElements:['火','水','風','雷','光','闇']};
  let trialDrops=[];
  const firstTrialMessages=Battle.completeAbyssElementalTrial(trialDrops);
  assert(App.data.progress.abyssSpiritBlessings['火']===true && App.data.items[701001]===1, '精霊勝利時に属性加護と対応する結晶片を一度付与する');
  Battle.completeAbyssElementalTrial(trialDrops);
  assert(App.data.items[701001]===1, '同じ精霊試練の勝利処理を再開しても結晶片を重複付与しない');
  Object.assign(App.data.progress.abyssSpiritBlessings,{水:true,風:true,雷:true,光:true});
  App.data.battle={fixedTrialElement:'闇',abyssSpiritElement:'闇',fixedTrialRewardItemId:701006,fixedTrialCompletionItemId:701008,fixedTrialRequiredElements:['火','水','風','雷','光','闇']};
  trialDrops=[];
  const finalTrialMessages=Battle.completeAbyssElementalTrial(trialDrops);
  assert(App.data.items[701006]===1 && App.data.items[701008]===1 && App.data.progress.flags.abyssAllSpiritTrialsCleared===true, '六属性すべての承認時だけオクタプリズマを付与する');
  assert(firstTrialMessages.length===1 && finalTrialMessages.length===2, '精霊承認と全制覇の結果メッセージを戦闘リザルトへ返す');

  if (failures.length) {
    console.error(`Abyss battle validation failed (${failures.length}):`);
    failures.forEach(message=>console.error(` - ${message}`));
    process.exit(1);
  }
  console.log(`Abyss battle validation passed (${checks.length} checks).`);
})().catch(error=>{ console.error(error); process.exit(1); });
