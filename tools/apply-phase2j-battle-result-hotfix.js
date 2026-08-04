#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(process.argv[2] || process.cwd());
const dryRun = process.argv.includes('--check');
const changed = [];

function read(rel) {
  const file = path.join(projectRoot, rel);
  if (!fs.existsSync(file)) throw new Error(`対象ファイルがありません: ${rel}`);
  return { file, text: fs.readFileSync(file, 'utf8') };
}

function write(rel, before, after) {
  if (before === after) return;
  changed.push(rel);
  if (!dryRun) fs.writeFileSync(path.join(projectRoot, rel), after, 'utf8');
}

function replaceExactlyOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`${label} の挿入位置を確認できません。現在のGit差分を点検してください。`);
  if (text.indexOf(search, first + search.length) >= 0) {
    throw new Error(`${label} の挿入位置が複数あります。自動適用を中止しました。`);
  }
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

function patchBattle() {
  const rel = 'battle.js';
  const { text: original } = read(rel);
  let text = original;

  if (!text.includes('getBattleRewardRateModifiers:')) {
    const anchor = [
      '    rollConfiguredDrop: (drop, bonus = 0, rateMultiplier = 1) => {',
      '        const rate = Math.max(0, Math.min(100, Battle.getConfiguredDropRate(drop, bonus) * Math.max(0, Number(rateMultiplier || 1))));',
      '        return Math.random() * 100 < rate;',
      '    },'
    ].join('\n');
    const replacement = anchor + '\n' + [
      '    // ランダム迷宮の報酬倍率は戦闘データを正本として勝利処理へ引き渡す。',
      '    // 未設定・旧セーブでは従来値へ安全にフォールバックする。',
      '    getBattleRewardRateModifiers: (battleData = App.data?.battle) => {',
      '        const rareDropMultiplier = Number(battleData?.rareDropMultiplier);',
      '        const equipPlus3BonusPct = Number(battleData?.equipPlus3BonusPct);',
      '        return {',
      '            rareDropMultiplier: Number.isFinite(rareDropMultiplier)',
      '                ? Math.max(0, rareDropMultiplier)',
      '                : 1,',
      '            equipPlus3BonusPct: Number.isFinite(equipPlus3BonusPct)',
      '                ? Math.max(0, equipPlus3BonusPct)',
      '                : 0',
      '        };',
      '    },',
      ''
    ].join('\n');
    text = replaceExactlyOnce(text, anchor, replacement, '戦闘報酬倍率ヘルパー');
  }

  if (!text.includes('const battleRewardRateModifiers = Battle.getBattleRewardRateModifiers(App.data?.battle);')) {
    const marker = /([ \t]*const randomHunterOutcome = randomHunterContext \? \{[\s\S]*?^[ \t]*\} : null;\r?\n)(\r?\n[ \t]*\/\/ 特性「56:解体」のパーティ合計値算出)/m;
    const match = text.match(marker);
    if (!match) throw new Error('勝利報酬倍率のローカル変数挿入位置を確認できません。');
    const indentMatch = match[1].match(/\n([ \t]*)const randomHunterOutcome/);
    const indent = indentMatch ? indentMatch[1] : '        ';
    const insertion = `${match[1]}${indent}const battleRewardRateModifiers = Battle.getBattleRewardRateModifiers(App.data?.battle);\n${indent}const rareDropMultiplier = battleRewardRateModifiers.rareDropMultiplier;\n`;
    text = text.replace(marker, insertion + match[2]);
  }

  if (!text.includes('bonusPlus3 += battleRewardRateModifiers.equipPlus3BonusPct;')) {
    const marker = /([ \t]*surviveMembers\.forEach\(p => \{[\s\S]*?^[ \t]*\}\);\r?\n)([ \t]*\/\/ オプション再抽選サブ関数)/m;
    const match = text.match(marker);
    if (!match) throw new Error('+3装備補正の挿入位置を確認できません。');
    const indentMatch = match[1].match(/\n([ \t]*)surviveMembers\.forEach/);
    const indent = indentMatch ? indentMatch[1] : '\t\t';
    text = text.replace(marker, `${match[1]}${indent}bonusPlus3 += battleRewardRateModifiers.equipPlus3BonusPct;\n${match[2]}`);
  }

  write(rel, original, text);
}

function patchNews() {
  const rel = 'news.js';
  const { text: original } = read(rel);
  if (original.includes('戦闘勝利時に敵が復活する不具合を修正しました')) return;
  const lines = original.split(/(?<=\n)/);
  const index = lines.findIndex(line => line.includes('date: "2026/08/04"'));
  if (index < 0) throw new Error('news.js の2026/08/04レコードが見つかりません。');
  const line = lines[index];
  const pos = line.lastIndexOf('" },');
  if (pos < 0) throw new Error('news.js の2026/08/04レコード形式を確認できません。');
  lines[index] = line.slice(0, pos) + '\\n・戦闘勝利時に敵が復活する不具合を修正しました' + line.slice(pos);
  write(rel, original, lines.join(''));
}

function patchCaches() {
  const mainRel = 'main.js';
  const main = read(mainRel);
  let mainText = main.text.replaceAll('prisma-abyss-v39.20260804-runtime', 'prisma-abyss-v40.20260804-runtime');
  write(mainRel, main.text, mainText);

  const swRel = 'sw.js';
  const sw = read(swRel);
  let swText = sw.text
    .replaceAll('prisma-abyss-v39.20260804-runtime', 'prisma-abyss-v40.20260804-runtime')
    .replaceAll('prisma-abyss-v39.20260804', 'prisma-abyss-v40.20260804');
  write(swRel, sw.text, swText);
}

try {
  patchBattle();
  patchNews();
  patchCaches();
  if (changed.length === 0) {
    console.log('[Phase2J] 既に適用済みです。変更はありません。');
  } else if (dryRun) {
    console.log(`[Phase2J] 適用可能です: ${changed.join(', ')}`);
  } else {
    console.log(`[Phase2J] 修正しました: ${changed.join(', ')}`);
  }
} catch (error) {
  console.error(`[Phase2J] 適用失敗: ${error.message}`);
  process.exitCode = 1;
}
