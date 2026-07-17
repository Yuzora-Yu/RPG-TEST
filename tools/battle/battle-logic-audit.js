const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function createUnit(name, overrides = {}) {
    const unit = {
        uid: name,
        name,
        hp: 1000,
        mp: 1000,
        baseMaxHp: 1000,
        baseMaxMp: 1000,
        atk: 240,
        def: 120,
        mag: 240,
        mdef: 120,
        spd: 100,
        cri: 0,
        eva: 0,
        elmAtk: {},
        elmRes: {},
        resists: {},
        finDmg: 0,
        finRed: 0,
        skills: [],
        config: { fullAuto: false, strategy: 'balanced', hiddenSkills: [], autoDisabledSkills: [], skillUsageConfigVersion: 2 },
        battleStatus: { buffs: {}, debuffs: {}, ailments: {} },
        passive: {},
        status: {},
        getStat(key) {
            if (key === 'maxHp') return this.baseMaxHp;
            if (key === 'maxMp') return this.baseMaxMp;
            return this[key] ?? 0;
        },
        ...overrides
    };
    return unit;
}

function loadRuntime(randomValue = 0.1) {
    let randomCalls = 0;
    let randomProvider = () => randomValue;
    const nextRandom = () => {
        randomCalls += 1;
        return randomProvider();
    };
    const dataContext = { window: {}, console };
    dataContext.Math = Object.create(Math);
    dataContext.Math.random = nextRandom;
    vm.createContext(dataContext);
    for (const file of ['skills.js', 'items.js', 'item-expansion.js', 'monsters.js', 'chest-mimics.js', 'monster-drop-policy.js', 'item_runtime.js']) {
        vm.runInContext(read(file), dataContext, { filename: file });
    }

    const registry = new Map();
    const runtimeContext = {
        window: dataContext.window,
        console,
        document: { getElementById: () => null },
        setTimeout,
        clearTimeout,
        Player: function Player() {},
        Monster: function Monster() {},
        PassiveSkill: { getSumValue: () => 0 },
        DB: {
            SKILLS: dataContext.window.SKILLS_DATA || [],
            ITEMS: dataContext.window.ITEMS_DATA || [],
            MONSTERS: dataContext.window.MONSTERS_DATA || []
        },
        App: {
            data: { battle: {}, items: {}, stats: {} },
            battleStrategies: { allout: {}, balanced: {}, conserve: {}, tricky: {}, defensive: {}, no_mp: {} },
            ensureCharacterBattleConfig(char) {
                char.config = char.config || {};
                char.config.hiddenSkills = Array.isArray(char.config.hiddenSkills) ? char.config.hiddenSkills.map(Number) : [];
                char.config.autoDisabledSkills = Array.isArray(char.config.autoDisabledSkills)
                    ? char.config.autoDisabledSkills.map(Number)
                    : [...char.config.hiddenSkills];
                char.config.strategy = this.battleStrategies[char.config.strategy] ? char.config.strategy : 'balanced';
                return char.config;
            },
            getChar: uid => registry.get(uid) || null,
            save: () => {}
        }
    };
    runtimeContext.Math = Object.create(Math);
    runtimeContext.Math.random = nextRandom;
    vm.createContext(runtimeContext);
    vm.runInContext(`${read('battle.js')}\nthis.__BATTLE__ = Battle;`, runtimeContext, { filename: 'battle.js' });
    const Battle = runtimeContext.__BATTLE__;
    const logs = [];
    for (const name of [
        'renderEnemies', 'renderPartyStatus', 'saveBattleState', 'updateDeadState', 'showDamagePopup',
        'playSfx', 'playAnimation', 'playSkillEffect', 'screenFlash', 'shakeScreen', 'animateAttack',
        'animateSkill', 'animateDamage', 'recordMaxDamage'
    ]) Battle[name] = () => {};
    Battle.log = line => logs.push(String(line));
    Battle.wait = async () => {};
    Battle.resultWait = async () => {};
    Battle.getColoredName = actor => actor.name;
    Battle.getWeakWeightedAliveEnemy = () => Battle.enemies.find(enemy => Battle.isBattleAlive(enemy)) || null;

    return {
        Battle,
        App: runtimeContext.App,
        DB: runtimeContext.DB,
        ItemRuntime: dataContext.window.ItemRuntime,
        registry,
        logs,
        setRandom(value) {
            randomCalls = 0;
            randomProvider = () => value;
        },
        setRandomSequence(values, fallback = 0.1) {
            randomCalls = 0;
            const queue = [...values];
            randomProvider = () => queue.length ? queue.shift() : fallback;
        },
        getRandomCallCount() {
            return randomCalls;
        }
    };
}

