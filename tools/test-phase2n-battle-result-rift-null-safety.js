#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(process.argv[2] || process.env.PRISMA_ROOT || path.join(__dirname, '..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const source = read('battle.js');

assert(source.includes('captureAbyssRiftResultContext:'), '亀裂戦の勝利前コンテキスト退避がありません。');
assert(source.includes('buildAbyssRiftResultOutcome:'), '亀裂報酬結果の安全な構築処理がありません。');
assert(!source.includes('App.data.dungeon.pendingRiftReward.itemName'), '勝利処理にpendingRiftRewardの危険な直接参照が残っています。');

const winStart = source.indexOf('win: async (options = {}) =>');
const winEnd = source.indexOf('\n    recoverCommittedBattleResult:', winStart);
assert(winStart >= 0 && winEnd > winStart, 'Battle.winを抽出できません。');
const winSource = source.slice(winStart, winEnd);
const captureIndex = winSource.indexOf('const abyssRiftResultContext = Battle.captureAbyssRiftResultContext');
const worldApplyIndex = winSource.indexOf('Dungeon.onBossDefeated()');
const buildIndex = winSource.indexOf('const abyssRiftOutcome = Battle.buildAbyssRiftResultOutcome');
const journalIndex = winSource.indexOf('abyssRiftOutcome,');
assert(captureIndex >= 0 && captureIndex < worldApplyIndex, '亀裂報酬IDを戦闘データ初期化前に退避していません。');
assert(buildIndex > worldApplyIndex, '亀裂報酬結果を世界状態確定後に構築していません。');
assert(journalIndex > buildIndex, '安全に構築した亀裂報酬結果が結果ジャーナルへ接続されていません。');

