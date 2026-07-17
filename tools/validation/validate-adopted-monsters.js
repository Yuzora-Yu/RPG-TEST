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

const manifest = JSON.parse(read('assets/monsters/library/manifest.json'));
const entries = manifest.assets || [];
const skills = new Set((context.SKILLS_DATA || []).map(skill => Number(skill.id)));
const monsterData = context.MonsterData;
const graphics = context.PRISMA_ASSETS?.graphics || {};
const imageMap = context.MonsterImageMap || {};
const battleSource = read('battle.js');
const bookSource = read('menus_book.js');

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
if (entries.length !== 24) errors.push(`expected 24 adopted entries, got ${entries.length}`);

for (const entry of entries) {
    const monster = monsterData?.getMonsterById(Number(entry.monsterId));
    if (!monster) {
        errors.push(`monster data is missing: ${entry.monsterId}`);
        continue;
    }
    if (monster.name !== entry.candidateName) errors.push(`name mismatch: ${entry.monsterId}`);
    if (monster.img !== entry.path) errors.push(`data image mismatch: ${entry.monsterId}`);
    if (graphics[`monster_${entry.monsterId}`] !== entry.path) errors.push(`graphics alias mismatch: ${entry.monsterId}`);
    if (imageMap[entry.monsterId] !== entry.path) errors.push(`battle image alias mismatch: ${entry.monsterId}`);
    if (!Array.isArray(monster.acts) || monster.acts.length < 3) errors.push(`insufficient skill pattern: ${entry.monsterId}`);
    if (!Array.isArray(monster.archives) || !monster.archives.some(text => String(text || '').trim().length >= 12)) {
        errors.push(`monster book archive is missing or too short: ${entry.monsterId}`);
    }
    if (!(Number(monster.gold) > 0) || !(Number(monster.exp) > 0)) {
        errors.push(`battle reward is missing: ${entry.monsterId}`);
    }
    for (const act of monster.acts || []) {
        if (!skills.has(Number(act.id))) errors.push(`unknown skill ${act.id}: ${entry.monsterId}`);
    }
    if (!monster.elmRes || Object.keys(monster.elmRes).filter(key => key !== 'json').length < 2) {
        errors.push(`weakness/resistance design missing: ${entry.monsterId}`);
    }
    if (entry.role === 'midboss') {
        if (!monster.isBoss || !monster.storyOnly || !monster.isStoryBoss) errors.push(`midboss is not story-only: ${entry.monsterId}`);
        if (Number(entry.monsterId) < 302201 || Number(entry.monsterId) > 302208) errors.push(`midboss ID outside adopted range: ${entry.monsterId}`);
        if (monsterData.getBossesForFloor(monster.minF).some(boss => boss.id === monster.id)) {
            errors.push(`story midboss leaked into Abyss floor boss pool: ${entry.monsterId}`);
        }
        const assignedQuestId = String(entry.storyAssignment || '').split(':')[0];
        const placements = questBosses.filter(({ boss }) => {
            const ids = Array.isArray(boss.monsterId) ? boss.monsterId : [boss.monsterId];
            return ids.map(Number).includes(Number(entry.monsterId));
        });
        if (placements.length !== 1 || placements[0]?.boss?.questId !== assignedQuestId) {
            errors.push(`story midboss placement differs from manifest assignment: ${entry.monsterId}`);
        } else {
            const event = mapRuntime.context.STORY_MANAGER_DATA?.events?.[placements[0].boss.startEventId];
            const battleAction = (event?.actions || []).find(action => action?.type === 'BOSS');
            const eventIds = Array.isArray(battleAction?.value) ? battleAction.value : [battleAction?.value];
            if (!eventIds.map(Number).includes(Number(entry.monsterId))) {
                errors.push(`story midboss is replaced or lost after its pre-battle conversation: ${entry.monsterId}`);
            }
        }
    } else {
        if (monster.isBoss || monster.storyOnly) errors.push(`normal monster marked as boss: ${entry.monsterId}`);
        const matchingBands = monsterData.bands.filter(band => band.monsters.some(candidate => candidate.id === monster.id));
        if (matchingBands.length !== 1) errors.push(`normal monster must belong to one band: ${entry.monsterId}`);
        const expectedBand = Number(entry.storyAssignment.match(/abyss-band-(\d+)-/)?.[1]);
        if (matchingBands[0]?.bandStart !== expectedBand) errors.push(`Abyss band mismatch: ${entry.monsterId}`);
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
            if (!withinRatio(value, baseline, min, max)) errors.push(`${label} balance outlier in assigned band: ${entry.monsterId}`);
        }
        const appearingFloors = [];
        for (let floor = 1; floor <= 200; floor += 1) {
            const floorBand = monsterData.getMonsterBandForFloor(floor);
            if (floorBand?.monsters?.some(candidate => Number(candidate.id) === Number(monster.id))) appearingFloors.push(floor);
        }
        const expectedFloors = Array.from({ length: 5 }, (_, index) => expectedBand + index);
        if (JSON.stringify(appearingFloors) !== JSON.stringify(expectedFloors)) {
            errors.push(`normal monster leaks outside its five-floor band: ${entry.monsterId} -> ${appearingFloors.join(',')}`);
        }
        for (const floor of [expectedBand, expectedBand + 4]) {
            const generated = monsterData.applyFloorOffset(monster, floor, band);
            if (Number(generated.baseId) !== Number(monster.id) || generated.img !== monster.img) {
                errors.push(`floor scaling loses adopted monster identity/image: ${entry.monsterId} floor ${floor}`);
            }
        }
    }
}

for (const marker of [
    'if (!App.data.book.monsters.includes(id)) App.data.book.monsters.push(id)',
    'Battle.getMonsterBaseById(id)',
]) {
    if (!battleSource.includes(marker)) errors.push(`battle-to-book registration marker is missing: ${marker}`);
}
for (const marker of ['DB.MONSTERS.forEach(m =>', 'MenuBook.getMonsterImgSrc(m)', "monster.archives || '（記録なし）'"]) {
    if (!bookSource.includes(marker)) errors.push(`monster book rendering marker is missing: ${marker}`);
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

console.log('Adopted monster validation passed: 8 curated quest bosses and 16 curated Abyss-band monsters.');
console.log('Balance, rewards, archives, five-floor containment, book registration, and encounter composition are valid.');
