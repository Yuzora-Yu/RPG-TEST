#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function dummyElement() {
  return {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    setAttribute() {}, getAttribute() { return null; }, getContext() { return {}; },
    getBoundingClientRect() { return { left:0, top:0, width:320, height:320 }; },
    children: [], innerHTML: '', textContent: '', disabled: false
  };
}

function createContext() {
  const document = {
    getElementById() { return dummyElement(); }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return dummyElement(); }, body: dummyElement(), documentElement: dummyElement(), addEventListener() {}
  };
  const window = {
    JOB_SKILLS: {}, CHARACTERS_DATA: [], ITEMS_DATA: [], addEventListener() {},
    requestAnimationFrame(callback) { return callback?.(); }, setTimeout, clearTimeout, document,
    innerWidth: 320, innerHeight: 640
  };
  const context = {
    window, document, console, setTimeout, clearTimeout, Math: Object.create(Math), Date, JSON, Number, String, Array, Object,
    Map, Set, WeakMap, WeakSet, Promise, Intl, structuredClone: global.structuredClone,
    DB: { CHARACTERS: [], SKILLS: [], ITEMS: [], EQUIPS: [], SYNERGIES: [], MONSTERS: [] },
    CONST: { SKILL_TREES: {}, EXP_BASE: 100, RARITY_EXP_MULT: {}, ELEMENTS:['火','水','風','雷','光','闇','混沌'] },
    navigator: {}, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    Image: function Image() { return dummyElement(); }, Audio: function Audio() { return dummyElement(); },
    Field: { currentMapData:null, getCurrentAreaKey(){ return 'WORLD'; }, getBattleBg(){ return 'battle_bg_field'; } },
    Dungeon: {}, PassiveSkill: { getSumValue(){ return 0; } }, globalThis: null
  };
  context.globalThis = context;
  Object.assign(window, context);
  vm.createContext(context);
  return context;
}

function load(context, file, expose = '') {
  vm.runInContext(`${read(file)}\n${expose}`, context, { filename:file });
}

const context = createContext();
load(context, 'abyss_content.js');
load(context, 'story.js');
load(context, 'main.js', 'globalThis.__APP=App; globalThis.Player=Player;');
context.App = context.__APP;
context.window.App = context.__APP;
load(context, 'battle.js', 'globalThis.__BATTLE=Battle; globalThis.Battle=Battle;');
load(context, 'item_runtime.js');

const App = context.__APP;
const Battle = context.__BATTLE;
const content = context.ABYSS_REGION_CONTENT;
const storyData = context.window.STORY_MANAGER_DATA;

assert.strictEqual(content.octaprismSupportMaster.triggerRate, 0.5, '精霊支援率が50%ではありません。');
assert.strictEqual(content.octaprismSupportMaster.heroChaosResistanceFloor, 90);
assert.deepStrictEqual(Array.from(content.spiritTrialElements), ['火','水','風','雷','光','闇']);
assert.strictEqual(Object.keys(storyData.abyssSpiritTrials).length, 6);
for (const [element, trial] of Object.entries(storyData.abyssSpiritTrials)) {
  assert(storyData.scripts[trial.introScriptId]?.length, `${element}の初回会話がありません。`);
  assert(storyData.scripts[trial.retryScriptId]?.length, `${element}の再戦会話がありません。`);
  assert(storyData.scripts[trial.victoryScriptId]?.length, `${element}の勝利会話がありません。`);
  assert(storyData.events[trial.introEventId], `${element}の初回イベントがありません。`);
  assert(storyData.events[trial.retryEventId], `${element}の再戦イベントがありません。`);
  assert(storyData.events[trial.victoryEventId], `${element}の勝利イベントがありません。`);
}
assert(storyData.events.abyss_spirit_trials_octaprism_grant, '六属性完了イベントがありません。');