function createRuntime({ boss = false, rift = false, stalePending = false } = {}) {
  const math = Object.create(Math);
  math.random = () => 0.999999;
  const character = { uid:'hero', name:'主人公', level:1, currentHp:100, currentMp:20, exp:0 };
  const rewardId = rift ? 'rift-regression-001' : null;
  const battleData = {
    active:true,
    battleId:rift ? 'battle-rift' : 'battle-normal',
    isBossBattle:boss || rift,
    isRiftBattle:rift,
    isSpecialBoss:false,
    isEstark:false,
    eventId:rift ? '__RIFT_BATTLE__' : null,
    riftRewardId:rewardId
  };
  const app = {
    data:{
      battle:battleData,
      progress:{ floor:1, storyStep:1, flags:{} },
      location:{ area:rift ? 'ABYSS' : 'FIELD' },
      dungeon:{
        abyssRift:rift ? { rewardId } : null,
        pendingRiftReward:stalePending
          ? { active:true, rewardId:'old-rift', itemName:'古い報酬' }
          : null
      },
      book:{ killCounts:{}, monsters:[] },
      gold:0,
      items:{},
      inventory:[],
      characters:[character],
      party:['hero'],
      gems:0
    },
    serializeSaveData:data => JSON.stringify(data),
    save(){ return true; },
    beginSaveTransaction(){},
    commitSaveTransaction(){ return true; },
    cancelSaveTransaction(){},
    getChar(uid){ return uid === 'hero' ? character : null; },
    noteQuestKills(){},
    noteBattleVictory(){ return []; },
    gainExp(){ return []; },
    calcStats(){ return { maxHp:100, maxMp:20 }; },
    tryRecruitMonsterAfterBattle(){ return null; },
    extractMonsterSkillIds(){ return []; },
    getSkillBookItemId(){ return null; },
    totalGoldGem(){},
    createEquipByFloor(){ return { name:'通常装備+3', plus:3, data:{}, opts:[], traits:[] }; }
  };
  const dungeon = {
    riftBattleEventId:'__RIFT_BATTLE__',
    completeAngelTrialIfNeeded(){ return []; },
    onBossDefeated(){
      if (!rift) return;
      app.data.dungeon.pendingRiftReward = {
        active:true,
        rewardId,
        itemName:'亀裂の剣+3'
      };
      app.data.dungeon.abyssRift = null;
      app.data.battle.isBossBattle = false;
      app.data.battle.isRiftBattle = false;
      app.data.battle.eventId = null;
      app.data.battle.riftRewardId = null;
    }
  };
  const context = {
    console,
    Math:math,
    Date,
    JSON,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Intl,
    setTimeout,
    clearTimeout,
    document:{ getElementById(){ return null; } },
    window:null,
    globalThis:null,
    App:app,
    DB:{ ITEMS:[], MONSTERS:[], SKILLS:[], OPT_RULES:[] },
    CONST:{ ELEMENTS:[] },
    PassiveSkill:{ getSumValue(){ return 0; }, checkTraitGrowth(){ return null; } },
    Field:{ currentMapData:{ id:'WORLD' }, render(){} },
    Dungeon:dungeon
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.Battle=Battle;`, context, { filename:'battle.js' });
  const Battle = context.Battle;
  Object.assign(Battle, {
    finishState:'idle',
    finishToken:null,
    party:[{ uid:'hero', hp:100, mp:20, baseMaxHp:100, baseMaxMp:20, isDead:false }],
    enemies:[{ id:1, baseId:1, name:'リトルメイジ', isDead:true, isFled:false, hp:0, exp:0, gold:0 }],
    collectDefeatedEnemiesForResult(){ return this.enemies; },
    getMonsterBaseById(){ return { id:1, name:boss || rift ? '門番' : 'リトルメイジ', exp:0, gold:0, drops:null, isBoss:boss || rift }; },
    getEnemyRewardValue(){ return 0; },
    getQuestProgressContext(){ return {}; },
    isStoryBossTrainingBattle(){ return false; },
    getStoryBossTrainingJournalContext(){ return null; },
    isBattleAlive(member){ return !member.isDead && member.hp > 0; },
    applyEndlessBossWedgeDrop(){ return { eligible:false, granted:false }; },
    tryCreateSkillBookDrop(){ return false; },
    completeAbyssElementalTrial(){ return []; },
    prepareMonsterSkillEvolutionAfterBattle(){ return null; },
    playResultSeAndWait:async () => {},
    log(){},
    setResultLevelSkipActive(){},
    tryMonsterSkillEvolutionAfterBattle:async () => null,
    resultWait:async () => {},
    updateResultLevelSkipButton(){},
    escapeHtml:value => String(value)
  });
  return { Battle, app };
}

(async () => {
  // ヘルパー単体: 未設定値同士が一致しても通常戦を亀裂報酬扱いしない。
  {
    const { Battle } = createRuntime();
    assert(Battle.captureAbyssRiftResultContext(
      { isRiftBattle:false, eventId:null, riftRewardId:null },
      { pendingRiftReward:null }
    ) === null, '通常戦の未設定値を亀裂戦として扱っています。');
    assert(Battle.buildAbyssRiftResultOutcome(null, { pendingRiftReward:null }) === null,
      '空の亀裂報酬コンテキストから結果が生成されています。');
    assert(Battle.buildAbyssRiftResultOutcome(
      { rewardId:'rift-a' },
      { pendingRiftReward:{ active:true, rewardId:'rift-b', itemName:'別報酬' } }
    ) === null, '異なる亀裂報酬IDを誤接続しています。');
    const fallback = Battle.buildAbyssRiftResultOutcome(
      { rewardId:'rift-a' },
      { pendingRiftReward:{ active:true, rewardId:'rift-a', itemName:null } }
    );
    assert(fallback?.itemName === '輝く装備+3', '亀裂報酬名欠落時の安全な代替名がありません。');
  }

  // 実際のBattle.win: 通常雑魚戦で結果ジャーナルをcommitし、ロールバックしない。
  {
    const { Battle, app } = createRuntime();
    await Battle.win({ finishToken:'normal-regression' });
    assert(Battle.finishState === 'committed', '通常戦勝利がcommitされませんでした。');
    assert(app.data.battle.resultJournal?.status === 'committed', '通常戦の結果ジャーナルが確定していません。');
    assert(app.data.battle.resultJournal?.abyssRiftOutcome === null, '通常戦に亀裂報酬結果が混入しました。');
    assert(!app.data.battle.lastResultError, '通常戦勝利で結果エラーが記録されました。');
  }

  // 古い受取待ち報酬が残っていても、現在の通常戦へ誤接続しない。
  {
    const { Battle, app } = createRuntime({ stalePending:true });
    await Battle.win({ finishToken:'stale-pending-regression' });
    assert(Battle.finishState === 'committed', '古い受取待ち報酬がある通常戦をcommitできませんでした。');
    assert(app.data.battle.resultJournal?.abyssRiftOutcome === null, '古い亀裂報酬が現在の通常戦へ混入しました。');
  }

  // 通常ボス戦も未設定ID同士を亀裂報酬扱いせず、結果をcommitする。
  {
    const { Battle, app } = createRuntime({ boss:true });
    await Battle.win({ finishToken:'normal-boss-regression' });
    assert(Battle.finishState === 'committed', '通常ボス戦勝利がcommitされませんでした。');
    assert(app.data.battle.resultJournal?.abyssRiftOutcome === null, '通常ボス戦に亀裂報酬結果が混入しました。');
    assert(!app.data.battle.lastResultError, '通常ボス戦勝利で結果エラーが記録されました。');
  }

  // 亀裂戦: onBossDefeatedが戦闘側IDを消した後でも、退避IDで正しい報酬を記録する。
  {
    const { Battle, app } = createRuntime({ rift:true });
    await Battle.win({ finishToken:'rift-regression' });
    assert(Battle.finishState === 'committed', '亀裂戦勝利がcommitされませんでした。');
    assert(app.data.battle.riftRewardId === null, '亀裂戦後の戦闘ID初期化が再現されていません。');
    const outcome = app.data.battle.resultJournal?.abyssRiftOutcome;
    assert(outcome?.rewardId === 'rift-regression-001', '退避した亀裂報酬IDが結果へ残っていません。');
    assert(outcome?.itemName === '亀裂の剣+3', '亀裂報酬名が結果へ残っていません。');
    assert(!app.data.battle.lastResultError, '亀裂戦勝利で結果エラーが記録されました。');
  }

  console.log('[Phase2N] battle result rift null-safety regression test: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
