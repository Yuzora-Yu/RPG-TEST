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

const battle = read('battle.js');
const news = read('news.js');
const main = read('main.js');
const sw = read('sw.js');

assert(battle.includes('getBattleRewardRateModifiers:'), '戦闘報酬倍率ヘルパーがありません。');
assert(battle.includes('const battleRewardRateModifiers = Battle.getBattleRewardRateModifiers(App.data?.battle);'), '勝利処理が戦闘報酬倍率を取得していません。');
assert(battle.includes('const rareDropMultiplier = battleRewardRateModifiers.rareDropMultiplier;'), 'rareDropMultiplier のローカル定義がありません。');
assert(battle.includes('bonusPlus3 += battleRewardRateModifiers.equipPlus3BonusPct;'), '特殊階層の+3装備補正が勝利処理へ接続されていません。');

const helperMatch = battle.match(/getBattleRewardRateModifiers: \(battleData = App\.data\?\.battle\) => \{([\s\S]*?)\n    \},/);
assert(helperMatch, '戦闘報酬倍率ヘルパーの構文を抽出できません。');
const helper = vm.runInNewContext(`(battleData = null) => {${helperMatch[1]}\n}`);
let result = helper({ rareDropMultiplier: 2, equipPlus3BonusPct: 20 });
assert(result.rareDropMultiplier === 2 && result.equipPlus3BonusPct === 20, '設定済み倍率を保持できません。');
result = helper({ rareDropMultiplier: 'invalid', equipPlus3BonusPct: null });
assert(result.rareDropMultiplier === 1 && result.equipPlus3BonusPct === 0, '旧セーブ向け既定値が不正です。');
result = helper({ rareDropMultiplier: -3, equipPlus3BonusPct: -5 });
assert(result.rareDropMultiplier === 0 && result.equipPlus3BonusPct === 0, '負の倍率を0へ制限できません。');

const winStart = battle.indexOf('win: async (options = {}) =>');
const winEnd = battle.indexOf('\n    recoverCommittedBattleResult:', winStart);
assert(winStart >= 0 && winEnd > winStart, '勝利処理を抽出できません。');
const win = battle.slice(winStart, winEnd);
const localIndex = win.indexOf('const rareDropMultiplier = battleRewardRateModifiers.rareDropMultiplier;');
const firstDropUse = win.indexOf('Battle.rollConfiguredDrop(monsterDrops.rare, bonusRare, rareDropMultiplier)');
const skillBookUse = win.indexOf('Battle.tryCreateSkillBookDrop(enemy, drops, rareDropMultiplier)');
assert(localIndex >= 0, '勝利処理内に倍率定義がありません。');
assert(firstDropUse > localIndex, 'レアドロップ倍率が定義前に参照されています。');
assert(skillBookUse > localIndex, 'スキル書倍率が定義前に参照されています。');

assert(battle.includes('Battle.init({ forceManual: true });'), '戦闘結果失敗時の安全復旧処理が意図せず削除されています。');
assert(news.includes('戦闘勝利時に敵が復活する不具合を修正しました'), 'news.js に修正履歴がありません。');

const mainRuntime = main.match(/fullDataCacheName:\s*['"]([^'"]+-runtime)['"]/i)?.[1];
const swRuntime = sw.match(/const RUNTIME_CACHE_NAME\s*=\s*['"]([^'"]+)['"]/i)?.[1];
assert(mainRuntime && swRuntime, 'キャッシュ名を取得できません。');
assert(mainRuntime === swRuntime, `main.jsとsw.jsのランタイムキャッシュが不一致です: ${mainRuntime} / ${swRuntime}`);

console.log('[Phase2J] battle result hotfix test: PASS');
