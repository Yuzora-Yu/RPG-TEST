const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];
const context = { console, Math };
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(read('skills.js'), context, { filename: 'skills.js' });
vm.runInContext(read('monsters.js'), context, { filename: 'monsters.js' });
vm.runInContext(read('assets.js'), context, { filename: 'assets.js' });
vm.runInContext(read('monster-images.js'), context, { filename: 'monster-images.js' });

const adoptedQuestBosses = [
    { id: 302201, questId: 'karin_volcano_depths' },
    { id: 302202, questId: 'sophia_alan_seabed_depths' },
    { id: 302203, questId: 'arisa_haine_forest_depths' },
    { id: 302204, questId: 'frieda_baron_thunder_depths' },
    { id: 302205, questId: 'zelied_big_tower' },
    { id: 302206, questId: 'claude_leon_dark_shrine' },
    { id: 302207, questId: 'arisa_haine_forest_depths' },
    { id: 302208, questId: 'sophia_alan_seabed_depths' },
];

const adoptedNormals = [
    { id: 200001, bandStart: 81 },
    { id: 200002, bandStart: 86 },
    { id: 200003, bandStart: 91 },
    { id: 200004, bandStart: 96 },
    { id: 200005, bandStart: 101 },
    { id: 200006, bandStart: 106 },
    { id: 200007, bandStart: 111 },
    { id: 200008, bandStart: 116 },
    { id: 200009, bandStart: 121 },
    { id: 200010, bandStart: 126 },
    { id: 200011, bandStart: 131 },
    { id: 200012, bandStart: 136 },
    { id: 200013, bandStart: 141 },
    { id: 200014, bandStart: 146 },
    { id: 200015, bandStart: 151 },
    { id: 200016, bandStart: 156 },
];

const skills = new Set((context.SKILLS_DATA || []).map(skill => Number(skill.id)));
const monsterData = context.MonsterData;
const graphics = context.PRISMA_ASSETS?.graphics || {};
const imageMap = context.MonsterImageMap || {};
const battleSource = read('battle.js');
const bookSource = read('menus_book.js');

const canonicalPath = id => `assets/monsters/monster_${id}.png`;
const exists = relative => fs.existsSync(path.join(root, relative));