App.data = {
  progress:{ flags:{}, abyssSpiritBlessings:{} }, items:{}, characters:[], party:[],
  battle:{active:false}, location:{area:'WORLD'}, dungeon:{}, system:{}, book:{killCounts:{}}, stats:{}
};
let progress = App.ensureAbyssSpiritTrialEvents();
assert.strictEqual(progress.abyssSpiritTrialEvents['火'].state, 'untouched');
assert.strictEqual(App.resolveAbyssSpiritTrialEventId('火'), 'abyss_spirit_trial_fire_intro');
progress.abyssSpiritTrialEvents['火'].state = 'lost';
progress.abyssSpiritTrialEvents['火'].lostOnce = true;
assert.strictEqual(App.resolveAbyssSpiritTrialEventId('火'), 'abyss_spirit_trial_fire_retry');
progress.abyssSpiritBlessings['火'] = true;
progress.abyssSpiritTrialEvents['火'].state = 'victory';
progress.abyssSpiritTrialEvents['火'].victoryBattleId = 'trial-win';
assert.strictEqual(App.resolveAbyssSpiritTrialEventId('火'), 'abyss_spirit_trial_fire_victory');
for (const element of content.spiritTrialElements) progress.abyssSpiritBlessings[element] = true;
App.data.items[701008] = 0;
progress.flags.abyssOctaprismGrantEventSeen = true;
progress.flags.abyssOctaprismGrantPending = false;
App.ensureAbyssSpiritTrialEvents();
assert.strictEqual(progress.flags.abyssOctaprismGrantPending, true, '演出済みフラグだけ残った欠損セーブを救済できません。');
assert.strictEqual(App.resolveAbyssSpiritTrialEventId('水'), 'abyss_spirit_trials_octaprism_grant', '旧セーブの六加護補填イベントへ分岐しません。');

const itemDef = { id:701008, battleUsable:false };
assert.strictEqual(context.window.ItemRuntime.isBattleUsable(itemDef), false, 'オクタプリズマが手動使用可能です。');

const effectCalls = [];
context.window.PolishBattleFX = { screenEffect(kind, options) { effectCalls.push({kind, options}); } };
const logs = [];
Battle.log = message => logs.push(String(message));
Battle.renderEnemies = () => {};
Battle.renderPartyStatus = () => {};
Battle.isStoryBossTrainingBattle = () => false;

const hero = {
  uid:'hero', name:'アルス', originData:{charId:301}, hp:500, baseMaxHp:1000, mp:20, baseMaxMp:100,
  elmRes:{混沌:89}, battleStatus:{buffs:{},debuffs:{},ailments:{}}, isDead:false, isFled:false
};
const ally = {
  uid:'ally', name:'仲間', originData:{charId:101}, hp:400, baseMaxHp:1000, mp:10, baseMaxMp:100,
  elmRes:{}, battleStatus:{buffs:{},debuffs:{},ailments:{}}, isDead:false, isFled:false
};
const boss = {
  baseId:302100, id:302100, name:'深淵王アゼルガラグ', hp:62000, baseMaxHp:62000,
  battleStatus:{buffs:{},debuffs:{},ailments:{}}, isDead:false, isFled:false
};
Battle.party = [hero, ally];
Battle.enemies = [boss];

// 戦闘開始時の未所持判定は、途中で所持数が変わっても同じ戦闘内では固定する。
App.data.items = {};
App.data.battle = {active:true, fixedBossId:302100, battleId:'octa-no-item'};
let state = Battle.initializeOctaprismBattleState();
assert.strictEqual(state.active, false, '未所持で支援が有効になりました。');
App.data.items[701008] = 1;
assert.strictEqual(Battle.initializeOctaprismBattleState().active, false, '戦闘途中の所持数変更で支援が有効化されました。');

// 対象外ボスと訓練所では所持していても発動しない。
App.data.battle = {active:true, fixedBossId:302099, battleId:'octa-other-boss'};
Battle.enemies = [{...boss, baseId:302099, id:302099}];
assert.strictEqual(Battle.initializeOctaprismBattleState().active, false, '対象外ボスで支援が有効になりました。');
App.data.battle = {active:true, fixedBossId:302100, battleId:'octa-training'};
Battle.enemies = [boss];
Battle.isStoryBossTrainingBattle = () => true;
assert.strictEqual(Battle.initializeOctaprismBattleState().active, false, '訓練所で支援が有効になりました。');
Battle.isStoryBossTrainingBattle = () => false;

App.data.items = {701008:1};
App.data.battle = {active:true, fixedBossId:302100, battleId:'octa-test'};
Battle.enemies = [boss];
state = Battle.initializeOctaprismBattleState();
assert.strictEqual(state.active, true);
assert.strictEqual(hero.elmRes['混沌'], 90, '主人公の混沌耐性89が90へ補正されません。');
hero.elmRes['混沌'] = 120;
Battle.applyOctaprismHeroChaosResistance(state);
assert.strictEqual(hero.elmRes['混沌'], 120, '既存90%以上の混沌耐性を低下させています。');