function createReport() {
    return { errors: [], warnings: [], sections: {}, metrics: {} };
}

function addCheck(report, section, condition, message, severity = 'error') {
    if (!report.sections[section]) report.sections[section] = { checks: 0, failures: 0 };
    report.sections[section].checks += 1;
    if (condition) return;
    report.sections[section].failures += 1;
    report[severity === 'warning' ? 'warnings' : 'errors'].push(`[${section}] ${message}`);
}

async function runAudit() {
    const report = createReport();
    const rt = loadRuntime();
    const { Battle, DB, App, ItemRuntime, registry } = rt;
    const skills = DB.SKILLS;
    const items = DB.ITEMS;
    const monsters = DB.MONSTERS;
    const skillIds = new Set(skills.map(skill => Number(skill.id)));
    const validTypes = new Set(['通常攻撃', '特殊', '物理', '魔法', 'ブレス', '回復', 'MP回復', '蘇生', '強化', '弱体']);
    const validTargets = new Set(['単体', '自分', '全体', 'ランダム']);
    const validElements = new Set(['火', '水', '雷', '風', '光', '闇', '混沌']);

    addCheck(report, 'catalog', skills.length > 0, '特技データが0件です');
    addCheck(report, 'catalog', skillIds.size === skills.length, `特技IDが重複しています (${skillIds.size}/${skills.length})`);
    for (const skill of skills) {
        const prefix = `ID ${skill.id} ${skill.name}`;
        addCheck(report, 'catalog', validTypes.has(skill.type), `${prefix}: 未定義type「${skill.type}」`);
        addCheck(report, 'catalog', validTargets.has(skill.target), `${prefix}: 未定義target「${skill.target}」`);
        addCheck(report, 'catalog', Number.isFinite(Number(skill.mp)) && Number(skill.mp) >= 0, `${prefix}: MPが不正です`);
        addCheck(report, 'catalog', Number.isFinite(Number(skill.rate)), `${prefix}: rateが不正です`);
        addCheck(report, 'catalog', Number.isFinite(Number(skill.count)) && Number(skill.count) >= 0, `${prefix}: countが不正です`);
        addCheck(report, 'catalog', !skill.elm || validElements.has(skill.elm), `${prefix}: 未定義属性「${skill.elm}」`);
        addCheck(report, 'catalog', Number(skill.turn || 1) > 0, `${prefix}: 持続ターンが不正です`);
    }
    for (const monster of monsters) {
        for (const action of monster.acts || []) {
            const id = Number(action?.id ?? action);
            addCheck(report, 'catalog', [1, 2, 9].includes(id) || skillIds.has(id), `${monster.name}: 行動ID ${id} が特技データに存在しません`);
            const condition = Number(action?.condition || 0);
            addCheck(report, 'catalog', [0, 1, 2, 3].includes(condition), `${monster.name}: 未定義の行動条件 ${condition}`);
        }
    }

    let executedSkills = 0;
    for (const skill of skills) {
        const actor = createUnit('skill-actor');
        const ally = createUnit('skill-ally', { hp: 250, mp: 100, battleStatus: { buffs: {}, debuffs: { atk: { val: 0.5, turns: 2 } }, ailments: { Poison: { turns: 2 } } } });
        const deadAlly = createUnit('skill-dead', { hp: 0, isDead: true });
        const enemy = createUnit('skill-enemy', { hp: 100000, baseMaxHp: 100000 });
        Battle.party = [actor, ally, deadAlly];
        Battle.enemies = [enemy];
        const support = Battle.isSupportSkill(skill);
        let target = support ? ally : enemy;
        if (skill.type === '蘇生') target = deadAlly;
        if (skill.target === '自分') target = actor;
        if (skill.target === '全体') target = support ? 'all_ally' : 'all_enemy';
        if (skill.target === 'ランダム') target = 'random';
        try {
            await Battle.processAction({ type: 'skill', actor, data: skill, target, targetScope: skill.target, isEnemy: false });
            executedSkills += 1;
            addCheck(report, 'skill-execution', Number.isFinite(actor.hp) && Number.isFinite(actor.mp), `ID ${skill.id} ${skill.name}: 使用者のHP/MPが非数になりました`);
            for (const targetUnit of [ally, deadAlly, enemy]) {
                addCheck(report, 'skill-execution', Number.isFinite(targetUnit.hp) && Number.isFinite(targetUnit.mp), `ID ${skill.id} ${skill.name}: 対象のHP/MPが非数になりました`);
            }
        } catch (error) {
            addCheck(report, 'skill-execution', false, `ID ${skill.id} ${skill.name}: 実行例外 ${error.message}`);
        }
    }

    const enemy = createUnit('auto-enemy', { hp: 5000, baseMaxHp: 5000 });
    const attack = { id: 9001, name: '監査攻撃', type: '物理', target: '単体', mp: 10, rate: 2, count: 1, base: 10 };
    const heal = { id: 9002, name: '監査回復', type: '回復', target: '単体', mp: 8, rate: 1, count: 1, base: 100 };
    const revive = { id: 9003, name: '監査蘇生', type: '蘇生', target: '単体', mp: 12, rate: 0.5, count: 1, base: 0 };
    const debuff = { id: 9004, name: '監査弱体', type: '弱体', target: '単体', mp: 6, rate: 0, count: 0, base: 0, debuff: { atk: 0.5 } };
    const autoActor = createUnit('auto-actor', { skills: [attack, heal, revive, debuff] });
    registry.set(autoActor.uid, autoActor);
    Battle.party = [autoActor];
    Battle.enemies = [enemy];
    for (const strategy of ['allout', 'balanced', 'conserve', 'tricky', 'defensive', 'no_mp']) {
        autoActor.config.strategy = strategy;
        const action = Battle.decideAutoAction(autoActor);
        addCheck(report, 'auto-ai', !!action && ['attack', 'skill', 'defend'].includes(action.type), `${strategy}: 有効な行動を返しません`);
        if (strategy === 'no_mp') addCheck(report, 'auto-ai', action.type === 'attack', 'ＭＰつかうながMP技を選びました');
    }
    autoActor.config.strategy = 'balanced';
    autoActor.config.hiddenSkills = [attack.id];
    autoActor.config.autoDisabledSkills = [];
    addCheck(report, 'skill-settings', Battle.getValidAutoSkills(autoActor).some(skill => skill.id === attack.id), 'メニュー非表示の技がオートからも除外されています');
    autoActor.config.hiddenSkills = [];
    autoActor.config.autoDisabledSkills = [attack.id];
    addCheck(report, 'skill-settings', !Battle.getValidAutoSkills(autoActor).some(skill => skill.id === attack.id), 'オート使用否の技がAI候補に残っています');
    autoActor.config.autoDisabledSkills = [];
    autoActor.battleStatus.ailments.SpellSeal = { turns: 2 };
    addCheck(report, 'auto-ai', !Battle.getValidAutoSkills(autoActor).some(skill => ['魔法', '強化', '弱体'].includes(skill.type)), '呪文封印中に呪文系候補が残っています');
    autoActor.battleStatus.ailments = { SkillSeal: { turns: 2 } };
    addCheck(report, 'auto-ai', !Battle.getValidAutoSkills(autoActor).some(skill => ['物理', '特殊'].includes(skill.type)), '特技封印中に物理・特殊候補が残っています');
    autoActor.battleStatus.ailments = { HealSeal: { turns: 2 } };
    const mpHeal = { id: 9005, name: '監査MP回復', type: 'MP回復', target: '単体', mp: 0, rate: 0, count: 1, base: 40 };
    autoActor.skills.push(mpHeal);
    addCheck(report, 'auto-ai', !Battle.getValidAutoSkills(autoActor).some(skill => ['回復', '蘇生', 'MP回復'].includes(skill.type)), '回復封印中に回復・蘇生・MP回復候補が残っています');

    autoActor.battleStatus.ailments = {};
    const partyHeal = { id: 9006, name: '監査全体回復', type: '回復', target: '全体', mp: 12, rate: 0.6, count: 1, base: 20 };
    autoActor.skills = [heal, partyHeal, mpHeal];
    autoActor.hp = 200;
    const hurtAlly = createUnit('hurt-ally', { hp: 200 });
    Battle.party = [autoActor, hurtAlly];
    let healAction = Battle.chooseAutoHealAction(autoActor, autoActor.skills, 0.7);
    addCheck(report, 'auto-ai', healAction?.data?.id === partyHeal.id && healAction.target === 'all_ally', '複数人負傷時に全体HP回復を優先しません');
    hurtAlly.hp = hurtAlly.baseMaxHp;
    healAction = Battle.chooseAutoHealAction(autoActor, autoActor.skills, 0.7);
    addCheck(report, 'auto-ai', healAction?.data?.id === heal.id && healAction.target === autoActor, '単体負傷時に適切な単体HP回復を選びません');
    addCheck(report, 'auto-ai', healAction?.data?.type !== 'MP回復', 'HP回復判断でMP回復技を選びました');

    const aiSkillHigh = { id: 9101, name: '高HP時技', type: '物理', target: '単体', mp: 1, rate: 1, count: 1, base: 0 };
    const aiSkillLow = { id: 9102, name: '低HP時技', type: '物理', target: '単体', mp: 1, rate: 1, count: 1, base: 0 };
    const aiSpell = { id: 9103, name: '封印確認魔法', type: '魔法', target: '単体', mp: 1, rate: 1, count: 1, base: 0 };
    DB.SKILLS.push(aiSkillHigh, aiSkillLow, aiSpell);
    const aiEnemy = createUnit('enemy-ai', { hp: 800, baseMaxHp: 1000, acts: [{ id: 9101, rate: 100, condition: 1 }, { id: 9102, rate: 100, condition: 2 }] });
    Battle.enemies = [aiEnemy];
    addCheck(report, 'enemy-ai', Battle.decideEnemyAction(aiEnemy).data?.id === 9101, 'HP50%以上の条件行動が選択されません');
    aiEnemy.hp = 200;
    addCheck(report, 'enemy-ai', Battle.decideEnemyAction(aiEnemy).data?.id === 9102, 'HP50%以下の条件行動が選択されません');
    aiEnemy.acts = [{ id: 9103, rate: 100 }];
    aiEnemy.battleStatus.ailments = { SpellSeal: { turns: 2 } };
    addCheck(report, 'enemy-ai', Battle.decideEnemyAction(aiEnemy).type === 'enemy_attack', '呪文封印中の敵が魔法を選択しました');
    aiEnemy.battleStatus.ailments = {};
    aiEnemy.mp = 0;
    addCheck(report, 'enemy-ai', Battle.decideEnemyAction(aiEnemy).type === 'enemy_attack', 'MP不足の敵が魔法を選択しました');
    const queuedAttack = { isEnemy: true, type: 'skill', actor: aiEnemy, data: aiSkillHigh };
    aiEnemy.mp = 100;
    addCheck(report, 'enemy-ai', !Battle.shouldReevaluateEnemyCommand(queuedAttack), '有効な攻撃行動を実行直前に再抽選します');
    const queuedHeal = { isEnemy: true, type: 'skill', actor: aiEnemy, data: heal };
    aiEnemy.hp = aiEnemy.baseMaxHp;
    addCheck(report, 'enemy-ai', Battle.shouldReevaluateEnemyCommand(queuedHeal), '全快後も不要になった回復行動を維持します');

    const statusUnit = createUnit('status-unit', { hp: 1000, mp: 0 });
    statusUnit.battleStatus.buffs.atk = { val: 1.5, turns: 1 };
    statusUnit.battleStatus.debuffs.def = { val: 0.5, turns: 2 };
    statusUnit.battleStatus.ailments.Poison = { turns: 1 };
    Battle.party = [statusUnit];
    Battle.enemies = [];
    addCheck(report, 'status', Battle.getBattleStat(statusUnit, 'atk') === 360, '攻撃力バフ1.5倍が反映されません');
    addCheck(report, 'status', Battle.getBattleStat(statusUnit, 'def') === 60, '防御力デバフ0.5倍が反映されません');
    await Battle.processEndOfRound();
    addCheck(report, 'status', !statusUnit.battleStatus.buffs.atk && !statusUnit.battleStatus.ailments.Poison, '残り1ターンの効果が終了しません');
    addCheck(report, 'status', statusUnit.battleStatus.debuffs.def?.turns === 1, '残り2ターンの効果が正しく減りません');
    statusUnit.hp = statusUnit.baseMaxHp;
    statusUnit.battleStatus.ailments = { Poison: { turns: 3 } };
    await Battle.onActionEnd(statusUnit);
    addCheck(report, 'status', statusUnit.hp === 950, `毒ダメージが最大HPの5%ではありません (${statusUnit.hp})`);
    statusUnit.hp = statusUnit.baseMaxHp;
    statusUnit.battleStatus.ailments = { ToxicPoison: { turns: 3 } };
    await Battle.onActionEnd(statusUnit);
    addCheck(report, 'status', statusUnit.hp === 900, `猛毒ダメージが最大HPの10%ではありません (${statusUnit.hp})`);
    statusUnit.hp = statusUnit.baseMaxHp;
    statusUnit.battleStatus.ailments = { Shock: { turns: 3 } };
    await Battle.onActionEnd(statusUnit);
    addCheck(report, 'status', statusUnit.hp === 850, `感電ダメージが最大HPの15%ではありません (${statusUnit.hp})`);

    const mdefUnit = createUnit('mdef-unit', { mdef: 333, mag: 999 });
    addCheck(report, 'battle-stats', Battle.getBattleStat(mdefUnit, 'mdef') === 333, '戦闘中の魔法防御が計算済み値を参照しません');
    const fallbackMdefUnit = createUnit('mdef-fallback', { mdef: 0, mag: 999 });
    fallbackMdefUnit.getStat = key => key === 'mdef' ? 444 : fallbackMdefUnit[key] || 0;
    addCheck(report, 'battle-stats', Battle.getBattleStat(fallbackMdefUnit, 'mdef') === 444, '魔法防御がgetStat値より旧mag代替値を優先します');

    const regenUnit = createUnit('regen-unit', { hp: 500, mp: 400 });
    regenUnit.battleStatus.buffs.HPRegen = { val: 0.1, turns: 2 };
    regenUnit.battleStatus.buffs.MPRegen = { val: 0.1, turns: 2 };
    Battle.party = [regenUnit];
    Battle.enemies = [];
    await Battle.onActionEnd(regenUnit);
    addCheck(report, 'status', regenUnit.hp === 500 && regenUnit.mp === 400, '毎ターン回復が行動終了ごとに発生します');
    await Battle.processEndOfRound();
    addCheck(report, 'status', regenUnit.hp === 600 && regenUnit.mp === 500, '毎ターン回復がターン終了時に1回だけ発生しません');

    const debuffSkill = { id: 9201, name: '成功率監査弱体', type: '弱体', target: '単体', mp: 0, rate: 0, count: 1, base: 0, SuccessRate: 70, debuff: { atk: 0.5 } };
    const procActor = createUnit('proc-actor');
    const procTarget = createUnit('proc-target', { resists: { Debuff: 20 } });
    Battle.party = [procActor];
    Battle.enemies = [procTarget];
    rt.setRandom(0.49);
    await Battle.processAction({ type: 'skill', actor: procActor, data: debuffSkill, target: procTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'status-proc', !!procTarget.battleStatus.debuffs.atk, '成功率70%-耐性20%=50%の49%抽選が失敗しました');
    addCheck(report, 'status-proc', rt.getRandomCallCount() === 1, `弱体成功率が複数回抽選されました (${rt.getRandomCallCount()}回)`);
    procTarget.battleStatus.debuffs = {};
    rt.setRandom(0.50);
    await Battle.processAction({ type: 'skill', actor: procActor, data: debuffSkill, target: procTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'status-proc', !procTarget.battleStatus.debuffs.atk, '成功率70%-耐性20%=50%の50%抽選が成功しました');

    const dualMpSkill = { id: 9202, name: '二刀MP回復監査', type: 'MP回復', target: '自分', mp: 0, rate: 0, count: 1, base: 10, SuccessRate: 100 };
    const dualActor = createUnit('dual-actor', {
        mp: 0,
        traits: [{ id: 8, level: 1 }],
        equips: { main: { type: '武器' }, sub: { type: '武器' } }
    });
    Battle.party = [dualActor];
    Battle.enemies = [];
    rt.setRandom(0.1);
    await Battle.processAction({ type: 'skill', actor: dualActor, data: dualMpSkill, target: dualActor, targetScope: '自分', isEnemy: false });
    addCheck(report, 'traits', dualActor.mp === 20, `二刀流時のMP回復が2回発動しません (${dualActor.mp})`);
    dualActor.mp = 0;
    dualActor.equips.sub = null;
    await Battle.processAction({ type: 'skill', actor: dualActor, data: dualMpSkill, target: dualActor, targetScope: '自分', isEnemy: false });
    addCheck(report, 'traits', dualActor.mp === 10, `副武器なしで二刀流が発動しました (${dualActor.mp})`);

    const expandedBattleItems = items.filter(item => item.id >= 1000 && item.id < 1100 && item.battleUsable !== false && item.effectKind);
    const recognizedEffects = new Set(['damage', 'partyMp', 'partyHp', 'buff', 'debuff', 'camp']);
    for (const item of expandedBattleItems) {
        addCheck(report, 'items', recognizedEffects.has(item.effectKind), `ID ${item.id} ${item.name}: 未定義effectKind「${item.effectKind}」`);
    }
    const itemActor = createUnit('item-actor');
    const itemEnemy = createUnit('item-enemy');
    Battle.party = [itemActor];
    Battle.enemies = [itemEnemy];
    for (const item of expandedBattleItems.filter(item => item.effectKind !== 'camp')) {
        App.data.items = { [item.id]: 1 };
        try {
            const target = item.target === '全体' ? (item.effectKind === 'damage' || item.effectKind === 'debuff' ? 'all_enemy' : 'all_ally')
                : (item.effectKind === 'damage' || item.effectKind === 'debuff' ? itemEnemy : itemActor);
            const result = ItemRuntime.applyBattleItem({ Battle, App, item, command: { actor: itemActor, target } });
            addCheck(report, 'items', result && result.handled === true, `ID ${item.id} ${item.name}: 戦闘使用が処理されません`);
        } catch (error) {
            addCheck(report, 'items', false, `ID ${item.id} ${item.name}: 実行例外 ${error.message}`);
        }
    }

    const mainSource = read('main.js');
    const alliesSource = read('menus_allies.js');
    const fieldSkillsSource = read('menus_skills.js');
    const battleSource = read('battle.js');
    const statusMenuSource = read('menus_status.js');
    addCheck(report, 'skill-settings', mainSource.includes('skillUsageConfigVersion: 2') && mainSource.includes('autoDisabledSkills'), '設定v2の旧セーブ移行がありません');
    addCheck(report, 'skill-settings', alliesSource.includes('toggleSkillAutoUsage') && alliesSource.includes('toggleSkillVisibility'), '仲間メニューに独立した2設定がありません');
    const polishSource = read('modern-polish.css');
    addCheck(report, 'skill-settings', alliesSource.includes('skill-usage-toggle') && polishSource.includes('.skill-usage-toggle.is-enabled') && polishSource.includes('background: #ffd700 !important'), 'スキル設定の有効状態が黄色表示になっていません');
    addCheck(report, 'skill-settings', fieldSkillsSource.includes('hiddenIds.has(Number(s.id))'), '非戦闘スキルメニューが非表示設定を参照していません');
    addCheck(report, 'skill-settings', battleSource.includes('autoDisabledIds.includes(sId)'), 'オートAIがオート使用否設定を参照していません');
    addCheck(report, 'menu-ui', statusMenuSource.includes("active ? '#ffd700' : '#111'") && statusMenuSource.includes("active ? '#000' : '#777'"), '戦歴メニューの選択タブが黄色表示になっていません');
    addCheck(report, 'menu-ui', statusMenuSource.includes("MenuStatus.setTab('record')") && statusMenuSource.includes("MenuStatus.setTab('quests')"), '戦歴メニューの記録／クエスト切替がありません');

    addCheck(report, 'regression-guards', !battleSource.includes("getSumValue(targetToHit, 'preempt_rate_base'") &&
        !battleSource.includes("getSumValue(targetToHit, 'counter_rate_base'") &&
        !battleSource.includes("getSumValue(p, 'chain_rate_base'"), '発動率特性が誤った_baseキーを参照しています');
    addCheck(report, 'regression-guards', !battleSource.includes("targetToHit.passive?.finRed10") && !battleSource.includes('targetToHit.passive.finRed10'), '被ダメージ軽減+10%が戦闘中に二重適用されます');
    addCheck(report, 'regression-guards', battleSource.includes('cmd.speed = Number(cmd.speed || 0) + (10 * 100000)'), '最速行動が優先度+10ではありません');
    addCheck(report, 'regression-guards', battleSource.includes('activatedCoverers'), 'かばう候補をパーティ全員から判定していません');
    addCheck(report, 'regression-guards', mainSource.includes('other.currentHp ?? other.hp ?? 0'), '戦闘不能者の隊列オーラをcurrentHpで除外していません');

    const normalTrash = monsters.filter(monster => !monster.isChestTrap && !monster.isRare && !monster.isBoss && !monster.isSpecialBoss && !monster.isEstark);
    addCheck(report, 'drops', normalTrash.every(monster => Number(monster.drops?.normal?.rate) >= 12 && Number(monster.drops?.normal?.rate) <= 15), '通常雑魚の通常ドロップ率が12-15%外です');
    addCheck(report, 'drops', normalTrash.every(monster => Number(monster.drops?.rare?.rate) >= 2 && Number(monster.drops?.rare?.rate) <= 5), '通常雑魚のレアドロップ率が2-5%外です');
    addCheck(report, 'drops', Battle.getConfiguredDropRate({ rate: 12 }, 3) === 15, '設定ドロップ率と特性補正を正しく合算しません');
    rt.setRandom(0.1499);
    addCheck(report, 'drops', Battle.rollConfiguredDrop({ rate: 12 }, 3), '15%設定の14.99%抽選が失敗しました');
    rt.setRandom(0.15);
    addCheck(report, 'drops', !Battle.rollConfiguredDrop({ rate: 12 }, 3), '15%設定の15.00%抽選が成功しました');

    report.metrics = {
        skills: skills.length - 3,
        executedSkills,
        monsters: monsters.length,
        monsterActionReferences: monsters.reduce((sum, monster) => sum + (monster.acts || []).length, 0),
        expandedBattleItems: expandedBattleItems.length,
        strategies: 6,
        errors: report.errors.length,
        warnings: report.warnings.length
    };
    return report;
}

function formatReport(report) {
    const lines = [];
    lines.push('# 戦闘ロジック監査結果');
    lines.push('');
    lines.push(`結果: ${report.errors.length === 0 ? 'PASS' : 'FAIL'} / エラー ${report.errors.length} / 警告 ${report.warnings.length}`);
    lines.push('');
    lines.push('## 対象');
    lines.push('');
    for (const [key, value] of Object.entries(report.metrics)) lines.push(`- ${key}: ${value}`);
    lines.push('');
    lines.push('## 検証区分');
    lines.push('');
    for (const [name, section] of Object.entries(report.sections)) lines.push(`- ${name}: ${section.checks - section.failures}/${section.checks}`);
    if (report.errors.length) {
        lines.push('', '## エラー', '');
        report.errors.forEach(message => lines.push(`- ${message}`));
    }
    if (report.warnings.length) {
        lines.push('', '## 警告', '');
        report.warnings.forEach(message => lines.push(`- ${message}`));
    }
    return `${lines.join('\n')}\n`;
}

if (require.main === module) {
    runAudit().then(report => {
        const markdown = formatReport(report);
        if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
        else console.log(markdown);
        if (report.errors.length) process.exitCode = 1;
    }).catch(error => {
        console.error(error.stack || error);
        process.exitCode = 1;
    });
}

module.exports = { createUnit, loadRuntime, runAudit, formatReport };
