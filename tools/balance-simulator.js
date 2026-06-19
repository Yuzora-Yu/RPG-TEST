const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAVE = 'C:/Users/ship2/Downloads/QoE_SaveData_1779146914656.json';

const TYPES = {
  normal: '\u901a\u5e38\u653b\u6483',
  physical: '\u7269\u7406',
  magic: '\u9b54\u6cd5',
  breath: '\u30d6\u30ec\u30b9',
};

const TARGETS = {
  single: '\u5358\u4f53',
  all: '\u5168\u4f53',
  random: '\u30e9\u30f3\u30c0\u30e0',
};

const SUPPORT_TYPES = new Set([
  '\u7279\u6b8a',
  '\u56de\u5fa9',
  '\u8607\u751f',
  '\u5f37\u5316',
  '\u5f31\u4f53',
  'MP\u56de\u5fa9',
]);

const RARITY_EXP_MULT = {
  N: 1.0,
  R: 1.0,
  SR: 1.4,
  SSR: 1.6,
  UR: 2.0,
  EX: 2.5,
};

function loadGameData() {
  const ctx = { window: {}, console, Math, JSON };
  vm.createContext(ctx);
  for (const file of ['skills.js', 'equips.js', 'monsters.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  }
  return {
    skills: ctx.window.SKILLS_DATA,
    equips: ctx.window.EQUIP_MASTER,
    monsters: ctx.window.MonsterData,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getNextExp(charData) {
  const baseExp = 100;
  const level = charData.level || 1;
  const reincCount = charData.reincarnationCount || 0;
  const eLevel = level + reincCount * 100;
  const rarityMult = RARITY_EXP_MULT[charData.rarity] || 1.0;
  const pEarly = 0.8;
  const target49 = 30000;
  const wall50 = 5;
  const wall100 = 5;
  const target99 = 150000;
  const pAfter50 = 1.3;
  const pReinc = 0.6;
  const reincStepRate = 0.05;

  const xp10 = baseExp * Math.pow(10, pEarly);
  const b = (target49 - xp10) / Math.pow(49 - 10, 2);
  const xp49 = xp10 + b * Math.pow(49 - 10, 2);
  const xp49Wall = xp49 * wall50;
  const base50 = xp49;
  const s = (target99 - base50) / Math.pow(99 - 50, pAfter50);
  const xp99 = base50 + s * Math.pow(99 - 50, pAfter50);
  const xp99Wall = xp99 * wall100;
  const base100 = xp99;

  let needExp;
  if (eLevel <= 10) {
    needExp = baseExp * Math.pow(eLevel, pEarly);
  } else if (eLevel <= 48) {
    needExp = xp10 + b * Math.pow(eLevel - 10, 2);
  } else if (eLevel === 49) {
    needExp = xp49Wall;
  } else if (eLevel <= 98) {
    needExp = base50 + s * Math.pow(eLevel - 50, pAfter50);
  } else if (eLevel === 99) {
    needExp = xp99Wall;
  } else {
    const step101 = base100 * reincStepRate;
    needExp = base100 + step101 * Math.pow(eLevel - 100, pReinc);
  }

  return Math.ceil(needExp * rarityMult);
}

function equipStatCharacter(char) {
  const out = {
    uid: char.uid,
    name: char.name,
    rarity: char.rarity,
    level: char.level || 1,
    exp: char.exp || 0,
    hp: char.currentHp || char.hp || 1,
    mp: char.currentMp || char.mp || 0,
    maxHp: char.currentHp || char.hp || 1,
    maxMp: char.currentMp || char.mp || 0,
    atk: char.atk || 0,
    def: char.def || 0,
    spd: char.spd || 0,
    mag: char.mag || 0,
    mdef: char.mdef || 0,
    skills: Array.isArray(char.skills) ? [...char.skills] : [],
  };

  for (const eq of Object.values(char.equips || {})) {
    if (!eq || !eq.data) continue;
    for (const key of ['atk', 'def', 'spd', 'mag', 'mdef']) {
      if (Number.isFinite(Number(eq.data[key]))) out[key] += Number(eq.data[key]);
    }
    if (Array.isArray(eq.opts)) {
      for (const opt of eq.opts) {
        if (opt && opt.unit === 'val' && Number.isFinite(Number(out[opt.key]))) {
          out[opt.key] += Number(opt.val || 0);
        }
      }
    }
  }
  return out;
}

function loadParty(save) {
  return (save.party || [])
    .map((uid) => (save.characters || []).find((char) => char.uid === uid))
    .filter(Boolean)
    .map(equipStatCharacter);
}

function isDamageSkill(skill) {
  if (!skill) return false;
  if (skill.id >= 500 && skill.id <= 505) return true;
  return skill.type === TYPES.normal || skill.type === TYPES.physical || skill.type === TYPES.magic || skill.type === TYPES.breath;
}

function isSupportSkill(skill) {
  return !!skill && SUPPORT_TYPES.has(skill.type);
}

function expectedDamage(actor, skill, target) {
  if (skill && skill.id >= 500 && skill.id <= 505) {
    return Math.max(0, (actor.mp || 0) * (skill.rate || 1));
  }

  const type = skill ? skill.type : TYPES.normal;
  const rate = skill && skill.rate !== undefined ? skill.rate : 1;
  const count = skill && skill.count !== undefined ? skill.count : 1;
  const base = skill ? skill.base || 0 : 0;

  let baseDamage;
  if (skill && skill.fix) {
    baseDamage = base;
  } else if (type === TYPES.breath) {
    baseDamage = Math.floor(((actor.atk || 0) + (actor.mag || 0)) / 6 + base);
  } else {
    const offense = type === TYPES.magic ? actor.mag || 0 : actor.atk || 0;
    const defense = type === TYPES.magic ? target.mdef || 0 : target.def || 0;
    baseDamage = Math.floor(offense / 2 + base - defense / 4);
  }

  if (baseDamage < 1) baseDamage = 0.3;
  return Math.max(0, baseDamage * rate * count);
}

function skillValue(actor, skill, enemies) {
  if (!skill) return Math.max(...enemies.map((enemy) => expectedDamage(actor, null, enemy)));
  if (skill.target === TARGETS.all) {
    return enemies.reduce((sum, enemy) => sum + Math.min(enemy.hp || 0, expectedDamage(actor, skill, enemy)), 0);
  }
  if (skill.target === TARGETS.random) {
    const bestHit = Math.max(...enemies.map((enemy) => expectedDamage(actor, skill, enemy)));
    return Math.min(enemies.reduce((sum, enemy) => sum + (enemy.hp || 0), 0), bestHit);
  }
  return Math.max(...enemies.map((enemy) => Math.min(enemy.hp || 0, expectedDamage(actor, skill, enemy))));
}

function bestPartyAction(actor, enemies, skillById, options = {}) {
  const allowMadan = options.allowMadan !== false;
  let best = {
    label: 'attack',
    value: skillValue(actor, null, enemies),
    mp: 0,
    skillId: 1,
  };

  for (const id of actor.skills || []) {
    const skill = skillById.get(Number(id));
    if (!isDamageSkill(skill)) continue;
    if (!allowMadan && skill.id >= 500 && skill.id <= 505) continue;
    if ((skill.mp || 0) > (actor.mp || 0)) continue;
    const value = skillValue(actor, skill, enemies);
    if (value > best.value) {
      best = {
        label: `${skill.name}(${skill.mp || 0})`,
        value,
        mp: skill.id >= 500 && skill.id <= 505 ? actor.mp || 0 : skill.mp || 0,
        skillId: skill.id,
      };
    }
  }

  return best;
}

function enemyActionDamage(enemy, target, skillById) {
  let totalWeight = 0;
  let totalDamage = 0;
  let attackWeight = 0;
  let supportWeight = 0;

  for (const action of enemy.acts || [{ id: 1, rate: 100 }]) {
    const skill = skillById.get(Number(action.id));
    const weight = Number(action.rate || 10);
    totalWeight += weight;
    if (!skill || skill.id === 1 || isDamageSkill(skill)) {
      attackWeight += weight;
      totalDamage += weight * expectedDamage(enemy, skill || skillById.get(1), target);
    } else if (isSupportSkill(skill)) {
      supportWeight += weight;
    }
  }

  return {
    damage: totalDamage / Math.max(1, totalWeight),
    attackRate: attackWeight / Math.max(1, totalWeight),
    supportRate: supportWeight / Math.max(1, totalWeight),
  };
}

function floorEnemies(monsterData, floor) {
  const band = monsterData.getMonsterBandForFloor(floor);
  if (!band) return [];
  return band.monsters.map((monster) => monsterData.applyFloorOffset(monster, floor, band));
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value, digits = 1) {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function getMedianTarget(party) {
  return [...party].sort((a, b) => (a.def + a.mdef) - (b.def + b.mdef))[Math.floor(party.length / 2)] || party[0];
}

function analyzeNormalFloor(floor, party, monsterData, skillById, encounterSize, options) {
  const baseEnemies = floorEnemies(monsterData, floor);
  if (baseEnemies.length === 0) return null;
  const enemies = baseEnemies.slice(0, encounterSize);
  while (enemies.length < encounterSize) enemies.push(baseEnemies[enemies.length % baseEnemies.length]);

  const enemyHp = enemies.reduce((sum, enemy) => sum + (enemy.hp || 0), 0);
  const partyActions = party.map((actor) => bestPartyAction(actor, enemies, skillById, options));
  const partyTurnDamage = partyActions.reduce((sum, action) => sum + action.value, 0);
  const turnsToClear = enemyHp / Math.max(1, partyTurnDamage);

  const target = getMedianTarget(party);
  const enemyActions = enemies.map((enemy) => enemyActionDamage(enemy, target, skillById));
  const enemyTurnDamage = enemyActions.reduce((sum, action) => sum + action.damage, 0);
  const partyHp = party.reduce((sum, actor) => sum + (actor.hp || 0), 0);
  const turnsToWipe = partyHp / Math.max(1, enemyTurnDamage);
  const danger = turnsToClear / Math.max(0.1, turnsToWipe);
  const expPerFight = enemies.reduce((sum, enemy) => sum + (enemy.exp || 0), 0);
  const avgNeed = avg(party.map((actor) => Math.max(0, getNextExp(actor) - (actor.exp || 0))));

  return {
    floor,
    enemyCount: encounterSize,
    avgEnemyHp: avg(enemies.map((enemy) => enemy.hp || 0)),
    avgEnemyAtk: avg(enemies.map((enemy) => enemy.atk || 0)),
    avgEnemyMag: avg(enemies.map((enemy) => enemy.mag || 0)),
    avgEnemySpd: avg(enemies.map((enemy) => enemy.spd || 0)),
    fasterEnemyRate: avg(enemies.map((enemy) => (enemy.spd || 0) > avg(party.map((actor) => actor.spd || 0)) ? 1 : 0)),
    attackActionRate: avg(enemyActions.map((action) => action.attackRate)),
    supportActionRate: avg(enemyActions.map((action) => action.supportRate)),
    enemyHp,
    partyTurnDamage,
    turnsToClear,
    enemyTurnDamage,
    turnsToWipe,
    danger,
    expPerFight,
    battlesToAvgLevel: avgNeed / Math.max(1, expPerFight),
    bestActions: partyActions.map((action, index) => `${party[index].name}:${action.label}`).join(' / '),
  };
}

function analyzeBossFloor(floor, party, monsterData, skillById, options) {
  const bosses = monsterData.getBossesForFloor(floor);
  if (!bosses || bosses.length === 0) return null;
  const bossHp = bosses.reduce((sum, boss) => sum + (boss.hp || 0), 0);
  const partyActions = party.map((actor) => bestPartyAction(actor, bosses, skillById, options));
  const partyTurnDamage = partyActions.reduce((sum, action) => sum + action.value, 0);
  const turnsToKill = bossHp / Math.max(1, partyTurnDamage);

  const target = getMedianTarget(party);
  const bossActions = bosses.map((boss) => enemyActionDamage(boss, target, skillById));
  const bossTurnDamage = bossActions.reduce((sum, action) => sum + action.damage, 0);
  const partyHp = party.reduce((sum, actor) => sum + (actor.hp || 0), 0);
  const turnsToWipe = partyHp / Math.max(1, bossTurnDamage);

  return {
    floor,
    bossCount: bosses.length,
    bossHp,
    avgBossSpd: avg(bosses.map((boss) => boss.spd || 0)),
    partyTurnDamage,
    turnsToKill,
    bossTurnDamage,
    turnsToWipe,
    danger: turnsToKill / Math.max(0.1, turnsToWipe),
    bestActions: partyActions.map((action, index) => `${party[index].name}:${action.label}`).join(' / '),
  };
}

function levelUpAverage(actor) {
  actor.level += 1;
  const hpBase = Math.max(10, actor.maxHp || actor.hp || 10);
  const mpBase = Math.max(5, actor.maxMp || actor.mp || 5);
  let hpGain = Math.max(1, Math.floor(hpBase * 0.055));
  let mpGain = Math.max(1, Math.floor(mpBase * 0.045));
  let atkGain = Math.max(1, Math.floor(Math.max(10, actor.atk) * 0.025));
  let defGain = Math.max(1, Math.floor(Math.max(10, actor.def) * 0.025));
  let magGain = Math.max(1, Math.floor(Math.max(10, actor.mag) * 0.025));
  let mdefGain = Math.max(1, Math.floor(Math.max(10, actor.mdef) * 0.025));
  let spdGain = Math.max(1, Math.floor(Math.max(10, actor.spd) * 0.02));

  if (actor.level === 50 || actor.level === 100) {
    hpGain = Math.floor(hpGain * 2.5);
    mpGain = Math.floor(mpGain * 2.5);
    atkGain = Math.floor(atkGain * 2.5);
    defGain = Math.floor(defGain * 2.5);
    magGain = Math.floor(magGain * 2.5);
    mdefGain = Math.floor(mdefGain * 2.5);
    spdGain = Math.floor(spdGain * 2.5);
  } else {
    const rareExpectedMult = 1 + (0.12 * 1.5 / 7);
    hpGain = Math.floor(hpGain * rareExpectedMult);
    mpGain = Math.floor(mpGain * rareExpectedMult);
    atkGain = Math.floor(atkGain * rareExpectedMult);
    defGain = Math.floor(defGain * rareExpectedMult);
    magGain = Math.floor(magGain * rareExpectedMult);
    mdefGain = Math.floor(mdefGain * rareExpectedMult);
    spdGain = Math.floor(spdGain * rareExpectedMult);
  }

  actor.maxHp += hpGain;
  actor.maxMp += mpGain;
  actor.hp = actor.maxHp;
  actor.mp = actor.maxMp;
  actor.atk += atkGain;
  actor.def += defGain;
  actor.mag += magGain;
  actor.mdef += mdefGain;
  actor.spd += spdGain;
}

function cloneParty(party) {
  return JSON.parse(JSON.stringify(party));
}

function simulateProgression(startParty, monsterData, startFloor, endFloor, fightsPerFloor) {
  const party = cloneParty(startParty);
  const rows = [];
  const snapshots = new Map();
  for (let floor = startFloor; floor <= endFloor; floor += 1) {
    const enemies = floorEnemies(monsterData, Math.min(200, floor));
    const expPerFight = enemies.length ? avg(enemies.map((enemy) => enemy.exp || 0)) * 2.5 : 0;
    const bossExp = floor % 10 === 0
      ? monsterData.getBossesForFloor(Math.min(200, floor)).reduce((sum, boss) => sum + (boss.exp || 0), 0)
      : 0;
    const gained = Math.floor(expPerFight * fightsPerFloor + bossExp);
    for (const actor of party) {
      actor.exp += gained;
      let guard = 0;
      while (actor.level < 100 && actor.exp >= getNextExp(actor) && guard < 20) {
        actor.exp -= getNextExp(actor);
        levelUpAverage(actor);
        guard += 1;
      }
    }
    if (floor % 10 === 0 || floor === startFloor || floor === endFloor) {
      rows.push({
        floor,
        gained,
        avgLevel: avg(party.map((actor) => actor.level)),
        avgHp: avg(party.map((actor) => actor.hp)),
        avgAtk: avg(party.map((actor) => actor.atk)),
        avgMag: avg(party.map((actor) => actor.mag)),
        avgSpd: avg(party.map((actor) => actor.spd)),
      });
      snapshots.set(floor, cloneParty(party));
    }
  }
  return { rows, snapshots };
}

function bucketLabel(floor) {
  const start = Math.floor((floor - 1) / 10) * 10 + 1;
  return `${start}-${Math.min(200, start + 9)}`;
}

function formatTable(rows, headers) {
  const out = [];
  out.push(headers.join('\t'));
  for (const row of rows) {
    out.push(headers.map((key) => row[key]).join('\t'));
  }
  return out.join('\n');
}

function main() {
  const savePath = process.argv[2] || DEFAULT_SAVE;
  const startFloorArg = Number(process.argv[3] || 1);
  const endFloor = Number(process.argv[4] || 200);
  const encounterSize = Number(process.env.ENCOUNTER_SIZE || 3);
  const fightsPerFloor = Number(process.env.FIGHTS_PER_FLOOR || 7);
  const allowMadan = process.env.ALLOW_MADAN === '1';

  const data = loadGameData();
  const skillById = new Map(data.skills.map((skill) => [Number(skill.id), skill]));
  const save = readJson(savePath);
  const party = loadParty(save);
  const saveFloor = Number(save.dungeon?.maxFloor || save.progress?.floor || 1);
  const startFloor = startFloorArg || saveFloor;

  const normalRows = [];
  const bossRows = [];
  for (let floor = startFloor; floor <= endFloor; floor += 1) {
    if ((floor - startFloor) % 10 === 0 || floor === endFloor || floor % 10 === 1) {
      const normal = analyzeNormalFloor(Math.min(200, floor), party, data.monsters, skillById, encounterSize, { allowMadan });
      if (normal) {
        normalRows.push({
          band: bucketLabel(floor),
          floor,
          enemyCount: normal.enemyCount,
          avgEnemyHp: round(normal.avgEnemyHp, 0),
          partyDpr: round(normal.partyTurnDamage, 0),
          clearTurns: round(normal.turnsToClear, 2),
          enemyDpr: round(normal.enemyTurnDamage, 0),
          wipeTurns: round(normal.turnsToWipe, 2),
          danger: round(normal.danger, 2),
          expFight: round(normal.expPerFight, 0),
          battlesLv: round(normal.battlesToAvgLevel, 1),
          atkRate: `${round(normal.attackActionRate * 100, 0)}%`,
          supportRate: `${round(normal.supportActionRate * 100, 0)}%`,
          faster: `${round(normal.fasterEnemyRate * 100, 0)}%`,
        });
      }
    }
    if (floor % 10 === 0) {
      const boss = analyzeBossFloor(Math.min(200, floor), party, data.monsters, skillById, { allowMadan });
      if (boss) {
        bossRows.push({
          floor,
          bossCount: boss.bossCount,
          bossHp: round(boss.bossHp, 0),
          partyDpr: round(boss.partyTurnDamage, 0),
          killTurns: round(boss.turnsToKill, 2),
          bossDpr: round(boss.bossTurnDamage, 0),
          wipeTurns: round(boss.turnsToWipe, 2),
          danger: round(boss.danger, 2),
        });
      }
    }
  }

  const progressionResult = simulateProgression(party, data.monsters, saveFloor + 1, endFloor, fightsPerFloor);
  const progression = progressionResult.rows
    .map((row) => ({
      floor: row.floor,
      gained: row.gained,
      avgLevel: round(row.avgLevel, 1),
      avgHp: round(row.avgHp, 0),
      avgAtk: round(row.avgAtk, 0),
      avgMag: round(row.avgMag, 0),
      avgSpd: round(row.avgSpd, 0),
    }));

  const projectedNormalRows = [];
  const projectedBossRows = [];
  for (const [floor, projectedParty] of progressionResult.snapshots.entries()) {
    const normal = analyzeNormalFloor(Math.min(200, floor), projectedParty, data.monsters, skillById, encounterSize, { allowMadan });
    if (normal) {
      projectedNormalRows.push({
        floor,
        avgLevel: round(avg(projectedParty.map((actor) => actor.level)), 1),
        enemyCount: normal.enemyCount,
        avgEnemyHp: round(normal.avgEnemyHp, 0),
        partyDpr: round(normal.partyTurnDamage, 0),
        clearTurns: round(normal.turnsToClear, 2),
        enemyDpr: round(normal.enemyTurnDamage, 0),
        wipeTurns: round(normal.turnsToWipe, 2),
        danger: round(normal.danger, 2),
        expFight: round(normal.expPerFight, 0),
      });
    }
    if (floor % 10 === 0) {
      const boss = analyzeBossFloor(Math.min(200, floor), projectedParty, data.monsters, skillById, { allowMadan });
      if (boss) {
        projectedBossRows.push({
          floor,
          avgLevel: round(avg(projectedParty.map((actor) => actor.level)), 1),
          bossCount: boss.bossCount,
          bossHp: round(boss.bossHp, 0),
          partyDpr: round(boss.partyTurnDamage, 0),
          killTurns: round(boss.turnsToKill, 2),
          bossDpr: round(boss.bossTurnDamage, 0),
          wipeTurns: round(boss.turnsToWipe, 2),
          danger: round(boss.danger, 2),
        });
      }
    }
  }

  const output = {
    meta: {
      savePath,
      saveFloor,
      analyzedFloorRange: [startFloor, endFloor],
      encounterSize,
      fightsPerFloor,
      allowMadan,
      note: 'Expected-value simulator. It ignores most passives, elemental resist/pierce, healing AI, deaths/retries, item usage, and MP depletion across multiple fights.',
    },
    party: party.map((actor) => ({
      name: actor.name,
      level: actor.level,
      hp: actor.hp,
      mp: actor.mp,
      atk: actor.atk,
      def: actor.def,
      mag: actor.mag,
      mdef: actor.mdef,
      spd: actor.spd,
      nextExp: getNextExp(actor),
      currentExp: actor.exp,
    })),
    normalRows,
    bossRows,
    progression,
    projectedNormalRows,
    projectedBossRows,
  };

  const outDir = path.join(ROOT, 'verification', 'balance-sim');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'balance-sim-latest.json'), JSON.stringify(output, null, 2), 'utf8');

  const report = [
    '# Balance Simulation',
    '',
    `saveFloor: ${saveFloor}`,
    `range: ${startFloor}-${endFloor}`,
    `encounterSize: ${encounterSize}`,
    `fightsPerFloor: ${fightsPerFloor}`,
    `allowMadan: ${allowMadan}`,
    '',
    '## Normal Floors',
    '',
    formatTable(normalRows, ['band', 'floor', 'enemyCount', 'avgEnemyHp', 'partyDpr', 'clearTurns', 'enemyDpr', 'wipeTurns', 'danger', 'expFight', 'battlesLv', 'atkRate', 'supportRate', 'faster']),
    '',
    '## Boss Floors',
    '',
    formatTable(bossRows, ['floor', 'bossCount', 'bossHp', 'partyDpr', 'killTurns', 'bossDpr', 'wipeTurns', 'danger']),
    '',
    '## Progression Projection',
    '',
    formatTable(progression, ['floor', 'gained', 'avgLevel', 'avgHp', 'avgAtk', 'avgMag', 'avgSpd']),
    '',
    '## Projected Normal Difficulty',
    '',
    formatTable(projectedNormalRows, ['floor', 'avgLevel', 'enemyCount', 'avgEnemyHp', 'partyDpr', 'clearTurns', 'enemyDpr', 'wipeTurns', 'danger', 'expFight']),
    '',
    '## Projected Boss Difficulty',
    '',
    formatTable(projectedBossRows, ['floor', 'avgLevel', 'bossCount', 'bossHp', 'partyDpr', 'killTurns', 'bossDpr', 'wipeTurns', 'danger']),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'balance-sim-latest.md'), report, 'utf8');
  console.log(report);
}

main();