let outcome = Battle.processOctaprismTurnStart({turnNumber:1, rng:() => 0.75});
assert.strictEqual(outcome.triggered, false, '50%失敗ロールで支援が発動しました。');
outcome = Battle.processOctaprismTurnStart({turnNumber:2, rng:() => 0.5});
assert.strictEqual(outcome.triggered, false, '境界値50%で支援が発動しました。');
const rolls = [0.499999, 0.0];
outcome = Battle.processOctaprismTurnStart({turnNumber:3, rng:() => rolls.shift()});
assert.strictEqual(outcome.element, '火');
assert.strictEqual(boss.hp, 62000 - Math.floor(62000 * 0.04), '火支援の正式割合ダメージが不正です。');
assert(effectCalls.some(call => call.kind === 'fire'), '火属性の画面エフェクトが呼ばれていません。');
const hpAfterFire = boss.hp;
const sameTurnOutcome = Battle.processOctaprismTurnStart({turnNumber:3, rng:() => 0.0});
assert.strictEqual(sameTurnOutcome, outcome, '同一ターンの支援結果を再利用していません。');
assert.strictEqual(boss.hp, hpAfterFire, '同一ターンで支援ダメージが二重適用されました。');
const previousElement = state.lastSpirit;
const repeatRolls = [0.1, 0.0];
outcome = Battle.processOctaprismTurnStart({turnNumber:4, rng:() => repeatRolls.shift()});
assert.notStrictEqual(outcome.element, previousElement, '同じ精霊が連続発動しました。');

hero.hp = 500; ally.hp = 400;
Battle.applyOctaprismSpiritSupport('風', 5);
assert.strictEqual(hero.hp, 680);
assert.strictEqual(ally.hp, 580);
hero.mp = 20; ally.mp = 10;
Battle.applyOctaprismSpiritSupport('水', 6);
assert.strictEqual(hero.mp, 35);
assert.strictEqual(ally.mp, 25);
Battle.applyOctaprismSpiritSupport('光', 7);
assert.strictEqual(hero.battleStatus.buffs.elmResUp.val, 50);
assert.strictEqual(hero.battleStatus.buffs.elmResUp.turns, 1);
Battle.applyOctaprismSpiritSupport('闇', 8);
for (const key of ['atk','def','spd','mag','mdef']) assert.strictEqual(boss.battleStatus.debuffs[key].val, 0.9);
assert(effectCalls.some(call => call.kind === 'wind') && effectCalls.some(call => call.kind === 'ice') && effectCalls.some(call => call.kind === 'light') && effectCalls.some(call => call.kind === 'dark'));

// 雷支援は第一形態の上限と1ターン防御低下を使う。
boss.hp = boss.baseMaxHp = 200000;
Battle.applyOctaprismSpiritSupport('雷', 9);
assert.strictEqual(boss.hp, 200000 - 3200, '雷支援の第一形態上限が不正です。');
assert.strictEqual(boss.battleStatus.debuffs.octaprismDef.val, 0.85);
assert.strictEqual(boss.battleStatus.debuffs.octaprismDef.turns, 1);
assert.strictEqual(Battle.getBattleStat({...boss, def:1000}, 'def'), 765, '闇と雷の守備低下が別枠で反映されません。');
assert(effectCalls.some(call => call.kind === 'thunder'), '雷属性の画面エフェクトが呼ばれていません。');

// 第一形態から第二形態へ移っても、戦闘開始時所持スナップショットと直前精霊を維持する。
const stateBeforePhase = state;
const lastSpiritBeforePhase = state.lastSpirit;
App.data.battle.fixedBossId = 302101;
App.data.battle.currentPhaseMonsterId = 302101;
boss.baseId = boss.id = 302101;
Battle.enemies = [boss];
hero.elmRes['混沌'] = 70;
state = Battle.initializeOctaprismBattleState();
assert.strictEqual(state, stateBeforePhase, '第二形態でオクタプリズマ状態を作り直しています。');
assert.strictEqual(state.active, true);
assert.strictEqual(state.lastSpirit, lastSpiritBeforePhase);
assert.strictEqual(hero.elmRes['混沌'], 90, '第二形態で主人公の混沌耐性下限が再適用されません。');

