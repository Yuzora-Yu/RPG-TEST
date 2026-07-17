const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const dataContext = { window: {}, console };
dataContext.globalThis = dataContext;
vm.createContext(dataContext);
for (const file of ['items.js', 'item-expansion.js', 'monsters.js', 'chest-mimics.js', 'monster-drop-policy.js']) {
    vm.runInContext(read(file), dataContext, { filename: file });
}

const traps = dataContext.window.MONSTERS_DATA.filter(monster => monster.isChestTrap);
assert(traps.length === 3, `expected 3 chest traps, got ${traps.length}`);
assert(JSON.stringify(traps.map(monster => monster.id)) === JSON.stringify([120301, 120302, 120303]), 'chest trap IDs changed');
assert(JSON.stringify(traps.map(monster => monster.rank)) === JSON.stringify([50, 120, 170]), 'chest trap ranks changed');
for (const monster of traps) {
    assert(monster.isElite && Number(monster.actCount) === 2, `${monster.name} is not a two-action elite`);
    assert(monster.drops?.normal?.id === 99 && monster.drops.normal.rate === 100, `${monster.name} does not always drop a small medal`);
    assert(monster.drops?.rare?.id >= 100 && monster.drops.rare.id <= 106, `${monster.name} rare drop is not a growth item 100-106`);
    assert(monster.drops.rare.id !== 107, `${monster.name} illegally drops reincarnation item 107`);
    assert(monster.hp > 0 && monster.atk > 0 && monster.def > 0 && monster.mag > 0 && monster.mdef > 0, `${monster.name} has invalid stats`);
}

const mimicData = dataContext.window.CHEST_MIMIC_DATA;
assert(mimicData.normalChestChance === 0.05, 'normal chest mimic rate is not 5%');
assert(mimicData.minimumAbyssFloor === 40, 'mimics do not begin at floor 40');
for (const [floor, id] of [[40,120301],[119,120301],[120,120302],[169,120302],[170,120303],[201,120303]]) {
    assert(mimicData.getForFloor(floor).id === id, `floor ${floor} selects the wrong mimic`);
}

const runtimeContext = {
    console,
    Math: Object.create(Math),
    window: null,
    setTimeout: fn => fn(),
    clearTimeout: () => {},
};
runtimeContext.window = runtimeContext;
runtimeContext.globalThis = runtimeContext;
runtimeContext.Math.random = () => 0.01;
runtimeContext.DB = { MONSTERS: traps, ITEMS: dataContext.window.ITEMS_DATA, SKILLS: [] };
runtimeContext.MonsterData = dataContext.window.MonsterData;
runtimeContext.CHEST_MIMIC_DATA = mimicData;
runtimeContext.App = {
    data: {
        progress: { floor: 40, openedChests: {}, mapChanges: {} },
        dungeon: { keyChests: [] },
        battle: { active: false },
        party: [], items: {}, inventory: [], stats: {}, gold: 0
    },
    save() {},
    log() {},
    changeScene(scene) { this.lastScene = scene; },
    getChar() { return null; }
};
runtimeContext.Field = {
    currentMapData: null,
    render() {},
    getCurrentAreaKey() { return 'ABYSS'; }
};
vm.createContext(runtimeContext);
vm.runInContext(`${read('dungeon.js')}\nglobalThis.Dungeon = Dungeon;`, runtimeContext, { filename: 'dungeon.js' });