const median = values => {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

const withinRatio = (value, baseline, min, max) => {
    if (!(baseline > 0)) return false;
    const ratio = Number(value) / baseline;
    return ratio >= min && ratio <= max;
};

const mapRuntime = loadMapRuntime(root);
mapRuntime.runFile('story.js', 'globalThis.STORY_MANAGER_DATA = STORY_MANAGER_DATA;');
const questBosses = [];
for (const [areaKey, dungeon] of Object.entries(mapRuntime.context.FIXED_DUNGEON_MAPS || {})) {
    for (const floor of dungeon.floors || []) {
        for (const boss of floor.bosses || []) {
            if (boss?.questId) questBosses.push({ areaKey, floor, boss });
        }
    }
}

if (!monsterData) errors.push('MonsterData was not exported');

for (const entry of adoptedQuestBosses) {
    const monster = monsterData?.getMonsterById(entry.id);
    const expectedPath = canonicalPath(entry.id);
    if (!monster) {
        errors.push(`quest boss data is missing: ${entry.id}`);
        continue;
    }
    if ('isStoryBoss' in monster || 'storyOnly' in monster) errors.push(`obsolete story flags remain: ${entry.id}`);
    if (!monster.isBoss) errors.push(`quest boss is not marked as boss: ${entry.id}`);
    if (monster.img !== expectedPath) errors.push(`quest boss image path mismatch: ${entry.id}`);
    if (graphics[`monster_${entry.id}`] !== expectedPath) errors.push(`quest boss graphics alias mismatch: ${entry.id}`);
    if (imageMap[entry.id] !== expectedPath) errors.push(`quest boss battle image alias mismatch: ${entry.id}`);
    if (!exists(expectedPath)) errors.push(`quest boss image file is missing: ${expectedPath}`);
    if (!monsterData.isStoryQuestBossId(monster)) errors.push(`quest boss ID range mismatch: ${entry.id}`);
    if (monsterData.isAbyssRandomBossCandidate(monster)) errors.push(`quest boss must not be an Abyss random boss candidate: ${entry.id}`);
    if (monsterData.getBossesForFloor(monster.minF).some(boss => boss.id === monster.id)) {
        errors.push(`quest boss leaked into Abyss floor boss pool: ${entry.id}`);
    }
    if (!Array.isArray(monster.acts) || monster.acts.length < 3) errors.push(`insufficient skill pattern: ${entry.id}`);
    for (const act of monster.acts || []) {
        if (!skills.has(Number(act.id))) errors.push(`unknown skill ${act.id}: ${entry.id}`);
    }
    const placements = questBosses.filter(({ boss }) => {
        const ids = Array.isArray(boss.monsterId) ? boss.monsterId : [boss.monsterId];
        return ids.map(Number).includes(entry.id);
    });
    if (placements.length !== 1 || placements[0]?.boss?.questId !== entry.questId) {
        errors.push(`quest boss placement differs from expected quest: ${entry.id}`);
    } else {
        const event = mapRuntime.context.STORY_MANAGER_DATA?.events?.[placements[0].boss.startEventId];
        const battleAction = (event?.actions || []).find(action => action?.type === 'BOSS');
        const eventIds = Array.isArray(battleAction?.value) ? battleAction.value : [battleAction?.value];
        if (!eventIds.map(Number).includes(entry.id)) {
            errors.push(`quest boss is replaced or lost after its pre-battle conversation: ${entry.id}`);
        }
    }
}

for (const entry of adoptedNormals) {
    const monster = monsterData?.getMonsterById(entry.id);
    const expectedPath = canonicalPath(entry.id);
    if (!monster) {
        errors.push(`normal adopted monster data is missing: ${entry.id}`);
        continue;
    }
    if ('isStoryBoss' in monster || 'storyOnly' in monster) errors.push(`obsolete story flags remain: ${entry.id}`);
    if (monster.isBoss) errors.push(`normal adopted monster marked as boss: ${entry.id}`);
    if (monster.img !== expectedPath) errors.push(`normal adopted image path mismatch: ${entry.id}`);
    if (imageMap[entry.id] !== expectedPath) errors.push(`normal adopted battle image alias mismatch: ${entry.id}`);
    if (!exists(expectedPath)) errors.push(`normal adopted image file is missing: ${expectedPath}`);
    if (!Array.isArray(monster.acts) || monster.acts.length < 3) errors.push(`insufficient skill pattern: ${entry.id}`);
    if (!Array.isArray(monster.archives) || !monster.archives.some(text => String(text || '').trim().length >= 12)) {
        errors.push(`monster book archive is missing or too short: ${entry.id}`);
    }
    for (const act of monster.acts || []) {
        if (!skills.has(Number(act.id))) errors.push(`unknown skill ${act.id}: ${entry.id}`);
    }
    const matchingBands = monsterData.bands.filter(band => band.monsters.some(candidate => candidate.id === monster.id));
    if (matchingBands.length !== 1) errors.push(`normal adopted monster must belong to one band: ${entry.id}`);
    if (matchingBands[0]?.bandStart !== entry.bandStart) errors.push(`Abyss band mismatch: ${entry.id}`);
    const band = matchingBands[0];
    const peers = (band?.monsters || []).filter(candidate => Number(candidate.id) !== Number(monster.id));
    const primaryOffense = candidate => Math.max(Number(candidate.atk || 0), Number(candidate.mag || 0));
    const primaryDefense = candidate => Math.max(Number(candidate.def || 0), Number(candidate.mdef || 0));
    for (const [label, value, baseline, min, max] of [
        ['HP', monster.hp, median(peers.map(candidate => candidate.hp)), 0.55, 1.85],
        ['offense', primaryOffense(monster), median(peers.map(primaryOffense)), 0.55, 1.85],
        ['defense', primaryDefense(monster), median(peers.map(primaryDefense)), 0.55, 1.85],
        ['gold', monster.gold, median(peers.map(candidate => candidate.gold)), 0.80, 1.25],
        ['exp', monster.exp, median(peers.map(candidate => candidate.exp)), 0.80, 1.25],
    ]) {
        if (!withinRatio(value, baseline, min, max)) errors.push(`${label} balance outlier in assigned band: ${entry.id}`);
    }
    const appearingFloors = [];
    for (let floor = 1; floor <= 200; floor += 1) {
        const floorBand = monsterData.getMonsterBandForFloor(floor);
        if (floorBand?.monsters?.some(candidate => Number(candidate.id) === Number(monster.id))) appearingFloors.push(floor);
    }
    const expectedFloors = Array.from({ length: 5 }, (_, index) => entry.bandStart + index);
    if (JSON.stringify(appearingFloors) !== JSON.stringify(expectedFloors)) {
        errors.push(`normal adopted monster leaks outside its five-floor band: ${entry.id} -> ${appearingFloors.join(',')}`);
    }
    for (const floor of [entry.bandStart, entry.bandStart + 4]) {
        const generated = monsterData.applyFloorOffset(monster, floor, band);
        if (Number(generated.baseId) !== Number(monster.id) || generated.img !== monster.img) {
            errors.push(`floor scaling loses adopted monster identity/image: ${entry.id} floor ${floor}`);
        }
    }
}

const abyssRandomBossCandidates = (monsterData?.bossMonsters || [])
    .filter(monster => monsterData.isAbyssRandomBossCandidate(monster));
if (abyssRandomBossCandidates.length === 0) {
    errors.push('no 400000-range Abyss random boss candidates were exported');
}
for (const boss of abyssRandomBossCandidates) {
    const floorBosses = monsterData.getBossesForFloor(boss.minF).map(candidate => Number(candidate.id));
    if (!floorBosses.includes(Number(boss.id))) {
        errors.push(`400000-range Abyss random boss is not selectable on its minF: ${boss.id}`);
    }
}
for (const boss of (monsterData?.bossMonsters || []).filter(monster => monsterData.isStoryQuestBossId(monster))) {
    const floorBosses = monsterData.getBossesForFloor(boss.minF).map(candidate => Number(candidate.id));
    if (floorBosses.includes(Number(boss.id))) {
        errors.push(`300000-range story/quest boss leaked into Abyss random boss pool: ${boss.id}`);
    }
}

for (const marker of [
    'if (!App.data.book.monsters.includes(id)) App.data.book.monsters.push(id)',
    'Battle.getMonsterBaseById(id)',
]) {
    if (!battleSource.includes(marker)) errors.push(`battle-to-book registration marker is missing: ${marker}`);
}
for (const marker of ['DB.MONSTERS.forEach(m =>', 'MenuBook.getMonsterImgSrc(m)', 'monster.archives ||']) {
    if (!bookSource.includes(marker)) errors.push(`monster book rendering marker is missing: ${marker}`);
}

for (const [file, source] of [
    ['monsters.js', read('monsters.js')],
    ['assets.js', read('assets.js')],
    ['monster-images.js', read('monster-images.js')],
]) {
    if (source.includes('assets/monsters/library') || source.includes('monsterlib_')) {
        errors.push(`obsolete monster library reference remains in ${file}`);
    }
}

const compactStory = read('story.js').replace(/\s+/g, '');
if (!compactStory.includes('"quest_arisa_haine_encounter":{"actions":[{"type":"CONV","value":"QUEST_ARISA_HAINE_ENCOUNTER"},{"type":"BOSS","value":[302203,302207]')) {
    errors.push('Arisa/Haine quest battle is not connected to the adopted wind/earth bosses');
}
if (!compactStory.includes('"quest_zelied_tower_echo_encounter":{"actions":[{"type":"CONV","value":"QUEST_ZELIED_TOWER_ECHO_ENCOUNTER"},{"type":"BOSS","value":[301060,302205]')) {
    errors.push('Zelied quest battle is not connected to the adopted light boss');
}

const compactMap = read('map.js').replace(/\s+/g, '');
const requiredMapConnections = [
    ['karin_volcano_depths', 'monsterId:302201,questId:"karin_volcano_depths"'],
    ['sophia_alan_seabed_depths', 'monsterId:[302208,302202],questId:"sophia_alan_seabed_depths"'],
    ['frieda_baron_thunder_depths', 'monsterId:[302204,100082],questId:"frieda_baron_thunder_depths"'],
    ['zelied_big_tower', 'monsterId:[301060,302205],questId:"zelied_big_tower"'],
    ['claude_leon_dark_shrine', 'monsterId:302206,questId:"claude_leon_dark_shrine"'],
];
for (const [questId, snippet] of requiredMapConnections) {
    if (!compactMap.includes(snippet)) errors.push(`map quest boss connection missing: ${questId}`);
}

if (errors.length) {
    console.error(`Adopted monster validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log('Adopted monster validation passed: 8 canonical quest bosses and 16 canonical Abyss-band monsters.');
console.log('IDs, paths, cache aliases, quest placement, floor containment, and obsolete flag removal are valid.');
