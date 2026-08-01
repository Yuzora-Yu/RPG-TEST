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
  const pillarBases = [
    {id:302080,name:'雷柱レナード',linkedDeathIndex:0,vegnasisElementKey:'thunder',vegnasisPowerName:'黒雷',vegnasisLastStandConversation:'ABYSS_VEGNASIS_LAST_STAND_1',acts:[106]},
    {id:302081,name:'風柱エリシア',linkedDeathIndex:1,vegnasisElementKey:'wind',vegnasisPowerName:'死風',vegnasisLastStandConversation:'ABYSS_VEGNASIS_LAST_STAND_2',acts:[103]},
    {id:302082,name:'水柱シーリス',linkedDeathIndex:2,vegnasisElementKey:'water',vegnasisPowerName:'極零',vegnasisLastStandConversation:'ABYSS_VEGNASIS_LAST_STAND_3',acts:[105,413]},
    {id:302083,name:'火柱グラド',linkedDeathIndex:3,vegnasisElementKey:'fire',vegnasisPowerName:'焦熱',vegnasisLastStandConversation:'ABYSS_VEGNASIS_LAST_STAND_4',acts:[104]},
    {id:302084,name:'闇柱ヴェルド',linkedDeathIndex:4,vegnasisElementKey:'dark',vegnasisPowerName:'昏迷の闇',vegnasisLastStandConversation:'ABYSS_VEGNASIS_LAST_STAND_5',acts:[114]}
  ].map(base => ({
    ...base, hp:1000, mp:100, atk:100, def:100, spd:100, mag:100, mdef:100, actCount:1,
    gutsLevel:10, linkedBattleGroup:'vegnasis', sharedVisualGroup:'vegnasis'
  }));
  const monsterBases = new Map([
    [302100, {
      id:302100,name:'深淵王アゼルガラグ',hp:200000,mp:6000,atk:1500,def:1400,spd:1000,mag:1600,mdef:1450,acts:[166,245],
      phaseTransition:{
        monsterId:302101,conversation:'ABYSS_AZELGARAG_TRANSFORM',preserveOctaprism:true,resumePhase:'input',
        effects:{party:{revive:true,fullRestore:true,buffs:{atk:1.3,def:1.3,spd:1.3,mag:1.3,mdef:1.3},turns:null,source:'light_god'}}
      }
    }],
    [302101, {id:302101,name:'深淵王アゼルガラグ・終極',hp:342000,mp:6700,atk:2920,def:2710,spd:1960,mag:3050,mdef:2790,acts:[166,245,700101,315]}],
    [990001, {id:990001,name:'汎用三形態・第一',hp:100,mp:10,atk:10,def:10,spd:10,mag:10,mdef:10,acts:[1],phaseTransition:{monsterId:990002}}],
    [990002, {id:990002,name:'汎用三形態・第二',hp:120,mp:12,atk:12,def:12,spd:12,mag:12,mdef:12,acts:[1],phaseTransition:{monsterId:990003}}],
    [990003, {id:990003,name:'汎用三形態・第三',hp:150,mp:15,atk:15,def:15,spd:15,mag:15,mdef:15,acts:[1]}],
    ...pillarBases.map(base => [base.id, base])
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
    DB:{
      ITEMS:[
        {id:701001,name:'火の結晶片'},{id:701006,name:'闇の結晶片'},{id:701008,name:'オクタプリズマ'}
      ],
      MONSTERS:pillarBases
    },
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
  const renderEnemiesImpl = Battle.renderEnemies.bind(Battle);
  Battle.getMonsterBaseById = id => monsterBases.get(Number(id)) || null;
  Battle.createMonsterFromBase = base => ({
    ...JSON.parse(JSON.stringify(base)),
    baseId:base.id,id:base.id,name:base.name,hp:base.hp,mp:base.mp,baseMaxHp:base.hp,baseMaxMp:base.mp,
    baseStats:{atk:base.atk,def:base.def,spd:base.spd,mag:base.mag,mdef:base.mdef},
    acts:JSON.parse(JSON.stringify(base.acts||[])),isDead:false,isFled:false,battleStatus:{buffs:{},debuffs:{},ailments:{}}
  });
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
  assert(App.data.battle.defeatedPhases?.some(entry=>Number(entry.baseId)===302100), '形態移行前の第一形態を汎用撃破履歴へ保存する');
  assert(Battle.collectDefeatedEnemiesForResult().some(enemy=>Number(enemy.baseId)===302100), '形態移行前の形態を図鑑・討伐集計対象へ含める');
  assert(Battle.party[0].hp===1000 && Battle.party[0].mp===250 && Battle.party[0].isDead===false, '第二形態移行時に味方HP・MP・戦闘不能を全回復する');
  assert(['atk','def','spd','mag','mdef'].every(key=>Battle.party[0].battleStatus.buffs[key]?.val===1.3), '光の神の加護で全能力バフを付与する');
  await Battle.awaitPendingBattleEvent();
  assert(conversations.includes('ABYSS_AZELGARAG_TRANSFORM'), '第二形態移行会話を戦闘中イベントとして実行する');

  // Generic chains must support future second/third forms without monster-ID branches.
  App.data.battle={active:true,fixedBossId:990001,defeatedPhases:[]};
  Battle.enemies=[Battle.createMonsterFromBase(monsterBases.get(990001))];
  Battle.enemies[0].hp=0;
  Battle.updateDeadState();
  assert(Number(Battle.enemies[0]?.baseId)===990002, '任意モンスターのphaseTransition設定で第二形態へ移行する');
  Battle.enemies[0].hp=0;
  Battle.updateDeadState();
  assert(Number(Battle.enemies[0]?.baseId)===990003, '同じ共通ロジックで第三形態まで連続移行する');
  assert(App.data.battle.defeatedPhases.map(entry=>Number(entry.baseId)).join(',')==='990001,990002', '各途中形態を重複なく撃破履歴へ登録する');

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

  // Vegnasis keeps five target/HP units while sharing one visual body.
  App.data.battle={active:true,fixedBossId:pillarBases.map(base=>base.id)};
  const makePillar = (base, overrides={}) => ({
    ...Battle.createMonsterFromBase(base),
    ...overrides,
    baseStats:{atk:100,def:100,spd:100,mag:100,mdef:100,...(overrides.baseStats||{})},
    atk:overrides.atk??100,def:overrides.def??100,spd:overrides.spd??100,mag:overrides.mag??100,mdef:overrides.mdef??100
  });
  const firstWave=pillarBases.map(base=>makePillar(base));
  firstWave[0].hp=0;
  firstWave[1].hp=200;
  firstWave[1].mp=30;
  Battle.enemies=firstWave;
  Battle.updateDeadState();
  assert(firstWave[0].isDead===true && firstWave[0].abyssFallHandled===true, '魔柱1対象の撃破を一度だけ確定する');
  assert(firstWave[1].baseMaxHp===1180 && firstWave[1].hp===436 && firstWave[1].baseMaxMp===112 && firstWave[1].mp===112, '対象撃破ごとに残存魔柱を強化し、HP回復を最大HPの20%に抑える');
  assert(['atk','def','spd','mag','mdef'].every(key=>firstWave[1].baseStats[key]===118), '残存魔柱の各能力を段階強化する');
  assert(Battle.phase==='battle_event', '魔柱撃破と同時に入力・オート進行を戦闘イベント状態へ停止する');
  await Battle.awaitPendingBattleEvent();
  assert(conversations.includes('ABYSS_VEGNASIS_FALL_1_ABSORB'), '第1〜4柱の撃破会話に力の吸収システム台詞を追加する');

  // The fourth fall awakens whichever identity remains, using its own plea and a clean 1.5x initial profile.
  App.data.battle={active:true,fixedBossId:pillarBases.map(base=>base.id)};
  const finalWave=pillarBases.map(base=>makePillar(base));
  finalWave.slice(0,3).forEach(enemy=>{ enemy.hp=0; enemy.isDead=true; enemy.abyssFallHandled=true; });
  finalWave[3].hp=0;
  finalWave[4].hp=123;
  finalWave[4].mp=7;
  Battle.enemies=finalWave;
  Battle.initializeLinkedBattleGroups();
  Battle.updateDeadState();
  const awakened=finalWave[4];
  assert(awakened.vegnasisFinalAwakened===true && awakened.hp===1500 && awakened.baseMaxHp===1500 && awakened.mp===150 && awakened.baseMaxMp===150, '最後の一柱はHP・MP全回復かつ初期最大値の1.5倍で覚醒する');
  assert(['atk','def','spd','mag','mdef'].every(key=>awakened[key]===150), '最後の一柱は累積値ではなく初期能力の1.5倍へ再構築する');
  assert(awakened.actCount===3 && new Set(awakened.acts.map(action=>Number(typeof action==='object'?action.id:action))).size>=5, '最後の一柱は3回行動かつ他四柱を含む技群を使用する');
  await Battle.awaitPendingBattleEvent();
  assert(conversations.includes('ABYSS_VEGNASIS_FALL_4_ABSORB') && conversations.includes('ABYSS_VEGNASIS_LAST_STAND_5'), '第4柱吸収後に残った柱固有の「止めてくれ」会話を実行する');

  // Final defeat is not resurrected; shared visual can disappear after its defeat-hold animation.
  awakened.hp=0; awakened.isDead=false;
  Battle.updateDeadState();
  assert(awakened.isDead===true && awakened.hp===0, '覚醒した最後の一柱は撃破時に再復活しない');
  await Battle.awaitPendingBattleEvent();
  assert(conversations.includes('ABYSS_VEGNASIS_FALL_5'), '最後の柱は吸収台詞ではなく固有の解放台詞で終了する');

  // Auto battle must pause during queued conversations and restore afterward.
  App.data.battle={active:true,fixedBossId:pillarBases.map(base=>base.id)};
  Battle.auto=true;
  Battle.enemies=pillarBases.map(base=>makePillar(base));
  Battle.enemies[0].hp=0;
  Battle.updateDeadState();
  assert(Battle.auto===false, '戦闘中イベント開始時にオートを一時停止する');
  await Battle.awaitPendingBattleEvent();
  assert(Battle.auto===true, '戦闘中イベント終了後にオート状態を復元する');

  // Shared-image rendering keeps five status/target nodes and removes only the body image after the final defeat.
  class FakeClassList {
    constructor(){ this.values=new Set(); }
    add(...names){ names.forEach(name=>this.values.add(name)); }
    remove(...names){ names.forEach(name=>this.values.delete(name)); }
    toggle(name,force){
      const enabled=force===undefined?!this.values.has(name):!!force;
      if(enabled)this.values.add(name);else this.values.delete(name);
      return enabled;
    }
    contains(name){ return this.values.has(name); }
  }
  class FakeNode {
    constructor(tag='div'){ this.tagName=tag; this.children=[]; this.dataset={}; this.style={}; this.className=''; this.classList=new FakeClassList(); this.attributes={}; this._innerHTML=''; }
    appendChild(child){ this.children.push(child); return child; }
    setAttribute(name,value){ this.attributes[name]=String(value); }
    querySelector(){ return null; }
    querySelectorAll(selector){ return this.children.filter(child=>selector==='.shared-enemy-visual' && String(child.className).includes('shared-enemy-visual')); }
    set innerHTML(value){ this._innerHTML=String(value); if(value==='')this.children=[]; }
    get innerHTML(){ return this._innerHTML; }
  }
  const fakeContainer=new FakeNode('div');
  const fakeScene=new FakeNode('div');
  context.document.createElement=tag=>new FakeNode(tag);
  Battle.getEl=id=>id==='enemy-container'?fakeContainer:(id==='battle-scene'?fakeScene:null);
  Battle.resolveMonsterImage=()=>({src:'monster_302080.png',fallback:'fallback.png'});
  Battle.renderEnemies=renderEnemiesImpl;
  App.data.battle={active:true,isBossBattle:true,vegnasisFallCount:0};
  Battle.enemies=pillarBases.map(base=>makePillar(base));
  Battle.renderEnemies();
  assert(fakeContainer.children.filter(node=>String(node.className).includes('enemy-sprite')).length===5, '共有画像戦でも5柱それぞれのHP・選択ノードを描画する');
  assert(fakeContainer.children.filter(node=>String(node.className).includes('shared-enemy-visual')).length===1, 'ヴェグナシス本体画像は5柱で1枚だけ共有する');
  assert(fakeContainer.children.filter(node=>String(node.className).includes('enemy-sprite')).every(node=>node.innerHTML.includes('enemy-hp-bar')), '4・5体目を含む全柱に常時HPゲージを描画する');
  Battle.enemies.forEach(enemy=>{ enemy.hp=0; enemy.isDead=true; });
  Battle.renderEnemies();
  assert(fakeContainer.children.filter(node=>String(node.className).includes('shared-enemy-visual')).length===0, '最後の柱撃破後は共有本体画像を描画しない');

  const polishSource=fs.readFileSync(path.join(root,'polish.js'),'utf8');
  const cssSource=fs.readFileSync(path.join(root,'modern-polish.css'),'utf8');
  assert(polishSource.includes('sharedVisualNodeForUnit') && polishSource.includes('this.sharedVisualNodeForUnit(unit) ||'), 'どの柱の被ダメージ・行動エフェクトも共有本体画像へルーティングする');
  assert(cssSource.includes('.shared-visual-target') && cssSource.includes('.vegnasis-shared-visual') && cssSource.includes('.vegnasis-atmosphere'), '5柱UI・共有画像・段階暗転/亀裂の専用スタイルを定義する');

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
