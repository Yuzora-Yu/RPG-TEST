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
    for (const file of ['skills.js', 'items.js', 'monsters.js', 'chest-mimics.js', 'monster-drop-policy.js', 'item_runtime.js']) {
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
        PassiveSkill: runtimeContext.PassiveSkill,
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
        const actionSignatures = new Set();
        for (const action of monster.acts || []) {
            const id = Number(action?.id ?? action);
            addCheck(report, 'catalog', [1, 2, 9].includes(id) || skillIds.has(id), `${monster.name}: 行動ID ${id} が特技データに存在しません`);
            const condition = Number(action?.condition || 0);
            addCheck(report, 'catalog', [0, 1, 2, 3].includes(condition), `${monster.name}: 未定義の行動条件 ${condition}`);
            const signature = `${id}@${condition}`;
            addCheck(report, 'catalog', !actionSignatures.has(signature),
                `${monster.name}: 同一行動ID・条件が重複しています (${signature})`);
            actionSignatures.add(signature);
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
    const randomAuditSkill = { id: 9013, name: 'ランダム期待値監査', type: '物理', target: 'ランダム', mp: 1, rate: 1, count: 3, base: 0 };
    const reliableAuditSkill = { id: 9014, name: '単体期待値監査', type: '物理', target: '単体', mp: 1, rate: 1, count: 1, base: 0 };
    const randomTargetA = createUnit('random-target-a');
    const randomTargetB = createUnit('random-target-b');
    const originalEstimateAutoDamage = Battle.estimateAutoDamage;
    Battle.estimateAutoDamage = (_actor, skill, target) => {
        if (!skill) return 1;
        if (skill === randomAuditSkill) return target === randomTargetA ? 1000 : 0;
        if (skill === reliableAuditSkill) return 600;
        return 0;
    };
    const conservativeChoice = Battle.pickConservativeAutoAction(autoActor, [randomAuditSkill, reliableAuditSkill], [randomTargetA, randomTargetB]);
    addCheck(report, 'auto-ai', conservativeChoice?.skill === reliableAuditSkill,
        'MP温存AIがランダム攻撃を最良対象への全段命中として過大評価します');
    Battle.estimateAutoDamage = originalEstimateAutoDamage;
    autoActor.config.strategy = 'balanced';
    autoActor.config.hiddenSkills = [attack.id];
    autoActor.config.autoDisabledSkills = [];
    addCheck(report, 'skill-settings', Battle.getValidAutoSkills(autoActor).some(skill => skill.id === attack.id), 'メニュー非表示の技がオートからも除外されています');
    autoActor.config.hiddenSkills = [];
    autoActor.config.autoDisabledSkills = [attack.id];
    addCheck(report, 'skill-settings', !Battle.getValidAutoSkills(autoActor).some(skill => skill.id === attack.id), 'オート使用否の技がAI候補に残っています');
    autoActor.config.autoDisabledSkills = [];
    const regenSkill = { id: 9012, name: '監査再生', type: '特殊', target: '全体', mp: 5, rate: 0, count: 1, base: 0, HPRegen: 0.1 };
    addCheck(report, 'auto-ai', !Battle.isAutoOffensiveSkill(regenSkill),
        'HP再生補助技が攻撃技として評価されています');
    addCheck(report, 'auto-ai', !Battle.isAutoOffensiveSkill({ id: 2, type: '特殊' }) && !Battle.isAutoOffensiveSkill({ id: 9, type: '特殊' }),
        '防御・逃走の予約IDが攻撃技候補に分類されています');
    autoActor.battleStatus.ailments.SpellSeal = { turns: 2 };
    addCheck(report, 'auto-ai', !Battle.getValidAutoSkills(autoActor).some(skill => ['魔法', '強化', '弱体'].includes(skill.type)), '呪文封印中に呪文系候補が残っています');
    autoActor.battleStatus.ailments = { SkillSeal: { turns: 2 } };
    addCheck(report, 'auto-ai', !Battle.getValidAutoSkills(autoActor).some(skill => ['物理', '特殊'].includes(skill.type)), '特技封印中に物理・特殊候補が残っています');
    autoActor.battleStatus.ailments = { HealSeal: { turns: 2 } };
    const mpHeal = { id: 9005, name: '監査MP回復', type: 'MP回復', target: '単体', mp: 0, rate: 0, count: 1, base: 40 };
    autoActor.skills.push(mpHeal, regenSkill);
    addCheck(report, 'auto-ai', !Battle.getValidAutoSkills(autoActor).some(skill => Battle.isHealSealBlockedSkill(skill)),
        '回復封印中に回復・蘇生・MP回復・継続回復候補が残っています');

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

    autoActor.hp = 200;
    hurtAlly.hp = 900;
    const mildlyHurtAlly = createUnit('mildly-hurt-ally', { hp: 900 });
    Battle.party = [autoActor, hurtAlly, mildlyHurtAlly];
    healAction = Battle.chooseAutoHealAction(autoActor, autoActor.skills, 0.7);
    addCheck(report, 'auto-ai', healAction?.data?.id === partyHeal.id && healAction.target === 'all_ally',
        '一人が重傷・他の全員も負傷している状況で、軽傷者の欠損を無視して単体回復を選びます');

    const weakRevive = { id: 9007, name: '監査弱蘇生', type: '蘇生', target: '単体', mp: 10, rate: 0.5, count: 1, base: 0 };
    const strongRevive = { id: 9008, name: '監査強蘇生', type: '蘇生', target: '単体', mp: 20, rate: 1, count: 1, base: 0 };
    const deadForAuto = createUnit('dead-for-auto', { hp: 0, isDead: true });
    autoActor.mp = 100;
    let reviveAction = Battle.chooseAutoReviveAction(autoActor, [weakRevive, strongRevive], [deadForAuto], 'balanced');
    addCheck(report, 'auto-ai', reviveAction?.data?.id === strongRevive.id,
        '通常作戦の蘇生AIが復帰HPを評価せず、先頭の弱い蘇生技を選びました');

    const selfMpRecovery = { id: 9009, name: '監査自己MP回復', type: 'MP回復', target: '自分', mp: 0, rate: 0, count: 1, base: 0, ratio: 0.5 };
    autoActor.skills = [selfMpRecovery];
    autoActor.config.strategy = 'balanced';
    autoActor.hp = autoActor.baseMaxHp;
    autoActor.mp = 10;
    Battle.party = [autoActor];
    Battle.enemies = [enemy];
    const mpRecoveryAction = Battle.decideAutoAction(autoActor);
    addCheck(report, 'auto-ai', mpRecoveryAction?.data?.id === selfMpRecovery.id && mpRecoveryAction.target === autoActor,
        '低MP時に自己MP回復技をオート選択しません');

    const allyMpRecovery = { id: 9012, name: '監査単体MP回復', type: 'MP回復', target: '単体', mp: 2, rate: 0, count: 1, base: 80 };
    const lowMpAlly = createUnit('low-mp-ally', { mp: 5, baseMaxMp: 500 });
    autoActor.mp = autoActor.baseMaxMp;
    Battle.party = [autoActor, lowMpAlly];
    const allyMpAction = Battle.chooseAutoMpRecoveryAction(autoActor, [allyMpRecovery], 0.20);
    addCheck(report, 'auto-ai', allyMpAction?.data?.id === allyMpRecovery.id && allyMpAction.target === lowMpAlly,
        '使用者のMPが十分だと、枯渇した仲間へのMP回復を選びません');

    const wrongCure = { id: 9013, name: '監査封印治療', type: '特殊', target: '単体', mp: 1, cures: ['SpellSeal'] };
    const poisonCure = { id: 9014, name: '監査毒治療', type: '特殊', target: '単体', mp: 2, cures: ['Poison', 'ToxicPoison'] };
    lowMpAlly.battleStatus.ailments = { Poison: { turns: 3 } };
    const matchedCureAction = Battle.chooseAutoCureAction(autoActor, [wrongCure, poisonCure], [autoActor, lowMpAlly]);
    addCheck(report, 'auto-ai', matchedCureAction?.data?.id === poisonCure.id && matchedCureAction.target === lowMpAlly,
        '対象の異常と治療内容を照合せず、効果のない治療技を選びます');

    const targetA = createUnit('target-a', { hp: 300, baseMaxHp: 1000 });
    const targetB = createUnit('target-b', { hp: 900, baseMaxHp: 1000 });
    const savedEstimateAutoDamage = Battle.estimateAutoDamage;
    Battle.estimateAutoDamage = (_actor, _skill, target) => target === targetB ? 800 : 100;
    rt.setRandom(0);
    const targetAction = Battle.chooseAutoOffensiveAction(autoActor, [attack], [targetA, targetB], 'balanced');
    addCheck(report, 'auto-ai', targetAction?.target === targetB,
        '攻撃AIの評価対象と実行対象が一致していません');
    Battle.estimateAutoDamage = savedEstimateAutoDamage;

    const statusOnlySkill = { id: 9015, name: '監査毒付与', type: '特殊', target: '単体', mp: 2, rate: 0, count: 1, base: 0, Poison: 100 };
    const statusEstimate = Battle.estimateAutoDamage(autoActor, statusOnlySkill, targetA);
    addCheck(report, 'auto-ai', statusEstimate === 0,
        `ダメージを与えない状態技を攻撃ダメージとして評価しました (${statusEstimate})`);
    const statusOnlyAction = Battle.chooseAutoOffensiveAction(autoActor, [statusOnlySkill], [targetA], 'balanced');
    addCheck(report, 'auto-ai', statusOnlyAction?.type === 'attack',
        '通常作戦がダメージ技の代わりに状態付与だけの技を高火力技として選びます');

    const elementalSkill = { id: 9016, name: '監査火炎', type: '魔法', target: '単体', mp: 2, rate: 2, count: 1, base: 50, elm: '火' };
    const immuneTarget = createUnit('immune-target', { elmRes: { 火: 100 } });
    addCheck(report, 'auto-ai', Battle.estimateAutoDamage(autoActor, elementalSkill, immuneTarget) === 0,
        '属性無効の対象へダメージが通ると誤評価します');
    immuneTarget.battleStatus.debuffs.elmResDown = { val: 40, turns: 3 };
    addCheck(report, 'auto-ai', Battle.estimateAutoDamage(autoActor, elementalSkill, immuneTarget) > 0,
        '戦闘中の属性耐性低下を攻撃評価へ反映しません');

    const cureSkill = { id: 9010, name: '監査治療', type: '特殊', target: '単体', mp: 1, rate: 0, count: 0, base: 0, CureAilments: true };
    autoActor.skills = [cureSkill];
    autoActor.mp = 100;
    autoActor.battleStatus.ailments = {};
    const curedCommand = { type: 'skill', actor: autoActor, target: autoActor, data: cureSkill, targetScope: '単体', isAuto: true };
    addCheck(report, 'auto-ai', Battle.shouldReevaluateAutoCommand(curedCommand),
        '状態異常が先に治った後も治療技を無駄撃ちします');
    autoActor.battleStatus.ailments = { SpellSeal: { turns: 2 } };
    const spellCommand = { type: 'skill', actor: autoActor, target: targetA, data: { ...attack, id: 9011, type: '魔法' }, targetScope: '単体', isAuto: true };
    autoActor.skills = [spellCommand.data];
    addCheck(report, 'auto-ai', Battle.shouldReevaluateAutoCommand(spellCommand),
        '行動決定後に呪文封印を受けてもオート行動を再判断しません');
    autoActor.battleStatus.ailments = {};

    const aiSkillHigh = { id: 9101, name: '高HP時技', type: '物理', target: '単体', mp: 1, rate: 1, count: 1, base: 0 };
    const aiSkillLow = { id: 9102, name: '低HP時技', type: '物理', target: '単体', mp: 1, rate: 1, count: 1, base: 0 };
    const aiSpell = { id: 9103, name: '封印確認魔法', type: '魔法', target: '単体', mp: 1, rate: 1, count: 1, base: 0 };
    const aiHeal = { id: 9104, name: '敵AI監査回復', type: '回復', target: '単体', mp: 1, rate: 1, count: 1, base: 100 };
    const aiBuff = { id: 9105, name: '敵AI監査強化', type: '強化', target: '単体', mp: 1, rate: 0, count: 1, base: 0, buff: { atk: 1.5 }, turn: 4 };
    DB.SKILLS.push(aiSkillHigh, aiSkillLow, aiSpell, aiHeal, aiBuff);
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

    const healthyEnemy = createUnit('healthy-enemy', { hp: 1000, baseMaxHp: 1000 });
    const criticalEnemy = createUnit('critical-enemy', { hp: 150, baseMaxHp: 1000 });
    Battle.enemies = [aiEnemy, healthyEnemy, criticalEnemy];
    addCheck(report, 'enemy-ai', Battle.chooseEnemySupportTarget(aiEnemy, aiHeal) === criticalEnemy,
        '敵の単体回復がHP割合の最も低い味方を選びません');
    criticalEnemy.hp = 990;
    addCheck(report, 'enemy-ai', !Battle.isEnemySkillContextuallyUseful(aiEnemy, aiHeal),
        '敵が軽微なHP欠損だけで単体回復を選びます');
    aiEnemy.battleStatus.buffs.atk = { val: 1.5, turns: 3 };
    healthyEnemy.battleStatus.buffs.atk = { val: 1.5, turns: 3 };
    criticalEnemy.battleStatus.buffs.atk = { val: 1.5, turns: 3 };
    addCheck(report, 'enemy-ai', !Battle.isEnemySkillContextuallyUseful(aiEnemy, aiBuff),
        '敵が十分な残りターンの同一強化を重ね掛けします');

    aiEnemy.hp = 400;
    aiEnemy.acts = [{ id: 1, rate: 70 }, { id: 9104, rate: 30 }];
    rt.setRandom(0.75);
    addCheck(report, 'enemy-ai', Battle.decideEnemyAction(aiEnemy).data?.id === aiHeal.id,
        'モンスターデータの行動率がAI内部の攻撃偏重補正で歪められています');

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
    const sealResistUnit = createUnit('seal-resist-unit', { resists: { SpellSeal: 10 } });
    sealResistUnit.battleStatus.buffs.resists_Seal = { val: 80, turns: 3 };
    const sealResists = Battle.getBattleStat(sealResistUnit, 'resists');
    addCheck(report, 'battle-stats', sealResists.SpellSeal === 90 && sealResists.SkillSeal === 80 && sealResists.HealSeal === 80,
        '共通封印耐性が呪文・特技・回復封印の成功判定へ反映されません');

    const resistanceBuffSkill = { id: 9204, name: '状態耐性監査', type: '強化', target: '単体', mp: 0, rate: 0, count: 1, base: 0, buff: { resists_Poison: 80, resists_Seal: 80 }, turn: 3 };
    const resistanceActor = createUnit('resistance-actor');
    const resistanceTarget = createUnit('resistance-target');
    Battle.party = [resistanceActor, resistanceTarget];
    Battle.enemies = [];
    rt.setRandom(0);
    await Battle.processAction({ type: 'skill', actor: resistanceActor, data: resistanceBuffSkill, target: resistanceTarget, targetScope: '単体', isEnemy: false });
    const appliedResists = Battle.getBattleStat(resistanceTarget, 'resists');
    addCheck(report, 'battle-stats', appliedResists.Poison === 80 && appliedResists.SpellSeal === 80,
        `状態耐性強化が加算百分率として反映されません (${JSON.stringify(appliedResists)})`);
    const weakerResistanceBuff = { ...resistanceBuffSkill, id: 9205, buff: { resists_Poison: 20, resists_Seal: 20 }, turn: 1 };
    await Battle.processAction({ type: 'skill', actor: resistanceActor, data: weakerResistanceBuff, target: resistanceTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'battle-stats', resistanceTarget.battleStatus.buffs.resists_Poison.val === 80 && resistanceTarget.battleStatus.buffs.resists_Poison.turns === 3,
        '弱い状態耐性強化が、強い既存効果または残り時間を上書きします');

    const generatedEnemy = createUnit('generated-enemy', {
        id: 200001, baseId: 200001, hp: 4321, baseMaxHp: 9000, mp: 77, baseMaxMp: 333,
        atk: 901, def: 802, mdef: 703, spd: 604, mag: 505, hit: 123, eva: 24, cri: 15,
        exp: 4567, gold: 890, actCount: 2, acts: [{ id: 501, rate: 70 }, { id: 1, rate: 30 }],
        rank: 210, generatedFloor: 240, traits: [{ id: 18, level: 3 }], passive: { drain: true },
        elmRes: { 火: 35 }, resists: { Fear: 60 }, isRiftEnemy: true,
        battleStatus: { buffs: { atk: { val: 1.5, turns: 2 } }, debuffs: {}, ailments: { Poison: { turns: 2 } } }
    });
    const enemySnapshot = Battle.serializeEnemyState(generatedEnemy);
    const restoredEnemy = createUnit('restored-enemy', { baseStats: { atk: 1, def: 1, mdef: 1, spd: 1, mag: 1 } });
    Battle.restoreEnemyState(restoredEnemy, enemySnapshot, { id: 200001, exp: 1, gold: 1 });
    addCheck(report, 'battle-stats', restoredEnemy.hp === 4321 && restoredEnemy.mp === 77
        && restoredEnemy.baseMaxMp === 333 && restoredEnemy.atk === 901 && restoredEnemy.mdef === 703
        && restoredEnemy.actCount === 2 && restoredEnemy.acts.length === 2
        && restoredEnemy.exp === 4567 && restoredEnemy.gold === 890
        && restoredEnemy.elmRes.火 === 35 && restoredEnemy.resists.Fear === 60
        && restoredEnemy.battleStatus.ailments.Poison.turns === 2 && restoredEnemy.isRiftEnemy,
    '戦闘中断復帰で生成敵のMP・能力・行動・耐性・報酬・状態変化を完全復元できません');
    addCheck(report, 'drops', Battle.getEnemyRewardValue(restoredEnemy, { exp: 10, gold: 20 }, 'exp') === 4567
        && Battle.getEnemyRewardValue(restoredEnemy, { exp: 10, gold: 20 }, 'gold') === 890
        && Battle.getEnemyRewardValue({}, { exp: 10, gold: 20 }, 'exp') === 10,
    '生成個体の経験値・ゴールドよりマスタ報酬が優先されるか、固定敵のフォールバックが失われています');

    const durationSkillActor = createUnit('duration-skill-actor');
    const durationSkillTarget = createUnit('duration-skill-target');
    durationSkillTarget.battleStatus.buffs.atk = { val: 1.5, turns: 7 };
    durationSkillTarget.battleStatus.buffs.HPRegen = { val: 0.2, turns: 7 };
    durationSkillTarget.battleStatus.debuffs.def = { val: 0.5, turns: 7 };
    const shortDurationSkill = {
        id: 9208, name: '持続監査', type: '強化', target: '単体', mp: 0, rate: 0, count: 0, base: 0,
        buff: { atk: 1.1 }, debuff: { def: 0.9 }, HPRegen: 0.1, SuccessRate: 100, turn: 2
    };
    await Battle.processAction({ type: 'skill', actor: durationSkillActor, data: shortDurationSkill, target: durationSkillTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'status', durationSkillTarget.battleStatus.buffs.atk.turns === 7
        && durationSkillTarget.battleStatus.buffs.HPRegen.turns === 7
        && durationSkillTarget.battleStatus.buffs.HPRegen.val === 0.2
        && durationSkillTarget.battleStatus.debuffs.def.turns === 7,
    '短い強化・弱体・継続回復の再付与で既存の残りターンまたは回復強度が低下しました');

    const regenUnit = createUnit('regen-unit', { hp: 500, mp: 400 });
    regenUnit.battleStatus.buffs.HPRegen = { val: 0.1, turns: 2 };
    regenUnit.battleStatus.buffs.MPRegen = { val: 0.1, turns: 2 };
    Battle.party = [regenUnit];
    Battle.enemies = [];
    await Battle.onActionEnd(regenUnit);
    addCheck(report, 'status', regenUnit.hp === 500 && regenUnit.mp === 400, '毎ターン回復が行動終了ごとに発生します');

    const sealedRegenActor = createUnit('sealed-regen-actor');
    sealedRegenActor.battleStatus.ailments.HealSeal = { turns: 2 };
    const sealedRegenTarget = createUnit('sealed-regen-target');
    Battle.party = [sealedRegenActor, sealedRegenTarget];
    Battle.enemies = [];
    await Battle.processAction({ type: 'skill', actor: sealedRegenActor, data: regenSkill, target: 'all_ally', targetScope: '全体', isEnemy: false });
    addCheck(report, 'status', !sealedRegenTarget.battleStatus.buffs.HPRegen,
        '回復封印中でも継続HP回復スキルを実行できます');
    Battle.party = [regenUnit];
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

    const multiDebuffSkill = { ...debuffSkill, id: 9206, debuff: { atk: 0.7, def: 0.7, mag: 0.7, mdef: 0.7, spd: 0.7 } };
    procTarget.battleStatus.debuffs = {};
    rt.setRandom(0.49);
    await Battle.processAction({ type: 'skill', actor: procActor, data: multiDebuffSkill, target: procTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'status-proc', Object.keys(procTarget.battleStatus.debuffs).length === 5 && rt.getRandomCallCount() === 1,
        `複数能力弱体が一括成功せず、能力ごとに再抽選されました (${rt.getRandomCallCount()}回)`);

    const selfCostSkill = { id: 9207, name: '自己代償監査', type: '強化', target: '自分', mp: 0, rate: 0, count: 0, base: 0, buff: { atk: 2.5 }, debuff: { def: 0.7 }, turn: 4 };
    const selfCostActor = createUnit('self-cost-actor', { resists: { Debuff: 100 } });
    Battle.party = [selfCostActor];
    Battle.enemies = [];
    rt.setRandom(0.99);
    await Battle.processAction({ type: 'skill', actor: selfCostActor, data: selfCostSkill, target: selfCostActor, targetScope: '自分', isEnemy: false });
    addCheck(report, 'status-proc', selfCostActor.battleStatus.buffs.atk?.val === 2.5 && selfCostActor.battleStatus.debuffs.def?.val === 0.7,
        '自己強化に設定された代償弱体を自身の弱体耐性で無効化できます');

    const randomPercentSkill = { id: 9203, name: 'ランダム割合3回監査', type: '特殊', target: 'ランダム', mp: 0, rate: 0, count: 3, base: 0, SuccessRate: 100, PercentDamage: 0.5 };
    const percentTarget = createUnit('percent-target', { hp: 1000, baseMaxHp: 1000, resists: { InstantDeath: 0 } });
    Battle.party = [procActor];
    Battle.enemies = [percentTarget];
    rt.setRandom(0);
    await Battle.processAction({ type: 'skill', actor: procActor, data: randomPercentSkill, target: 'random', targetScope: 'ランダム', isEnemy: false });
    addCheck(report, 'status-proc', percentTarget.hp === 125,
        `ランダム割合効果のcount:3が3回処理されません (${percentTarget.hp})`);

    const nearFullHealTarget = createUnit('near-full-heal', { hp: 990, baseMaxHp: 1000 });
    Battle.party = [procActor, nearFullHealTarget];
    Battle.enemies = [];
    rt.logs.length = 0;
    rt.setRandom(0.5);
    await Battle.processAction({ type: 'skill', actor: procActor, data: { ...heal, mp: 0, fix: true }, target: nearFullHealTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'status-proc', rt.logs.some(line => line.includes('HPが10回復')),
        '回復ログが実際に増えたHPではなく、上限超過前の計算量を表示します');

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

    // 二刀流は「各対象へ2発ずつ」ではなく、第1撃を全対象へ完了してから第2撃へ進む。
    // 第1撃で倒れた対象は追撃対象から外れることも実行順込みで監査する。
    const dualOrderActor = createUnit('dual-order-actor', {
        traits: [{ id: 8, level: 1 }],
        equips: { main: { type: '武器' }, sub: { type: '武器' } }
    });
    const firstHitDefeated = createUnit('dual-first-defeated', { hp: 1, baseMaxHp: 1000, def: 0, eva: 0 });
    const followUpTarget = createUnit('dual-follow-up-target', { hp: 1000, baseMaxHp: 1000, def: 0, eva: 0 });
    const dualAreaSkill = { ...attack, id: 9203, name: '二刀順序監査', target: '全体', mp: 0, rate: 1, base: 1 };
    Battle.party = [dualOrderActor];
    Battle.enemies = [firstHitDefeated, followUpTarget];
    rt.logs.length = 0;
    const originalVisualPhase = Battle.awaitActionVisualPhase;
    const visualPhases = [];
    Battle.awaitActionVisualPhase = async () => {
        visualPhases.push({ firstDead: !Battle.isBattleAlive(firstHitDefeated), followHp: followUpTarget.hp });
    };
    rt.setRandom(0.1);
    await Battle.processAction({ type: 'skill', actor: dualOrderActor, data: dualAreaSkill, target: 'all_enemy', targetScope: '全体', isEnemy: false });
    Battle.awaitActionVisualPhase = originalVisualPhase;
    const firstDamageLogs = rt.logs.filter(line => line.includes(firstHitDefeated.name) && line.includes('ダメージ'));
    const followDamageIndexes = rt.logs
        .map((line, index) => line.includes(followUpTarget.name) && line.includes('ダメージ') ? index : -1)
        .filter(index => index >= 0);
    const followUpLogIndex = rt.logs.findIndex(line => line.includes('追撃'));
    addCheck(report, 'traits', firstDamageLogs.length === 1,
        `第1撃で倒れた対象へ二刀流の第2撃が発生しました (${firstDamageLogs.length}回)`);
    addCheck(report, 'traits', followDamageIndexes.length >= 2 && followUpLogIndex > followDamageIndexes[0] && followUpLogIndex < followDamageIndexes[1],
        '二刀流が第1撃の全対象処理後に第2撃へ移行していません');
    addCheck(report, 'traits', visualPhases.some(phase => phase.firstDead),
        '第1撃の戦闘不能確定後に描画同期フェーズが実行されません');

    dualActor.mp = 0;
    dualActor.equips.sub = null;
    await Battle.processAction({ type: 'skill', actor: dualActor, data: dualMpSkill, target: dualActor, targetScope: '自分', isEnemy: false });
    addCheck(report, 'traits', dualActor.mp === 10, `副武器なしで二刀流が発動しました (${dualActor.mp})`);

    const aliasedWeapon = { type: '武器', traits: [{ id: 8, level: 1 }] };
    const aliasEquipActor = createUnit('alias-equip-actor', {
        traits: [],
        equips: { 武器: aliasedWeapon, weapon: aliasedWeapon, 盾: { type: '武器' } }
    });
    addCheck(report, 'traits', Battle.getTraitLevel(aliasEquipActor, 8) === 1
        && Battle.getEquippedWeaponCount(aliasEquipActor) === 2,
    '同一装備の互換キー参照が特性レベルまたは装備本数へ二重計上されます');

    const drainMpActor = createUnit('drain-mp-actor', { mp: 0, passive: { drainMp: true } });
    const drainMpTarget = createUnit('drain-mp-target');
    Battle.party = [drainMpActor];
    Battle.enemies = [drainMpTarget];
    rt.setRandom(0.5);
    await Battle.processAction({ type: 'attack', actor: drainMpActor, target: drainMpTarget, targetScope: '単体', isEnemy: false });
    const drainDamage = drainMpTarget.baseMaxHp - drainMpTarget.hp;
    const expectedDrainMp = Math.max(1, Math.floor(drainDamage * 0.05));
    addCheck(report, 'traits', Battle.DRAIN_MP_RATE === 0.05 && drainMpActor.mp === expectedDrainMp,
        `吸魔シナジーが与ダメージの5%を回復しません (damage=${drainDamage}, MP=${drainMpActor.mp}, expected=${expectedDrainMp})`);

    const reflectActor = createUnit('reflect-actor');
    const reflectTarget = createUnit('reflect-target', { weaponTypes: ['杖'] });
    Battle.party = [reflectActor];
    Battle.enemies = [reflectTarget];
    rt.PassiveSkill.getSumValue = (unit, key) => {
        if (unit !== reflectTarget) return 0;
        if (key === 'reflect_dmg_mult') return 12;
        if (key === 'reflect_trigger_mult') return 100;
        return 0;
    };
    rt.setRandom(0.5);
    await Battle.processAction({ type: 'skill', actor: reflectActor, data: attack, target: reflectTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'traits', reflectActor.hp === 976,
        `理力の壁の固定10%が二重加算されています (反射後HP ${reflectActor.hp})`);

    const reflectDrainActor = createUnit('reflect-drain-actor', { hp: 10, passive: { drain: true } });
    const lethalReflectTarget = createUnit('lethal-reflect-target', { weaponTypes: ['杖'] });
    Battle.party = [reflectDrainActor];
    Battle.enemies = [lethalReflectTarget];
    rt.PassiveSkill.getSumValue = (unit, key) => {
        if (unit !== lethalReflectTarget) return 0;
        if (key === 'reflect_dmg_mult' || key === 'reflect_trigger_mult') return 100;
        return 0;
    };
    rt.setRandom(0.5);
    await Battle.processAction({ type: 'attack', actor: reflectDrainActor, target: lethalReflectTarget, targetScope: '単体', isEnemy: false });
    addCheck(report, 'traits', !(reflectDrainActor.isDead && reflectDrainActor.hp > 0),
        `反射で死亡した吸収攻撃者が、戦闘不能のままHPだけ回復しています (${reflectDrainActor.hp})`);
    rt.PassiveSkill.getSumValue = () => 0;

    const zeroHitActor = createUnit('zero-hit-actor');
    const zeroHitTarget = createUnit('zero-hit-target', { hp: 1000, eva: 0 });
    Battle.party = [zeroHitActor];
    Battle.enemies = [zeroHitTarget];
    rt.setRandom(0);
    await Battle.processAction({
        type: 'skill', actor: zeroHitActor,
        data: { ...attack, id: 9301, mp: 0, hitRate: 0 },
        target: zeroHitTarget, targetScope: '単体', isEnemy: false
    });
    addCheck(report, 'battle-stats', zeroHitTarget.hp === 1000,
        '命中率0%の攻撃が乱数0の境界で命中します');

    const livingMedic = createUnit('living-medic');
    const deadMedic = createUnit('dead-medic', { hp: 0, isDead: true });
    registry.set(livingMedic.uid, livingMedic);
    registry.set(deadMedic.uid, deadMedic);
    Battle.party = [livingMedic, deadMedic];
    rt.PassiveSkill.getSumValue = (unit, key) => key === 'post_battle_hp_regen_pct' && unit === deadMedic ? 10 : 0;
    addCheck(report, 'traits', Battle.getSurvivingPartyPassiveSum('post_battle_hp_regen_pct') === 0,
        '戦闘不能者の戦闘後回復特性が生存者へ残っています');
    rt.PassiveSkill.getSumValue = () => 0;

    const auraSource = createUnit('aura-source', { hp: 100, atk: 100, status: { defend: true } });
    const auraReceiver = createUnit('aura-receiver', { hp: 100, atk: 200 });
    const auraSourceData = { uid: auraSource.uid, currentHp: 100, currentMp: 1000 };
    const auraReceiverData = { uid: auraReceiver.uid, currentHp: 100, currentMp: 1000 };
    registry.set(auraSource.uid, auraSourceData);
    registry.set(auraReceiver.uid, auraReceiverData);
    const originalCalcStats = App.calcStats;
    App.calcStats = source => ({
        atk: source.uid === auraReceiver.uid ? (auraSourceData.currentHp > 0 ? 200 : 100) : 100,
        def: 100, mdef: 100, spd: 100, mag: 100, hit: 100, eva: 0, cri: 0,
        finDmg: 0, finRed: 0, elmAtk: {}, elmRes: {}, resists: {}
    });
    Battle.party = [auraSource, auraReceiver];
    Battle.enemies = [];
    auraSource.hp = 0;
    Battle.markDefeated(auraSource, false);
    addCheck(report, 'traits', auraReceiver.atk === 100,
        '戦闘中にオーラ所持者が倒れた後も隊列オーラが残っています');
    addCheck(report, 'status', auraSource.status.defend === false,
        '防御中に倒れたキャラが蘇生後まで防御軽減を保持します');
    auraSource.isDead = false;
    auraSource.hp = 100;
    Battle.refreshPartyFormationAuras();
    addCheck(report, 'traits', auraReceiver.atk === 200,
        '戦闘中にオーラ所持者を蘇生しても隊列オーラが復帰しません');
    App.calcStats = originalCalcStats;

    const persistentPassiveActor = createUnit('persistent-passive', {
        passive: { warGod: true, atkDouble: true, magDouble: true },
        battleStatus: { buffs: {}, debuffs: {}, ailments: {} }
    });
    Battle.applyPersistentBattlePassives(persistentPassiveActor);
    addCheck(report, 'traits',
        persistentPassiveActor.battleStatus.buffs.atk?.val === 2
            && persistentPassiveActor.battleStatus.buffs.mag?.val === 2
            && persistentPassiveActor.battleStatus.buffs.atk?.turns === null
            && persistentPassiveActor.battleStatus.buffs.mag?.turns === null,
        '戦神・武神・魔神の常時効果を戦闘状態へ正しく反映できません');
    persistentPassiveActor.battleStatus = { buffs: {}, debuffs: {}, ailments: {} };
    Battle.applyPersistentBattlePassives(persistentPassiveActor);
    addCheck(report, 'traits',
        persistentPassiveActor.battleStatus.buffs.atk?.val === 2
            && persistentPassiveActor.battleStatus.buffs.mag?.val === 2,
        '戦闘不能後の蘇生時に装備シナジー由来の常時効果が復帰しません');

    const coverAttacker = createUnit('cover-attacker');
    const coverProtected = createUnit('cover-protected', { hp: 400, baseMaxHp: 1000 });
    const coverer = createUnit('coverer', { eva: 1 });
    Battle.party = [coverProtected, coverer];
    Battle.enemies = [coverAttacker];
    rt.PassiveSkill.getSumValue = (unit, key) => {
        if (unit !== coverer) return 0;
        if (key === 'cover_rate_mult') return 100;
        if (key === 'cover_reduce_mult') return 50;
        return 0;
    };
    rt.setRandom(0);
    await Battle.processAction({
        type: 'skill', actor: coverAttacker,
        data: { ...attack, mp: 0, hitRate: 0 },
        target: coverProtected, targetScope: '単体', isEnemy: true
    });
    addCheck(report, 'traits', !coverer.isCovering,
        'かばった攻撃が外れた後も、かばう軽減状態が残留します');
    rt.PassiveSkill.getSumValue = () => 0;

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

    const durationBuffItem = { id: 9391, name: '監査強化道具', type: '強化道具', effectKind: 'buff', target: '単体', buff: { atk: 1.3 }, turn: 4 };
    itemActor.battleStatus.buffs.atk = { val: 1.5, turns: 7 };
    App.data.items = { [durationBuffItem.id]: 1 };
    ItemRuntime.applyBattleItem({ Battle, App, item: durationBuffItem, command: { actor: itemActor, target: itemActor } });
    addCheck(report, 'items', itemActor.battleStatus.buffs.atk.val === 1.5 && itemActor.battleStatus.buffs.atk.turns === 7,
        '弱い強化道具が既存の強い効果または長い残り時間を短縮します');

    const durationDebuffItem = { id: 9392, name: '監査弱体道具', type: '弱体道具', effectKind: 'debuff', target: '単体', debuff: { def: 0.7 }, turn: 4, successRate: 100 };
    itemEnemy.battleStatus.debuffs.def = { val: 0.5, turns: 7 };
    App.data.items = { [durationDebuffItem.id]: 1 };
    rt.setRandom(0);
    ItemRuntime.applyBattleItem({ Battle, App, item: durationDebuffItem, command: { actor: itemActor, target: itemEnemy } });
    addCheck(report, 'items', itemEnemy.battleStatus.debuffs.def.val === 0.5 && itemEnemy.battleStatus.debuffs.def.turns === 7,
        '弱い弱体道具が既存の強い効果または長い残り時間を短縮します');

    const mainSource = read('main.js');
    const alliesSource = read('menus_allies.js');
    const fieldSkillsSource = read('menus_skills.js');
    const battleSource = read('battle.js');
    const battleEffectsSource = read('polish.js');
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
    addCheck(report, 'regression-guards',
        battleSource.includes('stageHpVisualTransition') && battleSource.includes('awaitActionVisualPhase')
            && battleEffectsSource.includes('displayHpBefore: this.consumeHpTransition(unit)'),
        'ダメージ数値より先に敵HPバーが更新されることを防ぐ描画同期がありません');
    addCheck(report, 'regression-guards',
        battleEffectsSource.includes('const healMatch = text.match(/HP[をが]\\s*([0-9,]+)\\s*回復/);')
            && !battleEffectsSource.includes('|| text.match(/([0-9,]+)\\s*回復/)'),
        'MP回復ログをHP回復演出として扱い、吸魔などの多段処理を遅延させます');
    addCheck(report, 'regression-guards', mainSource.includes('other.currentHp ?? other.hp ?? 0'), '戦闘不能者の隊列オーラをcurrentHpで除外していません');
    const fearStopBlock = battleSource.slice(
        battleSource.indexOf('if (Math.random() < fearStopChance)'),
        battleSource.indexOf('// 敵の逃走')
    );
    addCheck(report, 'regression-guards',
        fearStopBlock.includes('Battle.updateDeadState();')
            && fearStopBlock.includes('if (Battle.checkFinish()) return;'),
        '怯え停止中の継続ダメージ後に死亡更新または勝敗判定が行われません');
    const deepMonsterBlock = battleSource.slice(
        battleSource.indexOf('createDeepFloorMonster:'),
        battleSource.indexOf('log: (msg) =>', battleSource.indexOf('createDeepFloorMonster:'))
    );
    addCheck(report, 'regression-guards', !/\bSeal\s*:\s*50\b/.test(deepMonsterBlock),
        '深層敵へ共通封印耐性と個別封印耐性を重複設定し、50%が100%へ二重加算されます');
    addCheck(report, 'regression-guards',
        mainSource.includes('this.mp = Math.floor((data.mp || 0) * scale)')
            && mainSource.includes('this.baseStats.mdef = Math.floor((data.mdef || 0) * scale)')
            && battleSource.includes('m.mdef = m.baseStats?.mdef || base.mdef || m.mdef || 0'),
        'モンスター倍率がMPまたは魔法防御へ反映されません');

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
