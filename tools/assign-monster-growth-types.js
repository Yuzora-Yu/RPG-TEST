#!/usr/bin/env node
'use strict';

/**
 * Development-time monster ally growth assignment.
 *
 * The tool writes allyGrowthType directly into every monster master record.
 * Runtime code only reads the explicit master field and never infers or
 * overwrites master data.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const monsterPath = path.join(projectRoot, 'monsters.js');

delete require.cache[require.resolve(monsterPath)];
require(monsterPath);
const monsters = globalThis.MONSTERS_DATA;
if (!Array.isArray(monsters) || monsters.length === 0) throw new Error('MONSTERS_DATA could not be loaded.');

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function classifyMonsterGrowthType(monster) {
  const stats = {
    ATK: Math.max(0, Number(monster.atk) || 0),
    DEF: Math.max(0, Number(monster.def) || 0),
    MAG: Math.max(0, Number(monster.mag) || 0),
    MDEF: Math.max(0, Number(monster.mdef) || 0),
    SPD: Math.max(0, Number(monster.spd) || 0),
  };
  const ordered = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const maximum = ordered[0][1];
  const minimum = Math.max(1, ordered[ordered.length - 1][1]);
  const physical = mean([stats.ATK, stats.DEF, stats.SPD]);
  const magical = mean([stats.MAG, stats.MDEF]);

  if (maximum / minimum <= 1.35) {
    if (physical > magical * 1.15) return 'BALANCE_B';
    if (magical > physical * 1.15) return 'BALANCE_C';
    return 'BALANCE_A';
  }

  const topTwo = new Set(ordered.slice(0, 2).map(([key]) => key));
  let family;
  let specialized;
  let others;
  if (topTwo.has('ATK') && topTwo.has('MAG') && ordered[1][1] >= maximum * 0.72) {
    family = 'ATK_MAG';
    specialized = [stats.ATK, stats.MAG];
    others = [stats.DEF, stats.MDEF, stats.SPD];
  } else if (topTwo.has('DEF') && topTwo.has('MDEF') && ordered[1][1] >= maximum * 0.72) {
    family = 'DEF_MDEF';
    specialized = [stats.DEF, stats.MDEF];
    others = [stats.ATK, stats.MAG, stats.SPD];
  } else {
    family = ordered[0][0];
    specialized = [ordered[0][1]];
    others = ordered.slice(1).map(([, value]) => value);
  }

  const ratio = mean(specialized) / Math.max(1, mean(others));
  const tier = ratio < 1.75 ? 'A' : ratio < 3.2 ? 'B' : 'C';
  return `${family}_${tier}`;
}

function scanObjectRanges(source) {
  const stack = [];
  const ranges = [];
  let quote = null;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') stack.push(i);
    else if (ch === '}' && stack.length) {
      const start = stack.pop();
      ranges.push({ start, end: i + 1, length: i + 1 - start });
    }
  }
  return ranges;
}

function findTopLevelIdInsertion(source, range, id) {
  const text = source.slice(range.start, range.end);
  let braceDepth = 0;
  let bracketDepth = 0;
  let quote = null;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (braceDepth === 1 && bracketDepth === 0 && text.startsWith('"id"', i)) {
        const tail = text.slice(i).match(/^"id"\s*:\s*(\d+)\s*,/);
        if (tail && Number(tail[1]) === Number(id)) {
          return range.start + i + tail[0].length;
        }
      }
      quote = ch;
      continue;
    }
    if (ch === '{') braceDepth += 1;
    else if (ch === '}') braceDepth -= 1;
    else if (ch === '[') bracketDepth += 1;
    else if (ch === ']') bracketDepth -= 1;
  }
  return -1;
}

const assignments = new Map(monsters.map((monster) => [Number(monster.id), {
  id: Number(monster.id),
  name: String(monster.name || ''),
  type: classifyMonsterGrowthType(monster),
}]));

let source = fs.readFileSync(monsterPath, 'utf8');
const ranges = scanObjectRanges(source);
const edits = [];
for (const assignment of assignments.values()) {
  const idNeedle = `"id":${assignment.id}`;
  const nameNeedle = `"name":${JSON.stringify(assignment.name)}`;
  const candidates = ranges
    .filter((range) => {
      const text = source.slice(range.start, range.end);
      return text.includes(idNeedle) && text.includes(nameNeedle) && text.includes('"hp":') && text.includes('"atk":');
    })
    .sort((a, b) => a.length - b.length);

  const target = candidates.find((range) => findTopLevelIdInsertion(source, range, assignment.id) >= 0);
  if (!target) throw new Error(`Master record not found for ${assignment.id} ${assignment.name}`);
  const insertion = findTopLevelIdInsertion(source, target, assignment.id);
  const after = source.slice(insertion, insertion + 80);
  if (/^\s*"allyGrowthType"\s*:/.test(after)) continue;
  edits.push({ position: insertion, text: `"allyGrowthType":"${assignment.type}",` });
}

edits.sort((a, b) => b.position - a.position).forEach((edit) => {
  source = source.slice(0, edit.position) + edit.text + source.slice(edit.position);
});
fs.writeFileSync(monsterPath, source, 'utf8');

const counts = {};
for (const { type } of assignments.values()) counts[type] = (counts[type] || 0) + 1;
console.log(`Updated ${edits.length} monster master records.`);
console.log(JSON.stringify(counts, null, 2));