// 編成オーラ再計算で通常耐性へ戻されても、戦闘中の90%下限を直後に復元する。
const originalGetChar = App.getChar;
const originalCalcStats = App.calcStats;
App.getChar = uid => ({uid, currentHp:0, currentMp:0});
App.calcStats = () => ({atk:1,def:1,mdef:1,spd:1,mag:1,elmAtk:{},elmRes:{混沌:25},resists:{}});
hero.elmRes['混沌'] = 90;
Battle.refreshPartyFormationAuras();
assert.strictEqual(hero.elmRes['混沌'], 90, '編成オーラ再計算後に混沌耐性下限が失われました。');
App.getChar = originalGetChar;
App.calcStats = originalCalcStats;

// 試練勝利は加護と結晶片だけを結果トランザクションへ含め、六個目のオクタプリズマは会話イベントへ留保する。
App.data.progress = {flags:{},abyssSpiritBlessings:{},abyssSpiritTrialEvents:{}};
App.data.items = {};
App.data.battle = {
  active:false, battleId:'spirit-win-1',
  elementalSpiritTrial:{element:'火',rewardItemId:701001,completionItemId:701008,requiredElements:['火','水','風','雷','光','闇']}
};
context.DB.ITEMS = [{id:701001,name:'火の結晶片'},{id:701008,name:'オクタプリズマ'}];
let drops = [];
let messages = Battle.completeAbyssElementalTrial(drops);
assert.strictEqual(App.data.progress.abyssSpiritBlessings['火'], true);
assert.strictEqual(App.data.progress.abyssSpiritTrialEvents['火'].state, 'victory');
assert.strictEqual(App.data.items[701001], 1);
assert.strictEqual(App.data.items[701008] || 0, 0, '勝利結果がオクタプリズマを先行付与しました。');
assert(messages.some(message => message.includes('火の精霊')));
const duplicateDrops = [];
messages = Battle.completeAbyssElementalTrial(duplicateDrops);
assert.strictEqual(App.data.items[701001], 1, '同じ試練結果で結晶片が二重付与されました。');
assert.strictEqual(duplicateDrops.length, 0);
assert.strictEqual(App.data.battle.elementalSpiritTrialOutcome.blessingGranted, false, '再処理結果を新規加護として記録しています。');

App.data.progress.abyssSpiritTrialEvents['水'] = {state:'challenged',attempts:1};
App.data.battle = {active:false,battleId:'spirit-loss-1',elementalSpiritTrial:{element:'水',rewardItemId:701002}};
const loss = Battle.recordAbyssElementalTrialLoss();
assert.strictEqual(loss.lost, true);
assert.strictEqual(App.data.progress.abyssSpiritTrialEvents['水'].lostOnce, true);
assert.strictEqual(App.data.progress.abyssSpiritTrialEvents['水'].state, 'lost');

const battleSource = read('battle.js');
assert(battleSource.includes('Battle.processOctaprismTurnStart({ turnNumber:App.data.battle.turnNumber })'), 'ターン開始支援が実行経路へ接続されていません。');
assert(battleSource.includes('elementalSpiritTrialOutcome:'), '試練結果が結果ジャーナルへ保存されません。');
const itemSource = read('items.js');
assert(itemSource.includes('"name": "オクタプリズマ"'), '既存名称オクタプリズマが変更されています。');
assert(!itemSource.includes('"specialBattleItem": "octaprism"'), '旧手動使用マーカーが残っています。');
const storyLogicSource = read('story_logic.js');
assert(storyLogicSource.includes("action.type === 'ABYSS_SPIRIT_TRIAL_BATTLE'"), '大精霊戦開始アクションがありません。');
assert(storyLogicSource.includes('elementalSpiritTrial,'), '大精霊戦メタデータがBOSS開始処理へ保存されません。');
assert(storyLogicSource.includes("action.type === 'ABYSS_SPIRIT_TRIAL_COMPLETE'"), '勝利後完了アクションがありません。');
assert(storyLogicSource.includes("action.type === 'ABYSS_SPIRIT_TRIAL_GRANT_OCTAPRISM'"), 'オクタプリズマ授与確定アクションがありません。');
const storySource = read('story.js');
assert(storySource.includes('globalThis.ABYSS_REGION_CONTENT?.spiritTrials'), 'story.jsが六属性正式マスターを参照していません。');

console.log('Phase2H 六属性プリズム・オクタプリズマ回帰テスト: OK');