(async () => {
    const Dungeon = runtimeContext.Dungeon;
    Dungeon.floor = 40;
    Dungeon.map = [['C']];
    await Dungeon.openChest(0, 0, 'normal');
    assert(Dungeon.map[0][0] === 'T', 'opened mimic chest was not persisted as floor');
    assert(runtimeContext.App.data.battle.isChestTrapBattle, 'mimic chest did not build a chest-trap battle context');
    assert(runtimeContext.App.data.battle.preventEscape, 'mimic battle incorrectly permits escape after consuming the chest');
    assert(runtimeContext.App.data.battle.chestTrapMonsterId === 120301, 'floor 40 chest did not select rank-50 mimic');
    assert(runtimeContext.App.lastScene === 'battle', 'mimic chest did not enter battle');

    class Monster {
        constructor(base) {
            Object.assign(this, JSON.parse(JSON.stringify(base)));
            this.baseStats = { atk: base.atk, def: base.def, spd: base.spd, mag: base.mag };
            this.hp = base.hp; this.baseMaxHp = base.hp;
            this.mp = base.mp; this.baseMaxMp = base.mp;
            this.acts = JSON.parse(JSON.stringify(base.acts || []));
            this.actCount = base.actCount || 1;
        }
    }
    const battleContext = {
        console,
        Math: Object.create(Math),
        window: null,
        globalThis: null,
        document: { getElementById: () => null },
        Monster,
        DB: { MONSTERS: traps, SKILLS: [] },
        CONST: { ELEMENTS: ['火','水','風','雷','光','闇','混沌'] },
        Field: { currentMapData: null },
        App: { data: { progress: { floor: 201 }, battle: { isChestTrapBattle: true, chestTrapMonsterId: 120303, chestTrapFloor: 201 } } },
        setTimeout: fn => fn(), clearTimeout: () => {}
    };
    battleContext.window = battleContext;
    battleContext.globalThis = battleContext;
    battleContext.Math.random = () => 0.5;
    vm.createContext(battleContext);
    vm.runInContext(`${read('battle.js')}\nglobalThis.Battle = Battle;`, battleContext, { filename: 'battle.js' });
    battleContext.Battle.log = () => {};
    battleContext.Battle.initBattleStatus = target => { target.battleStatus = { buffs:{}, debuffs:{}, ailments:{} }; };
    const deepEnemies = battleContext.Battle.generateNewEnemies(false);
    assert(deepEnemies.length === 1, `201F mimic battle generated ${deepEnemies.length} enemies`);
    assert(deepEnemies[0].baseId === 120303 && deepEnemies[0].generatedFloor === 201, '201F mimic did not use rank-170 base with deep scaling');
    assert(deepEnemies[0].actCount === 2, 'deep-scaled mimic lost two-action behavior');

    const editor = read('map_story_editor.html');
    for (const marker of ['chest-mimics.js', 'chestQuickEditorHtml(', 'applyChestMode(', 'trapMonsterId', 'トラップモンスター']) {
        assert(editor.includes(marker), `map editor mimic support is missing: ${marker}`);
    }
    const dungeonSource = read('dungeon.js');
    assert(dungeonSource.includes("type === 'normal' && floor >= mimicMinimumFloor"), 'rare/key chests are not excluded from the mimic roll');
    assert(dungeonSource.includes('Math.random() < mimicChance'), 'mimic probability roll is missing');
    assert(read('battle.js').includes('trapFloor >= 201'), '201F deep mimic route is missing');
    assert(read('battle.js').includes('App.data.battle.isBossBattle || App.data.battle.preventEscape'), 'mimic escape lock is missing');

    for (const monster of traps) {
        const relative = monster.image;
        const data = fs.readFileSync(path.join(root, relative));
        assert(data.toString('ascii', 1, 4) === 'PNG', `${relative} is not PNG`);
        assert(data.readUInt32BE(16) === 768 && data.readUInt32BE(20) === 768, `${relative} is not normalized to 768x768`);
        assert(data[25] === 6, `${relative} has no RGBA alpha channel`);
        assert(read('assets.js').includes(relative), `${relative} is not registered for full caching`);
        assert(read('monster-images.js').includes(relative), `${relative} is not registered in MonsterImageMap`);
    }

    for (const script of ['index.html', 'map_story_editor.html', 'monster_editor.html', 'sw.js']) {
        assert(read(script).includes('chest-mimics.js'), `${script} does not load/cache chest-mimics.js`);
    }
    console.log('Chest mimic validation passed: 3 elite traps, 5% F40+ normal-chest route, fixed-map editor support, 201F deep scaling, drops, and fully cached 768px assets.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
