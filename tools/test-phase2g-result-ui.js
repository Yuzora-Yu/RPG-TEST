#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const battle = read('battle.js');
const index = read('index.html');
const css = read('modern-polish.css');
const main = read('main.js');
const dungeon = read('dungeon.js');
const menus = read('menus.js');
const inventory = read('menus_inventory.js');
const allies = read('menus_allies.js');
const party = read('menus_party.js');
const blacksmith = read('blacksmith.js');
const facilities = read('facilities.js');
const achievements = read('achievements.js');
const guild = read('guild.js');

assert(index.includes('id="btn-result-level-skip"'), 'Result level skip button is missing.');
assert(index.includes('onclick="Battle.requestResultLevelSkip()"'), 'Skip button does not call the dedicated request method.');
assert(css.includes('#btn-result-level-skip') && css.includes('left: 10px'), 'Skip button is not positioned at the upper left.');
assert(battle.includes('setResultLevelSkipActive(resultLevelEvents.length > 0'), 'Level-up skip window is not opened around level logs.');
assert(battle.includes("playResultSeAndWait('battle_level_up', { levelSkippable:true })"), 'Level-up SE wait is not skippable.');
assert(battle.includes('Battle.setResultLevelSkipActive(false);'), 'Level-up skip window is not closed.');
const skipStart = battle.indexOf('setResultLevelSkipActive(resultLevelEvents.length > 0');
const skillEvolution = battle.indexOf('tryMonsterSkillEvolutionAfterBattle', skipStart);
const skipClose = battle.indexOf('setResultLevelSkipActive(false)', skipStart);
assert(skipStart >= 0 && skipClose > skipStart && skillEvolution > skipClose, 'Skip scope leaks into skill evolution or later rewards.');
const tapBlock = battle.slice(battle.indexOf('handleResultTap:'), battle.indexOf('resultWait:', battle.indexOf('handleResultTap:')));
assert(!tapBlock.includes('requestResultLevelSkip'), 'Ordinary result-screen taps incorrectly trigger full level-log skip.');
assert(battle.includes('(Battle.resultLevelSkipActive && Battle.resultSkipRequested)'), 'Result waits are not scoped to level-up skip state.');
const committedReset = battle.slice(battle.indexOf("committedJournal?.status === 'committed'"), battle.indexOf("if (Battle.phase === 'result'", battle.indexOf("committedJournal?.status === 'committed'")));
assert(committedReset.includes('Battle.resultLevelSkipActive = false;') && committedReset.includes('Battle.updateResultLevelSkipButton?.();'), 'Committed result finalization does not clear the level-skip UI state.');

assert(main.includes('prepareHealSpringActionAt(x, y'), 'Exact-tile healing spring action routing is missing.');
assert(dungeon.includes('prepareHealSpringActionAt: (x, y, options = {}) =>'), 'Exact-tile healing spring action helper is missing.');
assert(dungeon.includes("App.setAction('泉で回復', () => Dungeon.useHealSpring(x, y))"), 'Healing spring action does not preserve the exact target tile.');
assert(!main.includes('prepareAdjacentHealSpringAction'), 'Adjacent healing spring action still exists in field action routing.');
assert(!dungeon.includes('getAdjacentHealSpring'), 'Adjacent healing spring search helper still exists.');
assert(!dungeon.includes('prepareAdjacentHealSpringAction'), 'Adjacent healing spring action helper still exists.');

assert(menus.includes('getEquipmentNameLineHTML') && menus.includes('compareEquipmentByRank'), 'Common equipment Rank renderer/sorter is missing.');
for (const [name, source] of [['inventory', inventory], ['allies', allies], ['party', party], ['blacksmith', blacksmith]]) {
  assert(source.includes('getEquipmentNameLineHTML'), `${name} equipment list does not use the common Rank renderer.`);
}
assert(inventory.includes('compareEquipmentByRank'), 'Inventory Rank sort is not commonized.');
assert(allies.includes('compareEquipmentByRank'), 'Ally equipment Rank sort is not commonized.');
assert(allies.includes("Menu.getEquipmentNameLineHTML(newItem)"), 'Ally equipment confirmation does not show Rank on the equipment name row.');
assert(blacksmith.includes('compareEquipmentByRank'), 'Blacksmith Rank sort is not commonized.');
assert(blacksmith.includes("${Menu.getEquipmentNameLineHTML(target)}"), 'Blacksmith detail/confirmation header does not use the common Rank renderer.');
assert(facilities.includes('Rank ${Number(base.rank || 0)}'), 'Shop equipment list does not show Rank on the name row.');
assert(facilities.includes('selectShopSellEquip'), 'Equipment sell flow is not available.');
assert(facilities.includes('Menu.compareEquipmentByRank(a.equip, b.equip)'), 'Shop equipment sell list is not Rank-sorted with the common comparator.');
assert(facilities.includes("reward.kind === 'equip'") && facilities.includes('Rank ${Number(reward.rank || 0)}'), 'Casino equipment reward selection does not show Rank on the name row.');
assert(achievements.includes('（Rank ${Number(equip?.rank || 0)}）'), 'Achievement equipment rewards do not show Rank.');
assert(guild.includes('（Rank ${Number(equip.rank || 0)}）'), 'Guild equipment completion rewards do not show Rank.');

console.log('Phase2G result UI, Rank display, and healing spring regression tests passed.');
