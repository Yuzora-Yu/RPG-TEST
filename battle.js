/* battle.js (AI行動ロジック刷新版: 条件・制約・確率抽選対応) */

const Battle = {
    // 吸魔シナジー：与ダメージの5%をMPへ変換する（最低1、最大MP上限あり）。
    DRAIN_MP_RATE: 0.05,
    active: false,
    auto: false,
    phase: 'init',
    party: [],
    enemies: [],
    commandQueue: [], 
    currentActorIndex: 0, 
    turnExecutionActive: false,
    turnExecutionToken: null,
    finishState: 'idle',
    finishToken: null,
    finishTimerId: null,
    runtimeGeneration: 0,
    inputGeneration: 0,
    phaseTransitionResumeToken: null,
    deferredPhaseTransitionResumeToken: null,
    phaseTransitionRestartPending: false,
    phaseTransitionRunnerActive: false,
    phaseTransitionRunnerToken: null,
    phaseTransitionRunnerScheduled: false,
    deferredInputStart: false,
    inputRecoveryScheduled: false,
    inputRecoveryAttempts: 0,
    turnRecoveryAttempts: 0,
    selectingAction: null, 
    selectedItemOrSkill: null,
	runAttemptCount: 0, // ★追加: 逃走試行回数
    battleSpeedOrder: ['normal', 'fast', 'fastest'],
    battleSpeedIcons: { normal: '▶', fast: '▶▶', fastest: '▶▶▶' },
    battleSpeedNames: { normal: '普通', fast: '早い', fastest: '最速' },
    
    // ステータス表示名マッピング
    statNames: {
        atk: '攻撃力', def: '守備力', octaprismDef: '守備力', spd: '素早さ', mag: '魔力', mdef: '魔法防御',
        cri: '会心率', eva: '回避率',
        elmResUp: '全属性耐性', elmResDown: '全属性耐性',
        Poison: '毒', ToxicPoison: '猛毒', Shock: '感電', Fear: '怯え',
        SpellSeal: '呪文封印', SkillSeal: '特技封印', HealSeal: '回復封印',HPRegen: 'HP回復' ,MPRegen: 'MP回復',
        InstantDeath: '即死', 
        Debuff: '弱体',
        Seal: '封印',
		resists_Poison: '毒耐性',
		resists_Shock: '感電耐性',
		resists_Fear: '怯え耐性',
		resists_Seal: '封印耐性',
		resists_InstantDeath: '即死耐性',
		resists_Debuff: '弱体耐性',
            resists_ToxicPoison: '猛毒耐性',
            resists_SkillSeal: '特技封印耐性',
            resists_SpellSeal: '呪文封印耐性',
            resists_HealSeal: '回復封印耐性',
            attack_Poison: '攻撃時毒',
            attack_Fear: '攻撃時怯え',
            attack_InstantDeath: '攻撃時即死'
    },
    
    // 状態異常と耐性IDの対応表 (拡張)
    RESIST_MAP: {
        Poison: 'Poison', ToxicPoison: 'ToxicPoison',
        Shock: 'Shock',
        Fear: 'Fear',
        SpellSeal: 'SpellSeal', 
        SkillSeal: 'SkillSeal', 
        HealSeal: 'HealSeal',
        PercentDamage: 'InstantDeath', // 指示通り即死ガードで割合ダメも防ぐ
        InstantDeath: 'InstantDeath',
        Debuff: 'Debuff',
        atk: 'Debuff',
        def: 'Debuff',
        mag: 'Debuff',
        mdef: 'Debuff',
        spd: 'Debuff',
        elmResDown: 'Debuff'          // 全属性耐性低下も弱体耐性を参照
    },


    // マダンテ系はID再編後も専用MP処理が必要。範囲判定ではなく明示IDで扱う。
    MADANTE_SKILL_IDS: new Set([245, 246, 247]),
    isMadanteSkillId: (id) => Battle.MADANTE_SKILL_IDS.has(Number(id)),
    isMadanteSkill: (data) => data && Battle.isMadanteSkillId(data.id),

    getUniqueEquips: (entity) => {
        if (typeof PassiveSkill !== 'undefined' && typeof PassiveSkill.getUniqueEquips === 'function') {
            return PassiveSkill.getUniqueEquips(entity);
        }
        if (!entity?.equips) return [];
        const result = [];
        const seenObjects = new WeakSet();
        const seenIds = new Set();
        Object.values(entity.equips).forEach(eq => {
            if (!eq || typeof eq !== 'object' || seenObjects.has(eq)) return;
            seenObjects.add(eq);
            const stableId = eq.uid ?? eq.guid ?? eq.uniqueId;
            if (stableId !== undefined && stableId !== null && stableId !== '') {
                const key = String(stableId);
                if (seenIds.has(key)) return;
                seenIds.add(key);
            }
            result.push(eq);
        });
        return result;
    },

    getTraitLevel: (entity, traitId) => {
        if (!entity) return 0;
        const id = Number(traitId);
        let lv = 0;
        const disabled = Array.isArray(entity.disabledTraits) ? entity.disabledTraits.map(Number) : [];
        if (Array.isArray(entity.traits)) {
            entity.traits.forEach(t => {
                if (!t || Number(t.id) !== id) return;
                if (disabled.includes(id)) return;
                lv += Number(t.level || 0);
            });
        }
        if (entity.equips) {
            Battle.getUniqueEquips(entity).forEach(eq => {
                if (!eq || !Array.isArray(eq.traits)) return;
                eq.traits.forEach(t => {
                    if (t && Number(t.id) === id) lv += Number(t.level || 0);
                });
            });
        }
        return lv;
    },

    getDualWieldLevel: (actor) => Battle.getTraitLevel(actor, 8),
    getEquippedWeaponCount: (actor) => {
        if (!actor || !actor.equips) return 0;
        return Battle.getUniqueEquips(actor).filter(eq => {
            if (!eq) return false;
            const type = eq.type || eq.data?.type;
            return type === '武器' || type === 'weapon';
        }).length;
    },
    isDualWieldActive: (actor) => {
        const traitLevel = Battle.getDualWieldLevel(actor);
        if (traitLevel <= 0) return false;
        // モンスターには装備スロットがないため、従来どおり特性所持で発動する。
        if (typeof Monster !== 'undefined' && actor instanceof Monster) return true;
        return Battle.getEquippedWeaponCount(actor) >= 2;
    },

    getSkillMpCost: (actor, skill, mode = 'required') => {
        if (!skill) return 0;
        const dualLv = Battle.isDualWieldActive(actor) ? Battle.getDualWieldLevel(actor) : 0;
        if (Battle.isMadanteSkill(skill)) {
            if (dualLv > 0) return Number(actor?.mp || 0) + 1;
            return mode === 'spend' ? Number(actor?.mp || 0) : 1;
        }

        let cost = Math.max(0, Number(skill.mp || 0));
        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue(actor, 'mag_amp_cost_mult') > 0) {
            cost = Math.floor(cost * 1.5);
        }
        if (dualLv > 0 && cost > 0) {
            cost = Math.ceil(cost * (1 + (dualLv * 0.1)));
        }
        return cost;
    },

    getConfiguredDropRate: (drop, bonus = 0) => {
        const configuredRate = Number(drop?.rate);
        if (!Number.isFinite(configuredRate)) return 0;
        return Math.max(0, Math.min(100, configuredRate + Number(bonus || 0)));
    },

    rollConfiguredDrop: (drop, bonus = 0, rateMultiplier = 1) => {
        const rate = Math.max(0, Math.min(100, Battle.getConfiguredDropRate(drop, bonus) * Math.max(0, Number(rateMultiplier || 1))));
        return Math.random() * 100 < rate;
    },

    // ランダム迷宮の報酬補正は、戦闘開始時に保存された戦闘データを正本とする。
    // 未設定の通常戦・旧セーブでは従来値へ安全にフォールバックする。
    getBattleRewardRateModifiers: (battleData = App.data?.battle) => {
        const rareDropMultiplier = Number(battleData?.rareDropMultiplier);
        const equipPlus3BonusPct = Number(battleData?.equipPlus3BonusPct);
        return {
            rareDropMultiplier: Number.isFinite(rareDropMultiplier)
                ? Math.max(0, rareDropMultiplier)
                : 1,
            equipPlus3BonusPct: Number.isFinite(equipPlus3BonusPct)
                ? Math.max(0, equipPlus3BonusPct)
                : 0
        };
    },

    // 亀裂戦の報酬識別子は、勝利中にDungeon.onBossDefeated()が戦闘データを初期化する前に退避する。
    // 未設定値同士の比較（null === null / undefined === undefined）を成立条件にしない。
    captureAbyssRiftResultContext: (battleData = App.data?.battle, dungeonData = App.data?.dungeon) => {
        const battleRewardId = String(battleData?.riftRewardId || '').trim();
        const dungeonRewardId = String(dungeonData?.abyssRift?.rewardId || '').trim();
        const riftEventId = (typeof Dungeon !== 'undefined') ? Dungeon.riftBattleEventId : null;
        const isRiftBattle = battleData?.isRiftBattle === true
            || !!battleRewardId
            || (riftEventId != null && battleData?.eventId === riftEventId);
        const rewardId = battleRewardId || dungeonRewardId;
        if (!isRiftBattle || !rewardId) return null;
        return { rewardId };
    },

    buildAbyssRiftResultOutcome: (context, dungeonData = App.data?.dungeon) => {
        const expectedRewardId = String(context?.rewardId || '').trim();
        if (!expectedRewardId) return null;
        const pending = dungeonData?.pendingRiftReward;
        if (!pending || pending.active !== true) return null;
        const pendingRewardId = String(pending.rewardId || '').trim();
        if (!pendingRewardId || pendingRewardId !== expectedRewardId) return null;
        const itemName = String(pending.itemName || '').trim() || '輝く装備+3';
        return { rewardId: expectedRewardId, itemName };
    },

    getEndlessBossWedgeDropRule: (data = App.data) => {
        const master = globalThis.ABYSS_REGION_CONTENT?.randomDungeonPhase2IMaster?.endlessBossWedge || {};
        const battle = data?.battle || {};
        const mode = battle.abyssMode || data?.dungeon?.abyssMode || null;
        const displayFloor = Math.max(1, Math.floor(Number(battle.abyssFloor || data?.dungeon?.floor || data?.progress?.floor || 1) || 1));
        const minimumDisplayFloor = Math.max(1, Math.floor(Number(master.minimumDisplayFloor || 101) || 101));
        const isRandomMode = globalThis.ABYSS_FLOOR_RULES?.isRandomMode
            ? globalThis.ABYSS_FLOOR_RULES.isRandomMode(mode)
            : String(mode) === 'random';
        const excluded = battle.isSpecialBoss === true || battle.isEstark === true
            || battle.randomAdventurerDuel != null || battle.randomHunter != null
            || battle.randomRareAmbush != null || battle.riftRewardId != null
            || battle.angelTrial != null || battle.guildQuestRun != null
            || battle.storyBossTraining === true;
        return {
            itemId:Number(master.itemId || 98),
            rate:Math.max(0, Math.min(1, Number(master.rate || 0.10))),
            displayFloor,
            minimumDisplayFloor,
            eligible:data?.location?.area === 'ABYSS' && isRandomMode && battle.isBossBattle === true
                && displayFloor >= minimumDisplayFloor && !excluded
        };
    },

    applyEndlessBossWedgeDrop: (drops = [], options = {}) => {
        const rule = Battle.getEndlessBossWedgeDropRule(options.data || App.data);
        const random = typeof options.random === 'function' ? options.random : Math.random;
        const outcome = {
            version:1,
            itemId:rule.itemId,
            rate:rule.rate,
            displayFloor:rule.displayFloor,
            eligible:rule.eligible,
            granted:false
        };
        if (!rule.eligible || random() >= rule.rate) return outcome;
        const itemDef = DB.ITEMS.find(item => Number(item.id) === Number(rule.itemId));
        if (!itemDef) return { ...outcome, missingItemMaster:true };
        if (!App.data.items || typeof App.data.items !== 'object') App.data.items = {};
        App.data.items[rule.itemId] = Math.max(0, Number(App.data.items[rule.itemId]) || 0) + 1;
        if (Array.isArray(drops)) drops.push({ name:itemDef.name, isRare:true, type:'kai', kind:'item', endlessBossWedge:true });
        return { ...outcome, granted:true, itemName:itemDef.name };
    },

    scaleEnemyCombatStats: (enemy, multiplier = 1, marker = null) => {
        if (!enemy) return enemy;
        const mult = Math.max(0.01, Number(multiplier || 1));
        if (marker && enemy[marker]) return enemy;
        enemy.hp = Math.max(1, Math.floor(Number(enemy.hp || 1) * mult));
        enemy.baseMaxHp = Math.max(1, Math.floor(Number(enemy.baseMaxHp || enemy.hp || 1) * mult));
        enemy.mp = Math.max(0, Math.floor(Number(enemy.mp || 0) * mult));
        enemy.baseMaxMp = Math.max(0, Math.floor(Number(enemy.baseMaxMp || enemy.mp || 0) * mult));
        ['atk','def','spd','mag','mdef'].forEach(key => {
            if (enemy.baseStats?.[key] !== undefined) enemy.baseStats[key] = Math.max(0, Math.floor(Number(enemy.baseStats[key] || 0) * mult));
            if (enemy[key] !== undefined) enemy[key] = Math.max(0, Math.floor(Number(enemy[key] || 0) * mult));
        });
        if (marker) enemy[marker] = mult;
        return enemy;
    },

    getDeepNormalBaseCandidates: () => {
        let candidates = [];
        if (window.MonsterData && typeof window.MonsterData.getDeepFloorNormalBaseCandidates === 'function') {
            candidates = window.MonsterData.getDeepFloorNormalBaseCandidates() || [];
        }
        if (!candidates.length && window.MonsterData && typeof window.MonsterData.generateBandMonster === 'function') {
            const fallback = window.MonsterData.generateBandMonster(200);
            if (fallback) candidates = [fallback];
        }
        return candidates.filter(base => base && !base.isBoss && !base.isRare && !Battle.isSpecialBossBase(base));
    },

    createDeepNormalEnemy: (targetFloor, options = {}) => {
        const floor = Math.max(1, Number(targetFloor) || 1);
        let base = null;
        if (floor < 201 && window.MonsterData && typeof window.MonsterData.generateEnemyForFloor === 'function') {
            base = window.MonsterData.generateEnemyForFloor(floor, { allowRare:false });
        }
        if (!base) {
            const candidates = Battle.getDeepNormalBaseCandidates();
            base = candidates[Math.floor(Math.random() * candidates.length)] || null;
        }
        if (!base && Array.isArray(DB.MONSTERS)) {
            const candidates = DB.MONSTERS.filter(entry => entry && !entry.isBoss && !entry.isRare && !Battle.isSpecialBossBase(entry));
            base = candidates[Math.floor(Math.random() * candidates.length)] || null;
        }
        if (!base) return null;
        const enemy = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), floor, false)
            || Battle.createMonsterFromBase(base, { isBossBattle:false });
        if (!enemy) return null;
        if (options.statMultiplier) Battle.scaleEnemyCombatStats(enemy, options.statMultiplier, options.marker || null);
        return enemy;
    },

    createStoryBossEchoEnemy: (targetFloor, index = 0, total = 1) => {
        const master = globalThis.ABYSS_REGION_CONTENT?.randomDungeonPhase2IMaster || {};
        const ids = Array.isArray(master.storyBossEchoIds) ? master.storyBossEchoIds : [];
        const bossBase = Battle.getMonsterBaseById(ids[Math.floor(Math.random() * ids.length)]);
        const reference = Battle.createDeepNormalEnemy(targetFloor);
        if (!bossBase || !reference) return reference;
        const enemy = Battle.createMonsterFromBase(bossBase, {
            isBossBattle:false,
            name:`${bossBase.name || '物語の残響'}${total > 1 ? String.fromCharCode(65 + index) : ''}`
        });
        if (!enemy) return reference;
        const modifier = App.data?.battle?.randomDungeonModifier || {};
        const statMult = Math.max(1, Number(modifier.normalStatMultiplier || 1.15));
        const hpMult = Math.max(1, Number(modifier.hpNormalMultiplier || 2));
        enemy.hp = Math.max(1, Math.floor(Number(reference.baseMaxHp || reference.hp || 1) * hpMult));
        enemy.baseMaxHp = enemy.hp;
        enemy.mp = Math.max(0, Math.floor(Number(reference.baseMaxMp || reference.mp || 0) * statMult));
        enemy.baseMaxMp = enemy.mp;
        ['atk','def','spd','mag','mdef'].forEach(key => {
            const value = Math.max(0, Math.floor(Number(reference.baseStats?.[key] ?? reference[key] ?? 0) * statMult));
            if (!enemy.baseStats) enemy.baseStats = {};
            enemy.baseStats[key] = value;
            enemy[key] = value;
        });
        enemy.exp = Math.max(1, Math.floor(Number(reference.exp || 0) * 1.5));
        enemy.gold = Math.max(0, Math.floor(Number(reference.gold || 0) * 1.5));
        enemy.isBoss = false;
        enemy.isStoryBossEcho = true;
        enemy.storyBossEchoSourceId = Number(bossBase.id);
        delete enemy.phaseTransition;
        delete enemy.phaseTransitionMonsterId;
        delete enemy.phaseTransitionConversation;
        return enemy;
    },

    applyRandomDungeonModifier: (enemy, modifier = App.data?.battle?.randomDungeonModifier) => {
        if (!enemy || !modifier?.id) return enemy;
        if (modifier.id === 'dangerTreasure') {
            Battle.scaleEnemyCombatStats(enemy, Math.max(1, Number(modifier.enemyStatMultiplier || 1.35)), 'randomDungeonDangerScale');
        }
        enemy.randomDungeonModifierId = modifier.id;
        return enemy;
    },

    getSurvivingPartyPassiveSum: (key) => {
        if (typeof PassiveSkill === 'undefined' || typeof PassiveSkill.getSumValue !== 'function') return 0;
        return Battle.party.filter(member => Battle.isBattleAlive(member)).reduce((sum, member) => {
            const source = (typeof App !== 'undefined' && typeof App.getChar === 'function') ? App.getChar(member.uid) : null;
            return sum + PassiveSkill.getSumValue(source || member, key);
        }, 0);
    },

    getEffectTurn: (data) => {
        const turn = Number(data?.turn);
        return Number.isFinite(turn) && turn > 0 ? turn : 3;
    },

    abyssVegnasisIds: Object.freeze([302080, 302081, 302082, 302083, 302084]),
    abyssAzelgaragIds: Object.freeze([302100, 302101]),
    abyssSealedSkillIds: Object.freeze([166, 245, 700101]),

    makeBattleUnitId: () => `enemy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,

    ensureEnemyBattleIdentity: (enemy, options = {}) => {
        if (!enemy) return null;
        if (options.battleUnitId) enemy.battleUnitId = options.battleUnitId;
        else if (!enemy.battleUnitId) enemy.battleUnitId = Battle.makeBattleUnitId();
        enemy.phaseIndex = Math.max(1, Number(options.phaseIndex || enemy.phaseIndex || 1));
        enemy.phaseRootId = Number(options.phaseRootId || enemy.phaseRootId || Battle.getUnitBaseId(enemy) || 0) || null;
        return enemy;
    },

    getLinkedBattleGroup: (enemy) => {
        if (!enemy) return null;
        const base = Battle.getMonsterBaseById?.(Battle.getUnitBaseId(enemy));
        return enemy.linkedBattleGroup || base?.linkedBattleGroup || null;
    },

    getSharedVisualGroup: (enemy) => {
        if (!enemy) return null;
        const base = Battle.getMonsterBaseById?.(Battle.getUnitBaseId(enemy));
        return enemy.sharedVisualGroup || base?.sharedVisualGroup || null;
    },

    getSharedVisualMembers: (groupName) => {
        if (!groupName) return [];
        return (Battle.enemies || []).filter(enemy => Battle.getSharedVisualGroup(enemy) === groupName);
    },

    getSharedVisualProfile: (groupName) => {
        const members = Battle.getSharedVisualMembers(groupName);
        let name = '';
        let title = '';
        for (const enemy of members) {
            const base = Battle.getMonsterBaseById?.(Battle.getUnitBaseId(enemy)) || {};
            if (!name) name = String(enemy?.sharedVisualName || base.sharedVisualName || '');
            if (!title) title = String(enemy?.sharedVisualTitle || base.sharedVisualTitle || '');
            if (name && title) break;
        }
        return {
            name: name || String(groupName || ''),
            title
        };
    },

    getSharedVisualHpSummary: (groupName) => {
        const members = Battle.getSharedVisualMembers(groupName);
        const fx = (typeof window !== 'undefined') ? window.PolishBattleFX : null;
        const summary = members.reduce((result, enemy) => {
            const maxHp = Math.max(1, Number(enemy?.baseMaxHp || enemy?.maxHp || enemy?.hp || 1));
            const rawHp = (fx && typeof fx.hpDisplayForEnemy === 'function')
                ? fx.hpDisplayForEnemy(enemy, enemy?.hp)
                : enemy?.hp;
            const currentHp = Math.max(0, Math.min(maxHp, Number(rawHp || 0)));
            result.currentHp += currentHp;
            result.maxHp += maxHp;
            if (Battle.isBattleAlive(enemy)) result.aliveCount += 1;
            return result;
        }, { currentHp: 0, maxHp: 0, aliveCount: 0, totalCount: members.length });
        summary.percent = summary.maxHp > 0
            ? Math.max(0, Math.min(100, (summary.currentHp / summary.maxHp) * 100))
            : 0;
        return summary;
    },

    isVegnasisPillar: (enemy) => Battle.getLinkedBattleGroup(enemy) === 'vegnasis',

    ensureLinkedInitialState: (enemy) => {
        if (!enemy || !Battle.getLinkedBattleGroup(enemy)) return null;
        if (!enemy.linkedInitialState) {
            enemy.linkedInitialState = {
                maxHp: Math.max(1, Number(enemy.baseMaxHp || enemy.maxHp || enemy.hp || 1)),
                maxMp: Math.max(0, Number(enemy.baseMaxMp || enemy.maxMp || enemy.mp || 0)),
                atk: Math.max(0, Number(enemy.atk ?? enemy.baseStats?.atk ?? 0)),
                def: Math.max(0, Number(enemy.def ?? enemy.baseStats?.def ?? 0)),
                spd: Math.max(0, Number(enemy.spd ?? enemy.baseStats?.spd ?? 0)),
                mag: Math.max(0, Number(enemy.mag ?? enemy.baseStats?.mag ?? 0)),
                mdef: Math.max(0, Number(enemy.mdef ?? enemy.baseStats?.mdef ?? 0)),
                actCount: Math.max(1, Number(enemy.actCount || 1)),
                acts: JSON.parse(JSON.stringify(enemy.acts || []))
            };
        }
        return enemy.linkedInitialState;
    },

    initializeLinkedBattleGroups: () => {
        (Battle.enemies || []).forEach(enemy => {
            Battle.ensureEnemyBattleIdentity(enemy);
            Battle.ensureLinkedInitialState(enemy);
        });
        const pillars = (Battle.enemies || []).filter(Battle.isVegnasisPillar);
        if (!pillars.length) return;
        const handled = pillars.filter(enemy => enemy.abyssFallHandled).length;
        if (App.data?.battle) {
            App.data.battle.vegnasisFallCount = Math.max(Number(App.data.battle.vegnasisFallCount || 0), handled);
        }
        const alive = pillars.filter(Battle.isBattleAlive);
        if (alive.length === 1 && handled >= pillars.length - 1 && !alive[0].vegnasisFinalAwakened) {
            Battle.awakenVegnasisFinalPillar(alive[0], { silent: true });
        }
    },

    getVegnasisProfile: (enemy) => {
        const base = Battle.getMonsterBaseById?.(Battle.getUnitBaseId(enemy)) || {};
        return {
            element: String(enemy?.vegnasisElement || base.vegnasisElement || ''),
            elementKey: String(enemy?.vegnasisElementKey || base.vegnasisElementKey || 'chaos'),
            powerName: String(enemy?.vegnasisPowerName || base.vegnasisPowerName || '深淵'),
            lastStandConversation: enemy?.vegnasisLastStandConversation || base.vegnasisLastStandConversation || null
        };
    },

    getLinkedBattleGroupSkillPool: (groupName) => {
        const seen = new Set();
        const result = [];
        (DB.MONSTERS || []).filter(base => base?.linkedBattleGroup === groupName).forEach(base => {
            (base.acts || []).forEach(raw => {
                const act = (typeof raw === 'object' && raw) ? raw : { id: raw, rate: 100, condition: 0 };
                const id = Number(act.id);
                if (!Number.isFinite(id) || seen.has(id)) return;
                seen.add(id);
                result.push({ ...JSON.parse(JSON.stringify(act)), id });
            });
        });
        return result;
    },

    awakenVegnasisFinalPillar: (enemy, options = {}) => {
        if (!enemy || enemy.vegnasisFinalAwakened) return false;
        const initial = Battle.ensureLinkedInitialState(enemy);
        if (!initial) return false;
        const scale = 1.5;
        enemy.baseMaxHp = Math.max(1, Math.floor(initial.maxHp * scale));
        enemy.maxHp = enemy.baseMaxHp;
        enemy.hp = enemy.baseMaxHp;
        enemy.baseMaxMp = Math.max(0, Math.floor(initial.maxMp * scale));
        enemy.maxMp = enemy.baseMaxMp;
        enemy.mp = enemy.baseMaxMp;
        ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
            const value = Math.max(0, Math.floor(Number(initial[key] || 0) * scale));
            enemy[key] = value;
            if (enemy.baseStats) enemy.baseStats[key] = value;
        });
        const pooledActs = Battle.getLinkedBattleGroupSkillPool('vegnasis');
        if (pooledActs.length) enemy.acts = pooledActs;
        enemy.actCount = 3;
        enemy.isDead = false;
        enemy.isFled = false;
        enemy.hasDiedThisTurn = false;
        enemy.vegnasisFinalAwakened = true;
        if (App.data?.battle) {
            App.data.battle.vegnasisFinalAwakenedUnitId = enemy.battleUnitId || null;
        }
        if (!options.silent) {
            Battle.log(`${enemy.name}は四柱の力を取り込み、完全に傷を癒した！`);
            Battle.log(`${enemy.name}の全能力が初期値の1.5倍となり、3回行動を開始した！`);
        }
        return true;
    },

    completeAbyssElementalTrial: (drops = []) => {
        const battleData = App.data?.battle || {};
        const trial = battleData.elementalSpiritTrial && typeof battleData.elementalSpiritTrial === 'object'
            ? battleData.elementalSpiritTrial
            : {};
        const element = String(trial.element || battleData.fixedTrialElement || battleData.abyssSpiritElement || '');
        const rewardId = Number(trial.rewardItemId || battleData.fixedTrialRewardItemId || 0);
        if (!element || !Number.isFinite(rewardId) || rewardId <= 0) return [];

        if (!App.data.items || typeof App.data.items !== 'object') App.data.items = {};
        const progress = App.ensureAbyssSpiritTrialEvents?.() || App.ensureAbyssRegionProgress?.() || App.data.progress || {};
        progress.flags = progress.flags || {};
        progress.abyssSpiritBlessings = progress.abyssSpiritBlessings || {};
        progress.abyssSpiritTrialEvents = progress.abyssSpiritTrialEvents || {};
        const record = progress.abyssSpiritTrialEvents[element] || (progress.abyssSpiritTrialEvents[element] = {});
        const battleId = battleData.battleId || null;
        record.state = 'victory';
        record.victoryBattleId = record.victoryBattleId || battleId;
        record.lastVictoryAt = Date.now();

        const messages = [];
        let blessingGranted = false;
        if (!progress.abyssSpiritBlessings[element]) {
            progress.abyssSpiritBlessings[element] = true;
            blessingGranted = true;
            if (rewardId > 0) {
                App.data.items[rewardId] = Number(App.data.items[rewardId] || 0) + 1;
                const item = (DB.ITEMS || []).find(entry => Number(entry.id) === rewardId);
                drops.push({ name: item?.name || `${element}の結晶片`, isRare: true, type: 'boss', kind: 'item' });
            }
            messages.push(`${element}の精霊に認められ、全員の${element}属性耐性が20%上昇した！`);
        }

        const required = Array.isArray(trial.requiredElements)
            ? trial.requiredElements.map(String)
            : (Array.isArray(battleData.fixedTrialRequiredElements)
                ? battleData.fixedTrialRequiredElements.map(String)
                : ['火', '水', '風', '雷', '光', '闇']);
        if (required.length > 0 && required.every(key => progress.abyssSpiritBlessings[key])) {
            progress.flags.abyssAllSpiritTrialsCleared = true;
            const completionId = Number(trial.completionItemId || battleData.fixedTrialCompletionItemId || 701008);
            if (Number(App.data.items?.[completionId] || 0) <= 0) {
                // 旧版で「演出済み」だけ残り、アイテム本体が欠けたセーブも授与イベントで救済する。
                progress.flags.abyssOctaprismGrantPending = true;
            }
            messages.push('六属性すべての精霊に認められた。');
        }
        battleData.elementalSpiritTrialOutcome = {
            version: 1,
            element,
            rewardItemId: rewardId,
            blessingGranted,
            allCleared: required.length > 0 && required.every(key => progress.abyssSpiritBlessings[key]),
            octaprismGrantPending: progress.flags.abyssOctaprismGrantPending === true,
            victoryBattleId: battleId
        };
        return messages;
    },

    recordAbyssElementalTrialLoss: () => {
        const battleData = App.data?.battle || {};
        const trial = battleData.elementalSpiritTrial && typeof battleData.elementalSpiritTrial === 'object'
            ? battleData.elementalSpiritTrial
            : {};
        const element = String(trial.element || battleData.fixedTrialElement || battleData.abyssSpiritElement || '');
        if (!element) return null;
        const progress = App.ensureAbyssSpiritTrialEvents?.() || App.ensureAbyssRegionProgress?.() || App.data.progress || {};
        progress.abyssSpiritTrialEvents = progress.abyssSpiritTrialEvents || {};
        const record = progress.abyssSpiritTrialEvents[element] || (progress.abyssSpiritTrialEvents[element] = {});
        record.state = 'lost';
        record.lostOnce = true;
        record.lastLossAt = Date.now();
        record.lastLossBattleId = battleData.battleId || null;
        battleData.elementalSpiritTrialOutcome = {
            version: 1,
            element,
            lost: true,
            lossBattleId: battleData.battleId || null
        };
        return battleData.elementalSpiritTrialOutcome;
    },

    getUnitBaseId: (unit) => Number(unit?.baseId || unit?.id || 0),

    ensureUnitBattleStatus: (unit) => {
        if (!unit) return { buffs: {}, debuffs: {}, ailments: {} };
        unit.battleStatus = unit.battleStatus || { buffs: {}, debuffs: {}, ailments: {} };
        unit.battleStatus.buffs = unit.battleStatus.buffs || {};
        unit.battleStatus.debuffs = unit.battleStatus.debuffs || {};
        unit.battleStatus.ailments = unit.battleStatus.ailments || {};
        return unit.battleStatus;
    },

    ensureBattleCutsceneQueue: () => {
        if (!App.data?.battle) return [];
        if (!Array.isArray(App.data.battle.cutsceneQueue)) App.data.battle.cutsceneQueue = [];
        return App.data.battle.cutsceneQueue;
    },

    getPhaseTransitionJournal: () => {
        const journal = App.data?.battle?.phaseTransitionJournal;
        if (!journal || typeof journal !== 'object') return null;
        if (!journal.version || Number(journal.version) < 2) {
            journal.version = 2;
            journal.preConversation = journal.preConversation || journal.conversation || null;
            journal.postConversation = journal.postConversation || null;
            journal.visual = journal.visual && typeof journal.visual === 'object' ? journal.visual : null;
            journal.steps = journal.steps && typeof journal.steps === 'object' ? journal.steps : {};
            if (!journal.status || journal.status === 'state_applied') journal.status = 'prepared';
        } else {
            journal.steps = journal.steps && typeof journal.steps === 'object' ? journal.steps : {};
        }
        return journal;
    },

    isPhaseTransitionInputReadyStatus: (status) =>
        ['ready_for_input', 'input_starting', 'completed'].includes(String(status || '')),

    hasPendingPhaseTransition: () => {
        const journal = Battle.getPhaseTransitionJournal();
        return !!(journal && !Battle.isPhaseTransitionInputReadyStatus(journal.status));
    },

    makePhaseTransitionToken: (enemy, nextForm) => {
        const battleId = App.data?.battle?.battleId || 'battle';
        const unitId = nextForm?.battleUnitId || enemy?.battleUnitId || Battle.makeBattleUnitId();
        const phaseIndex = Math.max(1, Number(nextForm?.phaseIndex || enemy?.phaseIndex || 1));
        return `${battleId}:phase:${unitId}:${phaseIndex}:${Date.now().toString(36)}`;
    },

    resetInputStateForPhaseTransition: () => {
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.selectingAction = null;
        Battle.selectedItemOrSkill = null;
        Battle.isPreemptive = false;
        Battle.isAmbushed = false;
        Battle.inputGeneration = Math.max(0, Number(Battle.inputGeneration || 0)) + 1;
        Battle.closeSubMenu?.();
        Battle.closeStrategyModal?.();
        Battle.closeStatusModal?.();
        [...(Battle.party || []), ...(Battle.enemies || [])].forEach(unit => {
            if (!unit) return;
            unit.turnProcessed = false;
            unit.hasDiedThisTurn = false;
            if (unit.status) unit.status.defend = false;
        });
    },

    invalidateRuntimeForPhaseTransition: () => {
        Battle.runtimeGeneration = Math.max(0, Number(Battle.runtimeGeneration || 0)) + 1;
        Battle.resetInputStateForPhaseTransition();
        Battle.phase = 'battle_event';
    },

    beginPhaseTransitionJournal: (enemy, nextForm, config = {}) => {
        if (!App.data?.battle) return null;
        const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
        const token = Battle.makePhaseTransitionToken(enemy, nextForm);
        const journal = {
            version: 2,
            token,
            status: 'prepared',
            fromMonsterId: Battle.getUnitBaseId(enemy),
            toMonsterId: Battle.getUnitBaseId(nextForm),
            battleUnitId: nextForm?.battleUnitId || enemy?.battleUnitId || null,
            phaseIndex: Math.max(1, Number(nextForm?.phaseIndex || 1)),
            preConversation: config.preConversation || config.conversation || null,
            postConversation: config.postConversation || null,
            visual: clone(config.visual || null),
            resumePhase: config.resumePhase || 'input',
            fromSnapshot: clone(Battle.serializeEnemyState?.(enemy) || null),
            toSnapshot: clone(Battle.serializeEnemyState?.(nextForm) || null),
            steps: {},
            createdAt: Date.now()
        };
        App.data.battle.phaseTransitionJournal = journal;
        Battle.phaseTransitionResumeToken = token;
        Battle.phaseTransitionRestartPending = true;
        Battle.deferredPhaseTransitionResumeToken = null;
        Battle.invalidateRuntimeForPhaseTransition();
        return journal;
    },

    finalizePhaseTransitionForInput: (journal = Battle.getPhaseTransitionJournal()) => {
        if (!journal || !App.data?.battle) return false;
        if (!Battle.isPhaseTransitionInputReadyStatus(journal.status)) return false;
        const currentEnemy = (Battle.enemies || []).find(enemy =>
            (journal.battleUnitId && enemy?.battleUnitId === journal.battleUnitId) ||
            Battle.getUnitBaseId(enemy) === Number(journal.toMonsterId)
        );
        if (!currentEnemy || !Battle.isBattleAlive(currentEnemy)) return false;

        // 入力の再帰開始（特にAUTO）より先に、形態移行を完全に確定する。
        // ここから先は通常の第二形態戦として扱い、移行ジャーナルと旧会話予約を残さない。
        Battle.ensureUnitBattleStatus(currentEnemy);
        const previousStatus = journal.status;
        const previousQueue = Array.isArray(App.data.battle.cutsceneQueue)
            ? App.data.battle.cutsceneQueue.slice()
            : null;
        journal.status = 'completed';
        journal.completedAt = Date.now();
        if (previousQueue) {
            App.data.battle.cutsceneQueue = previousQueue.filter(entry =>
                entry?.phaseTransitionToken !== journal.token
            );
        }
        Battle.phaseTransitionResumeToken = null;
        Battle.phaseTransitionRestartPending = false;
        Battle.deferredPhaseTransitionResumeToken = null;
        delete App.data.battle.phaseTransitionJournal;

        try {
            if (Battle.saveBattleState() === false) {
                throw new Error('形態移行完了状態を保存できませんでした。');
            }
        } catch (error) {
            // 保存に失敗した場合はジャーナルを戻し、入力開始前の安全な状態から再試行できるようにする。
            journal.status = previousStatus === 'input_starting' ? 'ready_for_input' : previousStatus;
            delete journal.completedAt;
            App.data.battle.phaseTransitionJournal = journal;
            if (previousQueue) App.data.battle.cutsceneQueue = previousQueue;
            Battle.phaseTransitionResumeToken = journal.token;
            Battle.phaseTransitionRestartPending = true;
            throw error;
        }

        if (typeof document !== 'undefined') {
            const container = Battle.getEl?.('enemy-container');
            container?.classList.remove('phase-form-transition-active');
            container?.querySelectorAll('.phase-form-transition-layer').forEach(node => node.remove());
        }
        return true;
    },

    completePhaseTransitionJournalOnInput: () =>
        Battle.finalizePhaseTransitionForInput(Battle.getPhaseTransitionJournal()),

    playBattleCutsceneVisual: (effect) => {
        if (!effect || typeof document === 'undefined') return;
        if (effect.type === 'vegnasis-fall' || effect.type === 'vegnasis-final') {
            const stage = Math.max(0, Math.min(4, Number(effect.stage || App.data?.battle?.vegnasisFallCount || 0)));
            if (App.data?.battle) App.data.battle.vegnasisFallCount = Math.max(Number(App.data.battle.vegnasisFallCount || 0), stage);
            Battle.renderEnemies?.();
            const scene = Battle.getEl('battle-scene');
            if (!scene) return;
            const old = scene.querySelector('.vegnasis-shift-flash');
            if (old) old.remove();
            const flash = document.createElement('div');
            flash.className = `vegnasis-shift-flash ${effect.type === 'vegnasis-final' ? 'is-final' : ''}`;
            flash.dataset.element = String(effect.elementKey || 'chaos');
            flash.setAttribute('aria-hidden', 'true');
            scene.appendChild(flash);
            setTimeout(() => flash.remove(), effect.type === 'vegnasis-final' ? 1100 : 800);
        }
    },

    queueBattleConversation: (scriptKey, options = {}) => {
        if (!scriptKey || !globalThis.StoryManager?.showConversation) return Promise.resolve(false);
        const persistId = options.persistId || null;
        const transitionStep = options.phaseTransitionStep || null;
        Battle.phase = 'battle_event';
        if (persistId) {
            const queue = Battle.ensureBattleCutsceneQueue();
            if (!queue.some(entry => entry?.id === persistId)) {
                queue.push({
                    id: persistId,
                    scriptKey,
                    status: 'queued',
                    resumePhase: options.resumePhase || 'input',
                    phaseTransitionToken: options.phaseTransitionToken || null,
                    phaseTransitionStep: transitionStep,
                    visualEffect: options.visualEffect ? JSON.parse(JSON.stringify(options.visualEffect)) : null,
                    createdAt: Date.now()
                });
                Battle.saveBattleState();
            }
        }
        if (Battle.specialCutsceneAutoBefore === undefined) {
            Battle.specialCutsceneAutoBefore = !!Battle.auto;
            Battle.auto = false;
            Battle.updateAutoButton?.();
        }
        const previous = (Battle.pendingBattleEvent || Promise.resolve()).catch(error => {
            console.error('[Battle] previous battle cutscene failed:', error);
        });
        Battle.pendingBattleEvent = previous.then(async () => {
            Battle.phase = 'battle_event';
            const persistentEntry = persistId
                ? Battle.ensureBattleCutsceneQueue().find(entry => entry?.id === persistId)
                : null;
            const journal = Battle.getPhaseTransitionJournal();
            const transitionToken = persistentEntry?.phaseTransitionToken || options.phaseTransitionToken || null;
            const stepName = persistentEntry?.phaseTransitionStep || transitionStep || null;
            if (persistentEntry) {
                persistentEntry.status = 'running';
                persistentEntry.startedAt = persistentEntry.startedAt || Date.now();
            }
            if (journal && transitionToken && journal.token === transitionToken && stepName) {
                journal.steps = journal.steps || {};
                journal.steps[stepName] = {
                    ...(journal.steps[stepName] || {}),
                    status: 'running',
                    startedAt: journal.steps[stepName]?.startedAt || Date.now()
                };
            }
            if (persistentEntry || (journal && transitionToken)) App.save();

            Battle.playBattleCutsceneVisual(persistentEntry?.visualEffect || options.visualEffect || null);
            let conversationSucceeded = false;
            try {
                const activeConversation = App.data?.progress?.activeConversation;
                const resumeLine = activeConversation?.key === scriptKey
                    ? Math.max(0, Number(activeConversation.index || 0))
                    : 0;
                let conversationResult = await StoryManager.showConversation(scriptKey, resumeLine);
                // 別会話の入力待ちと競合した場合は、完了扱いにせず終了まで待つ。
                // 5秒などの固定上限で戦闘を再開すると、会話中に旧ターンが進むため上限を置かない。
                while (conversationResult?.status === 'busy') {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    if (!Battle.active && Battle.phase !== 'result') break;
                    conversationResult = await StoryManager.showConversation(scriptKey, resumeLine);
                }
                const conversationStatus = conversationResult?.status
                    || (conversationResult === false ? 'error' : 'completed');
                if (conversationStatus === 'busy') {
                    if (persistentEntry) {
                        persistentEntry.status = 'queued';
                        persistentEntry.retryAt = Date.now();
                    }
                    if (journal && transitionToken && journal.token === transitionToken && stepName) {
                        journal.steps = journal.steps || {};
                        journal.steps[stepName] = {
                            ...(journal.steps[stepName] || {}),
                            status: 'queued',
                            retryAt: Date.now()
                        };
                    }
                    App.save();
                    return false;
                }
                if (conversationStatus !== 'completed') {
                    throw new Error(`戦闘会話を完了できませんでした: ${scriptKey} (${conversationStatus})`);
                }
                StoryManager.endConversation();
                conversationSucceeded = true;
            } catch (error) {
                console.error(`[Battle] cutscene failed: ${scriptKey}`, error);
                try { StoryManager.endConversation(); } catch (_) {}
                const priorAttempts = Math.max(
                    Number(persistentEntry?.attempts || 0),
                    Number(journal?.steps?.[stepName]?.attempts || 0)
                );
                const attempts = priorAttempts + 1;
                const maxErrorAttempts = Math.max(1, Number(options.maxErrorAttempts || 1));
                const skipAfterError = options.continueOnError === true && attempts >= maxErrorAttempts;
                if (persistentEntry) {
                    persistentEntry.status = skipAfterError ? 'skipped_after_error' : 'error';
                    persistentEntry.attempts = attempts;
                    persistentEntry.error = String(error?.message || error);
                    persistentEntry.lastFailedAt = Date.now();
                }
                if (journal && transitionToken && journal.token === transitionToken && stepName) {
                    journal.steps = journal.steps || {};
                    journal.steps[stepName] = {
                        ...(journal.steps[stepName] || {}),
                        status: skipAfterError ? 'skipped_after_error' : 'error',
                        attempts,
                        error: String(error?.message || error),
                        lastFailedAt: Date.now()
                    };
                }
                App.save();
            } finally {
                const persistentEntry = persistId
                    ? Battle.ensureBattleCutsceneQueue().find(entry => entry?.id === persistId)
                    : null;
                const canDiscardFailedEntry = persistentEntry?.status === 'skipped_after_error';
                if (persistId && App.data?.battle && (conversationSucceeded || canDiscardFailedEntry)) {
                    App.data.battle.cutsceneQueue = Battle.ensureBattleCutsceneQueue()
                        .filter(entry => entry?.id !== persistId);
                }
                if (journal && transitionToken && journal.token === transitionToken && stepName && conversationSucceeded) {
                    journal.steps = journal.steps || {};
                    journal.steps[stepName] = {
                        ...(journal.steps[stepName] || {}),
                        status: 'completed',
                        completedAt: Date.now()
                    };
                }
                if (persistId || (journal && transitionToken)) App.save();
            }
            return conversationSucceeded;
        });
        return Battle.pendingBattleEvent;
    },

    awaitPendingBattleEvent: async () => {
        // 形態移行はupdateDeadState()直後にはrunnerだけが予約され、
        // 会話Promiseがまだ作られていない瞬間がある。ここでfalseを返すと
        // 呼出側が旧ターンを再開し得るため、runnerそのものを完了まで待つ。
        if (!Battle.pendingBattleEvent && Battle.hasPendingPhaseTransition() && !Battle.turnExecutionActive) {
            const journal = Battle.getPhaseTransitionJournal();
            if (journal?.token) {
                if (Battle.phaseTransitionRunnerActive) {
                    while (Battle.active && Battle.phaseTransitionRunnerActive &&
                        Battle.getPhaseTransitionJournal()?.token === journal.token) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                } else {
                    await Battle.runPhaseTransitionSequence(journal.token);
                }
                return true;
            }
        }
        if (!Battle.pendingBattleEvent) return false;
        let result = false;
        try {
            result = await Battle.pendingBattleEvent;
        } catch (error) {
            console.error('[Battle] battle event wait failed:', error);
        } finally {
            Battle.pendingBattleEvent = null;
            const restoreAuto = Battle.specialCutsceneAutoBefore;
            Battle.specialCutsceneAutoBefore = undefined;
            if (restoreAuto !== undefined) {
                Battle.auto = !!restoreAuto;
                Battle.updateAutoButton?.();
            }
        }
        return result;
    },

    waitForPhaseTransition: (ms, token) => new Promise(resolve => {
        setTimeout(() => {
            const journal = Battle.getPhaseTransitionJournal();
            resolve(!!(Battle.active && journal && journal.token === token));
        }, Math.max(0, Number(ms || 0)));
    }),

    resolvePhaseTransitionVisualSource: (snapshot, fallbackMonsterId) => {
        const baseId = Number(snapshot?.baseId || fallbackMonsterId || 0);
        const base = Battle.getMonsterBaseById?.(baseId) || {};
        const visualMonster = {
            ...base,
            ...(snapshot || {}),
            id: baseId || base.id,
            baseId: baseId || base.id,
            name: snapshot?.name || base.name || '',
            imageId: snapshot?.imageId ?? base.imageId ?? base.baseImageId ?? null
        };
        const graphics = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};
        return Battle.resolveMonsterImage?.(visualMonster, graphics) || { src: null, fallback: null };
    },

    showPhaseTransitionStill: (journal, form = 'from') => {
        const visual = journal?.visual;
        if (!visual || visual.type !== 'alternating-forms-flash' || typeof document === 'undefined') return false;
        const container = Battle.getEl('enemy-container');
        if (!container) return false;
        const snapshot = form === 'to' ? journal.toSnapshot : journal.fromSnapshot;
        const monsterId = form === 'to' ? journal.toMonsterId : journal.fromMonsterId;
        const imageInfo = Battle.resolvePhaseTransitionVisualSource(snapshot, monsterId);
        if (!imageInfo?.src) return false;

        container.querySelectorAll('.phase-form-transition-layer').forEach(node => node.remove());
        const layer = document.createElement('div');
        layer.className = 'phase-form-transition-layer is-still';
        layer.dataset.phaseTransitionToken = journal.token;
        layer.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.className = `phase-form-transition-image ${form === 'to' ? 'is-second-form' : 'is-first-form'}`;
        image.dataset.form = form === 'to' ? 'second' : 'first';
        image.alt = '';
        image.src = imageInfo.src;
        image.onerror = () => {
            const fallback = imageInfo.fallback;
            image.onerror = null;
            if (fallback && image.src !== fallback) image.src = fallback;
        };
        layer.appendChild(image);
        container.classList.add('phase-form-transition-active');
        container.appendChild(layer);
        return true;
    },

    playPhaseTransitionVisual: async (journal) => {
        const visual = journal?.visual;
        if (!visual || visual.type !== 'alternating-forms-flash' || typeof document === 'undefined') {
            Battle.renderEnemies?.();
            return true;
        }
        const token = journal.token;
        const container = Battle.getEl('enemy-container');
        if (!container) {
            Battle.renderEnemies?.();
            return false;
        }

        const nextEnemy = (Battle.enemies || []).find(enemy =>
            (journal.battleUnitId && enemy?.battleUnitId === journal.battleUnitId) ||
            Battle.getUnitBaseId(enemy) === Number(journal.toMonsterId)
        );
        const fromImage = Battle.resolvePhaseTransitionVisualSource(journal.fromSnapshot, journal.fromMonsterId);
        const toImage = Battle.resolvePhaseTransitionVisualSource(
            journal.toSnapshot || Battle.serializeEnemyState?.(nextEnemy),
            journal.toMonsterId
        );
        if (!fromImage?.src || !toImage?.src) {
            Battle.renderEnemies?.();
            return false;
        }

        container.querySelectorAll('.phase-form-transition-layer').forEach(node => node.remove());
        const layer = document.createElement('div');
        layer.className = 'phase-form-transition-layer';
        layer.dataset.phaseTransitionToken = token;
        layer.setAttribute('aria-hidden', 'true');

        const image = document.createElement('img');
        image.className = 'phase-form-transition-image is-first-form';
        image.alt = '';
        image.src = fromImage.src;
        image.onerror = () => {
            const fallback = image.dataset.form === 'second' ? toImage.fallback : fromImage.fallback;
            image.onerror = null;
            if (fallback && image.src !== fallback) image.src = fallback;
        };

        const flash = document.createElement('div');
        flash.className = 'phase-form-transition-flash';
        layer.appendChild(image);
        layer.appendChild(flash);
        container.classList.add('phase-form-transition-active');
        container.appendChild(layer);

        const stillCurrent = () => {
            const current = Battle.getPhaseTransitionJournal();
            return !!(Battle.active && current && current.token === token);
        };
        const showForm = (second) => {
            image.dataset.form = second ? 'second' : 'first';
            image.classList.toggle('is-first-form', !second);
            image.classList.toggle('is-second-form', second);
            image.src = second ? toImage.src : fromImage.src;
        };
        const swapWithFlash = async (second, strong = false) => {
            flash.className = `phase-form-transition-flash is-active${strong ? ' is-strong' : ''}`;
            void flash.offsetWidth;
            const rise = strong ? 150 : 70;
            const tail = strong ? 360 : 170;
            if (!await Battle.waitForPhaseTransition(rise, token)) return false;
            showForm(second);
            if (!await Battle.waitForPhaseTransition(tail, token)) return false;
            flash.className = 'phase-form-transition-flash';
            return stillCurrent();
        };

        try {
            if (!await Battle.waitForPhaseTransition(Number(visual.firstHoldMs || 240), token)) return false;
            const alternations = Math.max(2, Math.min(5, Number(visual.alternations || 3)));
            for (let i = 0; i < alternations; i++) {
                if (!await swapWithFlash(true, false)) return false;
                if (!await Battle.waitForPhaseTransition(Number(visual.formHoldMs || 150), token)) return false;
                if (!await swapWithFlash(false, false)) return false;
                if (!await Battle.waitForPhaseTransition(Number(visual.formHoldMs || 150), token)) return false;
            }
            if (!await swapWithFlash(true, true)) return false;
            if (!await Battle.waitForPhaseTransition(Number(visual.finalHoldMs || 360), token)) return false;
            return true;
        } finally {
            container.classList.remove('phase-form-transition-active');
            layer.remove();
            Battle.renderEnemies?.();
        }
    },

    runPhaseTransitionConversationStep: async (journal, stepName, scriptKey) => {
        if (!scriptKey) {
            journal.steps = journal.steps || {};
            journal.steps[stepName] = { status: 'completed', completedAt: Date.now(), skipped: true };
            App.save();
            return true;
        }
        if (!globalThis.StoryManager?.showConversation) {
            journal.steps = journal.steps || {};
            journal.steps[stepName] = {
                status: 'skipped_after_error',
                error: 'StoryManager.showConversation is unavailable',
                completedAt: Date.now()
            };
            App.save();
            return true;
        }
        const prior = journal.steps?.[stepName];
        if (prior?.status === 'completed' || prior?.status === 'skipped_after_error') return true;
        journal.status = `${stepName}_conversation`;
        App.save();
        Battle.queueBattleConversation(scriptKey, {
            persistId: `${journal.token}:${stepName}:${scriptKey}`,
            resumePhase: 'battle_event',
            phaseTransitionToken: journal.token,
            phaseTransitionStep: stepName,
            continueOnError: true,
            maxErrorAttempts: 3
        });
        await Battle.awaitPendingBattleEvent();
        const finalStep = journal.steps?.[stepName];
        return finalStep?.status === 'completed' || finalStep?.status === 'skipped_after_error';
    },

    rebuildRuntimeForNextPhase: (journal) => {
        if (!journal || !Battle.active) return false;
        const snapshots = (Battle.enemies || []).map(Battle.serializeEnemyState).filter(Boolean);
        const rebuiltEnemies = snapshots.map(snapshot => {
            const base = Battle.getMonsterBaseById?.(snapshot.baseId);
            if (!base) return null;
            // 生成経路を通常の動的モンスター生成へ統一し、状態コンテナ・識別子・
            // 将来追加される初期化処理の取りこぼしを防ぐ。
            const monster = Battle.createMonsterFromBase?.(base, { isBossBattle: true })
                || (typeof Monster === 'function' ? new Monster(base, 1.0) : null);
            if (!monster) return null;
            return Battle.restoreEnemyState(monster, snapshot, base);
        }).filter(Boolean);
        if (rebuiltEnemies.length !== snapshots.length || rebuiltEnemies.length === 0) {
            throw new Error('次形態の敵ランタイム再構築に失敗しました');
        }

        Battle.runtimeGeneration = Math.max(0, Number(Battle.runtimeGeneration || 0)) + 1;
        const transitionedEnemy = rebuiltEnemies.find(enemy =>
            (journal.battleUnitId && enemy?.battleUnitId === journal.battleUnitId) ||
            Battle.getUnitBaseId(enemy) === Number(journal.toMonsterId)
        );
        if (!transitionedEnemy || !Battle.isBattleAlive(transitionedEnemy)) {
            throw new Error('次形態の生存ランタイムを確認できませんでした');
        }
        Battle.ensureUnitBattleStatus(transitionedEnemy);

        Battle.enemies = rebuiltEnemies;
        Battle.assignDuplicateMonsterSuffixes(Battle.enemies);
        Battle.resetInputStateForPhaseTransition();
        Battle.pendingBattleEvent = null;
        Battle.openingBattleConversations = (Battle.openingBattleConversations || [])
            .filter(entry => entry?.phaseTransitionToken !== journal.token);
        Battle.turnExecutionActive = false;
        Battle.turnExecutionToken = null;
        Battle.turnRecoveryAttempts = 0;
        Battle.inputRecoveryAttempts = 0;
        Battle.inputRecoveryScheduled = false;
        Battle.deferredPhaseTransitionResumeToken = null;
        Battle.isPreemptive = false;
        Battle.isAmbushed = false;
        Battle.phase = 'phase_transition_ready';
        [...(Battle.party || []), ...(Battle.enemies || [])].forEach(unit => {
            if (!unit) return;
            unit.turnProcessed = false;
            unit.hasDiedThisTurn = false;
            if (unit.status) unit.status.defend = false;
        });
        journal.steps = journal.steps || {};
        journal.steps.runtime = { status: 'completed', completedAt: Date.now() };
        journal.status = 'ready_for_input';
        journal.readyForInputAt = Date.now();
        if (Battle.saveBattleState() === false) {
            throw new Error('次形態ランタイムを保存できませんでした。');
        }
        Battle.renderEnemies?.();
        Battle.renderPartyStatus?.();
        return true;
    },

    startInputAfterPhaseTransition: (token) => {
        const journal = Battle.getPhaseTransitionJournal();
        if (!journal || journal.token !== token || !Battle.isPhaseTransitionInputReadyStatus(journal.status)) return false;
        if (!Battle.active || Battle.turnExecutionActive || Battle.phaseTransitionRunnerActive) return false;
        try {
            Battle.phase = 'phase_transition_ready';
            return Battle.startInputPhase() === true;
        } catch (error) {
            console.error('[Battle] phase transition input start failed:', error);
            const current = Battle.getPhaseTransitionJournal();
            if (current && current.token === token) {
                current.status = 'ready_for_input';
                current.inputStartError = String(error?.message || error);
                current.inputStartErrorAt = Date.now();
                try { App.save(); } catch (_) {}
            }
            Battle.phase = 'phase_transition_ready';
            Battle.commandQueue = [];
            Battle.currentActorIndex = 0;
            Battle.selectingAction = null;
            Battle.selectedItemOrSkill = null;
            Battle.closeSubMenu?.();
            Battle.renderEnemies?.();
            Battle.renderPartyStatus?.();
            return false;
        }
    },

    runPhaseTransitionSequence: async (token) => {
        const journal = Battle.getPhaseTransitionJournal();
        if (!journal || journal.token !== token || !Battle.active) return false;
        if (Battle.turnExecutionActive) {
            Battle.schedulePhaseTransitionRunner();
            return false;
        }
        if (Battle.phaseTransitionRunnerActive) return false;

        Battle.phaseTransitionRunnerActive = true;
        Battle.phaseTransitionRunnerToken = token;
        let shouldStartInput = false;
        let shouldRetry = false;
        try {
            Battle.phase = 'battle_event';
            Battle.resetInputStateForPhaseTransition();
            Battle.showPhaseTransitionStill(journal, 'from');

            if (!journal.steps?.pre?.status || !['completed', 'skipped_after_error'].includes(journal.steps.pre.status)) {
                const preCompleted = await Battle.runPhaseTransitionConversationStep(journal, 'pre', journal.preConversation);
                if (!preCompleted) {
                    shouldRetry = true;
                    return false;
                }
            }
            if (!Battle.active || Battle.getPhaseTransitionJournal()?.token !== token) return false;

            if (!journal.steps?.visual || journal.steps.visual.status !== 'completed') {
                journal.status = 'visual_running';
                journal.steps = journal.steps || {};
                journal.steps.visual = { ...(journal.steps.visual || {}), status: 'running', startedAt: Date.now() };
                App.save();
                try {
                    const visualCompleted = await Battle.playPhaseTransitionVisual(journal);
                    if (visualCompleted !== true) throw new Error('形態移行演出を完了できませんでした。');
                    journal.steps.visual = { status: 'completed', completedAt: Date.now(), attempts: Number(journal.steps.visual?.attempts || 0) };
                } catch (error) {
                    console.error('[Battle] phase transition visual failed:', error);
                    const attempts = Math.max(0, Number(journal.steps.visual?.attempts || 0)) + 1;
                    journal.steps.visual = {
                        status: attempts >= 3 ? 'skipped_after_error' : 'retry',
                        attempts,
                        error: String(error?.message || error),
                        lastFailedAt: Date.now()
                    };
                    journal.status = attempts >= 3 ? 'visual_skipped' : 'visual_pending';
                    Battle.renderEnemies?.();
                    App.save();
                    if (attempts < 3) {
                        shouldRetry = true;
                        return false;
                    }
                }
                App.save();
            }
            if (!Battle.active || Battle.getPhaseTransitionJournal()?.token !== token) return false;

            if (!journal.steps?.post?.status || !['completed', 'skipped_after_error'].includes(journal.steps.post.status)) {
                const postCompleted = await Battle.runPhaseTransitionConversationStep(journal, 'post', journal.postConversation);
                if (!postCompleted) {
                    shouldRetry = true;
                    return false;
                }
            }
            if (!Battle.active || Battle.getPhaseTransitionJournal()?.token !== token) return false;

            Battle.rebuildRuntimeForNextPhase(journal);
            shouldStartInput = true;
            return true;
        } catch (error) {
            console.error('[Battle] phase transition sequence failed:', error);
            const current = Battle.getPhaseTransitionJournal();
            if (current && current.token === token) {
                current.status = 'recovery';
                current.lastError = String(error?.message || error);
                current.lastErrorAt = Date.now();
                try {
                    Battle.rebuildRuntimeForNextPhase(current);
                    shouldStartInput = true;
                } catch (recoveryError) {
                    current.status = 'recovery_error';
                    current.recoveryError = String(recoveryError?.message || recoveryError);
                    current.recoveryErrorAt = Date.now();
                    try { App.save(); } catch (_) {}
                    console.error('[Battle] phase transition recovery failed:', recoveryError);
                }
            }
            return false;
        } finally {
            if (Battle.phaseTransitionRunnerToken === token) {
                Battle.phaseTransitionRunnerActive = false;
                Battle.phaseTransitionRunnerToken = null;
            }
            if (shouldStartInput) {
                // runnerロックは直前で解除済み。タイマーや別microtaskへ委ねず、
                // この形態移行Promiseの完了条件として入力再構築まで確定する。
                Battle.startInputAfterPhaseTransition(token);
            } else if (shouldRetry) {
                setTimeout(() => {
                    const current = Battle.getPhaseTransitionJournal();
                    if (Battle.active && current?.token === token) Battle.schedulePhaseTransitionRunner();
                }, 100);
            }
        }
    },

    schedulePhaseTransitionRunner: () => {
        const journal = Battle.getPhaseTransitionJournal();
        if (!journal || !Battle.active || Battle.phase === 'result') return false;
        if (Battle.isPhaseTransitionInputReadyStatus(journal.status)) {
            if (!Battle.turnExecutionActive && !Battle.phaseTransitionRunnerActive) {
                const resume = () => Battle.startInputAfterPhaseTransition(journal.token);
                if (typeof queueMicrotask === 'function') queueMicrotask(resume);
                else Promise.resolve().then(resume);
            }
            return true;
        }
        if (Battle.turnExecutionActive || Battle.phaseTransitionRunnerActive || Battle.phaseTransitionRunnerScheduled) return true;
        Battle.phaseTransitionRunnerScheduled = true;
        const token = journal.token;
        const start = () => {
            Battle.phaseTransitionRunnerScheduled = false;
            const current = Battle.getPhaseTransitionJournal();
            if (!Battle.active || !current || current.token !== token || Battle.turnExecutionActive) return;
            Battle.runPhaseTransitionSequence(token);
        };
        if (typeof queueMicrotask === 'function') queueMicrotask(start);
        else Promise.resolve().then(start);
        return true;
    },

    resumeInputAfterPhaseTransition: () => Battle.schedulePhaseTransitionRunner(),
    restartInputAfterPhaseTransition: () => Battle.schedulePhaseTransitionRunner(),

    getPhaseTransitionConfig: (enemy) => {
        if (!enemy) return null;
        const base = Battle.getMonsterBaseById?.(Battle.getUnitBaseId(enemy));
        if (!base) return null;
        const nested = (base.phaseTransition && typeof base.phaseTransition === 'object') ? base.phaseTransition : {};
        const nextMonsterId = Number(nested.monsterId ?? base.phaseTransitionMonsterId);
        if (!Number.isFinite(nextMonsterId) || nextMonsterId <= 0) return null;
        return {
            nextMonsterId,
            conversation: nested.conversation || base.phaseTransitionConversation || null,
            preConversation: nested.preConversation || nested.conversation || base.phaseTransitionConversation || null,
            postConversation: nested.postConversation || base.phaseTransitionPostConversation || null,
            visual: nested.visual && typeof nested.visual === 'object'
                ? JSON.parse(JSON.stringify(nested.visual))
                : (base.phaseTransitionVisual && typeof base.phaseTransitionVisual === 'object'
                    ? JSON.parse(JSON.stringify(base.phaseTransitionVisual))
                    : null),
            effects: nested.effects || base.phaseTransitionEffects || null,
            preserveOctaprism: nested.preserveOctaprism === true || base.phaseTransitionPreserveOctaprism === true,
            resumePhase: nested.resumePhase || 'input'
        };
    },

    recordDefeatedPhase: (enemy) => {
        if (!enemy || !App.data?.battle) return null;
        Battle.ensureEnemyBattleIdentity(enemy);
        if (!Array.isArray(App.data.battle.defeatedPhases)) App.data.battle.defeatedPhases = [];
        const baseId = Battle.getUnitBaseId(enemy);
        const key = `${enemy.battleUnitId}:${enemy.phaseIndex}:${baseId}`;
        const existing = App.data.battle.defeatedPhases.find(entry => entry?.key === key);
        if (existing) return existing;
        const snapshot = Battle.serializeEnemyState(enemy);
        snapshot.hp = 0;
        const entry = {
            key,
            battleUnitId: enemy.battleUnitId,
            phaseIndex: Math.max(1, Number(enemy.phaseIndex || 1)),
            baseId,
            snapshot,
            defeatedAt: Date.now()
        };
        App.data.battle.defeatedPhases.push(entry);
        return entry;
    },

    collectDefeatedEnemiesForResult: () => {
        const results = [];
        const seen = new Set();
        const add = (enemy, key) => {
            if (!enemy || seen.has(key)) return;
            seen.add(key);
            results.push(enemy);
        };
        (App.data?.battle?.defeatedPhases || []).forEach(entry => {
            const snapshot = entry?.snapshot;
            if (!snapshot) return;
            add({
                ...JSON.parse(JSON.stringify(snapshot)),
                id: Number(snapshot.baseId || entry.baseId),
                baseId: Number(snapshot.baseId || entry.baseId),
                baseMaxHp: Math.max(1, Number(snapshot.maxHp || 1)),
                baseMaxMp: Math.max(0, Number(snapshot.maxMp || 0)),
                isDead: true,
                isFled: false,
                battleUnitId: entry.battleUnitId,
                phaseIndex: entry.phaseIndex,
                isPhaseRewardSnapshot: true
            }, entry.key || `${entry.battleUnitId}:${entry.phaseIndex}:${entry.baseId}`);
        });
        (Battle.enemies || []).forEach(enemy => {
            if (!enemy?.isDead || enemy.isFled) return;
            Battle.ensureEnemyBattleIdentity(enemy);
            add(enemy, `${enemy.battleUnitId}:${enemy.phaseIndex}:${Battle.getUnitBaseId(enemy)}`);
        });
        return results;
    },

    applyPhaseTransitionEffects: (effects) => {
        if (!effects || typeof effects !== 'object') return;
        const partyEffect = effects.party;
        if (partyEffect && typeof partyEffect === 'object') {
            (Battle.party || []).forEach(member => {
                if (!member) return;
                if (partyEffect.revive === true) {
                    member.isDead = false;
                    member.isFled = false;
                    member.hasDiedThisTurn = false;
                }
                if (partyEffect.fullRestore === true) {
                    member.hp = Math.max(1, Number(member.baseMaxHp || member.maxHp || member.hp || 1));
                    member.mp = Math.max(0, Number(member.baseMaxMp || member.maxMp || member.mp || 0));
                }
                const status = Battle.ensureUnitBattleStatus(member);
                Object.entries(partyEffect.buffs || {}).forEach(([key, raw]) => {
                    const val = Number(raw);
                    if (!Number.isFinite(val) || val <= 0) return;
                    status.buffs[key] = {
                        val,
                        turns: partyEffect.turns ?? null,
                        source: partyEffect.source || 'phase_transition'
                    };
                });
            });
        }
        if (effects.log) Battle.log(String(effects.log));
    },

    transitionEnemyPhase: (enemy, index, config) => {
        if (!enemy || !config || enemy.phaseTransitioned || enemy.abyssPhaseTransitioned) return false;
        // 一つの戦闘で複数の形態移行が同時に成立しても、単一ジャーナルを上書きしない。
        // 先行する移行が完了した次の死亡更新で、残った対象を順に処理する。
        if (Battle.getPhaseTransitionJournal()) return false;
        const nextBase = Battle.getMonsterBaseById?.(config.nextMonsterId);
        if (!nextBase) {
            console.error(`[Battle] phase transition target is missing: ${config.nextMonsterId}`);
            return false;
        }
        // 次形態の生成に成功してから旧形態を確定する。
        // マスタ不整合や生成例外で、旧形態だけが移行済みになる状態を作らない。
        const nextForm = Battle.createMonsterFromBase(nextBase, { isBossBattle: true, name: nextBase.name });
        if (!nextForm) return false;
        Battle.ensureEnemyBattleIdentity(enemy);
        Battle.recordDefeatedPhase(enemy);
        enemy.phaseTransitioned = true;
        enemy.abyssPhaseTransitioned = true;
        Battle.ensureEnemyBattleIdentity(nextForm, {
            battleUnitId: enemy.battleUnitId,
            phaseIndex: Number(enemy.phaseIndex || 1) + 1,
            phaseRootId: enemy.phaseRootId || Battle.getUnitBaseId(enemy)
        });
        nextForm.isDead = false;
        nextForm.isFled = false;
        nextForm.hasDiedThisTurn = false;
        Battle.ensureUnitBattleStatus(nextForm);
        nextForm.hp = Math.max(1, Number(nextForm.baseMaxHp || nextForm.maxHp || nextForm.hp || nextBase.hp || 1));
        nextForm.mp = Math.max(0, Number(nextForm.baseMaxMp || nextForm.maxMp || nextForm.mp || nextBase.mp || 0));
        if ((config.preserveOctaprism || App.data?.battle?.abyssOctaprismUsed) &&
            App.data?.battle?.abyssOctaprismUsed && Battle.abyssAzelgaragIds.includes(Battle.getUnitBaseId(nextForm))) {
            Battle.applyOctaprismToEnemy(nextForm);
        }
        Battle.enemies[index] = nextForm;
        Battle.assignDuplicateMonsterSuffixes(Battle.enemies);

        if (App.data?.battle) {
            const fixedBossId = App.data.battle.fixedBossId;
            const oldId = Battle.getUnitBaseId(enemy);
            if (Array.isArray(fixedBossId)) {
                App.data.battle.fixedBossId = fixedBossId.map(id => Number(id) === oldId ? config.nextMonsterId : id);
            } else if (Number(fixedBossId) === oldId) {
                App.data.battle.fixedBossId = config.nextMonsterId;
            }
            App.data.battle.phaseTransitionCount = Math.max(1, Number(App.data.battle.phaseTransitionCount || 0) + 1);
            App.data.battle.currentPhaseMonsterId = config.nextMonsterId;
        }
        Battle.applyPhaseTransitionEffects(config.effects);
        const transitionJournal = Battle.beginPhaseTransitionJournal(enemy, nextForm, config);
        Battle.saveBattleState();
        if (transitionJournal && !Battle.turnExecutionActive) Battle.schedulePhaseTransitionRunner();
        return true;
    },

    getOctaprismSupportMaster: () => globalThis.ABYSS_REGION_CONTENT?.octaprismSupportMaster || null,

    isAzelgaragBattle: () => {
        if (Battle.isStoryBossTrainingBattle?.()) return false;
        const master = Battle.getOctaprismSupportMaster();
        const targetIds = Array.isArray(master?.azelgaragMonsterIds)
            ? master.azelgaragMonsterIds.map(Number)
            : Battle.abyssAzelgaragIds.slice();
        const fixedIds = (Array.isArray(App.data?.battle?.fixedBossId)
            ? App.data.battle.fixedBossId
            : [App.data?.battle?.fixedBossId]).map(Number).filter(Number.isFinite);
        if (fixedIds.some(id => targetIds.includes(id))) return true;
        return (Battle.enemies || []).some(enemy => targetIds.includes(Battle.getUnitBaseId(enemy)));
    },

    initializeOctaprismBattleState: () => {
        const battleData = App.data?.battle;
        const master = Battle.getOctaprismSupportMaster();
        if (!battleData || !master) return null;
        const eligible = Battle.isAzelgaragBattle();
        const itemId = Number(master.itemId || 701008);
        const legacyActivated = battleData.abyssOctaprismUsed === true;
        const previous = battleData.octaprismState && typeof battleData.octaprismState === 'object'
            ? battleData.octaprismState
            : null;
        // 一度戦闘状態を作成した後は、現在の所持数を再参照しない。
        // 再読込や形態移行で途中から有効化・無効化されないよう、開始時判定を正本にする。
        const hasPossessionSnapshot = previous && typeof previous.possessedAtBattleStart === 'boolean';
        const possessedAtBattleStart = hasPossessionSnapshot
            ? previous.possessedAtBattleStart === true
            : (legacyActivated || Number(App.data?.items?.[itemId] || 0) > 0);
        const state = previous || {
            version: 1,
            startedAt: Date.now(),
            supportHistory: [],
            lastSpirit: null,
            turnSupport: null
        };
        state.version = 1;
        state.eligible = eligible;
        state.possessedAtBattleStart = possessedAtBattleStart;
        state.active = eligible && possessedAtBattleStart;
        if (legacyActivated) state.legacyManualUseConverted = true;
        if (!Array.isArray(state.supportHistory)) state.supportHistory = [];
        battleData.octaprismState = state;
        if (state.active) Battle.applyOctaprismHeroChaosResistance(state);
        return state;
    },

    getOctaprismHero: () => {
        const master = Battle.getOctaprismSupportMaster();
        const heroId = Number(master?.heroCharacterId || 301);
        return (Battle.party || []).find(member => Number(member?.originData?.charId || member?.charId || 0) === heroId) || null;
    },

    applyOctaprismHeroChaosResistance: (state = App.data?.battle?.octaprismState) => {
        if (!state?.active) return false;
        const master = Battle.getOctaprismSupportMaster();
        const hero = Battle.getOctaprismHero();
        if (!hero) return false;
        if (!hero.elmRes || typeof hero.elmRes !== 'object') hero.elmRes = {};
        const floor = Math.max(0, Number(master?.heroChaosResistanceFloor || 90));
        const before = Number(hero.elmRes['混沌'] || 0);
        hero.elmRes['混沌'] = Math.max(before, floor);
        state.heroChaosResistance = {
            characterId: Number(hero?.originData?.charId || hero?.charId || 0),
            before,
            after: Number(hero.elmRes['混沌'] || 0),
            applied: before < floor
        };
        return before < floor;
    },

    getOctaprismCurrentPhaseId: () => {
        const current = (Battle.enemies || []).find(enemy => Battle.isBattleAlive(enemy))
            || (Battle.enemies || [])[0];
        return Battle.getUnitBaseId(current) || Number(App.data?.battle?.currentPhaseMonsterId || 0);
    },

    mergeOctaprismStatusEffect: (target, category, key, value, turns, mode = 'replace') => {
        if (!target) return null;
        const status = Battle.ensureUnitBattleStatus(target);
        const bucket = status[category] || (status[category] = {});
        const current = bucket[key];
        let mergedValue = Number(value);
        if (current && Number.isFinite(Number(current.val))) {
            if (mode === 'max') mergedValue = Math.max(Number(current.val), Number(value));
            else if (mode === 'min') mergedValue = Math.min(Number(current.val), Number(value));
        }
        bucket[key] = {
            val: mergedValue,
            turns: Math.max(Number(current?.turns || 0), Math.max(1, Number(turns || 1))),
            source: `octaprism_${String(key)}`
        };
        return bucket[key];
    },

    showOctaprismSpiritEffect: (support, targets) => {
        const fx = (typeof window !== 'undefined') ? window.PolishBattleFX : null;
        if (!fx || typeof fx.screenEffect !== 'function') return;
        try {
            fx.screenEffect(support.fx || 'light', {
                big: true,
                targets: Array.isArray(targets) ? targets.filter(Boolean) : []
            });
        } catch (error) {
            console.warn('[Battle] octaprism spirit effect skipped:', error);
        }
    },

    applyOctaprismSpiritSupport: (element, turnNumber) => {
        const master = Battle.getOctaprismSupportMaster();
        const support = master?.supports?.[element];
        const state = App.data?.battle?.octaprismState;
        if (!state?.active || !support) return null;
        const livingParty = (Battle.party || []).filter(member => Battle.isBattleAlive(member));
        const allParty = (Battle.party || []).filter(Boolean);
        const livingEnemies = (Battle.enemies || []).filter(enemy => Battle.isBattleAlive(enemy));
        let effected = 0;
        let total = 0;
        let targets = [];

        if (support.type === 'hpRecovery') {
            targets = livingParty;
            targets.forEach(member => {
                const maxHp = Math.max(1, Number(member.baseMaxHp || member.maxHp || member.hp || 1));
                const amount = Math.max(Number(support.minimum || 1), Math.floor(maxHp * Number(support.maxHpRate || 0)));
                const healed = Math.max(0, Math.min(amount, maxHp - Number(member.hp || 0)));
                member.hp = Math.min(maxHp, Number(member.hp || 0) + healed);
                total += healed;
                if (healed > 0) effected += 1;
            });
            Battle.log(`<span style="color:#9fffe0;">風の大精霊の支援！ 味方全体のHPが${total}回復した！</span>`);
        } else if (support.type === 'mpRecovery') {
            targets = allParty;
            targets.forEach(member => {
                const maxMp = Math.max(0, Number(member.baseMaxMp || member.maxMp || member.mp || 0));
                const amount = maxMp > 0
                    ? Math.max(Number(support.minimum || 1), Math.floor(maxMp * Number(support.maxMpRate || 0)))
                    : 0;
                const recovered = Math.max(0, Math.min(amount, maxMp - Number(member.mp || 0)));
                member.mp = Math.min(maxMp, Number(member.mp || 0) + recovered);
                total += recovered;
                if (recovered > 0) effected += 1;
            });
            Battle.log(`<span style="color:#8fd8ff;">水の大精霊の支援！ 味方全体のMPが${total}回復した！</span>`);
        } else if (support.type === 'elementResistance') {
            targets = livingParty;
            targets.forEach(member => {
                Battle.mergeOctaprismStatusEffect(member, 'buffs', 'elmResUp', Number(support.value || 50), support.turns || 1, 'max');
                effected += 1;
            });
            Battle.log(`<span style="color:#fff3a8;">光の大精霊の支援！ このターン、味方全体の全属性耐性が${Number(support.value || 50)}%上昇！</span>`);
        } else if (support.type === 'allStatDown') {
            targets = livingEnemies;
            targets.forEach(enemy => {
                (support.stats || ['atk','def','spd','mag','mdef']).forEach(key => {
                    Battle.mergeOctaprismStatusEffect(enemy, 'debuffs', key, Number(support.multiplier || 0.9), support.turns || 2, 'min');
                });
                effected += 1;
            });
            Battle.log('<span style="color:#d7a6ff;">闇の大精霊の支援！ 深淵王の全能力が低下した！</span>');
        } else if (support.type === 'damage' || support.type === 'damageAndDefenseDown') {
            targets = livingEnemies;
            const phaseId = Battle.getOctaprismCurrentPhaseId();
            const cap = Math.max(1, Number(support.damageCapByPhase?.[phaseId] || Number.MAX_SAFE_INTEGER));
            targets.forEach(enemy => {
                const maxHp = Math.max(1, Number(enemy.baseMaxHp || enemy.maxHp || enemy.hp || 1));
                const damage = Math.max(1, Math.min(cap, Math.floor(maxHp * Number(support.maxHpRate || 0))));
                const applied = Math.min(Math.max(0, Number(enemy.hp || 0)), damage);
                enemy.hp = Math.max(0, Number(enemy.hp || 0) - applied);
                total += applied;
                if (applied > 0) effected += 1;
                if (support.type === 'damageAndDefenseDown' && enemy.hp > 0) {
                    Battle.mergeOctaprismStatusEffect(enemy, 'debuffs', 'octaprismDef', Number(support.defenseMultiplier || 0.85), support.turns || 1, 'min');
                }
                if (enemy.hp <= 0) Battle.markDefeated(enemy, false);
            });
            if (support.type === 'damageAndDefenseDown') {
                Battle.log(`<span style="color:#fff07a;">雷の大精霊の支援！ 深淵王へ${total}ダメージを与え、守備力を低下させた！</span>`);
            } else {
                Battle.log(`<span style="color:#ff9b72;">炎の大精霊の支援！ 深淵王へ${total}ダメージ！</span>`);
            }
        }

        Battle.showOctaprismSpiritEffect(support, targets);
        Battle.renderEnemies?.();
        Battle.renderPartyStatus?.();
        const outcome = {
            turnNumber: Math.max(1, Number(turnNumber || 1)),
            element,
            type: support.type,
            effected,
            total,
            appliedAt: Date.now()
        };
        state.lastSpirit = element;
        state.turnSupport = outcome;
        state.supportHistory.push(outcome);
        if (state.supportHistory.length > 24) state.supportHistory.splice(0, state.supportHistory.length - 24);
        return outcome;
    },

    processOctaprismTurnStart: (options = {}) => {
        const state = App.data?.battle?.octaprismState || Battle.initializeOctaprismBattleState();
        const master = Battle.getOctaprismSupportMaster();
        if (!state?.active || !master) return null;
        const turnNumber = Math.max(1, Number(options.turnNumber || App.data?.battle?.turnNumber || 1));
        // エラー復旧や形態移行再開で同じターン実行経路へ戻っても、支援を二重適用しない。
        if (Number(state.turnSupport?.turnNumber || 0) === turnNumber) return state.turnSupport;
        const rng = typeof options.rng === 'function' ? options.rng : Math.random;
        const triggerRoll = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
        if (triggerRoll >= Number(master.triggerRate || 0.5)) {
            state.turnSupport = { turnNumber, triggered:false, triggerRoll, appliedAt:Date.now() };
            return state.turnSupport;
        }
        let elements = Object.keys(master.supports || {});
        if (master.avoidImmediateRepeat && state.lastSpirit && elements.length > 1) {
            elements = elements.filter(element => element !== state.lastSpirit);
        }
        if (!elements.length) return null;
        const selectRoll = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
        const index = Math.min(elements.length - 1, Math.floor(selectRoll * elements.length));
        const outcome = Battle.applyOctaprismSpiritSupport(elements[index], turnNumber);
        if (outcome) {
            outcome.triggered = true;
            outcome.triggerRoll = triggerRoll;
            outcome.selectRoll = selectRoll;
        }
        return outcome;
    },

    applyOctaprismToEnemy: (enemy) => {
        if (!enemy || !Battle.abyssAzelgaragIds.includes(Battle.getUnitBaseId(enemy))) return;
        const status = Battle.ensureUnitBattleStatus(enemy);
        ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
            status.debuffs[key] = { val: 0.7, turns: null, source: 'octaprism' };
        });
        enemy.abyssSealedSkillIds = Battle.abyssSealedSkillIds.slice();
    },

    tryGutsSurvive: (unit, hpBeforeDamage) => {
        if (!unit || Number(hpBeforeDamage) < 2) return false;
        const gutsChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(unit, 'guts_mult') : 0;
        if (gutsChance > 0 && Math.random() * 100 < gutsChance) {
            unit.hp = 1;
            Battle.log(`${unit.name}は 根性で 踏みとどまった！`);
            return true;
        }
        const unitId = Battle.getUnitBaseId(unit);
        const level = Number(unit?.gutsLevel || Battle.getMonsterBaseById?.(unitId)?.gutsLevel || 0);
        if (Battle.abyssVegnasisIds.includes(unitId) && level > 0 && Math.random() * 100 < Math.min(78, 18 + level * 5)) {
            unit.hp = 1;
            Battle.log(`${unit.name}は深淵の根性で踏みとどまった！`);
            return true;
        }
        return false;
    },

    getEl: (id) => document.getElementById(id),
    
	// ★追加: モンスター名を赤字にするヘルパー関数
    getColoredName: (actor) => {
        if (actor instanceof Monster) {
            return `<span style="color:#ff4444; font-weight:bold;">${actor.name}</span>`;
        }
        return `${actor.name}`;
    },

    // ★追加: スキルが補助（回復・蘇生・強化等）かどうかを判定する
    isSupportSkill: (d) => {
        return Battle.isAllySupportSkill(d);
    },

    // 最大ダメージ記録の共通処理。
    // ストーリー演出用の一時LB99中も、裏技的な達成として記録対象にする。
    recordMaxDamage: (actor, skillData, dmg, cmd = {}) => {
        if (Battle.isStoryBossTrainingBattle()) return;
        if (cmd && cmd.isEnemy) return;
        if (!Number.isFinite(Number(dmg)) || Number(dmg) <= 0) return;
        if (Number(dmg) > (App.data.stats.maxDamage?.val || 0)) {
            App.data.stats.maxDamage = {
                val: Number(dmg),
                actor: actor?.name || '不明',
                actorLv: actor?.level || null,
                skill: skillData ? skillData.name : '通常攻撃',
                time: Date.now()
            };
        }
    },

    getBattleSpeedSetting: () => {
        if (typeof App !== 'undefined' && typeof App.getBattleSpeedSetting === 'function') {
            return App.getBattleSpeedSetting();
        }
        const speed = App?.data?.settings?.battleSpeed || 'normal';
        return ['normal', 'fast', 'fastest'].includes(speed) ? speed : 'normal';
    },

    getBattleWaitMs: (ms) => {
        const base = Math.max(0, Math.floor(Number(ms) || 0));
        if (base <= 0) return 0;
        const speed = Battle.getBattleSpeedSetting();
        if (speed === 'fastest') return Math.max(1, Math.floor(base * 0.30));
        if (speed === 'fast') return Math.max(1, Math.floor(base * 0.50));
        return base;
    },

    schedule: (fn, ms) => setTimeout(fn, Battle.getBattleWaitMs(ms)),

    cycleBattleSpeed: () => {
        const current = Battle.getBattleSpeedSetting();
        const currentIndex = Battle.battleSpeedOrder.indexOf(current);
        const next = Battle.battleSpeedOrder[(currentIndex + 1) % Battle.battleSpeedOrder.length];

        if (typeof App !== 'undefined' && typeof App.setBattleSpeedSetting === 'function') {
            App.setBattleSpeedSetting(next);
        } else if (typeof App !== 'undefined' && App.data) {
            if (!App.data.settings || typeof App.data.settings !== 'object') App.data.settings = {};
            App.data.settings.battleSpeed = next;
            if (typeof App.save === 'function') App.save();
        }
        Battle.updateBattleSpeedButton();
    },

    updateBattleSpeedButton: () => {
        const speed = Battle.getBattleSpeedSetting();
        const btn = Battle.getEl('btn-battle-speed');
        if (!btn) return;

        const icon = Battle.battleSpeedIcons[speed] || Battle.battleSpeedIcons.normal;
        const name = Battle.battleSpeedNames[speed] || Battle.battleSpeedNames.normal;
        btn.textContent = icon;
        btn.dataset.speed = speed;
        btn.setAttribute('aria-label', `戦闘速度: ${name}`);
        btn.title = `戦闘速度: ${name}`;
    },

    // 戦闘ロジックは描画実装に依存させず、導入済みの演出層へHP遷移だけを通知する。
    // 多段攻撃で後続計算が先行しても、HPバーはダメージ数値の表示までは直前値を保つ。
    stageHpVisualTransition: (unit, hpBefore, options = {}) => {
        if (Number(unit?.hp) < Number(hpBefore) && typeof AudioManager !== 'undefined') {
            AudioManager.playSe?.(options.critical ? 'battle_critical' : 'battle_damage');
        }
        const fx = (typeof window !== 'undefined') ? window.PolishBattleFX : null;
        if (fx && typeof fx.stageHpTransition === 'function') {
            fx.stageHpTransition(unit, hpBefore);
        }
    },

    resolveActionSeKey: (cmd, data) => {
        if (cmd?.type !== 'skill') return 'battle_attack';
        const type = String(data?.type || '');
        if (type === 'ブレス') return 'battle_skill_breath';
        if (type === '物理' || type === '通常攻撃') return 'battle_skill_physical';
        if (type === '魔法') return 'battle_skill_magic';
        return 'battle_skill_other';
    },

    playRecoverySe: () => {
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('battle_heal');
    },

    updateResultLevelSkipButton: () => {
        const button = Battle.getEl?.('btn-result-level-skip') || document.getElementById('btn-result-level-skip');
        if (!button) return;
        const visible = Battle.phase === 'result' && Battle.resultLevelSkipActive === true && Battle.resultReadyToEnd !== true;
        button.style.display = visible ? 'block' : 'none';
        button.disabled = !visible || Battle.resultSkipRequested === true;
        button.textContent = Battle.resultSkipRequested ? 'スキップ中' : 'スキップ';
    },

    setResultLevelSkipActive: (active) => {
        Battle.resultLevelSkipActive = active === true;
        if (!Battle.resultLevelSkipActive) Battle.resultSkipRequested = false;
        Battle.updateResultLevelSkipButton();
    },

    requestResultLevelSkip: () => {
        if (Battle.phase !== 'result' || Battle.resultLevelSkipActive !== true) return false;
        Battle.resultSkipRequested = true;
        Battle.updateResultLevelSkipButton();
        if (typeof Battle.resultAdvanceResolver === 'function') {
            const resolveAdvance = Battle.resultAdvanceResolver;
            Battle.resultAdvanceResolver = null;
            try { resolveAdvance(); } catch (error) {}
        }
        if (Array.isArray(Battle.resultWaiters)) {
            const waiters = Battle.resultWaiters.splice(0);
            waiters.forEach(resolve => { try { resolve(); } catch (error) {} });
        }
        return true;
    },

    playResultSeAndWait: async (key, options = {}) => {
        if (typeof AudioManager === 'undefined') return false;
        const playback = typeof AudioManager.playSeAndWait === 'function'
            ? Promise.resolve(AudioManager.playSeAndWait(key))
            : Promise.resolve(AudioManager.playSe?.(key));
        if (options.levelSkippable !== true || Battle.resultSkipRequested) return Battle.resultSkipRequested ? false : playback;
        return Promise.race([
            playback,
            new Promise(resolve => {
                if (!Array.isArray(Battle.resultWaiters)) Battle.resultWaiters = [];
                Battle.resultWaiters.push(() => resolve(false));
            })
        ]);
    },

    waitForResultAdvance: () => {
        if (Battle.phase !== 'result' || (Battle.resultLevelSkipActive && Battle.resultSkipRequested)) return Promise.resolve();
        return new Promise(resolve => {
            Battle.resultAdvanceResolver = () => {
                Battle.resultAdvanceResolver = null;
                resolve();
            };
        });
    },

    // 1ヒット分の計算・ログ・描画を演出側が消化するまで待つ任意フック。
    // polish.js がない環境（Canvasのエラー回避経路を含む）では即時完了する。
    awaitActionVisualPhase: async () => {
        const fx = (typeof window !== 'undefined') ? window.PolishBattleFX : null;
        if (fx && typeof fx.waitForCurrentActionPhase === 'function') {
            await fx.waitForCurrentActionPhase();
        }
    },

    getAutoStartSetting: () => {
        if (typeof App !== 'undefined' && typeof App.getBattleAutoStartSetting === 'function') {
            return App.getBattleAutoStartSetting();
        }
        return App?.data?.settings?.battleAutoStart === true;
    },

    init: (options = {}) => {
        const fixedBossIds = (Array.isArray(App.data?.battle?.fixedBossId)
            ? App.data.battle.fixedBossId
            : [App.data?.battle?.fixedBossId]).map(Number).filter(Number.isFinite);
        const isVegnasisBattle = fixedBossIds.some(id => Battle.abyssVegnasisIds.includes(id));
        const spiritBlessings = App.data?.progress?.abyssSpiritBlessings || {};
        const recognizedSpirits = ['火', '水', '風', '雷', '光', '闇'].filter(element => spiritBlessings[element]);
        if (App.data?.battle) {
            if (!App.data.battle.battleId) {
                App.data.battle.battleId = `battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
            }
            // preparingは報酬適用前のactive戦闘を保存した印。再読込時は通常戦闘へ戻す。
            if (App.data.battle.active && App.data.battle.resultJournal?.status === 'preparing') {
                delete App.data.battle.resultJournal;
            }
            App.data.battle.abyssSpiritFinalBlessing = isVegnasisBattle && recognizedSpirits.length > 0;
            if (!isVegnasisBattle) delete App.data.battle.abyssSpiritFinalBlessing;
        }
        const persistedTransitionToken = Battle.getPhaseTransitionJournal()?.token || null;
        const persistedCutscenes = Array.isArray(App.data?.battle?.cutsceneQueue)
            ? App.data.battle.cutsceneQueue.filter(entry =>
                entry?.scriptKey &&
                entry.status !== 'completed' &&
                (!persistedTransitionToken || entry.phaseTransitionToken !== persistedTransitionToken)
            )
            : [];
        Battle.openingBattleConversations = persistedCutscenes.map(entry => ({
            scriptKey: entry.scriptKey,
            persistId: entry.id,
            resumePhase: entry.resumePhase || 'input',
            phaseTransitionToken: entry.phaseTransitionToken || null,
            visualEffect: entry.visualEffect || null
        }));
        if (isVegnasisBattle && recognizedSpirits.length > 0 && !App.data?.battle?.abyssSpiritFinalBlessingShown) {
            Battle.openingBattleConversations.push({ scriptKey: 'ABYSS_SPIRIT_FINAL_BLESSING', persistId: null });
            if (App.data?.battle) App.data.battle.abyssSpiritFinalBlessingShown = true;
        }
        Battle.pendingBattleEvent = null;
        Battle.specialCutsceneAutoBefore = undefined;
        Battle.phaseTransitionRestartPending = false;
        Battle.phaseTransitionResumeToken = Battle.getPhaseTransitionJournal()?.token || null;
        Battle.deferredPhaseTransitionResumeToken = null;
        Battle.phaseTransitionRunnerActive = false;
        Battle.phaseTransitionRunnerToken = null;
        Battle.phaseTransitionRunnerScheduled = false;
        Battle.turnExecutionActive = false;
        Battle.turnExecutionToken = null;
        if (Battle.finishTimerId) clearTimeout(Battle.finishTimerId);
        Battle.finishState = 'idle';
        Battle.finishToken = null;
        Battle.finishTimerId = null;
        Battle.deferredInputStart = false;
        Battle.inputRecoveryScheduled = false;
        Battle.inputRecoveryAttempts = 0;
        Battle.turnRecoveryAttempts = 0;
        Battle.runtimeGeneration = Math.max(0, Number(Battle.runtimeGeneration || 0)) + 1;
        Battle.inputGeneration = Math.max(0, Number(Battle.inputGeneration || 0)) + 1;
        Battle.active = true;
        Battle.phase = 'init';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.auto = options.forceManual === true ? false : Battle.getAutoStartSetting();
        if (App.data?.battle?.forceAutoOff === true) Battle.auto = false;
        Battle.runAttemptCount = 0; 
        Battle.skillScrollPositions = {};
        Battle.updateAutoButton();
        Battle.updateBattleSpeedButton();
        Battle.resultProcessing = false;
        Battle.resultReadyToEnd = false;
        Battle.resultEndIsGameOver = false;
        Battle.resultInputLocked = false;
        Battle.resultAdvanceResolver = null;
        Battle.resultSkipRequested = false;
        Battle.resultLevelSkipActive = false;
        Battle.resultWaiters = [];
        Battle.updateResultLevelSkipButton?.();
        
        const logEl = Battle.getEl('battle-log');
        if(logEl) logEl.innerHTML = '';

        // 背景管理
        const enemyArea = document.getElementById('enemy-container');
        if (enemyArea) {
            const bgKey = Field.getBattleBg();
            const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};

            // GRAPHICS.load() completes before gameplay begins. A corrupt individual file
            // must still never produce a blank battle frame, so resolve a loaded fallback
            // synchronously instead of drawing a temporary solid-color area.
            const fallbackKeys = ['battle_bg_dungeon', 'battle_bg_field'];
            const resolvedBgKey = [bgKey, ...fallbackKeys].find(key => {
                const image = g[key];
                return !!(image && image.complete && image.naturalWidth > 0);
            });
            const background = resolvedBgKey ? g[resolvedBgKey] : null;

            if (background) {
                enemyArea.style.backgroundImage = `url('${background.src}')`;
                enemyArea.style.backgroundSize = 'cover';
                enemyArea.style.backgroundPosition = 'center bottom';
                enemyArea.style.backgroundRepeat = 'no-repeat';
                enemyArea.dataset.battleBgKey = resolvedBgKey;
                enemyArea.dataset.requestedBattleBgKey = bgKey || '';
            } else {
                // This is a startup-integrity failure, not a supported rendering mode.
                // Keep the prior valid frame rather than flashing black while reporting it.
                console.error(`[Battle] No decoded battle background is available: ${bgKey}`);
            }
        }
        
        // パーティ生成
        Battle.party = [];
        if (App.data && App.data.party) {
            Battle.party = App.data.party.map(uid => {
                if(!uid) return null;
                const charData = App.getChar(uid);
                if(!charData) return null;
                const player = new Player(charData);
                const stats = App.calcStats(charData);
				
				// ★追加：calcStats が作った weaponTypes / weaponType を battle用インスタンスへ引き継ぐ
				player.weaponTypes = charData.weaponTypes || [];
				player.weaponType  = charData.weaponType  || '素手';
				
                player.hp = Math.min(player.hp, stats.maxHp);
                player.mp = Math.min(player.mp, stats.maxMp);
                player.baseMaxHp = stats.maxHp; player.baseMaxMp = stats.maxMp;
                player.atk = stats.atk; player.def = stats.def; player.mdef = stats.mdef;
                player.spd = stats.spd; player.mag = stats.mag;
                player.hit = stats.hit; player.eva = stats.eva; player.cri = stats.cri;
                player.elmAtk = stats.elmAtk || {}; player.elmRes = stats.elmRes || {};
                player.resists = stats.resists || {};
                player.finDmg = stats.finDmg || 0; player.finRed = stats.finRed || 0;
                player.passive = Battle.getPassives(player);
                
                // シナジー付与スキル習得
                if (player.equips) {
                    Battle.getUniqueEquips(player).forEach(eq => {
                        if (eq && eq.isSynergy && eq.effects) {
                            const grantSyn = eq.synergies?.find(s => s.effect === 'grantSkill');
                            if (grantSyn && grantSyn.value) {
                                if (!player.skills.find(s => s.id === grantSyn.value)) {
                                    const newSkill = DB.SKILLS.find(s => s.id === grantSyn.value);
                                    if (newSkill) player.skills.push(newSkill);
                                }
                            }
                        }
                    });
                }
				
				// ★追加：装備固有スキル付与
				if (player.equips) {
				  Battle.getUniqueEquips(player).forEach(eq => {
					if (!eq || !eq.grantSkills) return;
					eq.grantSkills.forEach(skillId => {
					  if (!player.skills.find(s => s.id === skillId)) {
						const sk = DB.SKILLS.find(s => s.id === skillId);
						if (sk) player.skills.push(sk);
					  }
					});
				  });
				}
				
                if (charData.battleStatus) player.battleStatus = JSON.parse(JSON.stringify(charData.battleStatus));
                else Battle.initBattleStatus(player);

                Battle.applyPersistentBattlePassives(player);
                return player;
            }).filter(p => p !== null);
        }

        const forcedAllyAilments = Array.isArray(App.data.battle?.guildChallengeAllyAilments)
            ? App.data.battle.guildChallengeAllyAilments
            : [];
        if (forcedAllyAilments.length) {
            Battle.party.forEach(player => {
                if (!player) return;
                player.battleStatus = player.battleStatus || { buffs: {}, debuffs: {}, ailments: {} };
                player.battleStatus.ailments = player.battleStatus.ailments || {};
                forcedAllyAilments.forEach(ailment => {
                    player.battleStatus.ailments[String(ailment)] = { turns: null, forced: true };
                });
            });
        }

        if (Battle.party.length === 0 || Battle.party.every(p => p.isDead)) {
            App.log("戦えるメンバーがいません！");
            Battle.endBattle(true); return;
        }

        // 敵の生成フラグ取得
        const isBoss = (App.data.battle && App.data.battle.isBossBattle) || false;
        const isEstark = (App.data.battle && App.data.battle.isEstark) || false;
        const isSpecialBoss = (App.data.battle && (App.data.battle.isSpecialBoss || App.data.battle.isEstark)) || false;
        const fixedId = (App.data.battle && App.data.battle.fixedBossId) ? App.data.battle.fixedBossId : null;
        // ★追加: StoryManager由来のeventIdを保持
        const eventId = (App.data.battle && App.data.battle.eventId) ? App.data.battle.eventId : null;
        const keyReward = App.data.battle?.keyReward || App.data.battle?.fixedKeyReward || null;

        if (App.data.battle && App.data.battle.active && App.data.battle.enemies?.length > 0) {
            // Resume only an opening advantage that had not yet been consumed.
            // saveBattleState() writes false after the first round, preventing replay.
            Battle.isAmbushed = App.data.battle.isAmbushed === true;
            Battle.isPreemptive = App.data.battle.isPreemptive === true;
            //Battle.log("戦闘に復帰した！");
            Battle.enemies = App.data.battle.enemies.map(e => {
                let base = Battle.getMonsterBaseById(e.baseId);
                if (!base) return null;
                const m = new Monster(base, 1.0);
                return Battle.restoreEnemyState(m, e, base);
            }).filter(enemy => enemy !== null);
            Battle.assignDuplicateMonsterSuffixes(Battle.enemies);
        } else {
            Battle.enemies = Battle.generateNewEnemies(isBoss || isSpecialBoss, fixedId);
            if (App.data?.battle?.randomDungeonModifier) {
                Battle.enemies.forEach(enemy => Battle.applyRandomDungeonModifier(enemy, App.data.battle.randomDungeonModifier));
            }
            Battle.assignDuplicateMonsterSuffixes(Battle.enemies);
            Battle.enemies.forEach(e => Battle.initBattleStatus(e));
            
            // 生成された敵データと共に eventId も保存
            // ★不意打ち・先制フラグを App.data.battle から Battle オブジェクトへ継承
            Battle.isAmbushed = App.data.battle?.isAmbushed || false;
            Battle.isPreemptive = App.data.battle?.isPreemptive || false;

            App.data.battle = { 
                // StoryManager / Dungeon が戦闘開始前に積んだ勝敗後イベント情報を落とさない
                ...(App.data.battle || {}),

                active: true, 
                isBossBattle: isBoss || isSpecialBoss, 
                isSpecialBoss: isSpecialBoss, 
                isEstark: isEstark || isSpecialBoss, 
                fixedBossId: fixedId, 
                eventId: eventId, 
                keyReward: keyReward,
                isAmbushed: Battle.isAmbushed, // フラグ維持用
                isPreemptive: Battle.isPreemptive,
                defeatedPhases: [],
                phaseTransitionCount: 0,
                currentPhaseMonsterId: null,
                ...(isVegnasisBattle ? {
                    vegnasisFallCount: 0,
                    vegnasisFinalAwakenedUnitId: null
                } : {}),
                enemies: Battle.enemies.map(Battle.serializeEnemyState).filter(Boolean)
            };
            App.save();
        }

        Battle.initializeLinkedBattleGroups();
        const octaprismState = Battle.initializeOctaprismBattleState();
        if (octaprismState?.active && !octaprismState.activationLogged) {
            const resistanceApplied = octaprismState.heroChaosResistance?.applied === true;
            Battle.log(resistanceApplied
                ? '<span style="color:#ffe78f;">オクタプリズマが六精霊の道を開き、主人公の混沌属性耐性を90%まで高めた！</span>'
                : '<span style="color:#ffe78f;">オクタプリズマが輝き、六精霊が戦いを見守っている。</span>');
            octaprismState.activationLogged = true;
            App.save();
        }

        if (typeof AudioManager !== 'undefined') AudioManager.syncForScene?.('battle');

        // ★追加: 戦闘開始時の特殊状況ログ表示
        if (Battle.isAmbushed) {
            Battle.log(`<span style="color:#ff4444; font-weight:bold;">まものの むれに ふいうちを うけた！</span>`);
        } else if (Battle.isPreemptive) {
            Battle.log(`<span style="color:#44ff44; font-weight:bold;">まものの むれを さきに みつけた！</span>`);
        }

        Battle.renderEnemies(); Battle.renderPartyStatus();
        const scene = document.getElementById('battle-scene');
        if(scene) scene.onclick = () => { if (Battle.phase === 'result') Battle.handleResultTap(); };

        // 形態移行の途中保存から復帰した場合は、通常入力より先に専用シーケンスを再開する。
        // 旧ターンの実行スタックはページ再読込で失われているため、ここでも同じ再構築経路へ統一する。
        if (Battle.hasPendingPhaseTransition()) {
            Battle.schedulePhaseTransitionRunner();
        } else if (Battle.isAmbushed) {
            Battle.schedule(() => {
                if (Battle.active) Battle.executeTurn();
            }, 1000);
        } else {
            Battle.startInputPhase();
        }
    },
	
    getPassives: (actor) => {
        let passives = {};
        if (actor.tree) {
            for (let key in actor.tree) {
                const level = actor.tree[key];
                const treeDef = CONST.SKILL_TREES[key];
                if (treeDef) {
                    for (let i = 0; i < level; i++) {
                        const step = treeDef.steps[i];
                        if (step.passive) passives[step.passive] = true;
                    }
                }
            }
        }
        if (actor.equips) {
            Battle.getUniqueEquips(actor).forEach(eq => {
                if (eq && typeof App.checkSynergy === 'function') {
                    const syns = App.checkSynergy(eq); // 配列で取得
                    syns.forEach(syn => {
                        if (syn && syn.effect) passives[syn.effect] = true;
                    });
                }
            });
        }
        return passives;
    },
	
    initBattleStatus: (actor) => {
        actor.battleStatus = { buffs: {}, debuffs: {}, ailments: {} };
    },

    // 装備シナジー由来の常時効果は、通常バフと違って戦闘不能で失効しない。
    // 戦闘開始・蘇生のどちらから復帰しても同じ状態になるよう、この関数だけを入口にする。
    applyPersistentBattlePassives: (actor) => {
        if (!actor) return;
        actor.battleStatus = actor.battleStatus || { buffs: {}, debuffs: {}, ailments: {} };
        actor.battleStatus.buffs = actor.battleStatus.buffs || {};
        const passive = actor.passive || {};
        if (passive.warGod) {
            actor.battleStatus.buffs.atk = { val: 1.5, turns: null };
            actor.battleStatus.buffs.mag = { val: 1.5, turns: null };
        }
        if (passive.atkDouble) actor.battleStatus.buffs.atk = { val: 2.0, turns: null };
        if (passive.magDouble) actor.battleStatus.buffs.mag = { val: 2.0, turns: null };
    },

    // ★修正: ステータス取得時にシナジー補正を適用
    getBattleStat: (actor, key) => {
        // 計算済みの戦闘ステータスを最優先する。未設定時だけ getStat、最後に旧モンスター用の
        // mdef 代替値を使う。これによりプレイヤーの装備・特性込み魔法防御を失わない。
        let val = actor ? actor[key] : 0;
        const isMissing = val === undefined || val === null;
        const isEmptyObject = (typeof val === 'object' && val !== null && Object.keys(val).length === 0);
        if ((isMissing || val === 0 || isEmptyObject) && typeof actor?.getStat === 'function') {
            val = actor.getStat(key);
        }
        if ((val === undefined || val === null || (key === 'mdef' && val === 0)) && key === 'mdef' && actor?.mag) {
            val = Math.floor(actor.mag * 0.8);
        }
        if (val === undefined || val === null) val = 0;
        
        // ★修正点: オブジェクト（resistsやelmRes）が空の場合、または数値が0の場合に getStat を呼び出す
        // これにより、装備やシナジーによる耐性補正が val に格納されます
        const remainsEmptyObject = (typeof val === 'object' && val !== null && Object.keys(val).length === 0);
        if ((val === 0 || remainsEmptyObject) && typeof actor?.getStat === 'function') {
            val = actor.getStat(key);
        }

        // ★修正点: maxHp / maxMp も計算済みステータス (getStat) を参照するように変更
        // これにより、限界突破や装備によるHP/MP上昇が戦闘に反映されます
        if (key === 'maxHp' || key === 'maxMp') {
            if (typeof actor.getStat === 'function') {
                val = actor.getStat(key);
            } else {
                val = (key === 'maxHp') ? actor.baseMaxHp : actor.baseMaxMp;
            }
        }

        // ★修正: 耐性取得時、戦闘中のバフ・デバフ（resists_XXX）を合算する
        if (key === 'resists') {
            // val には既に装備込みの耐性が取得されているため、それをベースにする
            const base = val || {};
            const res = { ...base }; 

            if (actor.battleStatus && actor.battleStatus.buffs) {
                for (let bKey in actor.battleStatus.buffs) {
                    if (bKey.startsWith('resists_')) {
                        const ailment = bKey.replace('resists_', '');
                        res[ailment] = (res[ailment] || 0) + actor.battleStatus.buffs[bKey].val;
                    }
                }
            }

            if (actor.battleStatus && actor.battleStatus.debuffs) {
                for (let dKey in actor.battleStatus.debuffs) {
                    if (dKey.startsWith('resists_')) {
                        const ailment = dKey.replace('resists_', '');
                        res[ailment] = (res[ailment] || 0) - actor.battleStatus.debuffs[dKey].val;
                    }
                }
            }
            // resists_Seal は呪文・特技・回復封印すべてに効く共通耐性。
            // 個別耐性だけを読む成功判定へ展開し、表示だけ上がって実戦では無効になる不整合を防ぐ。
            const genericSeal = Number(res.Seal || 0);
            if (genericSeal !== 0) {
                ['SpellSeal', 'SkillSeal', 'HealSeal'].forEach(key => {
                    res[key] = Number(res[key] || 0) + genericSeal;
                });
            }
            return res;
        }

        const b = actor.battleStatus;
        if (!b) return val;
        
        if (b.buffs[key]) val = Math.floor(val * b.buffs[key].val);
        if (b.debuffs[key]) val = Math.floor(val * b.debuffs[key].val);
        // 雷精霊の守備低下は闇精霊の全能力低下と別枠にし、1ターン後に
        // 雷分だけが切れて闇分が正しく残るようにする。
        if (key === 'def' && b.debuffs.octaprismDef) {
            val = Math.floor(val * b.debuffs.octaprismDef.val);
        }
        return val;
    },
	
	/**
     * 新規モンスターの生成 (特性・新ステータス・ドロップ・フラグ対応版)
     **/
    cloneMonsterBase: (base) => {
        if (!base) return null;
        if (window.MonsterData && typeof window.MonsterData.cloneMonsterData === 'function') {
            return window.MonsterData.cloneMonsterData(base);
        }
        return JSON.parse(JSON.stringify(base));
    },

    // 同名の敵が複数いる場合だけ A/B/C... を付ける。
    // 旧処理で混成編成の全員に付いた識別文字も、ここで一度取り除いて再採番する。
    getEnemyCanonicalDisplayName: (enemy) => {
        if (!enemy) return '不明な魔物';
        const stored = String(enemy.displayBaseName || '').trim();
        if (stored) return stored;

        const current = String(enemy.name || '').trim();
        const base = Battle.getMonsterBaseById?.(enemy.baseId || enemy.id);
        const masterName = String(base?.name || '').trim();
        if (masterName && current.startsWith(masterName)) {
            let modifier = current.slice(masterName.length);
            modifier = modifier
                .replace(/^[A-Z](?=$|[・\s])/, '')
                .replace(/[A-Z]$/, '');
            return `${masterName}${modifier}`.trim() || masterName;
        }

        return current.replace(/[A-Z]$/, '').trim() || masterName || '不明な魔物';
    },

    assignDuplicateMonsterSuffixes: (enemies = []) => {
        if (!Array.isArray(enemies) || enemies.length === 0) return enemies;
        const records = enemies.map(enemy => ({
            enemy,
            baseName: Battle.getEnemyCanonicalDisplayName(enemy)
        }));
        const counts = new Map();
        records.forEach(({ baseName }) => counts.set(baseName, (counts.get(baseName) || 0) + 1));
        const indices = new Map();
        records.forEach(({ enemy, baseName }) => {
            const index = indices.get(baseName) || 0;
            indices.set(baseName, index + 1);
            enemy.displayBaseName = baseName;
            enemy.name = counts.get(baseName) > 1
                ? `${baseName}${String.fromCharCode(65 + index)}`
                : baseName;
        });
        return enemies;
    },

    serializeEnemyState: (enemy) => {
        if (!enemy) return null;
        const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
        return {
            baseId: enemy.baseId || enemy.id,
            hp: Number(enemy.hp || 0),
            maxHp: Number(enemy.baseMaxHp || enemy.hp || 1),
            mp: Number(enemy.mp || 0),
            maxMp: Number(enemy.baseMaxMp || enemy.mp || 0),
            atk: Number(enemy.atk ?? enemy.baseStats?.atk ?? 0),
            def: Number(enemy.def ?? enemy.baseStats?.def ?? 0),
            mdef: Number(enemy.mdef ?? enemy.baseStats?.mdef ?? 0),
            spd: Number(enemy.spd ?? enemy.baseStats?.spd ?? 0),
            mag: Number(enemy.mag ?? enemy.baseStats?.mag ?? 0),
            hit: Number(enemy.hit ?? 100),
            eva: Number(enemy.eva ?? 0),
            cri: Number(enemy.cri ?? 0),
            finDmg: Number(enemy.finDmg ?? 0),
            finRed: Number(enemy.finRed ?? 0),
            exp: Number.isFinite(Number(enemy.exp)) ? Number(enemy.exp) : undefined,
            gold: Number.isFinite(Number(enemy.gold)) ? Number(enemy.gold) : undefined,
            name: enemy.name,
            displayBaseName: enemy.displayBaseName || null,
            rank: enemy.rank,
            minF: enemy.minF,
            rewardRank: enemy.rewardRank,
            generatedFloor: enemy.generatedFloor,
            actCount: Number(enemy.actCount || 1),
            acts: clone(enemy.acts || []),
            race: enemy.race,
            image: enemy.image || null,
            imageId: enemy.imageId ?? null,
            traits: clone(enemy.traits || []),
            passive: clone(enemy.passive || {}),
            drops: clone(enemy.drops || null),
            elmAtk: clone(enemy.elmAtk || {}),
            elmRes: clone(enemy.elmRes || {}),
            resists: clone(enemy.resists || {}),
            mapEnemyBoost: clone(enemy.mapEnemyBoost || null),
            storyBossStatMultiplier: enemy.storyBossStatMultiplier || null,
            memoryRealm: enemy.memoryRealm === true,
            memoryRarePreserveDrops: enemy.memoryRarePreserveDrops === true,
            memoryRewardRank: Number.isFinite(Number(enemy.memoryRewardRank)) ? Number(enemy.memoryRewardRank) : undefined,
            memoryElements: clone(enemy.memoryElements || []),
            memoryRoleProfile: enemy.memoryRoleProfile || null,
            absoluteElementImmunity: enemy.absoluteElementImmunity === true,
            isRiftEnemy: !!enemy.isRiftEnemy,
            isBoss: !!enemy.isBoss,
            isRare: !!enemy.isRare,
            isSpecialBoss: !!enemy.isSpecialBoss,
            isEstark: !!enemy.isEstark,
            specialBossScale: Number.isFinite(Number(enemy.specialBossScale)) ? Number(enemy.specialBossScale) : undefined,
            specialBossDefeatsAtStart: Number.isFinite(Number(enemy.specialBossDefeatsAtStart)) ? Number(enemy.specialBossDefeatsAtStart) : undefined,
            gutsLevel: Number(enemy.gutsLevel || 0),
            linkedDeathIndex: Number.isFinite(Number(enemy.linkedDeathIndex)) ? Number(enemy.linkedDeathIndex) : null,
            linkedBattleGroup: enemy.linkedBattleGroup || null,
            sharedVisualGroup: enemy.sharedVisualGroup || null,
            vegnasisElement: enemy.vegnasisElement || null,
            vegnasisElementKey: enemy.vegnasisElementKey || null,
            vegnasisPowerName: enemy.vegnasisPowerName || null,
            vegnasisLastStandConversation: enemy.vegnasisLastStandConversation || null,
            battleUnitId: enemy.battleUnitId || null,
            phaseIndex: Math.max(1, Number(enemy.phaseIndex || 1)),
            phaseRootId: Number(enemy.phaseRootId || enemy.baseId || enemy.id || 0) || null,
            phaseTransitioned: enemy.phaseTransitioned === true,
            linkedInitialState: clone(enemy.linkedInitialState || null),
            vegnasisFinalAwakened: enemy.vegnasisFinalAwakened === true,
            abyssFallHandled: enemy.abyssFallHandled === true,
            abyssPhaseTransitioned: enemy.abyssPhaseTransitioned === true,
            abyssSealedSkillIds: clone(enemy.abyssSealedSkillIds || []),
            battleStatus: clone(enemy.battleStatus || { buffs: {}, debuffs: {}, ailments: {} })
        };
    },

    restoreEnemyState: (enemy, snapshot, base = {}) => {
        if (!enemy || !snapshot) return enemy;
        const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
        const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
        enemy.baseId = snapshot.baseId || base.id || enemy.baseId || enemy.id;
        enemy.id = enemy.baseId;
        enemy.baseMaxHp = Math.max(1, finiteOr(snapshot.maxHp, enemy.baseMaxHp || 1));
        enemy.hp = Math.max(0, Math.min(enemy.baseMaxHp, finiteOr(snapshot.hp, enemy.baseMaxHp)));
        enemy.baseMaxMp = Math.max(0, finiteOr(snapshot.maxMp, enemy.baseMaxMp || 0));
        enemy.mp = Math.max(0, Math.min(enemy.baseMaxMp, finiteOr(snapshot.mp, enemy.baseMaxMp)));
        ['atk', 'def', 'mdef', 'spd', 'mag'].forEach(key => {
            const restored = finiteOr(snapshot[key], enemy[key] ?? enemy.baseStats?.[key] ?? base[key] ?? 0);
            enemy[key] = restored;
            if (enemy.baseStats) enemy.baseStats[key] = restored;
        });
        enemy.hit = Battle.normalizeMonsterHitRate(
            snapshot.hit ?? enemy.hit ?? base.hit,
            100
        );
        ['eva', 'cri', 'finDmg', 'finRed'].forEach(key => {
            enemy[key] = finiteOr(snapshot[key], enemy[key] ?? base[key] ?? 0);
        });
        if (snapshot.exp !== undefined) enemy.exp = finiteOr(snapshot.exp, base.exp || 0);
        if (snapshot.gold !== undefined) enemy.gold = finiteOr(snapshot.gold, base.gold || 0);
        enemy.name = snapshot.name || enemy.name;
        enemy.displayBaseName = snapshot.displayBaseName || null;
        enemy.rank = snapshot.rank ?? enemy.rank ?? base.rank ?? 1;
        enemy.minF = snapshot.minF ?? enemy.minF ?? base.minF ?? enemy.rank;
        enemy.rewardRank = snapshot.rewardRank ?? enemy.rewardRank;
        enemy.generatedFloor = snapshot.generatedFloor ?? enemy.generatedFloor ?? null;
        enemy.actCount = Math.max(1, finiteOr(snapshot.actCount, enemy.actCount || 1));
        enemy.acts = clone(snapshot.acts?.length ? snapshot.acts : (enemy.acts || base.acts || [1]));
        enemy.race = snapshot.race || enemy.race || base.race || '不明';
        enemy.image = snapshot.image || enemy.image || base.image || base.img || null;
        enemy.imageId = snapshot.imageId ?? enemy.imageId ?? base.imageId ?? base.baseImageId ?? null;
        enemy.traits = clone(snapshot.traits ?? enemy.traits ?? base.traits ?? []);
        enemy.passive = clone(snapshot.passive ?? enemy.passive ?? base.passive ?? {});
        enemy.drops = clone(snapshot.drops ?? enemy.drops ?? base.drops ?? null);
        enemy.elmAtk = clone(snapshot.elmAtk ?? enemy.elmAtk ?? base.elmAtk ?? {});
        enemy.elmRes = clone(snapshot.elmRes ?? enemy.elmRes ?? base.elmRes ?? {});
        enemy.resists = clone(snapshot.resists ?? enemy.resists ?? base.resists ?? {});
        enemy.mapEnemyBoost = clone(snapshot.mapEnemyBoost ?? enemy.mapEnemyBoost ?? null);
        enemy.storyBossStatMultiplier = snapshot.storyBossStatMultiplier ?? enemy.storyBossStatMultiplier ?? null;
        enemy.memoryRealm = snapshot.memoryRealm === true || enemy.memoryRealm === true;
        enemy.memoryRarePreserveDrops = snapshot.memoryRarePreserveDrops === true || enemy.memoryRarePreserveDrops === true;
        enemy.memoryRewardRank = snapshot.memoryRewardRank ?? enemy.memoryRewardRank;
        enemy.memoryElements = clone(snapshot.memoryElements ?? enemy.memoryElements ?? []);
        enemy.memoryRoleProfile = snapshot.memoryRoleProfile ?? enemy.memoryRoleProfile ?? null;
        enemy.absoluteElementImmunity = snapshot.absoluteElementImmunity === true || enemy.absoluteElementImmunity === true;
        enemy.isRiftEnemy = snapshot.isRiftEnemy === true;
        enemy.isBoss = !!(snapshot.isBoss || base.isBoss);
        enemy.isRare = !!(snapshot.isRare || base.isRare);
        enemy.isEstark = !!(snapshot.isEstark || base.isEstark);
        enemy.isSpecialBoss = !!(snapshot.isSpecialBoss || base.isSpecialBoss || enemy.isEstark);
        enemy.specialBossScale = finiteOr(snapshot.specialBossScale, enemy.specialBossScale ?? 1);
        enemy.specialBossDefeatsAtStart = Math.max(0, Math.floor(finiteOr(snapshot.specialBossDefeatsAtStart, enemy.specialBossDefeatsAtStart ?? 0)));
        enemy.gutsLevel = finiteOr(snapshot.gutsLevel, enemy.gutsLevel ?? base.gutsLevel ?? 0);
        enemy.linkedDeathIndex = Number.isFinite(Number(snapshot.linkedDeathIndex)) ? Number(snapshot.linkedDeathIndex) : (base.linkedDeathIndex ?? null);
        enemy.linkedBattleGroup = snapshot.linkedBattleGroup || enemy.linkedBattleGroup || base.linkedBattleGroup || null;
        enemy.sharedVisualGroup = snapshot.sharedVisualGroup || enemy.sharedVisualGroup || base.sharedVisualGroup || null;
        enemy.vegnasisElement = snapshot.vegnasisElement || enemy.vegnasisElement || base.vegnasisElement || null;
        enemy.vegnasisElementKey = snapshot.vegnasisElementKey || enemy.vegnasisElementKey || base.vegnasisElementKey || null;
        enemy.vegnasisPowerName = snapshot.vegnasisPowerName || enemy.vegnasisPowerName || base.vegnasisPowerName || null;
        enemy.vegnasisLastStandConversation = snapshot.vegnasisLastStandConversation || enemy.vegnasisLastStandConversation || base.vegnasisLastStandConversation || null;
        enemy.battleUnitId = snapshot.battleUnitId || enemy.battleUnitId || Battle.makeBattleUnitId();
        enemy.phaseIndex = Math.max(1, finiteOr(snapshot.phaseIndex, enemy.phaseIndex || 1));
        enemy.phaseRootId = finiteOr(snapshot.phaseRootId, enemy.phaseRootId || base.id || enemy.baseId || enemy.id || 0) || null;
        enemy.phaseTransitioned = snapshot.phaseTransitioned === true || snapshot.abyssPhaseTransitioned === true;
        enemy.linkedInitialState = clone(snapshot.linkedInitialState || enemy.linkedInitialState || null);
        enemy.vegnasisFinalAwakened = snapshot.vegnasisFinalAwakened === true;
        enemy.abyssFallHandled = snapshot.abyssFallHandled === true;
        enemy.abyssPhaseTransitioned = snapshot.abyssPhaseTransitioned === true;
        enemy.abyssSealedSkillIds = clone(snapshot.abyssSealedSkillIds || []);
        enemy.battleStatus = clone(snapshot.battleStatus || { buffs: {}, debuffs: {}, ailments: {} });
        Battle.ensureUnitBattleStatus(enemy);
        enemy.isDead = enemy.hp <= 0;
        return enemy;
    },

    getMonsterBaseById: (id) => {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) return null;
        const base = (window.MonsterData && typeof window.MonsterData.getMonsterById === 'function')
            ? window.MonsterData.getMonsterById(numericId)
            : (DB.MONSTERS || []).find(m => Number(m.id) === numericId);
        return Battle.cloneMonsterBase(base);
    },

    getMonsterBasesByIds: (ids) => {
        const idList = Array.isArray(ids) ? ids : [ids];
        if (window.MonsterData && typeof window.MonsterData.getBossesByIds === 'function') {
            const bosses = window.MonsterData.getBossesByIds(idList);
            if (bosses && bosses.length > 0) return bosses;
        }
        return idList.map(id => Battle.getMonsterBaseById(id)).filter(Boolean);
    },

    isSpecialBossBase: (base) => !!(base && (base.isSpecialBoss || base.isEstark || Number(base.id) === 902000)),

    // 裏ボス固有ルールはモンスターマスターの specialBossRules を正本とする。
    // 通常の深層強化とは分離し、討伐回数補正・勝利時消費・加入率を一か所で扱う。
    getSpecialBossRules: (baseOrEnemy) => {
        if (!baseOrEnemy) return null;
        const baseId = Number(baseOrEnemy.baseId || baseOrEnemy.id);
        const base = Battle.getMonsterBaseById(baseId) || baseOrEnemy;
        const raw = base?.specialBossRules;
        if (!raw || typeof raw !== 'object') return null;
        return {
            statScalePerDefeat: Math.max(0, Number(raw.statScalePerDefeat) || 0),
            requiredItemId: Number.isFinite(Number(raw.requiredItemId)) ? Number(raw.requiredItemId) : null,
            consumeRequiredItemOnVictory: raw.consumeRequiredItemOnVictory === true,
            gemReward: Math.max(0, Math.floor(Number(raw.gemReward) || 0)),
            linkedRareDropItemId: Number.isFinite(Number(raw.linkedRareDropItemId)) ? Number(raw.linkedRareDropItemId) : null,
            recruitBaseRate: Math.max(0, Number(raw.recruitBaseRate) || 0),
            recruitRatePerDefeat: Math.max(0, Number(raw.recruitRatePerDefeat) || 0),
            recruitMaxRate: Math.max(0, Math.min(1, Number(raw.recruitMaxRate) || 1)),
            guaranteedEquipment: raw.guaranteedEquipment && typeof raw.guaranteedEquipment === 'object'
                ? JSON.parse(JSON.stringify(raw.guaranteedEquipment))
                : null
        };
    },

    getSpecialBossScale: (baseOrEnemy, previousDefeats = 0) => {
        const rules = Battle.getSpecialBossRules(baseOrEnemy);
        const count = Math.max(0, Math.floor(Number(previousDefeats) || 0));
        return 1 + count * Math.max(0, Number(rules?.statScalePerDefeat) || 0);
    },

    // completedDefeats は今回の勝利を含む討伐数。ギルガメッシュは 1回目5%、2回目10%…。
    getSpecialBossRecruitChance: (baseOrEnemy, completedDefeats = 1) => {
        const rules = Battle.getSpecialBossRules(baseOrEnemy);
        if (!rules) return 0;
        const count = Math.max(1, Math.floor(Number(completedDefeats) || 1));
        const chance = rules.recruitBaseRate + Math.max(0, count - 1) * rules.recruitRatePerDefeat;
        return Math.max(0, Math.min(rules.recruitMaxRate, chance));
    },

    applySpecialBossEquipmentBalance: (equipment, options = {}) => {
        if (!equipment || typeof equipment !== 'object') return equipment;
        const scale = Math.max(0.01, Number(options.baseStatScale || 0.55));
        const version = Math.max(2, Number(options.version || 2));
        if (Number(equipment.specialBossEquipmentBalanceVersion || 0) >= version) return equipment;
        const keys = ['hp','mp','atk','def','spd','mag','mdef'];
        if (equipment.data && typeof equipment.data === 'object') {
            keys.forEach(key => {
                if (!Number.isFinite(Number(equipment.data[key]))) return;
                const minimum = key === 'mp' ? 0 : 1;
                equipment.data[key] = Math.max(minimum, Math.floor(Number(equipment.data[key]) * scale));
            });
        }
        equipment.specialBossEquipmentBalanceVersion = version;
        equipment.specialBossEquipmentBaseStatScale = scale;
        equipment.specialBossMonsterId = Number(options.monsterId || equipment.specialBossMonsterId || 902000);
        return equipment;
    },

    applySpecialBossVictoryOutcome: (specialEnemy, options = {}) => {
        if (!specialEnemy || !App.data) return null;
        if (!App.data.battle) App.data.battle = {};
        if (!App.data.items) App.data.items = {};
        if (!Array.isArray(App.data.inventory)) App.data.inventory = [];
        const specialId = Number(specialEnemy.baseId || specialEnemy.id);
        const base = Battle.getMonsterBaseById(specialId) || specialEnemy;
        const rules = Battle.getSpecialBossRules(base);
        if (!rules) return null;

        const battleId = String(App.data.battle.battleId || Battle.finishToken || 'active-special-battle');
        const prior = App.data.battle.specialBossOutcome;
        if (prior && String(prior.battleId) === battleId && Number(prior.monsterId) === specialId && prior.applied === true) {
            return { ...prior, reused: true, recruitResult: null };
        }

        const completedDefeats = Math.max(1, Math.floor(Number(options.completedDefeats) || 1));
        const drops = Array.isArray(options.drops) ? options.drops : [];
        const createEquipment = options.createEquipment;
        const bonusRare = Number(options.bonusRare || 0);
        const bonusNormal = Number(options.bonusNormal || 0);
        let requiredItemConsumed = false;
        let requiredItemName = '';

        if (rules.consumeRequiredItemOnVictory && rules.requiredItemId != null) {
            const current = Math.max(0, Math.floor(Number(App.data.items[rules.requiredItemId]) || 0));
            if (current < 1) throw new Error(`勝利時消費アイテム(ID:${rules.requiredItemId})がありません。`);
            App.data.items[rules.requiredItemId] = current - 1;
            const itemDef = DB.ITEMS.find(item => Number(item.id) === rules.requiredItemId);
            requiredItemName = itemDef?.name || `アイテム${rules.requiredItemId}`;
            requiredItemConsumed = true;
        }

        let equipmentName = '';
        let equipmentRewardFloor = null;
        let equipmentBaseStatScale = null;
        const equipRule = rules.guaranteedEquipment;
        if (equipRule && typeof createEquipment === 'function') {
            const phase2IMaster = globalThis.ABYSS_REGION_CONTENT?.randomDungeonPhase2IMaster?.specialBossEquipment || {};
            const floorBase = Math.max(1, Number(equipRule.rewardFloorBase || phase2IMaster.rewardFloorBase || 250));
            const floorPerDefeat = Math.max(0, Number(equipRule.rewardFloorPerDefeat || phase2IMaster.rewardFloorPerDefeat || 5));
            const floorCap = Math.max(floorBase, Number(equipRule.rewardFloorCap || phase2IMaster.rewardFloorCap || 400));
            const rewardFloor = Math.min(floorCap, floorBase + Math.max(0, completedDefeats - 1) * floorPerDefeat);
            equipmentRewardFloor = rewardFloor;
            equipmentBaseStatScale = Number(equipRule.baseStatScale || phase2IMaster.baseStatScale || 0.55);
            const eq = createEquipment(
                rewardFloor,
                Math.max(0, Math.floor(Number(equipRule.plus) || 3)),
                Array.isArray(equipRule.minRarities) && equipRule.minRarities.length ? equipRule.minRarities : ['UR', 'EX']
            );
            if (eq) {
                Battle.applySpecialBossEquipmentBalance(eq, {
                    baseStatScale:equipmentBaseStatScale,
                    monsterId:specialId,
                    version:2
                });
                if (Number.isFinite(Number(eq.val))) eq.val = Math.floor(Number(eq.val) * Math.max(1, Number(equipRule.valueMultiplier) || 1));
                eq.name = `${equipRule.namePrefix || ''}${eq.name || '特殊装備'}`;
                equipmentName = eq.name;
                App.data.inventory.push(eq);
                drops.push({ name:eq.name, isRare:true, isUltra:true, isSpecialBoss:true, isEstark:true, kind:'equip' });
            }
        }

        if (rules.gemReward > 0) App.data.gems = Math.max(0, Number(App.data.gems) || 0) + rules.gemReward;

        const monsterDrops = base.drops || specialEnemy.drops || null;
        const grantConfiguredItem = (drop, bonus, linked = false) => {
            if (!drop || drop.id == null || !Battle.rollConfiguredDrop(drop, bonus)) return null;
            const itemDef = DB.ITEMS.find(item => Number(item.id) === Number(drop.id));
            if (!itemDef) return null;
            App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
            const isRare = linked || Number(itemDef.id) === 107 || drop === monsterDrops?.rare;
            drops.push({ name:itemDef.name, isRare, type:isRare ? 'kai' : 'item', kind:'item' });
            return itemDef.id;
        };

        const rareDropId = grantConfiguredItem(monsterDrops?.rare, bonusRare);
        const normalDropId = grantConfiguredItem(monsterDrops?.normal, bonusNormal);
        let linkedRareDropId = null;
        if (rules.linkedRareDropItemId != null && monsterDrops?.rare) {
            linkedRareDropId = grantConfiguredItem({ ...monsterDrops.rare, id:rules.linkedRareDropItemId }, bonusRare, true);
        }

        const recruitChance = Battle.getSpecialBossRecruitChance(base, completedDefeats);
        let recruitResult = null;
        let recruitSucceeded = false;
        if (recruitChance > 0 && Math.random() < recruitChance && typeof App.addOrLimitBreakMonsterAlly === 'function') {
            recruitResult = App.addOrLimitBreakMonsterAlly(specialEnemy, base);
            recruitSucceeded = recruitResult?.ok === true;
        }

        const outcome = {
            version:1,
            battleId,
            monsterId:specialId,
            applied:true,
            completedDefeats,
            statScale:Number(specialEnemy.specialBossScale || Battle.getSpecialBossScale(base, Math.max(0, completedDefeats - 1))),
            requiredItemId:rules.requiredItemId,
            requiredItemConsumed,
            requiredItemName,
            gemReward:rules.gemReward,
            equipmentName,
            equipmentRewardFloor,
            equipmentBaseStatScale,
            rareDropId,
            normalDropId,
            linkedRareDropId,
            recruitChance,
            recruitSucceeded,
            recruitExisting:recruitResult?.existing === true,
            limitBreakChanged:recruitResult?.lbChanged === true
        };
        App.data.battle.specialBossOutcome = outcome;
        return { ...outcome, recruitResult };
    },
    isNormalEncounterBase: (base) => !!(base && !base.isBoss && !base.isRare && !Battle.isSpecialBossBase(base)),
    isAbyssRandomBossBase: (base) => {
        if (!base) return false;
        const id = Number(base.id ?? base.baseId);
        return Number.isFinite(id) && id >= 400000 && id < 500000;
    },

    getEquipmentRewardFloor: (enemy, fallbackFloor = 1) => {
        const base = Battle.getMonsterBaseById(enemy?.baseId || enemy?.id) || {};
        const raw = enemy?.memoryRewardRank ?? enemy?.generatedFloor ?? enemy?.rewardRank ?? enemy?.rank ?? base.generatedFloor ?? base.rewardRank ?? base.rank ?? base.minF ?? fallbackFloor;
        return Math.max(1, Math.floor(Number(raw) || Number(fallbackFloor) || 1));
    },

    getEnemyRewardValue: (enemy, base, key) => {
        const personal = Number(enemy?.[key]);
        const hasPersonal = Number.isFinite(personal) && (key === 'gold' ? personal >= 0 : personal > 0);
        return hasPersonal ? personal : Math.max(0, Number(base?.[key] || 0));
    },

    // モンスターマスターの命中は絶対値（100 = 基準命中）を正本とする。
    // 旧データには「基準100への加算値」を 1～49 で保存した個体があるため、
    // 読み込み時に 100 + 値へ補正して、1～49%として扱われる事故を防ぐ。
    normalizeMonsterHitRate: (rawValue, fallback = 100) => {
        if (globalThis.MonsterData && typeof globalThis.MonsterData.normalizeHitRate === 'function') {
            return globalThis.MonsterData.normalizeHitRate(rawValue, fallback);
        }
        const value = Number(rawValue);
        const base = Math.max(1, Number(fallback) || 100);
        if (!Number.isFinite(value) || value <= 0) return base;
        if (value < 50) return base + value;
        return value;
    },

    setupEnemyStats: (m, base, isBossBattle = false) => {
        if (!m || !base) return m;
        m.atk = m.baseStats?.atk || base.atk || m.atk;
        m.def = m.baseStats?.def || base.def || m.def;
        m.spd = m.baseStats?.spd || base.spd || m.spd;
        m.mag = m.baseStats?.mag || base.mag || m.mag;
        m.mdef = m.baseStats?.mdef || base.mdef || m.mdef || 0;
        m.hit = Battle.normalizeMonsterHitRate(base.hit, 100);
        m.eva = base.eva || 0;
        m.cri = base.cri || 0;
        m.id = base.id;
        m.baseId = base.id;
        m.rank = base.rank || base.generatedFloor || base.minF || m.rank || 1;
        m.minF = base.minF || m.minF || m.rank;
        m.generatedFloor = base.generatedFloor || m.generatedFloor || null;
        m.isBoss = base.isBoss || isBossBattle || false;
        m.isRare = base.isRare || false;
        m.isEstark = base.isEstark || false;
        m.isSpecialBoss = base.isSpecialBoss || base.isEstark || Number(base.id) === 902000;
        m.race = base.race || '\u4e0d\u660e';
        m.drops = JSON.parse(JSON.stringify(base.drops || null));
        m.traits = JSON.parse(JSON.stringify(base.traits || []));
        m.elmAtk = JSON.parse(JSON.stringify(base.elmAtk || {}));
        m.elmRes = JSON.parse(JSON.stringify(base.elmRes || {}));
        m.image = base.image || base.img || m.image || null;
        m.imageId = base.imageId ?? base.baseImageId ?? m.imageId ?? null;
        m.linkedDeathIndex = Number.isFinite(Number(base.linkedDeathIndex)) ? Number(base.linkedDeathIndex) : (m.linkedDeathIndex ?? null);
        m.linkedBattleGroup = base.linkedBattleGroup || m.linkedBattleGroup || null;
        m.sharedVisualGroup = base.sharedVisualGroup || m.sharedVisualGroup || null;
        m.vegnasisElement = base.vegnasisElement || m.vegnasisElement || null;
        m.vegnasisElementKey = base.vegnasisElementKey || m.vegnasisElementKey || null;
        m.vegnasisPowerName = base.vegnasisPowerName || m.vegnasisPowerName || null;
        m.vegnasisLastStandConversation = base.vegnasisLastStandConversation || m.vegnasisLastStandConversation || null;
        m.finDmg = 0;
        m.finRed = 0;

        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
            const atkPct  = PassiveSkill.getSumValue(m, 'atk_pct');
            const defPct  = PassiveSkill.getSumValue(m, 'def_pct');
            const magPct  = PassiveSkill.getSumValue(m, 'mag_pct');
            const mdefPct = PassiveSkill.getSumValue(m, 'mdef_pct');
            const spdPct  = PassiveSkill.getSumValue(m, 'spd_pct');

            if (atkPct !== 0)  m.atk  = Math.floor(m.atk  * (1 + atkPct / 100));
            if (defPct !== 0)  m.def  = Math.floor(m.def  * (1 + defPct / 100));
            if (magPct !== 0)  m.mag  = Math.floor(m.mag  * (1 + magPct / 100));
            if (mdefPct !== 0) m.mdef = Math.floor(m.mdef * (1 + mdefPct / 100));
            if (spdPct !== 0)  m.spd  = Math.floor(m.spd  * (1 + spdPct / 100));

            m.hit += PassiveSkill.getSumValue(m, 'hit_pct');
            m.eva += PassiveSkill.getSumValue(m, 'eva_pct');
            m.cri += PassiveSkill.getSumValue(m, 'cri_pct');
        }

        return m;
    },

    createMonsterFromBase: (base, options = {}) => {
        const clone = Battle.cloneMonsterBase(base);
        if (!clone) return null;
        const m = new Monster(clone, options.scale || 1.0);
        m.name = options.name || clone.name || m.name;
        m.id = clone.id;
        m.baseId = clone.id;
        m.actCount = clone.actCount || 1;
        Battle.setupEnemyStats(m, clone, !!options.isBossBattle);
        // 動的生成（形態変化・増援・再構築）でも、AI決定前に必ず状態コンテナを持たせる。
        Battle.ensureUnitBattleStatus(m);
        Battle.ensureEnemyBattleIdentity(m, options);
        Battle.ensureLinkedInitialState(m);
        if (options.forceSpecialBoss) {
            m.isSpecialBoss = true;
            m.isEstark = clone.isEstark || true;
        }
        return m;
    },

    applyRiftEnemyBoost: (enemy, multiplier = null) => {
        if (!enemy) return enemy;
        const masterMultiplier = globalThis.ABYSS_REGION_CONTENT?.randomDungeonPhase2IMaster?.abyssRift?.statMultiplier || 1.25;
        Battle.scaleEnemyCombatStats(enemy, Math.max(1, Number(multiplier || masterMultiplier)), 'riftStatMultiplier');
        enemy.isRiftEnemy = true;
        return enemy;
    },

    applyMapEnemyBoost: (enemy, boost) => {
        if (!enemy || !boost || (enemy.isRare && boost.applyToRares !== true)) return enemy;
        const scale = Math.max(0.1, Number(enemy.isRare ? (boost.rareStatMultiplier || boost.statMultiplier || boost.scale || 1) : (boost.statMultiplier || boost.scale || 1)) || 1);
        const scaleNumber = (value, rate, min = 0) => {
            const n = Number(value || 0);
            if (!Number.isFinite(n)) return value;
            return Math.max(min, Math.floor(n * rate));
        };

        if (boost.nameSuffix && !String(enemy.name || '').endsWith(boost.nameSuffix)) {
            enemy.name = `${enemy.name || '魔物'}${boost.nameSuffix}`;
        }
        enemy.hp = scaleNumber(enemy.hp, scale, 1);
        enemy.baseMaxHp = scaleNumber(enemy.baseMaxHp || enemy.hp, scale, enemy.hp);
        enemy.mp = scaleNumber(enemy.mp, scale, 0);
        enemy.baseMaxMp = scaleNumber(enemy.baseMaxMp || enemy.mp, scale, enemy.mp);

        if (enemy.baseStats) {
            ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                if (enemy.baseStats[key] !== undefined) enemy.baseStats[key] = scaleNumber(enemy.baseStats[key], scale, 0);
            });
        }
        ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
            if (enemy[key] !== undefined) enemy[key] = scaleNumber(enemy[key], scale, 0);
        });

        enemy.elmRes = JSON.parse(JSON.stringify(enemy.elmRes || {}));
        Object.entries(boost.elmRes || {}).forEach(([elm, value]) => {
            enemy.elmRes[elm] = Number(enemy.elmRes[elm] || 0) + Number(value || 0);
        });

        enemy.elmAtk = JSON.parse(JSON.stringify(enemy.elmAtk || {}));
        Object.entries(boost.elmAtk || {}).forEach(([elm, value]) => {
            enemy.elmAtk[elm] = Number(enemy.elmAtk[elm] || 0) + Number(value || 0);
        });

        enemy.resists = JSON.parse(JSON.stringify(enemy.resists || {}));
        Object.entries(boost.resists || {}).forEach(([key, value]) => {
            enemy.resists[key] = Number(enemy.resists[key] || 0) + Number(value || 0);
        });

        enemy.traits = Array.isArray(enemy.traits) ? JSON.parse(JSON.stringify(enemy.traits)) : [];
        (boost.traits || []).forEach(trait => {
            const id = Number(trait?.id);
            if (!Number.isFinite(id)) return;
            const current = enemy.traits.find(value => Number(value?.id) === id);
            if (current) current.level = Math.max(Number(current.level || 1), Math.max(1, Number(trait.level || 1)));
            else enemy.traits.push({ id, level: Math.max(1, Number(trait.level || 1)), battleCount: 0 });
        });

        enemy.acts = Array.isArray(enemy.acts) ? JSON.parse(JSON.stringify(enemy.acts)) : [];
        (boost.extraSkillIds || []).map(Number).filter(id => Number.isFinite(id) && id >= 100).forEach(id => {
            if (!enemy.acts.some(act => Number(typeof act === 'object' ? act.id : act) === id)) {
                enemy.acts.push({ id, rate: 20, condition: 0 });
            }
        });

        enemy.mapEnemyBoost = JSON.parse(JSON.stringify(boost));
        return enemy;
    },

    generateNewEnemies: (isBoss, fixedBossId = null) => {
        const newEnemies = [];
        let floor = Math.max(1, Number(App.data.progress.floor) || 1);
        if (!isBoss && typeof Field !== 'undefined' && Field.currentMapData?.isFixed) {
            // 固定ダンジョンは progress.floor（1F/2F...）では弱すぎるため、
            // map.js の encounterRank を優先して「何階相当の敵を出すか」を指定する。
            // encounterRank未指定の場合はrankを使う。
            const fixedRank = Field.currentMapData.encounterRank || Field.currentMapData.rank;
            if (fixedRank) floor = Math.max(1, Number(fixedRank) || floor);
        }
        const battleData = App.data.battle || {};
        const abyssMode = battleData.abyssMode || (typeof Dungeon !== 'undefined' ? Dungeon.getAbyssMode?.() : null);
        const abyssDisplayFloor = Math.max(1, Number(battleData.abyssFloor || App.data.progress.floor || floor));
        const abyssBalanceFloor = Math.max(1, Number(battleData.abyssBalanceFloor || (globalThis.ABYSS_FLOOR_RULES?.getBalanceFloor?.(abyssDisplayFloor, abyssMode)) || floor));
        if (!isBoss && battleData.encounterRank) {
            floor = Math.max(1, Number(battleData.encounterRank) || floor);
        }
        const targetId = fixedBossId !== null && fixedBossId !== undefined ? fixedBossId : battleData.fixedBossId;
        const isSpecialBossBattle = !!(battleData.isSpecialBoss || battleData.isEstark);
        const normalCount = 1 + Math.floor(Math.random() * 4);
        const deepBossCount = 1 + Math.floor(Math.random() * 3);
        const suffix = (index, total) => total > 1 ? String.fromCharCode(65 + index) : '';
        const bossStatMultiplier = Math.max(1, Number(battleData.bossStatMultiplier || battleData.bossScale || 1) || 1);
        const pushBase = (base, index, total, options = {}) => {
            const name = (base.name || '\u4e0d\u660e\u306a\u9b54\u7269') + suffix(index, total);
            const m = Battle.createMonsterFromBase(base, { ...options, name });
            if (m && Number(options.storyBossStatMultiplier || 1) > 1) {
                const mult = Number(options.storyBossStatMultiplier || 1);
                m.hp = Math.max(1, Math.floor(Number(m.hp || 1) * mult));
                m.baseMaxHp = Math.max(1, Math.floor(Number(m.baseMaxHp || m.hp || 1) * mult));
                m.mp = Math.max(0, Math.floor(Number(m.mp || 0) * mult));
                m.baseMaxMp = Math.max(0, Math.floor(Number(m.baseMaxMp || m.mp || 0) * mult));
                if (m.baseStats) {
                    ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                        if (m.baseStats[key] !== undefined) m.baseStats[key] = Math.max(0, Math.floor(Number(m.baseStats[key] || 0) * mult));
                    });
                }
                ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                    if (m[key] !== undefined) m[key] = Math.max(0, Math.floor(Number(m[key] || 0) * mult));
                });
                m.storyBossStatMultiplier = mult;
            }
            if (m && options.trialEnemyBoost) {
                Battle.applyMapEnemyBoost(m, options.trialEnemyBoost);
            }
            if (m) newEnemies.push(m);
            return m;
        };

        // 試練の天使は現在階層の固定モンスターIDではなく、正式マスターの
        // 階層差・個体数・倍率を使った通常深層敵として生成する。
        if (!isBoss && battleData.angelTrial) {
            const trial = battleData.angelTrial;
            const total = Math.max(1, Number(trial.enemyCount || 3));
            const targetFloor = Math.max(1, Number(trial.targetFloor || abyssBalanceFloor + 15));
            Battle.log('<span style="color:#fff3a6;font-weight:bold;">天使の試練を担う強敵が現れた！</span>');
            for (let i = 0; i < total; i++) {
                const enemy = Battle.createDeepNormalEnemy(targetFloor, {
                    statMultiplier:Math.max(1, Number(trial.statMultiplier || 1.35)),
                    marker:'angelTrialStatMultiplier'
                });
                if (!enemy) continue;
                Battle.applyMapEnemyBoost(enemy, trial.enemyBoost || null);
                if (total > 1) enemy.name += String.fromCharCode(65 + i);
                enemy.isAngelTrialEnemy = true;
                newEnemies.push(enemy);
            }
            return newEnemies;
        }

        // 冒険者の腕試し。現行マスター上の正式ID302001（深淵門将ガレオン）を、
        // 現在階層+10相当の深層ボスとして再構築する。
        if (isBoss && battleData.randomAdventurerDuel) {
            const duel = battleData.randomAdventurerDuel;
            const base = Battle.getMonsterBaseById(Number(duel.bossId || 302001));
            const targetFloor = Math.max(1, Number(duel.targetFloor || abyssBalanceFloor + 10));
            if (base) {
                const enemy = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), targetFloor, true)
                    || Battle.createMonsterFromBase(base, { isBossBattle:true });
                if (enemy) {
                    enemy.name = `${base.name || '深淵門将ガレオン'}・腕試し`;
                    enemy.isRandomAdventurerDuel = true;
                    delete enemy.phaseTransition;
                    delete enemy.phaseTransitionMonsterId;
                    delete enemy.phaseTransitionConversation;
                    newEnemies.push(enemy);
                }
            }
            return newEnemies;
        }

        // 冒険者が呼び出した追跡者は、階層+20相当の通常深層敵3体で構成する。
        if (!isBoss && battleData.randomHunter) {
            const context = battleData.randomHunter;
            const total = Math.max(1, Number(context.enemyCount || 3));
            const targetFloor = Math.max(1, Number(context.targetFloor || abyssBalanceFloor + 20));
            for (let i = 0; i < total; i++) {
                const enemy = Battle.createDeepNormalEnemy(targetFloor);
                if (!enemy) continue;
                enemy.name += total > 1 ? String.fromCharCode(65 + i) : '';
                enemy.isRandomHunterEnemy = true;
                newEnemies.push(enemy);
            }
            return newEnemies;
        }

        // レアモンスター5体との即時戦闘。レア抽選率は使わず正式レア帯から直接選び、
        // 深層階層へ能力を正規化する。先制・オート解除はBattle.initで確定する。
        if (!isBoss && battleData.randomRareAmbush) {
            const context = battleData.randomRareAmbush;
            const total = Math.max(1, Number(context.enemyCount || 5));
            const targetFloor = Math.max(1, Number(context.targetFloor || abyssBalanceFloor));
            for (let i = 0; i < total; i++) {
                let base = window.MonsterData?.tryGenerateRareMonster?.(targetFloor, { force:true }) || null;
                let enemy = base ? Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), targetFloor, false) : null;
                if (!enemy) enemy = Battle.createDeepNormalEnemy(targetFloor);
                if (!enemy) continue;
                enemy.isRare = true;
                enemy.isRandomRareAmbushEnemy = true;
                enemy.name += total > 1 ? String.fromCharCode(65 + i) : '';
                newEnemies.push(enemy);
            }
            return newEnemies;
        }

        // 「物語の残響」階では通常敵抽選を完全に置き換え、能力だけを同階層雑魚基準へ
        // ナーフした物語ボス1～2体を出す。
        if (!isBoss && battleData.storyBossEchoFloor) {
            const total = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < total; i++) {
                const enemy = Battle.createStoryBossEchoEnemy(abyssBalanceFloor, i, total);
                if (enemy) newEnemies.push(enemy);
            }
            return newEnemies;
        }

        // 深淵の裂け目戦は「10フロア先相当の通常強敵3体」を出す。
        // fixedBossId にIDを詰める方式だと、201階以降で generateEnemyForFloor() が null になり、
        // allowRare:true 経由でメタル系などのレアモンスターだけが選ばれる事故が起きる。
        // そのため、ここで battleData.riftFloor を正として、201階以降は通常深層敵生成ロジックを使う。
        const riftEventId = (typeof Dungeon !== 'undefined' && Dungeon.riftBattleEventId) ? Dungeon.riftBattleEventId : '__DUNGEON_ABYSS_RIFT__';
        const isRiftBattle = !!(battleData.isRiftBattle || battleData.eventId === riftEventId);
        if (isRiftBattle) {
            const riftFloor = Math.max(1, Number(battleData.riftFloor) || (floor + 10));
            const total = Math.max(1, Number(battleData.riftEnemyCount || 3));
            const multiplier = Math.max(1, Number(battleData.riftStatMultiplier || 1.25));
            Battle.log('<span style="color:#c78cff; font-weight:bold;">亀裂の根源から強敵が現れた！</span>');
            for (let i = 0; i < total; i++) {
                const enemy = Battle.createDeepNormalEnemy(riftFloor);
                if (!enemy) continue;
                Battle.applyRiftEnemyBoost(enemy, multiplier);
                enemy.name += total > 1 ? String.fromCharCode(65 + i) : '';
                newEnemies.push(enemy);
            }
            return newEnemies;
        }

        // ストーリーボス訓練所は、正式マスターのボスをPhase2Dの深層強化規則で再現する。
        // fixedBossIdを使わず専用コンテキストから生成し、本編進行と完全に分離する。
        const storyBossTraining = battleData.storyBossTraining;
        if (isBoss && storyBossTraining && Array.isArray(storyBossTraining.monsterIds)) {
            const trainingIds = storyBossTraining.monsterIds.map(Number).filter(Number.isFinite);
            const trainingFloor = Math.max(101, Number(storyBossTraining.strengthFloor || 101));
            Battle.log(`<span style="color:#d8b5ff;font-weight:bold;">${Battle.escapeHtml(storyBossTraining.opponentName || '物語の強敵')}が訓練用に再現された！</span>`);
            trainingIds.forEach((id, index) => {
                const base = Battle.getMonsterBaseById(id);
                if (!base) return;
                const enemy = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), trainingFloor, true);
                if (!enemy) return;
                enemy.exp = 0;
                enemy.gold = 0;
                enemy.drops = null;
                enemy.isSpecialBoss = false;
                enemy.isEstark = false;
                enemy.isStoryBossTrainingEnemy = true;
                enemy.storyBossTrainingId = storyBossTraining.trainingId || null;
                enemy.storyBossTrainingFloor = trainingFloor;
                delete enemy.phaseTransition;
                delete enemy.phaseTransitionMonsterId;
                delete enemy.phaseTransitionConversation;
                if (trainingIds.length > 1) enemy.name += String.fromCharCode(65 + index);
                newEnemies.push(enemy);
            });
            return newEnemies;
        }

        const storedAbyssBoss = battleData.abyssBossEncounter;
        if (isBoss && storedAbyssBoss && Array.isArray(storedAbyssBoss.monsterIds) && storedAbyssBoss.monsterIds.length > 0) {
            const storedFloor = Math.max(1, Number(storedAbyssBoss.balanceFloor || battleData.abyssBalanceFloor || storedAbyssBoss.floor) || floor);
            const storedIds = storedAbyssBoss.monsterIds.map(id => Number(id)).filter(id => Number.isFinite(id));
            if (storedAbyssBoss.source === 'memory-realm') {
                Battle.log('<span style="color:#d8b5ff; font-weight:bold;">追憶の最奥から、強大な記憶が具現化した！</span>');
                storedIds.forEach((id, i) => {
                    const base = Battle.getMonsterBaseById(id);
                    const enemy = Battle.createMemoryRealmMonster(base, 120, { isBossBattle:true, elements:battleData.memoryElements || [] });
                    if (enemy && storedIds.length > 1) enemy.name += String.fromCharCode(65 + i);
                    if (enemy) newEnemies.push(enemy);
                });
                return newEnemies;
            }
            if (storedAbyssBoss.source === 'deep-random' || storedFloor >= 201) {
                Battle.log('<span style="color:#ff0000; font-size:1em; font-weight:bold;">深淵の守護者が現れた！</span>');
                storedIds.forEach((id, i) => {
                    const base = Battle.getMonsterBaseById(id);
                    if (!base) return;
                    let m = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), storedFloor, true);
                    if (!m) return;
                    const mult = Math.max(1, Number(battleData.bossStatMultiplier || 1));
                    if (mult > 1) {
                        m.hp = Math.max(1, Math.floor(Number(m.hp || 1) * mult));
                        m.baseMaxHp = Math.max(1, Math.floor(Number(m.baseMaxHp || m.hp || 1) * mult));
                        ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                            if (m.baseStats?.[key] !== undefined) m.baseStats[key] = Math.max(0, Math.floor(Number(m.baseStats[key] || 0) * mult));
                            if (m[key] !== undefined) m[key] = Math.max(0, Math.floor(Number(m[key] || 0) * mult));
                        });
                    }
                    m = Battle.applyMapEnemyBoost(m, battleData.guildChallengeEnemyBoost || null);
                    if (storedIds.length > 1) m.name += String.fromCharCode(65 + i);
                    newEnemies.push(m);
                });
            } else {
                Battle.log('強大な魔物が現れた！');
                storedIds.forEach((id, i) => {
                    const base = Battle.getMonsterBaseById(id);
                    if (!base) return;
                    const guildBossBoost = storedAbyssBoss.source === 'guild-quest'
                        ? (battleData.guildChallengeBossBoost || {
                            ...(battleData.guildChallengeEnemyBoost || {}),
                            statMultiplier: 1,
                            rareStatMultiplier: 1,
                            applyToRares: false
                        })
                        : (battleData.guildChallengeEnemyBoost || null);
                    pushBase(base, i, storedIds.length, {
                        isBossBattle: true,
                        storyBossStatMultiplier: battleData.bossStatMultiplier || 1,
                        trialEnemyBoost: guildBossBoost
                    });
                });
            }
            if (newEnemies.length > 0) return newEnemies;
        }

        if (isBoss && targetId) {
            const bases = Battle.getMonsterBasesByIds(targetId);
            if (bases.length > 0) {
                bases.forEach((base, i) => {
                    const special = Battle.isSpecialBossBase(base);
                    const previousDefeats = special
                        ? Math.max(0, Math.floor(Number(App.data.book?.killCounts?.[base.id]) || 0))
                        : 0;
                    const specialScale = special ? Battle.getSpecialBossScale(base, previousDefeats) : 1;
                    const enemy = pushBase(base, i, bases.length, {
                        isBossBattle: true,
                        forceSpecialBoss: special,
                        scale: specialScale,
                        // 裏ボスは専用の討伐回数補正だけを使用し、深層・試練倍率と重複させない。
                        storyBossStatMultiplier: special ? 1 : bossStatMultiplier,
                        trialEnemyBoost: special ? null : (battleData.trialEnemyBoost || null),
                    });
                    if (enemy && special) {
                        enemy.specialBossScale = specialScale;
                        enemy.specialBossDefeatsAtStart = previousDefeats;
                    }
                });
                return newEnemies;
            }
        }

        if (isBoss && isSpecialBossBattle) {
            let bases = [];
            if (window.MonsterData && typeof window.MonsterData.getSpecialBossesForFloor === 'function') {
                bases = window.MonsterData.getSpecialBossesForFloor(floor) || [];
            }
            if (bases.length === 0) {
                const gilgamesh = Battle.getMonsterBaseById(902000);
                if (gilgamesh) bases = [gilgamesh];
            }
            bases.forEach((base, i) => {
                const previousDefeats = Math.max(0, Math.floor(Number(App.data.book?.killCounts?.[base.id]) || 0));
                const scale = Battle.getSpecialBossScale(base, previousDefeats);
                const enemy = pushBase(base, i, bases.length, { isBossBattle:true, forceSpecialBoss:true, scale });
                if (enemy) {
                    enemy.specialBossScale = scale;
                    enemy.specialBossDefeatsAtStart = previousDefeats;
                }
            });
            return newEnemies;
        }

        // 宝箱トラップは通常エンカウント数の抽選を行わず、指定された1体だけを出す。
        // 201階以降は他の深層雑魚と同じ createDeepFloorMonster() で170階型を強化する。
        const chestTrapId = Number(battleData.chestTrapMonsterId);
        if (!isBoss && battleData.isChestTrapBattle && Number.isFinite(chestTrapId)) {
            const base = Battle.getMonsterBaseById(chestTrapId);
            if (base?.isChestTrap) {
                const trapFloor = Math.max(1, Number(battleData.chestTrapFloor) || floor);
                const monster = trapFloor >= 201
                    ? Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), trapFloor, false)
                    : Battle.createMonsterFromBase(base, { isBossBattle: false });
                if (monster) {
                    monster.isChestTrap = true;
                    newEnemies.push(monster);
                    Battle.log(`<span style="color:#ff8a72;font-weight:bold;">${monster.name}</span> が正体を現した！`);
                }
            }
            return newEnemies;
        }

        // イベント用の明示編成。通常エンカウントは最大4体だが、イベント/亀裂では5体まで許可する。
        // 使い方例: App.data.battle.fixedEnemyIds = [100001,100002,100003,100004,100005]
        // または App.data.battle.exactMonsters = true; App.data.battle.monsters = [...]
        const exactEventMonsterIds = Array.isArray(battleData.fixedEnemyIds)
            ? battleData.fixedEnemyIds
            : (battleData.exactMonsters && Array.isArray(battleData.monsters) ? battleData.monsters : null);
        if (!isBoss && exactEventMonsterIds && exactEventMonsterIds.length > 0) {
            const ids = exactEventMonsterIds.slice(0, 5);
            ids.forEach((mid, i) => {
                const base = Battle.getMonsterBaseById(mid);
                if (!base || Battle.isSpecialBossBase(base)) return;
                const m = Battle.createMonsterFromBase(base, {
                    name: (base.name || '\u4e0d\u660e\u306a\u9b54\u7269') + suffix(i, ids.length),
                    isBossBattle: !!base.isBoss,
                });
                if (m) newEnemies.push(m);
            });
            if (newEnemies.length > 0) return newEnemies;
        }

        const hasConfiguredEncounterPool = !isBoss && Array.isArray(battleData.monsters) && battleData.monsters.length > 0;
        const rareEncounterRank = Math.max(1, Number(battleData.abyssBalanceFloor || battleData.encounterRank || floor) || 1);
        if (!isBoss && abyssMode !== 'memory' && window.MonsterData && typeof window.MonsterData.tryGenerateRareMonster === 'function') {
            const rareBase = window.MonsterData.tryGenerateRareMonster(rareEncounterRank, {
                rateMultiplier:Math.max(0, Number(battleData.rareEncounterRateMultiplier || 1))
            });
            if (rareBase && rareBase.isRare === true && !Battle.isSpecialBossBase(rareBase)) {
                const rareEnemy = Battle.createMonsterFromBase(rareBase, { name: rareBase.name || '\u4e0d\u660e\u306a\u9b54\u7269' });
                if (rareEnemy) {
                    newEnemies.push(rareEnemy);
                    Battle.log(`<span style="color:#ffd45c;font-weight:bold;">${rareEnemy.name}</span> \u304c\u73fe\u308c\u305f\uff01`);
                    return newEnemies;
                }
            }
        }
        const isRandomEndless = globalThis.ABYSS_FLOOR_RULES?.isEndlessFloor?.(abyssDisplayFloor, abyssMode) === true;
        if ((isRandomEndless || floor >= 201) && !hasConfiguredEncounterPool) {
            const deepScaleFloor = isRandomEndless ? abyssBalanceFloor : floor;
            if (isBoss) {
                Battle.log('<span style="color:#ff0000; font-size:1em; font-weight:bold;">\u6df1\u6df5\u306e\u5b88\u8b77\u8005\u304c\u73fe\u308c\u305f\uff01</span>');
                let candidates = (window.MonsterData?.bossMonsters || DB.MONSTERS || [])
                    .filter(base => base.isBoss && !base.isRare && !Battle.isSpecialBossBase(base) && Battle.isAbyssRandomBossBase(base));
                candidates = Array.from(new Map(
                    candidates
                        .filter(base => Number.isFinite(Number(base?.id)) && Number(base.id) > 0)
                        .map(base => [Number(base.id), base])
                ).values());
                if (candidates.length === 0) {
                    const fallback = Battle.getMonsterBaseById(401200);
                    if (fallback) candidates = [fallback];
                }
                const count = Math.min(deepBossCount, candidates.length);
                const pool = candidates.slice();
                for (let i = 0; i < count; i++) {
                    const index = Math.floor(Math.random() * pool.length);
                    const [base] = pool.splice(index, 1);
                    if (!base) continue;
                    const m = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), deepScaleFloor, true);
                    if (!m) continue;
                    if (count > 1) m.name += String.fromCharCode(65 + i);
                    newEnemies.push(m);
                }
            } else {
                Battle.log('\u5f37\u529b\u306a\u9b54\u7269\u306e\u6c17\u914d\u304c\u3059\u308b\u2026\uff01');
                let candidates = [];
                if (window.MonsterData && typeof window.MonsterData.getDeepFloorNormalBaseCandidates === 'function') {
                    candidates = window.MonsterData.getDeepFloorNormalBaseCandidates() || [];
                }
                if (candidates.length === 0 && window.MonsterData && typeof window.MonsterData.generateBandMonster === 'function') {
                    const fallback = window.MonsterData.generateBandMonster(200);
                    if (fallback) candidates = [fallback];
                }
                for (let i = 0; i < normalCount; i++) {
                    const base = candidates[Math.floor(Math.random() * candidates.length)];
                    if (!base) continue;
                    const m = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), deepScaleFloor, false);
                    if (!m) continue;
                    if (normalCount > 1) m.name += String.fromCharCode(65 + i);
                    newEnemies.push(m);
                }
            }
            return newEnemies;
        }

        if (!isBoss && abyssMode === 'memory') {
            Battle.log('<span style="color:#d8b5ff;">強化された魔物の記憶が現れた！</span>');
            const pool = Array.isArray(battleData.monsters) ? battleData.monsters.map(Number).filter(Number.isFinite) : [];
            for (let i = 0; i < normalCount; i++) {
                const id = pool[Math.floor(Math.random() * pool.length)];
                const base = Battle.getMonsterBaseById(id) || globalThis.MonsterData?.generateBandMonster?.(Math.min(85, Math.max(1, Number(floor) - 90)));
                const enemy = Battle.createMemoryRealmMonster(base, abyssBalanceFloor, { isBossBattle:false, elements:battleData.memoryElements || [] });
                if (enemy && normalCount > 1) enemy.name += String.fromCharCode(65 + i);
                if (enemy) newEnemies.push(enemy);
            }
            return newEnemies;
        }

        if (isBoss) {
            Battle.log('\u5f37\u5927\u306a\u9b54\u7269\u304c\u73fe\u308c\u305f\uff01');
            let bosses = [];
            if (window.MonsterData && typeof window.MonsterData.getBossesForFloor === 'function') {
                bosses = window.MonsterData.getBossesForFloor(abyssMode === 'random' ? abyssBalanceFloor : floor) || [];
            }
            if (bosses.length === 0 && window.MonsterData && typeof window.MonsterData.getBossesForFloor === 'function') {
                bosses = window.MonsterData.getBossesForFloor(200) || [];
            }
            bosses.forEach((base, i) => pushBase(base, i, bosses.length, { isBossBattle: true }));
            return newEnemies;
        }

        Battle.log('\u9b54\u7269\u304c\u73fe\u308c\u305f\uff01');
        for (let i = 0; i < normalCount; i++) {
            let monsterData = null;
            const isFixedMap = typeof Field !== 'undefined' && Field.currentMapData && Field.currentMapData.isFixed;
            const battleMonsterIds = Array.isArray(battleData.monsters) ? battleData.monsters : null;
            const fixedMonsterIds = battleMonsterIds;

            if (!monsterData && fixedMonsterIds && fixedMonsterIds.length > 0) {
                const mid = fixedMonsterIds[Math.floor(Math.random() * fixedMonsterIds.length)];
                const fixedBase = Battle.getMonsterBaseById(mid);
                if (Battle.isNormalEncounterBase(fixedBase)) monsterData = fixedBase;
            }

            if (!monsterData && battleData.useHabitatEncounters && window.MonsterData && typeof window.MonsterData.generateEnemyForEncounter === 'function') {
                monsterData = window.MonsterData.generateEnemyForEncounter({
                    mapId: battleData.encounterMapId,
                    floor: battleData.encounterFloor,
                    abyssFloor: battleData.abyssFloor,
                    rank: battleData.abyssBalanceFloor || battleData.encounterRank || floor,
                    allowRare: false
                });
            }
            if (!monsterData && !battleData.useHabitatEncounters && window.MonsterData && typeof window.MonsterData.generateEnemyForFloor === 'function') {
                monsterData = window.MonsterData.generateEnemyForFloor(floor, { allowRare: false });
            }

            if (!monsterData && typeof window.generateEnemy === 'function') {
                monsterData = window.generateEnemy(floor);
            }

            if (monsterData && !Battle.isSpecialBossBase(monsterData) && (!monsterData.isBoss || monsterData.isRare)) {
                const m = Battle.createMonsterFromBase(monsterData, { name: (monsterData.name || '\u4e0d\u660e\u306a\u9b54\u7269') + suffix(i, normalCount) });
                const boost = battleData.guildChallengeEnemyBoost
                    || ((typeof Field !== 'undefined' && Field.currentMapData?.enemyBoost) ? Field.currentMapData.enemyBoost : null);
                if (m) newEnemies.push(Battle.applyMapEnemyBoost(m, boost));
            }
        }
        return newEnemies;
    },

    getMemoryRealmSkillCandidates: (targetRank, elements = [], preferMagic = false, options = {}) => {
        const elementSet = new Set((elements || []).map(String));
        const rank = Math.max(91, Number(targetRank || 91));
        const strictElements = options.strictElements === true;
        const preferredType = options.preferredType || (preferMagic ? '魔法' : '物理');
        // Rank91～120では高位技を中心にする。MPだけでなく倍率・固定威力・手数も評価する。
        const targetMp = Math.max(20, Math.floor(rank * 0.55));
        const targetPower = Math.max(1.8, rank / 38);
        return (DB.SKILLS || []).filter(skill => {
            const id = Number(skill?.id);
            if (!Number.isFinite(id) || id < 100 || id >= 700000) return false;
            if (!['物理','魔法','特殊','強化'].includes(String(skill.type || ''))) return false;
            if (skill.instantDeath || skill.escape || skill.revive || skill.fullRestore) return false;
            const target = String(skill.target || '');
            if (target.includes('味方') && !String(skill.type || '').includes('強化')) return false;
            if (options.attackOnly === true && !['物理','魔法'].includes(String(skill.type || ''))) return false;
            if (strictElements && elementSet.size > 0 && !elementSet.has(String(skill.elm || skill.element || ''))) return false;
            if (options.strictType === true && String(skill.type || '') !== preferredType) return false;
            return true;
        }).map(skill => {
            const count = Math.max(1, Number(skill.count || 1));
            const power = Math.max(Number(skill.rate || 0) * count, Number(skill.base || 0) / Math.max(1, rank));
            let score = 120 - Math.abs(Number(skill.mp || 0) - targetMp) * 0.9;
            score += Math.min(75, power * 18);
            score -= Math.abs(power - targetPower) * 7;
            if (elementSet.has(String(skill.elm || skill.element || ''))) score += 100;
            if (String(skill.type || '') === preferredType) score += 45;
            if (skill.type === '特殊' || skill.type === '強化') score += 10;
            return { skill, score: score + Math.random() * 25 };
        }).sort((a,b) => b.score - a.score).map(entry => entry.skill);
    },

    getMemoryRealmAllPartyHealSkill: (targetRank) => {
        const rank = Math.max(91, Number(targetRank || 91));
        const targetMp = Math.max(25, Math.floor(rank * 0.55));
        const candidates = (DB.SKILLS || []).filter(skill =>
            String(skill?.type || '') === '回復' &&
            String(skill?.target || '').includes('全体') &&
            skill?.revive !== true && skill?.fullRestore !== true &&
            Number.isFinite(Number(skill?.id))
        );
        return candidates.map(skill => {
            const healing = Number(skill.base || 0) + Number(skill.rate || 0) * rank;
            const score = healing - Math.abs(Number(skill.mp || 0) - targetMp) * 1.5;
            return { skill, score };
        }).sort((a,b) => b.score - a.score)[0]?.skill || null;
    },

    applyMemoryRealmStatProfile: (enemy, profile) => {
        if (!enemy || !profile) return enemy;
        const scaleStat = (key, mult, min = 1) => {
            const current = Number(enemy.baseStats?.[key] ?? enemy[key] ?? 0);
            const value = Math.max(min, Math.floor(current * mult));
            if (enemy.baseStats && key in enemy.baseStats) enemy.baseStats[key] = value;
            enemy[key] = value;
        };
        if (profile.role === 'magic') {
            scaleStat('mag', 1.35);
            scaleStat('mdef', 1.15);
            scaleStat('atk', 0.62);
            enemy.mp = Math.max(1, Math.floor(Number(enemy.mp || 0) * 1.3));
            enemy.baseMaxMp = Math.max(enemy.mp, Math.floor(Number(enemy.baseMaxMp || enemy.mp) * 1.3));
        } else if (profile.role === 'physical') {
            scaleStat('atk', 1.35);
            scaleStat('def', 1.15);
            scaleStat('mag', 0.62);
            enemy.hp = Math.max(1, Math.floor(Number(enemy.hp || 1) * 1.12));
            enemy.baseMaxHp = Math.max(enemy.hp, Math.floor(Number(enemy.baseMaxHp || enemy.hp) * 1.12));
        }
        enemy.elmAtk = JSON.parse(JSON.stringify(enemy.elmAtk || {}));
        (profile.elements || []).forEach(element => {
            enemy.elmAtk[element] = Math.max(Number(enemy.elmAtk[element] || 0), 30);
        });
        enemy.memoryRoleProfile = profile.role || null;
        return enemy;
    },

    applyMemoryRealmSkillLoadout: (enemy, base, targetRank, elements, isBoss) => {
        if (!enemy) return enemy;
        const profile = (typeof Dungeon !== 'undefined' && typeof Dungeon.getMemoryRealmGlobalMonsterProfile === 'function')
            ? Dungeon.getMemoryRealmGlobalMonsterProfile(base?.id ?? enemy.baseId ?? enemy.id)
            : null;
        const effectiveElements = profile?.elements ? [...profile.elements] : [...(elements || [])];
        const preferMagic = profile ? profile.role === 'magic' : Number(base?.mag || 0) > Number(base?.atk || 0);
        const pool = Battle.getMemoryRealmSkillCandidates(targetRank, effectiveElements, preferMagic, profile ? {
            strictElements: true,
            strictType: true,
            attackOnly: true,
            preferredType: profile.role === 'magic' ? '魔法' : '物理'
        } : {});
        const count = isBoss ? 6 : (profile ? 3 : 3);
        const acts = [{ id:1, rate:isBoss ? 18 : (profile ? 18 : 30), condition:0 }];
        for (const skill of pool) {
            if (acts.length >= count + 1) break;
            if (acts.some(act => Number(act.id) === Number(skill.id))) continue;
            acts.push({ id:Number(skill.id), rate:isBoss ? 20 : (profile ? 26 : 24), condition:0 });
        }
        if (profile?.allPartyHeal) {
            const healSkill = Battle.getMemoryRealmAllPartyHealSkill(targetRank);
            if (healSkill && !acts.some(act => Number(act.id) === Number(healSkill.id))) {
                acts.push({ id:Number(healSkill.id), rate:32, condition:0 });
            }
        }
        enemy.acts = acts;
        enemy.memoryElements = effectiveElements;
        if (profile) Battle.applyMemoryRealmStatProfile(enemy, profile);
        return enemy;
    },

    getMemoryRealmItemDropCandidates: (targetRank) => {
        const rank = Math.max(1, Math.floor(Number(targetRank) || 1));
        const eligible = (DB.ITEMS || []).filter(item => {
            if (!item) return false;
            if (['貴重品','乗り物','移動','スキル書','特性書'].includes(String(item.type || ''))) return false;
            if (item.medalOnly === true || item.abyssDrop === false) return false;
            return Number(item.rank || 1) <= rank;
        });
        if (!eligible.length) return [];
        // 現在Rank以下で最も近いマスタRankを正本にし、低Rank消耗品へ逆戻りしない。
        const nearestRank = Math.max(...eligible.map(item => Math.max(1, Number(item.rank || 1))));
        return eligible.filter(item => Math.max(1, Number(item.rank || 1)) === nearestRank);
    },

    createMemoryRealmRareMonster: (base, targetRank) => {
        if (!base) return null;
        const original = Battle.cloneMonsterBase(base);
        const enemy = Battle.createMonsterFromBase(original, { isBossBattle:false });
        if (!enemy) return null;
        const sourceRank = Math.max(1, Number(original.rank || original.minF || 1));
        const rank = Math.max(91, Number(targetRank) || 91);
        const rewardScale = Math.max(1, rank / sourceRank);
        const elements = (typeof CONST !== 'undefined' && Array.isArray(CONST.ELEMENTS))
            ? CONST.ELEMENTS
            : ['火','水','風','雷','光','闇','混沌'];

        // メタル系の個性は「低HP・極端な防御・属性無効・高報酬・逃走行動」。
        // 通常のRank比例ステータス化を通すと全て失われるため、専用生成で保持する。
        enemy.id = Number(original.id);
        enemy.baseId = Number(original.id);
        enemy.name = original.name || enemy.name;
        enemy.image = original.image || original.img || enemy.image;
        enemy.imageId = original.imageId ?? original.baseImageId ?? enemy.imageId;
        enemy.rank = rank;
        enemy.generatedFloor = rank;
        enemy.memoryRewardRank = rank;
        enemy.memoryRealm = true;
        enemy.memoryRarePreserveDrops = true;
        enemy.absoluteElementImmunity = true;
        enemy.isBoss = false;
        enemy.isRare = true;
        enemy.isSpecialBoss = false;
        enemy.isEstark = false;
        enemy.race = original.race || enemy.race;

        enemy.hp = Math.max(1, Math.floor(Number(original.hp || 1)));
        enemy.baseMaxHp = enemy.hp;
        enemy.mp = Math.max(0, Math.floor(Number(original.mp || 0)));
        enemy.baseMaxMp = enemy.mp;
        enemy.atk = Math.max(1, Math.floor(Number(original.atk || 1)));
        enemy.def = Math.max(9999, Math.floor(Number(original.def || 9999)));
        enemy.spd = Math.max(1, Math.floor(Number(original.spd || 1) * Math.max(1, Math.sqrt(rewardScale))));
        enemy.mag = Math.max(1, Math.floor(Number(original.mag || 1)));
        enemy.mdef = Math.max(9999, Math.floor(Number(original.mdef || original.def || 9999)));
        enemy.baseStats = enemy.baseStats || {};
        Object.assign(enemy.baseStats, { atk:enemy.atk, def:enemy.def, spd:enemy.spd, mag:enemy.mag, mdef:enemy.mdef });
        enemy.hit = Battle.normalizeMonsterHitRate(original.hit, 100);
        enemy.eva = Math.max(0, Number(original.eva || 0));
        enemy.cri = Math.max(0, Number(original.cri || 0));
        enemy.exp = Math.max(1, Math.floor(Number(original.exp || 1) * rewardScale));
        enemy.gold = Math.max(0, Math.floor(Number(original.gold || 0) * rewardScale));
        enemy.actCount = Math.max(1, Number(original.actCount || 1));
        enemy.acts = JSON.parse(JSON.stringify(original.acts || [{ id:9, rate:100, condition:0 }]));
        enemy.traits = JSON.parse(JSON.stringify(original.traits || []));
        enemy.resists = JSON.parse(JSON.stringify(original.resists || {}));
        enemy.elmRes = JSON.parse(JSON.stringify(original.elmRes || {}));
        elements.forEach(element => {
            enemy.elmRes[element] = Math.max(100, Number(enemy.elmRes[element] || 0));
        });
        enemy.drops = JSON.parse(JSON.stringify(original.drops || null));
        return enemy;
    },

    createMemoryRealmMonster: (base, targetRank, options = {}) => {
        if (!base) return null;
        const original = Battle.cloneMonsterBase(base);
        const storyBossAsNormal = !options.isBossBattle && typeof Dungeon !== 'undefined' && Dungeon.isMemoryRealmBossId?.(original.id);
        const rareAsNormal = !options.isBossBattle && !!original.isRare;
        if (rareAsNormal) return Battle.createMemoryRealmRareMonster(original, targetRank);

        let scalingBase = Battle.cloneMonsterBase(original);
        if (storyBossAsNormal) {
            const referenceRank = Math.max(1, Math.min(85, Number(original.rank || original.minF || 85)));
            const reference = globalThis.MonsterData?.generateBandMonster?.(referenceRank) || globalThis.MonsterData?.generateBandMonster?.(85);
            if (reference) {
                ['hp','mp','atk','def','spd','mag','mdef','exp','gold'].forEach(key => { scalingBase[key] = Number(reference[key] || scalingBase[key] || 1); });
                scalingBase.rank = Number(reference.rank || referenceRank);
            }
            scalingBase.isBoss = false;
            scalingBase.isSpecialBoss = false;
            scalingBase.isEstark = false;
            scalingBase.isRare = false;
            scalingBase.drops = null;
        }
        const enemy = Battle.createDeepFloorMonster(scalingBase, Math.max(91, Number(targetRank) || 91), !!options.isBossBattle);
        if (!enemy) return null;
        enemy.id = Number(original.id);
        enemy.baseId = Number(original.id);
        enemy.name = original.name || enemy.name;
        enemy.image = original.image || original.img || enemy.image;
        enemy.imageId = original.imageId ?? original.baseImageId ?? enemy.imageId;
        enemy.rank = Math.max(91, Number(targetRank) || 91);
        enemy.generatedFloor = enemy.rank;
        enemy.memoryRewardRank = enemy.rank;
        enemy.memoryRealm = true;
        enemy.drops = null;
        enemy.race = original.race || enemy.race;
        enemy.isBoss = !!options.isBossBattle;
        enemy.isSpecialBoss = false;
        enemy.isEstark = false;
        enemy.isRare = false;
        Battle.applyMemoryRealmSkillLoadout(enemy, original, enemy.rank, options.elements || [], !!options.isBossBattle);
        return enemy;
    },

/**
     * 深層ボス強化用の正式マスターを取得する。
     * マスター未読込時は空配列・空オブジェクトで安全に処理する。
     */
    getDeepBossEnhancementMaster: () => {
        const content = globalThis.ABYSS_REGION_CONTENT || {};
        return {
            skillFamilies: Array.isArray(content.deepBossSkillFamilies) ? content.deepBossSkillFamilies : [],
            roleTraitPools: content.deepBossRoleTraitPools || {},
            statusResistKeys: Array.isArray(content.deepBossStatusResistKeys) ? content.deepBossStatusResistKeys : []
        };
    },

    getDeepBossEnhancementStage: (floor) => {
        const numericFloor = Math.max(101, Math.floor(Number(floor) || 101));
        return Math.max(1, Math.min(8, 1 + Math.floor((numericFloor - 101) / 50)));
    },

    getDeepBossSkillFamily: (skillId) => {
        const numericId = Number(skillId);
        return Battle.getDeepBossEnhancementMaster().skillFamilies.find(family =>
            Array.isArray(family?.skillIds) && family.skillIds.some(id => Number(id) === numericId)
        ) || null;
    },

    getDeepBossUpgradeSkillIds: (baseActs, floor) => {
        const acts = Array.isArray(baseActs) ? baseActs : [];
        const stage = Battle.getDeepBossEnhancementStage(floor);
        const step = Math.min(4, 1 + Math.floor((stage - 1) / 2));
        const candidates = [];
        acts.forEach(act => {
            const currentId = Number(act?.id);
            if (!Number.isFinite(currentId) || currentId <= 0) return;
            const family = Battle.getDeepBossSkillFamily(currentId);
            if (!family) return;
            const ids = family.skillIds.map(Number).filter(id => Number.isFinite(id) && id > 0);
            const currentIndex = ids.indexOf(currentId);
            if (currentIndex < 0 || currentIndex >= ids.length - 1) return;
            const upgradeId = ids[Math.min(ids.length - 1, currentIndex + step)];
            if (upgradeId === currentId || acts.some(existing => Number(existing?.id) === upgradeId)) return;
            if (!DB?.SKILLS?.some(skill => Number(skill?.id) === upgradeId)) return;
            if (!candidates.some(entry => entry.id === upgradeId)) {
                candidates.push({ id:upgradeId, sourceAct:act, familyId:family.id });
            }
        });
        const maxAdditions = Math.min(3, 1 + Math.floor((stage - 1) / 2));
        const selected = [];
        const pool = candidates.slice();
        while (pool.length && selected.length < maxAdditions) {
            const index = Math.floor(Math.random() * pool.length);
            selected.push(pool.splice(index, 1)[0]);
        }
        return selected;
    },

    applyDeepBossSkillEnhancements: (monster, base, floor) => {
        const originalActs = JSON.parse(JSON.stringify(base?.acts || [{ id:1, rate:100, condition:0 }]));
        monster.acts = originalActs;
        const stage = Battle.getDeepBossEnhancementStage(floor);
        Battle.getDeepBossUpgradeSkillIds(originalActs, floor).forEach(entry => {
            const sourceRate = Math.max(1, Number(entry.sourceAct?.rate || 10));
            monster.acts.push({
                id: entry.id,
                rate: Math.max(8, Math.min(20, Math.floor(sourceRate * 0.65) + stage)),
                condition: Number(entry.sourceAct?.condition || 0),
                deepUpgradeOf: Number(entry.sourceAct?.id),
                deepSkillFamily: entry.familyId
            });
        });
        monster.deepOriginalActIds = originalActs.map(act => Number(act?.id)).filter(Number.isFinite);
    },

    getDeepBossRoleKeys: (base) => {
        const stats = {
            physical: Math.max(0, Number(base?.atk || 0)),
            magic: Math.max(0, Number(base?.mag || 0)),
            tank: (Math.max(0, Number(base?.def || 0)) + Math.max(0, Number(base?.mdef || base?.mag || 0))) / 2,
            speed: Math.max(0, Number(base?.spd || 0))
        };
        const roleKeys = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([key]) => key);
        const skills = (Array.isArray(base?.acts) ? base.acts : [])
            .map(act => DB?.SKILLS?.find(skill => Number(skill?.id) === Number(act?.id)))
            .filter(Boolean);
        if (skills.some(skill => skill.type === 'ブレス')) roleKeys.unshift('breath');
        if (skills.some(skill => ['回復','蘇生','強化','弱体'].includes(skill.type))) roleKeys.push('support');
        return [...new Set(roleKeys)].slice(0, 3);
    },

    applyDeepBossTraitEnhancements: (monster, base, floor) => {
        const master = Battle.getDeepBossEnhancementMaster();
        const stage = Battle.getDeepBossEnhancementStage(floor);
        const levelBonus = Math.min(5, 1 + Math.floor((stage - 1) / 2));
        monster.traits = JSON.parse(JSON.stringify(base?.traits || [])).map(trait => ({
            ...trait,
            id: Number(trait?.id),
            level: Math.min(10, Math.max(1, Number(trait?.level || trait?.lv || 1) + levelBonus))
        }));

        const roleKeys = Battle.getDeepBossRoleKeys(base);
        const existingIds = new Set(monster.traits.map(trait => Number(trait?.id)));
        const candidateIds = [...new Set(roleKeys.flatMap(role =>
            Array.isArray(master.roleTraitPools?.[role]) ? master.roleTraitPools[role] : []
        ).map(Number).filter(id =>
            Number.isInteger(id) && id > 0 && !existingIds.has(id) && !!PassiveSkill?.MASTER?.[id]
        ))];
        const additionCount = Math.min(3, 1 + Math.floor((stage - 1) / 2));
        const addedTraitLevel = Math.min(10, 3 + stage);
        for (let i = 0; i < additionCount && candidateIds.length; i++) {
            const index = Math.floor(Math.random() * candidateIds.length);
            const id = candidateIds.splice(index, 1)[0];
            monster.traits.push({ id, level:addedTraitLevel, deepAdded:true });
            existingIds.add(id);
        }
        monster.deepBossRoles = roleKeys;
    },

    applyDeepBossResistanceEnhancements: (monster, base, floor) => {
        const master = Battle.getDeepBossEnhancementMaster();
        const stage = Battle.getDeepBossEnhancementStage(floor);
        const statusBonus = Math.min(50, 5 + (stage - 1) * 5);
        const elementBonus = Math.min(40, 5 + (stage - 1) * 5);
        const baseResists = JSON.parse(JSON.stringify(base?.resists || {}));
        monster.resists = { ...baseResists };
        master.statusResistKeys.forEach(key => {
            const baseValue = Number(baseResists[key] ?? 0);
            monster.resists[key] = Math.min(200, Math.max(-100, baseValue + statusBonus));
        });

        const baseElementResists = JSON.parse(JSON.stringify(base?.elmRes || {}));
        monster.elmRes = {};
        CONST.ELEMENTS.forEach(element => {
            const baseValue = Number(baseElementResists[element] ?? 0);
            monster.elmRes[element] = Math.min(100, Math.max(-100, baseValue + elementBonus));
        });
        monster.deepStatusResistBonus = statusBonus;
        monster.deepElementResistBonus = elementBonus;
    },

    /**
     * 深層モンスターの個別生成・スケーリング。
     * ボスのみ、元マスターの耐性・技・特性を基準に順当強化する。
     */
    createDeepFloorMonster: (base, floor, isBoss) => {
        const m = new Monster(base, 1.0);
        const rank = Math.max(1, base.rank || 1);
        const randMult = isBoss ? 2.0 : (0.9 + Math.random() * 0.4);

        m.hp = Math.floor((base.hp / rank) * floor * randMult);
        m.baseMaxHp = m.hp;
        m.mp = Math.floor((base.mp / rank) * floor * randMult);
        m.baseMaxMp = m.mp;
        m.baseStats.atk = Math.floor((base.atk / rank) * floor * randMult);
        m.baseStats.def = Math.floor((base.def / rank) * floor * randMult);
        m.baseStats.spd = Math.floor((base.spd / rank) * floor * randMult);
        m.baseStats.mag = Math.floor((base.mag / rank) * floor * randMult);
        m.mdef = Math.floor(((base.mdef || base.mag) / rank) * floor * randMult);

        m.hit = Battle.normalizeMonsterHitRate(base.hit, 100) + Math.floor(Math.random() * 21);
        m.eva = (base.eva || 0) + Math.floor(Math.random() * 21);
        m.cri = (base.cri || 0) + Math.floor(Math.random() * 21);
        m.id = base.id;
        m.baseId = base.id;
        m.rank = base.rank || rank;
        m.generatedFloor = floor;
        m.race = base.race || '不明';
        m.isBoss = base.isBoss || isBoss || false;
        m.isEstark = base.isEstark || false;
        m.isRare = base.isRare || false;
        m.isSpecialBoss = base.isSpecialBoss || base.isEstark || Number(base.id) === 902000;
        m.image = base.image || base.img || m.image || null;
        m.drops = JSON.parse(JSON.stringify(base.drops || null));

        if (isBoss) {
            Battle.applyDeepBossTraitEnhancements(m, base, floor);
            Battle.applyDeepBossResistanceEnhancements(m, base, floor);
            Battle.applyDeepBossSkillEnhancements(m, base, floor);
            m.deepEnhancementVersion = 2;
        } else {
            m.traits = JSON.parse(JSON.stringify(base.traits || []));
            if (typeof PassiveSkill !== 'undefined' && PassiveSkill.MASTER) {
                const traitCount = 1 + Math.floor(Math.random() * 3);
                const availableTraitIds = Object.keys(PassiveSkill.MASTER).filter(tid => PassiveSkill.MASTER[tid].type !== '武器');
                for (let i = 0; i < traitCount; i++) {
                    const randomId = availableTraitIds[Math.floor(Math.random() * availableTraitIds.length)];
                    const randomLv = 1 + Math.floor(Math.random() * 5);
                    if (!m.traits.some(t => Number(t.id) === Number(randomId))) m.traits.push({ id:Number(randomId), level:randomLv });
                }
            }
            m.resists = base.isRare
                ? JSON.parse(JSON.stringify(base.resists || {}))
                : { Poison:50, ToxicPoison:50, Shock:50, Fear:50, Debuff:50, InstantDeath:50, SkillSeal:50, SpellSeal:50, HealSeal:50 };
            m.elmRes = {};
            CONST.ELEMENTS.forEach(element => {
                if (base.isRare && base.elmRes && base.elmRes[element] !== undefined) m.elmRes[element] = base.elmRes[element];
                else m.elmRes[element] = -50 + Math.floor(Math.random() * 101);
            });
            m.acts = JSON.parse(JSON.stringify(base.acts || [{ id:1, rate:100, condition:0 }]));
            const candidates = DB.SKILLS.filter(skill => skill.mp >= 150 && ['物理','魔法','特殊'].includes(skill.type));
            for (let i = 0; i < 2; i++) {
                const skill = candidates[Math.floor(Math.random() * candidates.length)];
                if (skill && !m.acts.some(act => Number(act.id) === Number(skill.id))) m.acts.push({ id:skill.id, rate:20, condition:0 });
            }
        }

        m.exp = Math.floor(((base.exp || 10) / rank) * floor * randMult);
        m.gold = Math.floor(((base.gold || 10) / rank) * floor * randMult);
        m.name = base.name.replace(/^(神・|強・|真・|極・)+/, '').replace(/\s?Lv\d+[A-Z]?$/, '').trim();

        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
            m.baseStats.atk = Math.floor(m.baseStats.atk * (1 + PassiveSkill.getSumValue(m, 'atk_pct') / 100));
            m.baseStats.def = Math.floor(m.baseStats.def * (1 + PassiveSkill.getSumValue(m, 'def_pct') / 100));
            m.baseStats.mag = Math.floor(m.baseStats.mag * (1 + PassiveSkill.getSumValue(m, 'mag_pct') / 100));
            m.mdef = Math.floor(m.mdef * (1 + PassiveSkill.getSumValue(m, 'mdef_pct') / 100));
            m.baseStats.spd = Math.floor(m.baseStats.spd * (1 + PassiveSkill.getSumValue(m, 'spd_pct') / 100));
            m.hit += PassiveSkill.getSumValue(m, 'hit_pct');
            m.eva += PassiveSkill.getSumValue(m, 'eva_pct');
            m.cri += PassiveSkill.getSumValue(m, 'cri_pct');
        }

        m.passive = base.passive || {};
        Battle.initBattleStatus(m);
        return m;
    },

    log: (msg) => {
        const el = Battle.getEl('battle-log');
        if (el) {
            const line = document.createElement('div');
            line.innerHTML = msg; 
            el.appendChild(line);
            el.scrollTop = el.scrollHeight;
        }
        console.log(`[Battle] ${msg}`);
    },

    recoverInputPhaseWithoutAuto: (reason = null) => {
        if (!Battle.active || Battle.phase === 'result') return false;
        Battle.auto = false;
        Battle.updateAutoButton?.();
        Battle.phase = 'input';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.inputGeneration = Math.max(0, Number(Battle.inputGeneration || 0)) + 1;
        Battle.selectingAction = null;
        Battle.selectedItemOrSkill = null;
        Battle.closeSubMenu?.();
        while (Battle.currentActorIndex < Battle.party.length) {
            const actor = Battle.party[Battle.currentActorIndex];
            if (actor && !actor.isDead && !actor.isFled && Number(actor.hp || 0) > 0) break;
            Battle.commandQueue.push({
                type: 'skip',
                actor,
                speed: 0,
                runtimeGeneration: Number(Battle.runtimeGeneration || 0),
                inputGeneration: Number(Battle.inputGeneration || 0)
            });
            Battle.currentActorIndex++;
        }
        if (Battle.currentActorIndex >= Battle.party.length) {
            Battle.checkFinish?.();
            return false;
        }
        const actor = Battle.party[Battle.currentActorIndex];
        const nameDiv = Battle.getEl?.('battle-actor-name');
        if (nameDiv) {
            nameDiv.style.display = 'block';
            nameDiv.innerText = `${actor.name}の行動`;
        }
        Battle.renderEnemies?.();
        Battle.renderPartyStatus?.();
        Battle.updateCommandButtons?.();
        if (reason) console.error('[Battle] manual input fallback:', reason);
        return true;
    },

    recoverBattleRuntimeAfterResultError: (reason = null) => {
        Battle.resultProcessing = false;
        Battle.resultReadyToEnd = false;
        Battle.resultEndIsGameOver = false;
        Battle.resultInputLocked = false;
        Battle.resultAdvanceResolver = null;
        Battle.resultSkipRequested = false;
        Battle.resultLevelSkipActive = false;
        Battle.resultWaiters = [];
        Battle.updateResultLevelSkipButton?.();
        Battle.finishState = 'idle';
        Battle.finishToken = null;
        Battle.finishTimerId = null;
        Battle.active = true;
        Battle.phase = 'rollback_recovery';
        if (App.data?.battle) App.data.battle.active = true;

        // 結果計算中には所持金・経験値だけでなく、敵・味方のランタイムや
        // 固定MAPの一時状態も変更され得る。入力UIだけを戻すのではなく、
        // 保存済みの戦闘スナップショットから戦闘全体を再構築する。
        try {
            Battle.init({ forceManual: true });
            Battle.auto = false;
            Battle.updateAutoButton?.();
            if (reason) console.error('[Battle] battle runtime rebuilt after result error:', reason);
            return true;
        } catch (initError) {
            console.error('[Battle] battle runtime rebuild after result error failed:', initError);
            Battle.active = true;
            Battle.phase = 'input_recovery';
            return Battle.recoverInputPhaseWithoutAuto(reason || initError);
        }
    },

    scheduleInputRecovery: (reason = null) => {
        if (!Battle.active || Battle.phase === 'result' || Battle.hasPendingPhaseTransition() ||
            Battle.phaseTransitionRunnerActive || Battle.turnExecutionActive) return false;
        if (Battle.inputRecoveryScheduled) return true;
        Battle.inputRecoveryAttempts = Math.max(0, Number(Battle.inputRecoveryAttempts || 0)) + 1;
        if (Battle.inputRecoveryAttempts > 2) {
            return Battle.recoverInputPhaseWithoutAuto(reason);
        }
        Battle.inputRecoveryScheduled = true;
        const resume = () => {
            Battle.inputRecoveryScheduled = false;
            if (!Battle.active || Battle.phase === 'result' || Battle.hasPendingPhaseTransition() ||
                Battle.phaseTransitionRunnerActive || Battle.turnExecutionActive) return;
            try {
                Battle.startInputPhase();
            } catch (error) {
                Battle.scheduleInputRecovery(error);
            }
        };
        if (typeof queueMicrotask === 'function') queueMicrotask(resume);
        else Promise.resolve().then(resume);
        return true;
    },

    startInputPhase: () => {
        if (!Battle.active) return false;
        const transitionJournal = Battle.getPhaseTransitionJournal();
        if (transitionJournal && !Battle.isPhaseTransitionInputReadyStatus(transitionJournal.status)) {
            Battle.schedulePhaseTransitionRunner();
            return false;
        }
        if (Battle.turnExecutionActive || Battle.phaseTransitionRunnerActive) {
            Battle.deferredInputStart = true;
            return false;
        }
        Battle.deferredInputStart = false;
        if (Array.isArray(Battle.openingBattleConversations) && Battle.openingBattleConversations.length) {
            const entry = Battle.openingBattleConversations.shift();
            Battle.queueBattleConversation(entry.scriptKey, {
                persistId: entry.persistId || null,
                resumePhase: entry.resumePhase || 'input',
                phaseTransitionToken: entry.phaseTransitionToken || null,
                visualEffect: entry.visualEffect || null
            });
            Battle.awaitPendingBattleEvent().then(completed => {
                if (completed && Battle.active) Battle.startInputPhase();
            });
            return false;
        }

        const inputTransition = transitionJournal && transitionJournal.status !== 'completed'
            ? transitionJournal
            : null;
        if (inputTransition) {
            try {
                if (!Battle.finalizePhaseTransitionForInput(inputTransition)) {
                    Battle.schedulePhaseTransitionRunner();
                    return false;
                }
            } catch (error) {
                console.error('[Battle] phase transition finalization failed:', error);
                Battle.phase = 'phase_transition_ready';
                Battle.schedulePhaseTransitionRunner();
                return false;
            }
        }

        try {
            Battle.phase = 'input';
            Battle.commandQueue = [];
            Battle.currentActorIndex = 0;
            Battle.inputGeneration = Math.max(0, Number(Battle.inputGeneration || 0)) + 1;
            Battle.selectingAction = null;
            Battle.selectedItemOrSkill = null;
            Battle.closeSubMenu();
            Battle.findNextActor();
            Battle.inputRecoveryAttempts = 0;
            return true;
        } catch (error) {
            console.error('[Battle] input phase initialization failed:', error);
            Battle.commandQueue = [];
            Battle.currentActorIndex = 0;
            Battle.selectingAction = null;
            Battle.selectedItemOrSkill = null;
            Battle.phase = 'input_recovery';
            Battle.closeSubMenu?.();
            Battle.renderEnemies?.();
            Battle.renderPartyStatus?.();
            Battle.scheduleInputRecovery(error);
            return false;
        }
    },

	/* battle.js: オート設定とスキル非表示の完全反映版 */
findNextActor: () => {
        while (Battle.currentActorIndex < Battle.party.length) {
            const actor = Battle.party[Battle.currentActorIndex];
            if (!actor || actor.isDead || actor.isFled || Number(actor.hp || 0) <= 0) {
                Battle.commandQueue.push({
                    type: 'skip',
                    actor,
                    speed: 0,
                    runtimeGeneration: Number(Battle.runtimeGeneration || 0),
                    inputGeneration: Number(Battle.inputGeneration || 0)
                });
                Battle.currentActorIndex++;
                continue; 
            }
            Battle.phase = 'input';
            break;
        }

        if (Battle.currentActorIndex >= Battle.party.length) {
            Battle.executeTurn();
            return;
        }

        const actor = Battle.party[Battle.currentActorIndex];
        Battle.renderPartyStatus();
        
        // --- オート戦闘処理 ---
        if (Battle.auto) {
            // 現在の戦況に最適な行動を思考ルーチンで決定
            const action = Battle.decideAutoAction(actor);
            Battle.registerAction(action);
            return;
        }
        
        // --- 手動入力 ---
        const nameDiv = Battle.getEl('battle-actor-name');
        if(nameDiv) {
            nameDiv.style.display = 'block';
            nameDiv.innerText = `${actor.name}の行動`;
        }
        Battle.updateCommandButtons(); 
        Battle.log(`${actor.name}はどうする？`);
    },

    getAutoStrategyKey: (actor) => {
        const source = (typeof App !== 'undefined' && App.getChar && actor?.uid) ? App.getChar(actor.uid) : null;
        if (source && App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(source);
        const key = source?.config?.strategy || actor?.config?.strategy || 'balanced';
        return (App.battleStrategies && App.battleStrategies[key]) ? key : 'balanced';
    },

    isHealSealBlockedSkill: (skill) => {
        if (!skill) return false;
        return ['回復', '蘇生', 'MP回復'].includes(skill.type) || !!skill.HPRegen || !!skill.MPRegen;
    },

    getValidAutoSkills: (actor, allowSkills = true) => {
        if (!allowSkills) return [];
        const source = (typeof App !== 'undefined' && App.getChar && actor?.uid) ? App.getChar(actor.uid) : null;
        const config = source?.config || actor?.config || {};
        const autoDisabledIds = Array.isArray(config.autoDisabledSkills) ? config.autoDisabledSkills.map(id => Number(id)) : [];
        return (actor.skills || []).filter(s => {
            const sId = Number(s.id);
            if ([1, 2, 9].includes(sId)) return false;
            if (Battle.isMadanteSkillId(sId)) return false;
            if (autoDisabledIds.includes(sId)) return false;
            if (actor.mp < Battle.getSkillMpCost(actor, s)) return false;

            const ailments = actor.battleStatus?.ailments || {};
            if (ailments['SpellSeal'] && ['魔法','強化','弱体'].includes(s.type)) return false;
            if (ailments['SkillSeal'] && ['物理','特殊'].includes(s.type)) return false;
            if (ailments['HealSeal'] && Battle.isHealSealBlockedSkill(s)) return false;
            return true;
        });
    },

    makeAutoAttackAction: (actor, target = null) => {
        const enemyTarget = target || Battle.getWeakWeightedAliveEnemy();
        if (enemyTarget) return { type: 'attack', actor, target: enemyTarget, isAuto: true };
        return { type: 'defend', actor, isAuto: true };
    },

    autoSkillCanTargetAlly: (skill, actor, ally) => {
        if (!skill || !ally) return false;
        if (skill.target === '自分') return ally === actor;
        return true;
    },

    isAllySupportSkill: (skill) => {
        if (!skill) return false;
        const type = String(skill.type || '');
        return type.includes('回復') || type === '蘇生' || type === '強化' || skill.CureAilments ||
            (Array.isArray(skill.cures) && skill.cures.length > 0) || skill.debuff_reset || skill.HPRegen || skill.MPRegen;
    },

    getAutoSkillTarget: (actor, skill, preferredTarget = null) => {
        if (!skill) return null;
        const support = Battle.isAllySupportSkill(skill);
        if (skill.target === '全体') return support ? 'all_ally' : 'all_enemy';
        if (skill.target === 'ランダム') return 'random';
        if (skill.target === '自分') return actor;
        if (support) return preferredTarget || actor;
        return preferredTarget || Battle.getWeakWeightedAliveEnemy();
    },

    makeAutoSkillAction: (actor, skill, target = null) => {
        if (!skill) return null;
        const chosenTarget = Battle.getAutoSkillTarget(actor, skill, target);
        if (!chosenTarget) return null;
        return { type: 'skill', actor, target: chosenTarget, data: skill, targetScope: skill.target, isAuto: true };
    },

    findLowHpAlly: (allies, threshold) => {
        return allies
            .filter(p => p && !p.isDead && p.baseMaxHp > 0 && (p.hp / p.baseMaxHp) <= threshold)
            .sort((a, b) => (a.hp / a.baseMaxHp) - (b.hp / b.baseMaxHp))[0] || null;
    },

    chooseAutoAllyAction: (actor, skills, predicate, preferredAlly = null) => {
        const skill = skills.find(s => predicate(s) && Battle.autoSkillCanTargetAlly(s, actor, preferredAlly || actor));
        if (!skill) return null;
        return Battle.makeAutoSkillAction(actor, skill, preferredAlly || actor);
    },

    chooseAutoReviveAction: (actor, skills, deadAllies, mode = 'balanced') => {
        if (!actor || !Array.isArray(deadAllies) || deadAllies.length === 0) return null;
        const candidates = [];
        skills.filter(skill => skill.type === '蘇生').forEach(skill => {
            const cost = Battle.getSkillMpCost(actor, skill);
            const reviveRate = Math.max(0.01, Number(skill.rate ?? 0.5));
            const targets = skill.target === '全体'
                ? deadAllies
                : deadAllies.slice().sort((a, b) => {
                    const value = unit => (Number(unit.baseMaxHp || 0) * 0.6) +
                        Number(Battle.getBattleStat(unit, 'atk') || 0) +
                        Number(Battle.getBattleStat(unit, 'mag') || 0) +
                        Number(Battle.getBattleStat(unit, 'spd') || 0);
                    return value(b) - value(a);
                }).slice(0, 1);
            if (!targets.length) return;
            const restoredHp = targets.reduce((sum, target) => sum + Math.max(1, Math.floor(target.baseMaxHp * reviveRate)), 0);
            const rescueBonus = Math.max(0, targets.length - 1) * 500;
            const score = mode === 'conserve'
                ? (restoredHp + rescueBonus) / Math.max(1, cost)
                : restoredHp + rescueBonus - cost * 2;
            candidates.push({ skill, target: skill.target === '全体' ? 'all_ally' : targets[0], score, cost });
        });
        candidates.sort((a, b) => (b.score - a.score) || (a.cost - b.cost));
        const best = candidates[0];
        return best ? Battle.makeAutoSkillAction(actor, best.skill, best.target) : null;
    },

    chooseAutoBuffAction: (actor, skills) => {
        const aliveAllies = Battle.party.filter(p => Battle.isBattleAlive(p));
        const candidates = skills.filter(s => s.type === '強化' || s.buff || s.HPRegen || s.MPRegen);
        if (candidates.length === 0) return null;
        const skill = candidates[Math.floor(Math.random() * candidates.length)];
        const target = skill.target === '自分'
            ? actor
            : (aliveAllies[Math.floor(Math.random() * Math.max(1, aliveAllies.length))] || actor);
        return Battle.makeAutoSkillAction(actor, skill, target);
    },

    estimateAutoHeal: (actor, skill, target) => {
        if (!actor || !skill || !target || target.isDead) return 0;
        const rate = Number(skill.rate ?? skill.Rate ?? 1);
        const base = Number(skill.base ?? skill.Base ?? 0);
        let amount = 0;
        if (skill.ratio !== undefined) amount = Number(target.baseMaxHp || 0) * Number(skill.ratio || 0);
        else if (skill.fix) amount = base;
        else amount = (Number(Battle.getBattleStat(actor, 'mag') || 0) * rate) + base;
        amount *= 1 + (Number(PassiveSkill.getSumValue(actor, 'heal_pct') || 0) / 100);
        return Math.max(0, Math.floor(amount));
    },

    estimateAutoMpRecovery: (skill, target) => {
        if (!skill || !target || target.isDead) return 0;
        if (skill.ratio !== undefined) return Math.max(0, Math.floor(Number(target.baseMaxMp || 0) * Number(skill.ratio || 0)));
        return Math.max(0, Math.floor(Number(skill.base ?? skill.Base ?? 0)));
    },

    chooseAutoMpRecoveryAction: (actor, skills, threshold) => {
        if (!actor) return null;
        const recoverySkills = skills.filter(skill => skill.type === 'MP回復');
        if (!recoverySkills.length) return null;
        const aliveAllies = Battle.party.filter(p => Battle.isBattleAlive(p) && p.baseMaxMp > 0 && p.mp < p.baseMaxMp);
        const scored = [];
        recoverySkills.forEach(skill => {
            const possibleTargets = skill.target === '自分' ? [actor] : aliveAllies;
            const urgentTargets = possibleTargets.filter(target => target.baseMaxMp > 0 &&
                target.mp / target.baseMaxMp <= threshold && target.mp < target.baseMaxMp);
            if (!urgentTargets.length) return;
            const targets = skill.target === '全体' ? aliveAllies : urgentTargets;
            if (!targets.length) return;
            if (skill.target === '全体') {
                const effective = targets.reduce((sum, target) => sum + Math.min(
                    target.baseMaxMp - target.mp,
                    Battle.estimateAutoMpRecovery(skill, target)
                ), 0);
                scored.push({ skill, target: 'all_ally', score: effective - Battle.getSkillMpCost(actor, skill) });
                return;
            }
            targets.forEach(target => {
                const effective = Math.min(target.baseMaxMp - target.mp, Battle.estimateAutoMpRecovery(skill, target));
                const urgency = 1 + (1 - target.mp / target.baseMaxMp);
                scored.push({ skill, target, score: effective * urgency - Battle.getSkillMpCost(actor, skill) });
            });
        });
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        return best && best.score > 0 ? Battle.makeAutoSkillAction(actor, best.skill, best.target) : null;
    },

    chooseAutoCureAction: (actor, skills, allies) => {
        const livingAllies = (allies || []).filter(target => Battle.isBattleAlive(target));
        if (!actor || !livingAllies.length) return null;
        const cureSkills = skills.filter(skill => skill.CureAilments || (Array.isArray(skill.cures) && skill.cures.length));
        const scored = [];
        const curedCount = (skill, target) => {
            const ailments = target.battleStatus?.ailments || {};
            if (skill.CureAilments) return Object.keys(ailments).length;
            return skill.cures.reduce((sum, key) => sum + (ailments[key] ? 1 : 0), 0);
        };

        cureSkills.forEach(skill => {
            const targets = skill.target === '自分'
                ? [actor]
                : (skill.target === '全体' ? livingAllies : livingAllies);
            if (skill.target === '全体') {
                const totalCures = targets.reduce((sum, target) => sum + curedCount(skill, target), 0);
                if (totalCures > 0) {
                    scored.push({ skill, target: 'all_ally', score: totalCures * 100 - Battle.getSkillMpCost(actor, skill) });
                }
                return;
            }
            targets.forEach(target => {
                const count = curedCount(skill, target);
                if (count <= 0) return;
                const danger = 1 - target.hp / Math.max(1, target.baseMaxHp);
                scored.push({ skill, target, score: count * 100 + danger * 20 - Battle.getSkillMpCost(actor, skill) });
            });
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        return best ? Battle.makeAutoSkillAction(actor, best.skill, best.target) : null;
    },

    chooseAutoHealAction: (actor, skills, threshold) => {
        const living = Battle.party.filter(p => Battle.isBattleAlive(p) && p.baseMaxHp > 0);
        const allInjured = living.filter(p => p.hp < p.baseMaxHp);
        const injured = allInjured.filter(p =>
            (p.hp / p.baseMaxHp) <= threshold && p.hp < p.baseMaxHp);
        const healSkills = skills.filter(s => s.type === '回復');
        if (injured.length === 0 || healSkills.length === 0) return null;

        const scored = [];
        for (const skill of healSkills) {
            const mpPenalty = Battle.getSkillMpCost(actor, skill) * 0.15;
            if (skill.target === '全体') {
                // 発動のきっかけは閾値以下の重傷者だが、全体回復の価値は実際に回復する全員で評価する。
                const effective = allInjured.reduce((sum, target) => {
                    const missing = Math.max(0, target.baseMaxHp - target.hp);
                    return sum + Math.min(missing, Battle.estimateAutoHeal(actor, skill, target));
                }, 0);
                // 全員が負傷している場合は全体回復を明確に優先する。複数人負傷時も立て直し価値を加点する。
                const aliveCount = living.length;
                const partyBonus = allInjured.length >= 2
                    ? (allInjured.length === aliveCount ? 2.5 : 1.5)
                    : 0.85;
                scored.push({ skill, target: 'all_ally', score: effective * partyBonus - mpPenalty });
                continue;
            }

            const candidates = skill.target === '自分' ? injured.filter(p => p === actor) : injured;
            for (const target of candidates) {
                const missing = Math.max(0, target.baseMaxHp - target.hp);
                const estimate = Battle.estimateAutoHeal(actor, skill, target);
                const effective = Math.min(missing, estimate);
                const overheal = Math.max(0, estimate - missing);
                const urgency = 1 + (1 - target.hp / target.baseMaxHp);
                scored.push({ skill, target, score: (effective * urgency) - (overheal * 0.2) - mpPenalty });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        return best ? Battle.makeAutoSkillAction(actor, best.skill, best.target) : null;
    },

    chooseAutoOffensiveAction: (actor, skills, aliveEnemies, mode = 'balanced') => {
        if (!aliveEnemies || aliveEnemies.length === 0) return { type: 'defend', actor, isAuto: true };
        const offensive = skills.filter(s => Battle.isAutoOffensiveSkill(s));
        if (mode === 'conserve') {
            const choice = Battle.pickConservativeAutoAction(actor, offensive, aliveEnemies);
            if (choice && choice.type === 'attack') return Battle.makeAutoAttackAction(actor, choice.target);
            if (choice && choice.skill) return Battle.makeAutoSkillAction(actor, choice.skill, choice.target || null);
            return Battle.makeAutoAttackAction(actor);
        }
        if (offensive.length === 0) return Battle.makeAutoAttackAction(actor);

        const scored = offensive.map(skill => {
            let target = null;
            let score = 0;
            if (skill.target === '全体') {
                score = aliveEnemies.reduce((sum, enemy) => sum + Math.min(
                    enemy.hp,
                    Battle.estimateAutoDamage(actor, skill, enemy)
                ), 0);
            } else if (skill.target === 'ランダム') {
                score = aliveEnemies.reduce((sum, enemy) => sum + Battle.estimateAutoDamage(actor, skill, enemy), 0) /
                    Math.max(1, aliveEnemies.length);
            } else {
                const targetScores = aliveEnemies.map(enemy => {
                    const damage = Battle.estimateAutoDamage(actor, skill, enemy);
                    const effective = Math.min(enemy.hp, damage);
                    const finishBonus = damage >= enemy.hp ? Math.min(enemy.hp, enemy.baseMaxHp * 0.25) : 0;
                    return { enemy, score: effective + finishBonus };
                }).sort((a, b) => b.score - a.score);
                target = targetScores[0]?.enemy || null;
                score = targetScores[0]?.score || 0;
            }
            if (mode === 'balanced') score -= Battle.getSkillMpCost(actor, skill) * 0.35;
            if (mode === 'tricky' && (skill.type === '弱体' || skill.debuff)) score *= 1.35;
            return { skill, target, score };
        }).sort((a, b) => b.score - a.score);

        const bestScore = Number(scored[0]?.score || 0);
        if (bestScore <= 0) return Battle.makeAutoAttackAction(actor);
        const qualityFloor = bestScore * (mode === 'allout' ? 0.90 : (mode === 'tricky' ? 0.75 : 0.82));
        const top = scored.filter(entry => entry.score > 0 && entry.score >= qualityFloor).slice(0, 4);
        const pool = top.length ? top : scored;
        const totalWeight = pool.reduce((sum, entry) => sum + Math.max(1, entry.score), 0);
        let roll = Math.random() * Math.max(1, totalWeight);
        let picked = pool[0];
        for (const entry of pool) {
            roll -= Math.max(1, entry.score);
            if (roll <= 0) { picked = entry; break; }
        }
        return Battle.makeAutoSkillAction(actor, picked?.skill, picked?.target || null) || Battle.makeAutoAttackAction(actor);
    },

    decideTacticalAutoAction: (actor) => {
        const tactic = Battle.getAutoStrategyKey(actor);
        const validSkills = Battle.getValidAutoSkills(actor, tactic !== 'no_mp');
        const aliveAllies = Battle.party.filter(p => Battle.isBattleAlive(p));
        const deadAllies = Battle.party.filter(p => p && p.isDead);
        const aliveEnemies = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        const debuffedAlly = aliveAllies.find(p => Object.keys(p.battleStatus?.debuffs || {}).length > 0);
        const buffedEnemy = aliveEnemies.find(e => Object.keys(e.battleStatus?.buffs || {}).length > 0);

        if (tactic === 'no_mp') return Battle.makeAutoAttackAction(actor);

        const revive = () => deadAllies.length
            ? Battle.chooseAutoReviveAction(actor, validSkills, deadAllies, tactic)
            : null;
        const heal = (threshold) => Battle.chooseAutoHealAction(actor, validSkills, threshold);
        const recoverMp = (threshold) => Battle.chooseAutoMpRecoveryAction(actor, validSkills, threshold);
        const cure = () => Battle.chooseAutoCureAction(actor, validSkills, aliveAllies);
        const resetDebuff = () => debuffedAlly
            ? Battle.chooseAutoAllyAction(actor, validSkills, s => s.debuff_reset === true, debuffedAlly)
            : null;
        const resetEnemyBuff = () => {
            const skill = buffedEnemy ? validSkills.find(s => s.buff_reset === true) : null;
            return skill ? Battle.makeAutoSkillAction(actor, skill, buffedEnemy) : null;
        };

        let action = null;
        if (tactic === 'allout') {
            action = (deadAllies.length >= 2 ? revive() : null) || heal(0.25) || Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'allout');
        } else if (tactic === 'conserve') {
            action = revive() || heal(0.35) || cure() || recoverMp(0.30) || Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'conserve');
        } else if (tactic === 'tricky') {
            const debuffPool = validSkills.filter(s => s.type === '弱体' || s.debuff || (Battle.isAutoOffensiveSkill(s) && s.debuff));
            if (Math.random() < 0.65 && debuffPool.length) {
                action = Battle.makeAutoSkillAction(actor, debuffPool[Math.floor(Math.random() * debuffPool.length)], null);
            }
            action = action || recoverMp(0.18) || (Math.random() < 0.25 ? Battle.chooseAutoBuffAction(actor, validSkills) : null) ||
                Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'tricky');
        } else if (tactic === 'defensive') {
            action = revive() || heal(0.70) || cure() || resetDebuff() || recoverMp(0.30) || Battle.chooseAutoBuffAction(actor, validSkills) ||
                Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'balanced');
        } else {
            action = revive() || heal(0.45) || cure() || resetDebuff() || resetEnemyBuff() || recoverMp(0.20) ||
                Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'balanced');
        }

        return action || Battle.makeAutoAttackAction(actor);
    },

    // Auto battle strategy dispatcher
    decideAutoAction: (actor) => {
        return Battle.decideTacticalAutoAction(actor);
    },

    getAutoCommandTargets: (cmd) => {
        if (!cmd) return [];
        if (cmd.target === 'all_ally') return Battle.party.filter(p => p && !p.isFled);
        if (cmd.target === 'all_enemy') return Battle.enemies.filter(e => e && !e.isFled);
        if (cmd.target && typeof cmd.target === 'object') return [cmd.target];
        return [];
    },

    shouldReevaluateAutoCommand: (cmd) => {
        if (!cmd?.isAuto || cmd.isEnemy || cmd.type !== 'skill' || !cmd.data || !cmd.actor) return false;
        const actor = cmd.actor;
        const skill = cmd.data;
        const stillUsable = Battle.getValidAutoSkills(actor, true).some(candidate => Number(candidate.id) === Number(skill.id));
        if (!stillUsable) return true;

        const targets = Battle.getAutoCommandTargets(cmd);
        const livingTargets = targets.filter(target => Battle.isBattleAlive(target));
        const useful = [];
        if (skill.type === '蘇生') useful.push(targets.some(target => target.isDead && !target.isFled));
        if (skill.type === '回復') useful.push(livingTargets.some(target => target.hp / Math.max(1, target.baseMaxHp) < 0.90));
        if (skill.type === 'MP回復') useful.push(livingTargets.some(target => target.mp / Math.max(1, target.baseMaxMp) < 0.90));
        if (skill.CureAilments || (Array.isArray(skill.cures) && skill.cures.length)) {
            useful.push(livingTargets.some(target => {
                const ailments = target.battleStatus?.ailments || {};
                return skill.CureAilments
                    ? Object.keys(ailments).length > 0
                    : skill.cures.some(key => ailments[key]);
            }));
        }
        if (skill.debuff_reset) {
            useful.push(livingTargets.some(target => Object.keys(target.battleStatus?.debuffs || {}).length > 0));
        }
        if (skill.buff_reset) {
            useful.push(livingTargets.some(target => Object.keys(target.battleStatus?.buffs || {}).length > 0));
        }
        return useful.length > 0 && !useful.some(Boolean);
    },

    isAutoOffensiveSkill: (s) => {
        if (!s || [1, 2, 9].includes(Number(s.id))) return false;
        if (Battle.isAllySupportSkill(s)) return false;
        return ['物理', '魔法', 'ブレス', '特殊'].includes(s.type) &&
            !String(s.type || '').includes('回復') && s.type !== '蘇生';
    },

    estimateAutoDamage: (actor, skill, target) => {
        if (!actor || !target) return 0;
        const data = skill || null;
        const effectType = data ? data.type : '通常攻撃';
        const isPhysical = (!data || effectType === '物理' || effectType === '通常攻撃');
        const baseDmg = data ? (data.base || 0) : 0;
        const isFixedDamage = data?.fix === true;
        const count = data && typeof data.count === 'number' ? Math.max(1, data.count) : 1;

        const directEffectOnly = !!data && ['回復', '蘇生', '強化', '弱体', '特殊', 'MP回復'].includes(effectType);
        if (directEffectOnly) {
            if (!data.PercentDamage) return 0;
            let successRate = Number(data.SuccessRate ?? 100);
            if (successRate > 0 && successRate <= 1) successRate *= 100;
            const resist = (Battle.getBattleStat(target, 'resists') || {}).InstantDeath || 0;
            const procBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_instantdeath_bonus') : 0;
            const finalChance = Math.max(0, Math.min(100, successRate + procBonus - resist)) / 100;
            // 各回で現在HP割合が減るため、連続適用後の期待減少量を概算する。
            const oneProcRemain = Math.max(0, 1 - Number(data.PercentDamage || 0));
            const expectedRemainPerHit = (1 - finalChance) + finalChance * oneProcRemain;
            return Math.max(0, Math.floor(Number(target.hp || 0) * (1 - Math.pow(expectedRemainPerHit, count))));
        }

        let baseDmgCalc = 0;

        if (data && data.fix) {
            baseDmgCalc = baseDmg;
        } else if (effectType === 'ブレス') {
            baseDmgCalc = Math.floor(((Battle.getBattleStat(actor, 'atk') + Battle.getBattleStat(actor, 'mag')) / 6) + baseDmg);
        } else {
            const atkVal = isPhysical ? Battle.getBattleStat(actor, 'atk') : Battle.getBattleStat(actor, 'mag');
            const defVal = isPhysical ? Battle.getBattleStat(target, 'def') : Battle.getBattleStat(target, 'mdef');
            const ignoreDefense = !!(data && data.IgnoreDefense);
            baseDmgCalc = Math.floor((atkVal / 2 + baseDmg) - (ignoreDefense ? 0 : defVal / 4));
        }

        if (baseDmgCalc < 1) baseDmgCalc = 1;

        let rate = isFixedDamage ? 1.0 : (data && data.rate !== undefined ? data.rate : 1.0);
        let cutRate = 0;
        let bonusRate = 0;

        if (data?.elm && target.absoluteElementImmunity === true) return 0;
        if (!isFixedDamage && data && data.elm) {
            bonusRate += (Battle.getBattleStat(actor, 'elmAtk') || {})[data.elm] || 0;
            const res = (target.getStat ? target.getStat('elmRes') : (target.elmRes || {})) || {};
            let pierce = 0;
            if (typeof PassiveSkill !== 'undefined') {
                pierce += PassiveSkill.getSumValue(actor, 'all_elm_pierce_pct');
                const key = {火:'fire',水:'water',風:'wind',雷:'thunder',光:'light',闇:'dark',混沌:'chaos'}[data.elm];
                if (key) pierce += PassiveSkill.getSumValue(actor, `${key}_pierce_pct`);
            }
            const finalRes = Number(res[data.elm] || 0) +
                Number(target.battleStatus?.buffs?.elmResUp?.val || 0) -
                Number(target.battleStatus?.debuffs?.elmResDown?.val || 0) - pierce;
            if (finalRes >= 100) return 0;
            cutRate += finalRes;
        }

        if (!isFixedDamage) bonusRate += Battle.getBattleStat(actor, 'finDmg') || 0;
        let finRed = Battle.getBattleStat(target, 'finRed') || 0;
        if (finRed > 80) finRed = 80;
        cutRate += finRed;

        let dmg = Math.floor(baseDmgCalc * rate * count * (1 + bonusRate / 100) * (1 - cutRate / 100));
        if (!isFixedDamage && isPhysical) {
            if (actor.formation === 'back' && !['弓', '短剣', '杖'].includes(actor.weaponType)) dmg *= 0.5;
            if (target.formation === 'back') dmg *= 0.5;
        }
        if (typeof PassiveSkill !== 'undefined') {
            const damageKey = isPhysical ? 'physical_dmg_pct' : (effectType === '魔法' ? 'magic_dmg_pct' : (effectType === 'ブレス' ? 'breath_dmg_pct' : null));
            const reduceKey = isPhysical ? 'physical_reduce_pct' : (effectType === '魔法' ? 'magic_reduce_pct' : (effectType === 'ブレス' ? 'breath_reduce_pct' : null));
            if (!isFixedDamage && damageKey) dmg *= 1 + PassiveSkill.getSumValue(actor, damageKey) / 100;
            if (reduceKey) dmg *= 1 - PassiveSkill.getSumValue(target, reduceKey) / 100;
        }
        if (target.status?.defend) dmg *= 0.5;

        const baseHitRate = Number(data?.hitRate ?? data?.HitRate ?? 100);
        const hitChance = data?.isPerfect ? 1 : Math.max(0, Math.min(1,
            ((baseHitRate * ((Battle.getBattleStat(actor, 'hit') || 100) / 100)) - (Battle.getBattleStat(target, 'eva') || 0)) / 100
        ));
        if (hitChance <= 0) return 0;
        dmg = Math.floor(dmg * hitChance);
        if (dmg < 1) dmg = 1;
        return dmg;
    },

    pickConservativeAutoAction: (actor, pool, aliveEnemies) => {
        if (!aliveEnemies || aliveEnemies.length === 0) return null;

        const attackTargets = [...aliveEnemies].sort((a, b) => a.hp - b.hp);
        const normalAttack = Math.max(1, Battle.estimateAutoDamage(actor, null, attackTargets[0]));
        const weakEnemy = attackTargets.find(e => e.hp <= Math.ceil(normalAttack * 1.15));
        const mpMax = Math.max(1, actor.baseMaxMp || 1);
        const mpRatio = (actor.mp || 0) / mpMax;

        // 通常攻撃でほぼ落とせる敵がいる場合はMPを使わない
        if (weakEnemy) {
            return { type: 'attack', target: weakEnemy };
        }

        const offensive = pool.filter(s => Battle.isAutoOffensiveSkill(s));
        const support = pool.filter(s => !Battle.isAutoOffensiveSkill(s));
        if (offensive.length === 0) {
            const s = support[Math.floor(Math.random() * support.length)];
            return s ? { type: 'skill', skill: s } : { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        const totalEnemyHp = aliveEnemies.reduce((sum, e) => sum + Math.max(0, e.hp || 0), 0);
        const hasBossLike = aliveEnemies.some(e => e.isBoss || (e.baseMaxHp && e.baseMaxHp >= normalAttack * 8) || (e.hp && e.hp >= normalAttack * 5));

        const candidates = offensive.map(skill => {
            const cost = Battle.getSkillMpCost(actor, skill);
            let target = null;
            let value = 0;

            if (skill.target === '全体') {
                aliveEnemies.forEach(e => {
                    value += Math.min(e.hp, Battle.estimateAutoDamage(actor, skill, e));
                });
            } else if (skill.target === 'ランダム') {
                value = aliveEnemies.reduce((sum, enemy) => {
                    return sum + Math.min(enemy.hp, Battle.estimateAutoDamage(actor, skill, enemy));
                }, 0) / Math.max(1, aliveEnemies.length);
            } else {
                target = [...aliveEnemies].sort((a, b) => {
                    const da = Math.min(a.hp, Battle.estimateAutoDamage(actor, skill, a));
                    const db = Math.min(b.hp, Battle.estimateAutoDamage(actor, skill, b));
                    return db - da;
                })[0];
                value = Math.min(target.hp, Battle.estimateAutoDamage(actor, skill, target));
            }

            const efficiency = value / Math.max(1, cost || 1);
            const overkill = target ? Math.max(0, Battle.estimateAutoDamage(actor, skill, target) - target.hp) : Math.max(0, value - totalEnemyHp);
            return { skill, target, cost, value, efficiency, overkill };
        }).filter(c => c.cost <= (actor.mp || 0));

        if (candidates.length === 0) return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };

        candidates.sort((a, b) => {
            if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
            return b.value - a.value;
        });

        let best = candidates[0];

        // MPが少ないときは、ボス級/高HPでない限り攻撃スキルを温存
        if (mpRatio <= 0.25 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        // 節約ONでは、通常攻撃と大差ない攻撃スキルは使わない
        const normalValue = aliveEnemies.length >= 2 ? normalAttack * Math.min(2, aliveEnemies.length) : normalAttack;
        if (best.value <= normalValue * 1.35 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        // 残MPに対して重すぎる技は、明確に強い場面以外では温存
        if (best.cost > mpMax * 0.30 && best.value < normalValue * 2.2 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        // 過剰オーバーキル気味なら通常攻撃へ寄せる
        if (best.overkill > normalAttack * 2 && best.value < normalValue * 2.0 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        return { type: 'skill', skill: best.skill, target: best.skill.target === '単体' ? best.target : null };
    },

    goBack: () => {
        if (Battle.currentActorIndex > 0) {
            Battle.commandQueue.pop(); 
            Battle.currentActorIndex--;
            while (Battle.currentActorIndex >= 0 && (!Battle.party[Battle.currentActorIndex] || Battle.party[Battle.currentActorIndex].isDead)) {
                Battle.currentActorIndex--;
            }
            if(Battle.currentActorIndex < 0) Battle.currentActorIndex = 0;
            Battle.closeSubMenu();
            Battle.phase = 'input'; 
            Battle.findNextActor();
        }
    },

    updateCommandButtons: () => {
        const btn = Battle.getEl('btn-run');
        const strategyBtn = Battle.getEl('btn-strategy');
        if(btn) {
            const firstAlive = Battle.party.findIndex(p => p && !p.isDead && !p.isFled && Number(p.hp || 0) > 0);
            if (Battle.currentActorIndex === firstAlive) {
                if (strategyBtn) strategyBtn.style.display = '';
                btn.innerText = "にげる";
                btn.onclick = Battle.run;
                btn.disabled = !!(App.data.battle.isBossBattle || App.data.battle.preventEscape);
                btn.style.gridColumn = '';
            } else {
                if (strategyBtn) strategyBtn.style.display = 'none';
                btn.innerText = "もどる";
                btn.onclick = Battle.goBack;
                btn.disabled = false;
                btn.style.gridColumn = 'span 2';
            }
        }
    },

    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch])),

    openStrategyWindow: () => {
        if (Battle.phase !== 'input' || Battle.auto) return;
        Battle.closeSubMenu();
        const win = Battle.getEl('battle-list-window');
        const title = Battle.getEl('battle-list-title');
        const content = Battle.getEl('battle-list-content');
        if (!win || !content) return;
        if (title) title.innerText = 'さくせん';
        content.innerHTML = '';
        Battle.renderStrategyList(content);
        win.style.display = 'flex';
    },

    renderStrategyList: (content) => {
        const strategies = (typeof App !== 'undefined' && App.battleStrategies) ? App.battleStrategies : {};
        Battle.party.forEach((actor) => {
            if (!actor) return;
            const charData = App.getChar ? App.getChar(actor.uid) : null;
            if (charData && App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(charData);
            const current = charData?.config?.strategy || actor.config?.strategy || 'balanced';
            const row = document.createElement('div');
            row.className = 'list-item';
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px;';
            row.innerHTML = `
                <div style="min-width:0;">
                    <div style="font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Battle.escapeHtml(actor.name)}</div>
                    <div style="font-size:11px; color:#ffd; margin-top:3px;">${Battle.escapeHtml(App.getBattleStrategyLabel ? App.getBattleStrategyLabel(current) : (strategies[current]?.label || current))}</div>
                </div>
                <div style="font-size:18px; color:#888; flex:0 0 auto;">›</div>
            `;
            row.onclick = () => Battle.openStrategyModal(actor.uid);
            content.appendChild(row);
        });
    },

    openStrategyModal: (uid) => {
        const charData = App.getChar ? App.getChar(uid) : null;
        if (!charData) return;
        if (App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(charData);
        Battle.closeStrategyModal();

        const strategies = (typeof App !== 'undefined' && App.battleStrategies) ? App.battleStrategies : {};
        const current = charData.config?.strategy || 'balanced';
        const currentLabel = App.getBattleStrategyLabel ? App.getBattleStrategyLabel(current) : (strategies[current]?.label || current);
        const modal = document.createElement('div');
        modal.id = 'battle-strategy-modal';
        modal.style.cssText = 'position:fixed; inset:0; z-index:3300; background:rgba(0,0,0,0.74); display:flex; align-items:center; justify-content:center; padding:16px;';
        modal.onclick = () => Battle.closeStrategyModal();
        modal.innerHTML = `
            <div onclick="event.stopPropagation()" style="width:min(360px, 100%); max-height:86vh; overflow:auto; background:#151515; border:1px solid #777; border-radius:8px; box-shadow:0 18px 48px rgba(0,0,0,0.7);">
                <div style="padding:12px; border-bottom:1px solid #333;">
                    <div style="font-size:15px; font-weight:bold; color:#fff;">${Battle.escapeHtml(charData.name)}</div>
                    <div style="font-size:11px; color:#aaa; margin-top:2px;">現在: ${Battle.escapeHtml(currentLabel)}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; padding:12px;">
                    ${Object.keys(strategies).map(key => `<button class="btn" style="width:100%; text-align:left; padding:10px 12px; background:${key === current ? '#064' : '#333'};" onclick="Battle.setPartyStrategy('${uid}', '${key}')">${Battle.escapeHtml(strategies[key].label || key)}</button>`).join('')}
                </div>
                <div style="padding:0 12px 12px;">
                    <button class="btn" style="width:100%; background:#555;" onclick="Battle.closeStrategyModal()">閉じる</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    closeStrategyModal: () => {
        const modal = document.getElementById('battle-strategy-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },

    setPartyStrategy: (uid, strategy) => {
        if (App.setBattleStrategy) App.setBattleStrategy(uid, strategy);
        Battle.closeStrategyModal();
        const content = Battle.getEl('battle-list-content');
        if (content) {
            content.innerHTML = '';
            Battle.renderStrategyList(content);
        }
    },

    selectCommand: (type) => {
        if (Battle.phase !== 'input' || Battle.auto) return;
        Battle.selectingAction = type;
        Battle.selectedItemOrSkill = null;

        if (type === 'attack') {
            Battle.log("攻撃対象を選択してください");
            Battle.openTargetWindow('enemy');
        } 
        else if (type === 'skill') Battle.openSkillList();
        else if (type === 'item') Battle.openItemList();
        else if (type === 'defend') {
            const actor = Battle.party[Battle.currentActorIndex];
            Battle.registerAction({ type: 'defend', actor: actor });
        }
    },

    openTargetWindow: (targetType, actionData = null) => { 
        const win = Battle.getEl('battle-target-window');
        const list = Battle.getEl('battle-target-list');
        const listWin = Battle.getEl('battle-list-window');
        if (!win || !list) return;
        if (listWin) listWin.style.display = 'none'; 

        win.style.display = 'flex';
        list.innerHTML = '';
        Battle.phase = 'target_select';
        const targetInputGeneration = Math.max(0, Number(Battle.inputGeneration || 0));
        const targetActor = Battle.party[Battle.currentActorIndex];
        win.dataset.inputGeneration = String(targetInputGeneration);

        let targets = [];
        let actualTargetType = targetType;
        
        if (actionData && Battle.selectingAction === 'item' && window.ItemRuntime) {
            actualTargetType = window.ItemRuntime.getBattleTargetType(actionData);
        } else if(actionData) {
            const type = actionData.type || '';
            const range = actionData.target || '単体';
            if (range === '単体') {
                if (type === '蘇生') actualTargetType = 'ally_dead';
                else if (type.includes('回復') || type === '強化' || type === 'MP回復') actualTargetType = 'ally';
                else if (actionData.debuff_reset || actionData.CureAilments) actualTargetType = 'ally'; 
                else actualTargetType = 'enemy';
            } else if (range === '全体') {
                if (type.includes('回復') || ['蘇生','強化'].includes(type) || 
                    actionData.debuff_reset || actionData.CureAilments || 
                    actionData.HPRegen || actionData.MPRegen) {
                    actualTargetType = 'all_ally';
                } else {
                    actualTargetType = 'all_enemy';
                }
            } else if (range === 'ランダム') {
                actualTargetType = 'random';
            } else if (range === '自分') {
                actualTargetType = 'self';
            }
        }

        if (['all_enemy', 'all_ally', 'random', 'self'].includes(actualTargetType)) {
            const actor = targetActor;
            let targetObj = actualTargetType;
            if (actualTargetType === 'self') targetObj = actor;

            Battle.registerAction({ 
                type: Battle.selectingAction, 
                actor: actor, 
                target: targetObj, 
                data: Battle.selectedItemOrSkill,
                targetScope: actionData ? actionData.target : null,
                inputGeneration: targetInputGeneration
            });
            return;
        }

        if (actualTargetType === 'enemy') targets = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        else if (actualTargetType === 'ally') targets = Battle.party.filter(p => Battle.isBattleAlive(p));
        else if (actualTargetType === 'ally_dead') targets = Battle.party.filter(p => p && p.isDead);

        if (targets.length === 0) {
            Battle.log("対象がいません");
            Battle.schedule(Battle.cancelSubMenu, 800);
            return;
        }

        targets.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'battle-target-btn';
            btn.innerText = t.name;
            if(t.isDead && actualTargetType !== 'ally_dead') btn.disabled = true;
            btn.onclick = (e) => {
                e.stopPropagation();
                Battle.selectTarget(t, targetInputGeneration, targetActor);
            };
            list.appendChild(btn);
        });
    },

    selectTarget: (target, inputGeneration = Battle.inputGeneration, expectedActor = null) => {
        if (Battle.phase !== 'target_select' ||
            Number(inputGeneration) !== Number(Battle.inputGeneration || 0)) return false;
        const actor = Battle.party[Battle.currentActorIndex];
        if (expectedActor && actor !== expectedActor) return false;
        return Battle.registerAction({
            type: Battle.selectingAction,
            actor: actor,
            target: target,
            data: Battle.selectedItemOrSkill,
            inputGeneration
        });
    },

	openSkillList: () => {
        const actor = Battle.party[Battle.currentActorIndex];
        const listInputGeneration = Math.max(0, Number(Battle.inputGeneration || 0));
        const win = Battle.getEl('battle-list-window');
        const title = Battle.getEl('battle-list-title');
        const content = Battle.getEl('battle-list-content');
        const targetWin = Battle.getEl('battle-target-window');
        if (!win || !title || !content) return;
        if (targetWin) targetWin.style.display = 'none';

        win.style.display = 'flex';
        title.innerText = "特技・魔法";
        content.innerHTML = '';
        Battle.phase = 'skill_select';

        if (!actor.skills || actor.skills.length === 0) {
            content.innerHTML = '<div style="padding:10px; font-size:12px;">特技がありません</div>';
            return;
        }
        
        // 個別設定（非表示スキル）の読み込み
        const config = actor.config || { fullAuto: false, hiddenSkills: [], autoDisabledSkills: [] };
        const hiddenIds = config.hiddenSkills.map(id => Number(id));
        
        [...actor.skills]
            .sort(window.PRISMA_SKILL_ORDER?.compareById || ((a, b) => Number(a.id || 0) - Number(b.id || 0)))
            .forEach(sk => {
            // 通常攻撃(ID:1)および、メニューで「非表示」設定されたスキルは出さない
            if (sk.id === 1) return;
            if (hiddenIds.includes(Number(sk.id))) return;
            
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let isDisabled = false;
            let note = "";
            const ailments = actor.battleStatus.ailments;
            
            const requiredMp = Battle.getSkillMpCost(actor, sk);

            // 状態異常による封印判定
            if (ailments['SpellSeal'] && ['魔法','強化','弱体'].includes(sk.type)) { isDisabled = true; note = "(封印)"; }
            if (ailments['SkillSeal'] && ['物理','特殊'].includes(sk.type)) { isDisabled = true; note = "(封印)"; }
            if (ailments['HealSeal'] && Battle.isHealSealBlockedSkill(sk)) { isDisabled = true; note = "(封印)"; }
            if (!isDisabled && actor.mp < requiredMp) { isDisabled = true; note = "(MP不足)"; }

            let elmHtml = '';
            if (sk.elm) {
                const colors = { '火':'#f88', '水':'#88f', '雷':'#ff0', '風':'#8f8', '光':'#ffc', '闇':'#a8f', '混沌':'#d4d' };
                let color = colors[sk.elm] || '#ccc';
                elmHtml = `<span style="color:${color}; margin-right:3px;">[${sk.elm}]</span>`;
            }

            // ★フォントサイズを全体的に縮小調整したレイアウト
            div.innerHTML = `
                <div style="flex:1; min-width:0; ${isDisabled?'color:#888':''}">
                    <div style="display:flex; align-items:center;">
                        <span style="font-size:12px; font-weight:bold; margin-right:5px;">${sk.name}</span>
                        <span style="font-size:9px; color:#f44;">${note}</span>
                        <span style="font-size:9px; color:#aaa; margin-left:auto; margin-right:5px;">(${sk.target})</span>
                    </div>
                    <div style="font-size:9px; color:#ccc; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${elmHtml}${sk.desc || ''}
                    </div>
                </div>
                <div style="font-size:11px; color:#88f; text-align:right; min-width:40px;">MP:${requiredMp}</div>
            `;

            div.onclick = (e) => {
                e.stopPropagation();
                if (Number(Battle.inputGeneration || 0) !== listInputGeneration ||
                    Battle.party[Battle.currentActorIndex] !== actor || Battle.phase !== 'skill_select') return;
                if (isDisabled) { 
                    const message = note === "(MP不足)" ? 'この特技を使うにはMPが足りない！' : '封印されていて使えない！';
                    Battle.showNoticeOverlay('', message, 'ＯＫ');
					//Battle.log(message);
					return;
				}
					
                if (actor.mp < requiredMp) {
                    Battle.showNoticeOverlay('', 'この特技を使うにはMPが足りない！', 'ＯＫ');
                    //Battle.log("MPが足りません");
                    return;
                }
                
                Battle.selectedItemOrSkill = sk;
                Battle.openTargetWindow(sk.target, sk);
            };
            content.appendChild(div);
        });

        // ★スクロール位置の復元
        const uid = actor.uid || ('temp_' + Battle.currentActorIndex);
        if (Battle.skillScrollPositions && Battle.skillScrollPositions[uid] !== undefined) {
            content.scrollTop = Battle.skillScrollPositions[uid];
        } else {
            content.scrollTop = 0;
        }

        // ★スクロール位置の保存
        content.onscroll = function() {
            if (Battle.phase === 'skill_select') {
                if (!Battle.skillScrollPositions) Battle.skillScrollPositions = {};
                Battle.skillScrollPositions[uid] = content.scrollTop;
            }
        };
    },


    openItemList: () => {
        const itemActor = Battle.party[Battle.currentActorIndex];
        const listInputGeneration = Math.max(0, Number(Battle.inputGeneration || 0));
		const win = Battle.getEl('battle-list-window');
		const title = Battle.getEl('battle-list-title');
		const content = Battle.getEl('battle-list-content');
		const targetWin = Battle.getEl('battle-target-window');
		if (!win || !title || !content) return;
		if (targetWin) targetWin.style.display = 'none';
		
		win.style.display = 'flex';
		title.innerText = "道具";
		content.innerHTML = '';
		Battle.phase = 'item_select';

		const items = [];
		if (App.data.items) {
			Object.keys(App.data.items).forEach(id => {
				const it = DB.ITEMS.find(i => i.id == id);
				if (
					it &&
					(window.ItemRuntime
						? window.ItemRuntime.isBattleUsable(it)
						: (it.type.includes('回復') || it.type.includes('蘇生'))) &&
					App.data.items[id] > 0
				) {
					items.push({ def: it, count: App.data.items[id] });
				}
			});
		}

		if (items.length === 0) {
			content.innerHTML = '<div style="padding:10px; font-size:12px;">使える道具がありません</div>';
			return;
		}

		items.sort((a, b) => window.PRISMA_ITEM_CATALOG?.compareToolsByTypeAndId
			? window.PRISMA_ITEM_CATALOG.compareToolsByTypeAndId(a.def, b.def)
			: Number(a.def?.id || 0) - Number(b.def?.id || 0));

		items.forEach(obj => {
			const it = obj.def;

			const div = document.createElement('div');
			div.className = 'list-item';

			const desc = it.desc || '説明なし';
			const targetLabel = it.target || it.type || '';

			div.innerHTML = `
				<div style="flex:1; min-width:0;">
					<div style="display:flex; align-items:center;">
						<span style="font-size:12px; font-weight:bold; margin-right:5px;">${it.name}</span>
						<span style="font-size:9px; color:#aaa; margin-left:auto; margin-right:5px;">(${targetLabel})</span>
					</div>
					<div style="font-size:9px; color:#ccc; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
						${desc}
					</div>
				</div>
				<div style="font-size:11px; color:#ffd700; text-align:right; min-width:40px;">x${obj.count}</div>
			`;

			div.onclick = (e) => {
				e.stopPropagation();
                if (Number(Battle.inputGeneration || 0) !== listInputGeneration ||
                    Battle.party[Battle.currentActorIndex] !== itemActor || Battle.phase !== 'item_select') return;

				Battle.selectedItemOrSkill = it;

				const tType = window.ItemRuntime
					? window.ItemRuntime.getBattleTargetType(it)
					: (it.type === '蘇生' ? 'ally_dead' : (it.target === '全体' ? 'all_ally' : 'ally'));

				Battle.openTargetWindow(tType, it);
			};

			content.appendChild(div);
		});
	},
	
    cancelSubMenu: () => {
        Battle.closeSubMenu();
        Battle.phase = 'input';
        Battle.selectingAction = null;
        Battle.selectedItemOrSkill = null;
        Battle.log("コマンドを選択してください");
    },
    
    closeSubMenu: () => {
        const winT = Battle.getEl('battle-target-window');
        const winL = Battle.getEl('battle-list-window');
        if(winT) winT.style.display = 'none';
        if(winL) winL.style.display = 'none';
        Battle.closeNoticeOverlay();
    },

    showNoticeOverlay: (title, message, buttonText = 'ＯＫ') => {
        Battle.closeNoticeOverlay();

        const scene = Battle.getEl('battle-scene') || document.body;
        const layer = document.createElement('div');
        layer.id = 'battle-notice-overlay';
        layer.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.45);
            padding: 16px;
            box-sizing: border-box;
            font-family: 'DotGothic16', sans-serif;
        `;

        layer.innerHTML = `
            <div style="
                width: min(320px, 92vw);
                background: #000;
                color: #fff;
                border: 3px double #fff;
                box-sizing: border-box;
                padding: 16px;
                text-align: center;
                box-shadow: 0 0 18px rgba(0,0,0,0.8);
            ">
                <div style="color:#ffd700; font-size:14px; font-weight:bold; margin-bottom:10px;">${title}</div>
                <div style="font-size:13px; line-height:1.6; margin-bottom:14px;">${message}</div>
                <button class="btn" style="width:30%; height:30px; background:#000; color:#fff; border:2px solid #fff;" onclick="Battle.closeNoticeOverlay()">${buttonText}</button>
            </div>
        `;

        scene.appendChild(layer);
    },

    closeNoticeOverlay: () => {
        const layer = document.getElementById('battle-notice-overlay');
        if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    },

    registerAction: (actionObj) => {
        const validInputPhases = ['input', 'skill_select', 'item_select', 'target_select'];
        if (!actionObj || !validInputPhases.includes(Battle.phase) ||
            Battle.turnExecutionActive || Battle.phaseTransitionRunnerActive ||
            Battle.hasPendingPhaseTransition()) return false;
        if (actionObj.inputGeneration !== undefined &&
            Number(actionObj.inputGeneration) !== Number(Battle.inputGeneration || 0)) return false;
        const actor = actionObj.actor;
        const expectedActor = Battle.party[Battle.currentActorIndex];
        // 形態移行前に開いていた対象ボタン等の古いクロージャから、
        // 別の行動者・旧入力世代のコマンドが混入するのを防ぐ。
        if (!actor || actor !== expectedActor || actor.isDead || actor.isFled) {
            Battle.closeSubMenu();
            Battle.selectingAction = null;
            Battle.selectedItemOrSkill = null;
            Battle.phase = 'input';
            Battle.findNextActor();
            return false;
        }
        const spd = Battle.getBattleStat(actor, 'spd');
        
        let finalSpeed = spd * (0.9 + Math.random() * 0.2);
        let priority = 0;
        
        if (actionObj.type === 'defend') priority = 1; 
        else if (actionObj.data && actionObj.data.priority) priority = actionObj.data.priority;

        actionObj.speed = finalSpeed + (priority * 100000);
        actionObj.runtimeGeneration = Math.max(0, Number(Battle.runtimeGeneration || 0));
        actionObj.inputGeneration = Math.max(0, Number(Battle.inputGeneration || 0));

        Battle.commandQueue.push(actionObj);
        Battle.closeSubMenu();
        Battle.currentActorIndex++;
        Battle.findNextActor();
        return true;
    },

    run: () => {
        if (Battle.phase !== 'input') return;
        if (App.data.battle.isBossBattle || App.data.battle.preventEscape) {
            Battle.log(App.data.battle.isChestTrapBattle ? "擬態箱に回り込まれ、逃げられない！" : "ボスからは逃げられない！");
            return;
        }
        // ★逃走試行回数を加算
        Battle.runAttemptCount = (Battle.runAttemptCount || 0) + 1;

        // ★試行回数に応じた成功率の決定
        let rate = 0.5;
        if (Battle.runAttemptCount === 2) rate = 0.7;
        else if (Battle.runAttemptCount === 3) rate = 0.9;
        else if (Battle.runAttemptCount >= 4) rate = 1.0;

        if(Math.random() < rate) {
            Battle.log("逃げ出した！");
            Battle.endBattle(false);
        } else {
            Battle.log(`しかし、回り込まれてしまった！`);
            Battle.commandQueue = [];
            Battle.party.forEach(p => {
                if (p && !p.isDead && !p.isFled && Number(p.hp || 0) > 0) {
                    Battle.commandQueue.push({
                        type: 'defend',
                        actor: p,
                        speed: Battle.getBattleStat(p, 'spd'),
                        runtimeGeneration: Number(Battle.runtimeGeneration || 0),
                        inputGeneration: Number(Battle.inputGeneration || 0)
                    });
                }
            });
            Battle.executeTurn();
        }
    },

    isEnemySkillContextuallyUseful: (actor, skill) => {
        if (!actor || !skill) return false;
        const allies = Battle.enemies.filter(enemy => enemy && !enemy.isFled);
        const livingAllies = allies.filter(enemy => Battle.isBattleAlive(enemy));
        const playerTargets = Battle.party.filter(member => Battle.isBattleAlive(member));
        const allyTargets = skill.target === '自分' ? [actor] : livingAllies;
        const reasons = [];

        if (skill.type === '蘇生') reasons.push(allies.some(enemy => enemy.isDead && !enemy.isFled));
        if (skill.type === '回復') {
            const ratios = allyTargets.map(target => target.hp / Math.max(1, target.baseMaxHp));
            const useful = skill.target === '全体'
                ? ratios.some(ratio => ratio <= 0.65) || ratios.filter(ratio => ratio <= 0.85).length >= 2
                : ratios.some(ratio => ratio <= 0.80);
            reasons.push(useful);
        }
        if (skill.type === 'MP回復') {
            reasons.push(allyTargets.some(target => target.mp / Math.max(1, target.baseMaxMp) <= 0.30));
        }
        if (skill.CureAilments || (Array.isArray(skill.cures) && skill.cures.length)) {
            reasons.push(allyTargets.some(target => {
                const ailments = target.battleStatus?.ailments || {};
                return skill.CureAilments
                    ? Object.keys(ailments).length > 0
                    : skill.cures.some(key => ailments[key]);
            }));
        }
        if (skill.debuff_reset) {
            reasons.push(allyTargets.some(target => Object.keys(target.battleStatus?.debuffs || {}).length > 0));
        }
        const buffKeys = Object.keys(skill.buff || {});
        if (skill.HPRegen) buffKeys.push('HPRegen');
        if (skill.MPRegen) buffKeys.push('MPRegen');
        if (buffKeys.length) {
            reasons.push(allyTargets.some(target => buffKeys.some(key => {
                const existing = target.battleStatus?.buffs?.[key];
                return !existing || (Number.isFinite(Number(existing.turns)) && Number(existing.turns) <= 1);
            })));
        }

        const hasDirectDamage = Number(skill.rate || 0) > 0 || Number(skill.base || 0) > 0 || !!skill.PercentDamage;
        if (skill.buff_reset && !hasDirectDamage) {
            reasons.push(playerTargets.some(target => Object.keys(target.battleStatus?.buffs || {}).length > 0));
        }
        return reasons.length === 0 || reasons.some(Boolean);
    },

    chooseEnemySupportTarget: (actor, skill) => {
        if (!actor || !skill) return actor || null;
        const allies = Battle.enemies.filter(enemy => enemy && !enemy.isFled);
        const livingAllies = allies.filter(enemy => Battle.isBattleAlive(enemy));
        const byLowestRatio = (list, currentKey, maxKey) => list.slice().sort((a, b) => {
            const ratioA = Number(a?.[currentKey] || 0) / Math.max(1, Number(a?.[maxKey] || 0));
            const ratioB = Number(b?.[currentKey] || 0) / Math.max(1, Number(b?.[maxKey] || 0));
            return ratioA - ratioB;
        });

        if (skill.type === '蘇生') {
            const dead = allies.filter(enemy => enemy.isDead && !enemy.isFled);
            return dead.sort((a, b) => Number(b.baseMaxHp || 0) - Number(a.baseMaxHp || 0))[0] || actor;
        }
        if (skill.type === '回復') {
            return byLowestRatio(livingAllies, 'hp', 'baseMaxHp')[0] || actor;
        }
        if (skill.type === 'MP回復') {
            return byLowestRatio(livingAllies, 'mp', 'baseMaxMp')[0] || actor;
        }
        if (skill.CureAilments || (Array.isArray(skill.cures) && skill.cures.length)) {
            const affected = livingAllies.filter(target => {
                const ailments = target.battleStatus?.ailments || {};
                return skill.CureAilments
                    ? Object.keys(ailments).length > 0
                    : skill.cures.some(key => ailments[key]);
            });
            if (affected.length) return affected[0];
        }
        if (skill.debuff_reset) {
            const debuffed = livingAllies.filter(target => Object.keys(target.battleStatus?.debuffs || {}).length > 0);
            if (debuffed.length) return debuffed[0];
        }

        const buffKeys = Object.keys(skill.buff || {});
        if (skill.HPRegen) buffKeys.push('HPRegen');
        if (skill.MPRegen) buffKeys.push('MPRegen');
        if (buffKeys.length) {
            const scored = livingAllies.map(target => {
                const buffs = target.battleStatus?.buffs || {};
                const score = buffKeys.reduce((sum, key) => {
                    const existing = buffs[key];
                    if (!existing) return sum + 2;
                    if (Number.isFinite(Number(existing.turns)) && Number(existing.turns) <= 1) return sum + 1;
                    return sum;
                }, 0);
                return { target, score };
            }).sort((a, b) => b.score - a.score);
            if (scored[0]?.score > 0) return scored[0].target;
        }

        return livingAllies[Math.floor(Math.random() * livingAllies.length)] || actor;
    },

// ★追加: 敵の行動を決定する関数 (再評価用)
    decideEnemyAction: (e) => {
        if (!e) return { type: 'defend', data: null, targetScope: '自分', priority: 1 };
        const enemyBattleStatus = Battle.ensureUnitBattleStatus(e);
        // 生の行動データを取得
        let rawActs = e.acts || [];
        const sealedSkillIds = new Set([
            ...(e?.abyssSealedSkillIds || []),
            ...(App.data?.battle?.abyssSealedSkillIds || [])
        ].map(Number));
        if (sealedSkillIds.size) {
            rawActs = rawActs.filter(action => !sealedSkillIds.has(Number(typeof action === 'object' ? action.id : action)));
        }
        if (rawActs.length === 0) rawActs = [{ id: 1, rate: 100, condition: 0 }];
		
        // ① 行動フラグと制約によるフィルタリング
        const validActions = rawActs.filter(actObj => {
            const actId = (typeof actObj === 'object') ? actObj.id : actObj;
            const condition = (typeof actObj === 'object') ? (actObj.condition || 0) : 0;
            
            // Condition Check
            if (condition === 1) { // HP>=50%
                if ((e.hp / e.baseMaxHp) < 0.5) return false;
            } else if (condition === 2) { // HP<=50%
                if ((e.hp / e.baseMaxHp) > 0.5) return false;
            } else if (condition === 3) { // 状態異常時
                const hasAilment = Object.keys(enemyBattleStatus.ailments).length > 0;
                const hasDebuff = Object.keys(enemyBattleStatus.debuffs).length > 0;
                if (!hasAilment && !hasDebuff) return false;
            }

            // スキル情報の取得
            if ([1, 2, 9].includes(actId)) return true;
            const s = DB.SKILLS.find(k => k.id === actId);
            if (!s) return false;

            // MP Check
            if (e.mp < Battle.getSkillMpCost(e, s)) return false;

            // Seal Check (現在の状態を参照)
            if (enemyBattleStatus.ailments['SpellSeal'] && (['魔法','強化','弱体'].includes(s.type))) return false;
            if (enemyBattleStatus.ailments['SkillSeal'] && (['物理','特殊'].includes(s.type))) return false;
            if (enemyBattleStatus.ailments['HealSeal'] && Battle.isHealSealBlockedSkill(s)) return false;
			// ※通常攻撃(ID:1)は除外済
            if (!Battle.isEnemySkillContextuallyUseful(e, s)) return false;

            return true;
        });

        // ② 行動抽選
        let selectedActId = 1; // Default
        if (validActions.length > 0) {
			// モンスターデータに記述された rate を、そのまま相対行動率として扱う。
			// 不要な回復・強化は候補フィルタ側で除外し、AI側で勝手に攻撃偏重へ補正しない。
            const getWeight = (a) => {
                let w = (typeof a === 'object') ? (a.rate || 10) : 10;
                return Math.max(1, Math.floor(w));
            };
			
            // ★修正: totalWeight の計算とループ内の減算に getWeight を使用
            let totalWeight = validActions.reduce((sum, a) => sum + getWeight(a), 0);

            if (totalWeight <= 0) {
                const rndObj = validActions[Math.floor(Math.random() * validActions.length)];
                selectedActId = (typeof rndObj === 'object') ? rndObj.id : rndObj;
            } else {
                let r = Math.random() * totalWeight;
                for (const act of validActions) {
                    r -= getWeight(act); // ★修正
                    if (r < 0) {
                        selectedActId = (typeof act === 'object') ? act.id : act;
                        break;
                    }
                }
            }
        }

        // ③ 結果データの構築
        let actionType = 'enemy_attack'; 
        let skillData = null;
        let targetScope = 'single'; 

        if (selectedActId === 9) { actionType = 'flee'; }
        else if (selectedActId === 2) { actionType = 'defend'; }
        else if (selectedActId !== 1) {
            const skill = DB.SKILLS.find(s => s.id === selectedActId);
            if (skill) {
                actionType = 'skill';
                skillData = skill;
                targetScope = skill.target; 
            }
        }
        
        // 優先度の取得(速度計算用には使わないがデータとして返す)
        let priority = 0;
        if (actionType === 'defend') priority = 1;
        else if (skillData && skillData.priority) priority = skillData.priority;

        return { type: actionType, data: skillData, targetScope: targetScope, priority: priority };
    },

    shouldReevaluateEnemyCommand: (cmd) => {
        if (!cmd?.isEnemy || cmd.type !== 'skill' || !cmd.data) return false;
        const actor = cmd.actor;
        const skill = cmd.data;
        const ailments = actor?.battleStatus?.ailments || {};

        if (!actor || actor.mp < Battle.getSkillMpCost(actor, skill)) return true;
        if (ailments.SpellSeal && ['魔法', '強化', '弱体'].includes(skill.type)) return true;
        if (ailments.SkillSeal && ['物理', '特殊'].includes(skill.type)) return true;
        if (ailments.HealSeal && Battle.isHealSealBlockedSkill(skill)) return true;
        return !Battle.isEnemySkillContextuallyUseful(actor, skill);
    },

	executeTurn: async () => {
        if (!Battle.active) return false;
        if (Battle.hasPendingPhaseTransition()) {
            Battle.schedulePhaseTransitionRunner();
            return false;
        }
        if (Battle.turnExecutionActive || Battle.phaseTransitionRunnerActive) return false;

        const executionToken = `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const executionGeneration = Math.max(0, Number(Battle.runtimeGeneration || 0));
        const executionInputGeneration = Math.max(0, Number(Battle.inputGeneration || 0));
        let startNextInput = false;
        let recoverInputAfterError = false;
        Battle.turnExecutionActive = true;
        Battle.turnExecutionToken = executionToken;
        Battle.deferredInputStart = false;

        const isCurrentTurn = () =>
            Battle.active &&
            Battle.turnExecutionToken === executionToken &&
            Number(Battle.runtimeGeneration || 0) === executionGeneration &&
            !Battle.hasPendingPhaseTransition();

        try {
            Battle.phase = 'execution';
            const nameDiv = Battle.getEl('battle-actor-name');
            if (nameDiv) nameDiv.style.display = 'none';
            Battle.log("--- ターン開始 ---");

            if (Battle.isPreemptive) {
                Battle.log("<span style='color:#44ff44; font-weight:bold;'>まものたちは おどろき とまどっている！</span>");
            }

            [...Battle.party, ...Battle.enemies].forEach(actor => {
                if (!actor) return;
                Battle.ensureUnitBattleStatus(actor);
                actor.turnProcessed = false;
                actor.hasDiedThisTurn = false;
            });

            // 入力キューをこのターン専用のローカル配列へ切り離す。
            // 精霊支援で形態移行した場合、旧形態へ入力済みだった命令は持ち越さない。
            const queuedCommands = Battle.commandQueue.slice();
            Battle.commandQueue = [];

            if (App.data?.battle) {
                App.data.battle.turnNumber = Math.max(0, Number(App.data.battle.turnNumber || 0)) + 1;
                Battle.processOctaprismTurnStart({ turnNumber:App.data.battle.turnNumber });
                Battle.updateDeadState();
                if (Battle.hasPendingPhaseTransition()) return false;
                if (Battle.checkFinish()) return false;
            }

            if (!Battle.isPreemptive) {
                Battle.enemies.forEach(enemy => {
                    if (!Battle.isBattleAlive(enemy)) return;
                    const count = Math.max(1, Number(enemy.actCount || 1));
                    for (let i = 0; i < count; i++) {
                        const decision = Battle.decideEnemyAction(enemy);
                        const spd = Battle.getBattleStat(enemy, 'spd');
                        const finalSpeed = (spd * (0.8 + Math.random() * 0.4)) + (decision.priority * 100000);
                        queuedCommands.push({
                            type: decision.type,
                            actor: enemy,
                            speed: finalSpeed,
                            isEnemy: true,
                            data: decision.data,
                            targetScope: decision.targetScope,
                            target: null,
                            runtimeGeneration: executionGeneration
                        });
                    }
                });
            }

            const playerCommands = queuedCommands.filter(command =>
                !command.isEnemy && command.type !== 'skip' && command.type !== 'defend'
            );
            const turnCommands = queuedCommands.filter(command =>
                command.isEnemy || command.type === 'skip' || command.type === 'defend'
            );

            for (const command of playerCommands) {
                const actor = command.actor;
                const isDouble = !!(actor?.passive?.doubleAction && Math.random() < 0.2);
                const isFast = !!(actor?.passive?.fastestAction && Math.random() < 0.2);
                command.runtimeGeneration = executionGeneration;

                if (isFast) {
                    command.speed = Number(command.speed || 0) + (10 * 100000);
                    Battle.log(`${actor.name}は最速で行動する！`);
                }
                turnCommands.push(command);
                if (isDouble) {
                    const extra = { ...command, speed: command.speed - 1 };
                    turnCommands.push(extra);
                    Battle.log(`${actor.name}は2回行動する！`);
                }
            }

            turnCommands.sort((a, b) => b.speed - a.speed);

            for (const cmd of turnCommands) {
                if (!isCurrentTurn()) return false;
                const actor = cmd.actor;
                if (cmd.runtimeGeneration !== undefined &&
                    Number(cmd.runtimeGeneration) !== executionGeneration) continue;
                if (!cmd.isEnemy && cmd.inputGeneration !== undefined &&
                    Number(cmd.inputGeneration) !== executionInputGeneration) continue;
                if (cmd.type === 'skip' || !actor || actor.hp <= 0 || actor.isFled || actor.hasDiedThisTurn) continue;

                if (Battle.auto && cmd.isAuto && !cmd.isEnemy && cmd.type === 'skill') {
                    if (Battle.shouldReevaluateAutoCommand(cmd)) {
                        const reAction = Battle.decideAutoAction(actor);
                        cmd.type = reAction.type;
                        cmd.target = reAction.target;
                        cmd.data = reAction.data;
                        cmd.targetScope = reAction.targetScope;
                        Battle.log(`<span style="color:#aaa; font-size:0.9em;">(状況の変化により ${actor.name} は行動を変更)</span>`);
                    }
                }

                if (Battle.shouldReevaluateEnemyCommand(cmd)) {
                    const reDecision = Battle.decideEnemyAction(actor);
                    cmd.type = reDecision.type;
                    cmd.data = reDecision.data;
                    cmd.targetScope = reDecision.targetScope;
                    cmd.target = null;
                    Battle.log(`<span style="color:#aaa; font-size:0.9em;">(状況の変化により ${actor.name} は行動を変更)</span>`);
                }

                if (cmd.isEnemy && !cmd.target) {
                    const isSupport = Battle.isSupportSkill(cmd.data);
                    if (cmd.targetScope === '自分') {
                        cmd.target = actor;
                    } else if (cmd.targetScope === '全体') {
                        cmd.target = isSupport ? 'all_enemy' : 'all_party';
                    } else if (cmd.targetScope === 'ランダム') {
                        cmd.target = 'random';
                    } else if (isSupport) {
                        cmd.target = Battle.chooseEnemySupportTarget(actor, cmd.data);
                    } else {
                        const aliveParty = Battle.party.filter(member => Battle.isBattleAlive(member));
                        if (aliveParty.length > 0) {
                            const weights = aliveParty.map(member => {
                                let weight = 100;
                                if (typeof PassiveSkill !== 'undefined') {
                                    weight += PassiveSkill.getSumValue(member, 'target_rate_mult');
                                }
                                return Math.max(1, weight);
                            });
                            const totalWeight = weights.reduce((a, b) => a + b, 0);
                            let random = Math.random() * totalWeight;
                            let selectedIndex = 0;
                            for (let i = 0; i < weights.length; i++) {
                                random -= weights[i];
                                if (random <= 0) {
                                    selectedIndex = i;
                                    break;
                                }
                            }
                            cmd.target = aliveParty[selectedIndex];
                        } else {
                            cmd.target = null;
                        }
                    }
                }

                const fear = actor.battleStatus?.ailments?.Fear;
                if (fear) {
                    fear.turns--;
                    let fearWoreOff = false;
                    if (fear.turns <= 0) {
                        delete actor.battleStatus.ailments.Fear;
                        fearWoreOff = true;
                    }
                    const fearStopChance = Number.isFinite(Number(fear.chance)) ? Number(fear.chance) : 0.5;
                    if (Math.random() < fearStopChance) {
                        Battle.log(`${actor.name}は 怯えて動けない！`);
                        if (fearWoreOff) Battle.log(`${actor.name}の 怯え が解けた！`);
                        await Battle.onActionEnd(actor);
                        if (!Battle.active) return false;
                        Battle.updateDeadState();
                        if (Battle.hasPendingPhaseTransition()) return false;
                        if (typeof Battle.awaitPendingBattleEvent === 'function') {
                            const cutsceneCompleted = await Battle.awaitPendingBattleEvent();
                            if (cutsceneCompleted === false && Battle.phase === 'battle_event') return false;
                        }
                        if (!isCurrentTurn()) return false;
                        Battle.renderEnemies();
                        Battle.renderPartyStatus();
                        if (Battle.checkFinish()) return false;
                        continue;
                    }
                    if (fearWoreOff) Battle.log(`${actor.name}の 怯え が解けた！`);
                }

                if (cmd.type === 'flee') {
                    Battle.log(`${cmd.actor.name}は逃げ出した！`);
                    cmd.actor.isFled = true;
                    cmd.actor.hp = 0;
                    Battle.renderEnemies();
                    if (Battle.checkFinish()) return false;
                    continue;
                }

                if (cmd.target && typeof cmd.target === 'object' && (cmd.target.isDead || cmd.target.isFled)) {
                    if (Battle.enemies.includes(cmd.target)) {
                        cmd.target = Battle.getRandomAliveEnemy();
                    } else if (Battle.party.includes(cmd.target) && cmd.data?.type !== '蘇生') {
                        const aliveParty = Battle.party.filter(member => Battle.isBattleAlive(member));
                        cmd.target = aliveParty.length > 0
                            ? aliveParty[Math.floor(Math.random() * aliveParty.length)]
                            : null;
                    }
                }

                await Battle.processAction(cmd);
                if (!isCurrentTurn()) return false;

                await Battle.onActionEnd(actor);
                if (!Battle.active) return false;

                Battle.updateDeadState();
                if (Battle.hasPendingPhaseTransition()) return false;

                if (typeof Battle.awaitPendingBattleEvent === 'function') {
                    const cutsceneCompleted = await Battle.awaitPendingBattleEvent();
                    if (cutsceneCompleted === false && Battle.phase === 'battle_event') return false;
                }
                if (!isCurrentTurn()) return false;

                Battle.renderEnemies();
                Battle.renderPartyStatus();
                if (Battle.checkFinish()) return false;
                await Battle.resultWait(500);
                if (!isCurrentTurn()) return false;
                Battle.log("<br>");
                await Battle.resultWait(50);
            }

            if (!isCurrentTurn()) return false;
            await Battle.processEndOfRound();
            if (!isCurrentTurn()) return false;

            Battle.isPreemptive = false;
            Battle.isAmbushed = false;
            Battle.turnRecoveryAttempts = 0;
            Battle.inputRecoveryAttempts = 0;
            Battle.saveBattleState();
            startNextInput = true;
            return true;
        } catch (error) {
            console.error('[Battle] turn execution failed:', error);
            Battle.commandQueue = [];
            Battle.turnRecoveryAttempts = Math.max(0, Number(Battle.turnRecoveryAttempts || 0)) + 1;
            [...(Battle.party || []), ...(Battle.enemies || [])].forEach(Battle.ensureUnitBattleStatus);
            if (App.data?.battle) {
                App.data.battle.lastTurnExecutionError = String(error?.message || error);
                App.data.battle.lastTurnExecutionErrorAt = Date.now();
                App.data.battle.turnRecoveryAttempts = Battle.turnRecoveryAttempts;
            }
            if (Battle.active && !Battle.hasPendingPhaseTransition() && Battle.phase !== 'result') {
                Battle.phase = 'input_recovery';
                // 同じ例外がAUTOで再帰し続ける場合だけ手動へ退避する。
                // 一回目は設定を維持し、二回目以降は操作可能な入力画面を優先する。
                if (Battle.turnRecoveryAttempts >= 2 && Battle.auto) {
                    Battle.auto = false;
                    Battle.updateAutoButton?.();
                }
                recoverInputAfterError = true;
                try { Battle.saveBattleState(); } catch (_) {}
            }
            return false;
        } finally {
            if (Battle.turnExecutionToken === executionToken) {
                Battle.turnExecutionActive = false;
                Battle.turnExecutionToken = null;
            }

            if (Battle.hasPendingPhaseTransition()) {
                Battle.deferredInputStart = false;
                const journal = Battle.getPhaseTransitionJournal();
                // 旧ターンのfinally内でロックを解除した後、次形態の会話・演出・
                // ランタイム再構築・入力開始まで同じawait鎖で完了させる。
                // 背景runnerへ投げっぱなしにしないことでAUTO/手動双方の競合を防ぐ。
                if (journal?.token && Battle.active) {
                    await Battle.runPhaseTransitionSequence(journal.token);
                }
            } else if (Battle.active && Battle.phase !== 'result' &&
                (startNextInput || recoverInputAfterError || Battle.deferredInputStart)) {
                Battle.deferredInputStart = false;
                const resume = () => {
                    if (Battle.active && !Battle.turnExecutionActive &&
                        !Battle.phaseTransitionRunnerActive && !Battle.hasPendingPhaseTransition()) {
                        Battle.startInputPhase();
                    }
                };
                if (typeof queueMicrotask === 'function') queueMicrotask(resume);
                else Promise.resolve().then(resume);
            }
        }
    },

    // ターン終了時に全員の状態異常・バフの持続時間を更新する
    processEndOfRound: async () => {
        const allParticipants = [...Battle.party, ...Battle.enemies];

        for (const actor of allParticipants) {
            if (!actor || actor.isDead || actor.isFled) continue;
            const b = actor.battleStatus;
            if (!b) continue;

            // 持続時間がこのターンで切れる場合も、最後の回復を1回発生させるため先に保持する。
            const timedHpRegenRate = Number(b.buffs?.HPRegen?.val || 0);
            const timedMpRegenRate = Number(b.buffs?.MPRegen?.val || 0);

            // [1] 持続時間の更新 (怯え以外を一括カウントダウン)
            ['buffs', 'debuffs', 'ailments'].forEach(cat => {
                for (let key in b[cat]) {
                    if (key === 'Fear') continue; // ★怯えはここでは判定しない

                    const eff = b[cat][key];
                    if (eff.turns !== undefined && eff.turns !== null) {
                        eff.turns--;
                        if (eff.turns <= 0) {
                            const getDisplayName = (k) => {
                                if (k.startsWith('resists_')) return (Battle.statNames[k.replace('resists_', '')] || k) + "耐性";
                                return Battle.statNames[k] || k;
                            };
                            const dispName = getDisplayName(key);
                            if (cat === 'buffs') Battle.log(`${actor.name}の ${dispName} アップの効果が切れた！`);
                            if (cat === 'debuffs') Battle.log(`${actor.name}の ${dispName} ダウンの効果が切れた！`);
                            if (cat === 'ailments') Battle.log(`${actor.name}の ${dispName} が解けた！`);
                            delete b[cat][key];
                        }
                    }
                }
            });

            // [2] 回復処理（パッシブ特性：再生・魔力循環・ボス自動回復）
            if (actor.hp > 0) {
                let totalHpRegenPct = 0;
                let totalMpRegenPct = 0;

                // --- 特性による計算 (PassiveSkill.js 参照) ---
                if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
                    // 特性 52: 再生 (Skill %)
                    totalHpRegenPct += PassiveSkill.getSumValue(actor, 'turn_hp_regen_pct');
                    // 特性 53: 魔力循環 (Skill %)
                    totalMpRegenPct += PassiveSkill.getSumValue(actor, 'turn_mp_regen_pct');
                }

                // --- 既存のレガシーパッシブおよびボスの自動回復 ---
                // 既存の hpRegen (一律 5% 扱い)
                if (actor.passive && actor.passive.hpRegen) {
                    totalHpRegenPct += 5;
                }

                // 「毎ターン回復」バフは行動回数に依存させず、ターン終了時に一度だけ加算する。
                totalHpRegenPct += timedHpRegenRate * 100;
                totalMpRegenPct += timedMpRegenRate * 100;
                
                // ボス等の個別データに設定された自動回復 (autoRegen プロパティがある場合)
                //if (actor.autoRegen) {
                //    totalHpRegenPct += actor.autoRegen;
                //}

                // --- HP回復実行 ---
                if (totalHpRegenPct > 0 && actor.hp < actor.baseMaxHp) {
                    const recHp = Math.floor(actor.baseMaxHp * (totalHpRegenPct / 100));
                    if (recHp > 0) {
                        actor.hp = Math.min(actor.baseMaxHp, actor.hp + recHp);
                        Battle.playRecoverySe();
                        if (timedHpRegenRate > 0) Battle.log(`${actor.name}のHPが ${recHp} 回復した！`);
                        // ボスか味方かでログを少し変えるなど、演出の統合
                        if (actor.isBoss) {
                            //Battle.log(`${actor.name}のHPが ${recHp} 回復`);
                        } else {
                            //Battle.log(`${actor.name}のHPが ${recHp} 回復`);
                        }
                    }
                }

                // --- MP回復実行 ---
                if (totalMpRegenPct > 0 && actor.mp < actor.baseMaxMp) {
                    const recMp = Math.floor(actor.baseMaxMp * (totalMpRegenPct / 100));
                    if (recMp > 0) {
                        actor.mp = Math.min(actor.baseMaxMp, actor.mp + recMp);
                        Battle.playRecoverySe();
                        if (timedMpRegenRate > 0) Battle.log(`${actor.name}のMPが ${recMp} 回復した！`);
                        //Battle.log(`${actor.name}は魔力循環により MPが ${recMp} 回復した`);
                    }
                }
            }
        }
        
        // 画面表示の更新
        Battle.renderEnemies();
        Battle.renderPartyStatus();
    },
	
	onActionEnd: async (actor) => {
        if (!actor || actor.hp <= 0) return;
        const b = Battle.ensureUnitBattleStatus(actor);
        const forcedAilments = Array.isArray(App.data.battle?.guildChallengeAllyAilments)
            ? App.data.battle.guildChallengeAllyAilments
            : [];
        if (Battle.party.includes(actor) && forcedAilments.length) {
            b.ailments = b.ailments || {};
            forcedAilments.forEach(ailment => {
                b.ailments[String(ailment)] = { turns: null, forced: true };
            });
        }

        // [1] 状態異常ダメージ (行動ごとに発生)
        let dmgRate = 0;
        let msgType = '';
        if (b.ailments['Shock']) { dmgRate = 0.15; msgType = '感電'; }
        else if (b.ailments['ToxicPoison']) { dmgRate = 0.10; msgType = '猛毒'; }
        else if (b.ailments['Poison']) { dmgRate = 0.05; msgType = '毒'; }

        if (dmgRate > 0) {
            let dmg = Math.floor(actor.baseMaxHp * dmgRate);
            if (dmg < 1) dmg = 1;
            actor.hp -= dmg;
            Battle.log(`${actor.name}は ${msgType}のダメージを ${dmg} 受けた！`);
            if (actor.hp <= 0) { 
                Battle.markDefeated(actor); 
                return;
            }
        }

    },
	
	// ターン経過（持続時間減少）を処理する共通関数
    isBattleAlive: (unit) => {
        return !!(unit && !unit.isFled && !unit.isDead && Number(unit.hp || 0) > 0);
    },

    refreshPartyFormationAuras: () => {
        if (typeof App === 'undefined' || typeof App.calcStats !== 'function' || typeof App.getChar !== 'function') return;
        const members = (Battle.party || []).filter(Boolean);
        // 全員の生存状態を先に同期してから一括再計算する。順番によって一部だけ旧オーラが残るのを防ぐ。
        members.forEach(member => {
            const source = App.getChar(member.uid);
            if (!source) return;
            source.currentHp = Number(member.hp || 0);
            source.currentMp = Number(member.mp || 0);
        });
        members.forEach(member => {
            const source = App.getChar(member.uid);
            if (!source) return;
            const stats = App.calcStats(source);
            ['atk', 'def', 'mdef', 'spd', 'mag', 'hit', 'eva', 'cri', 'finDmg', 'finRed'].forEach(key => {
                if (stats[key] !== undefined) member[key] = stats[key];
            });
            if (stats.elmAtk) member.elmAtk = stats.elmAtk;
            if (stats.elmRes) member.elmRes = stats.elmRes;
            if (stats.resists) member.resists = stats.resists;
        });
        // 編成オーラ再計算でelmResが通常値へ戻るため、対象戦では混沌耐性下限を再適用する。
        Battle.applyOctaprismHeroChaosResistance?.();
    },

    markDefeated: (unit, message) => {
        if (!unit || unit.isFled || Number(unit.hp || 0) > 0) return false;
        const alreadyDead = !!unit.isDead;
        unit.hp = 0;
        unit.isDead = true;
        unit.hasDiedThisTurn = true;
        if (unit.status) unit.status.defend = false;
        if (!alreadyDead && message !== false) Battle.log(message || `${unit.name}は倒れた！`);
        if (!alreadyDead && Battle.party.includes(unit)) Battle.refreshPartyFormationAuras();
        return !alreadyDead;
    },

	processAction: async (cmd) => {
        const actor = cmd.actor;
        const data = cmd.data;
        if (!actor || (cmd.type !== 'item' && !Battle.isBattleAlive(actor))) return;
        const actorBattleStatus = Battle.ensureUnitBattleStatus(actor);
        const actorName = Battle.getColoredName(actor);

        // --- [1] 実行時の封印チェック ---
        if (cmd.type !== 'item' && cmd.type !== 'defend') {
            const type = data ? data.type : '通常攻撃';
            const ailments = actorBattleStatus.ailments;

            if (ailments['SpellSeal']) {
                if (['魔法', '強化', '弱体'].includes(type)) {
                    Battle.log(`${actorName}は 呪文が封じられていて動けない！`);
                    return;
                }
            }

            if (ailments['SkillSeal']) {
                if (['物理', '特殊'].includes(type) && type !== '通常攻撃') {
                    Battle.log(`${actorName}は 特技が封じられていて動けない！`);
                    return;
                }
            }

            if (ailments['HealSeal']) {
                if (Battle.isHealSealBlockedSkill(data)) {
                    Battle.log(`${actorName}は 回復が封じられていて動けない！`);
                    return;
                }
            }
        }

        // --- [2] 防御の処理 ---
        if (cmd.type === 'defend') {
            Battle.log(`${actor.name}は身を守っている`);
            actor.status = actor.status || {};
            actor.status.defend = true;
            return;
        }
        if (actor.status) actor.status.defend = false;

        // --- [3] アイテムの処理 ---
        if (cmd.type === 'item') {
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('battle_item');
            const item = data;
            if (window.ItemRuntime) {
                const result = window.ItemRuntime.applyBattleItem({ Battle, App, item, command: cmd });
                if (result.handled) {
                    Battle.renderPartyStatus();
                    Battle.renderEnemies();
                    return;
                }
            }
            Battle.log(`${actor.name}は${item.name}を使った！`);
            if (App.data.items && App.data.items[item.id] > 0) {
                if (item.type !== '貴重品') {
                    App.data.items[item.id]--;
                    if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
                }
                const targets = (cmd.target === 'all_ally') ? Battle.party : [cmd.target];
                for (let t of targets) {
                    if (!t) continue;
                    if (item.type === '蘇生') {
                        if (t.isDead) { 
                            t.isDead = false; 
                            let rate = (item.rate !== undefined) ? item.rate : 1;
                            t.hp = Math.floor(t.baseMaxHp * rate); 
                            if(t.hp < 1) t.hp = 1;
                            Battle.applyPersistentBattlePassives(t);
                            if (Battle.party.includes(t)) Battle.refreshPartyFormationAuras();
                            Battle.playRecoverySe();
                            Battle.log(`${t.name}は生き返った！`); 
                        }
                        else Battle.log(`${t.name}には効果がなかった`);
                    } else if (item.type === 'HP回復') {
                        if (!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxHp;
                            const beforeHp = t.hp;
                            t.hp = Math.min(t.baseMaxHp, t.hp + rec);
                            if (t.hp > beforeHp) Battle.playRecoverySe();
                            Battle.log(`${t.name}のHPが${t.hp - beforeHp}回復！`);
                        }
                    } else if (item.type === 'MP回復') {
                        if (!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxMp;
                            const beforeMp = t.mp;
                            t.mp = Math.min(t.baseMaxMp, t.mp + Math.floor(rec));
                            if (t.mp > beforeMp) Battle.playRecoverySe();
                            Battle.log(`${t.name}のMPが${t.mp - beforeMp}回復！`);
                        }
                    } else if (item.type === '状態異常回復' && !t.isDead) {
                        let cured = false;
                        if (item.cures) {
                            item.cures.forEach(ailment => {
                                if (t.battleStatus.ailments[ailment]) {
                                    delete t.battleStatus.ailments[ailment];
                                    const name = Battle.statNames[ailment] || ailment;
                                    Battle.log(`${t.name}の ${name} が治った！`);
                                    cured = true;
                                }
                            });
                        }
                        if (item.CureAilments) {
                            if (Object.keys(t.battleStatus.ailments).length > 0) {
                                t.battleStatus.ailments = {};
                                Battle.log(`${t.name}の状態異常が 全て治った！`);
                                cured = true;
                            }
                        }
                        if (item.debuff_reset) {
                            if (Object.keys(t.battleStatus.debuffs).length > 0) {
                                t.battleStatus.debuffs = {}; 
                                Battle.log(`${t.name}の 能力低下が 元に戻った！`);
                                cured = true;
                            }
                        }
                        if (!cured) Battle.log(`${t.name}には効果がなかった`);
                    }
                }
            }
            Battle.renderPartyStatus();
            return;
        }

        // --- [4] 攻撃/スキル準備 ---
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.(Battle.resolveActionSeKey(cmd, data));
        let skillName = "攻撃";
        let isPhysical = true;
        let skillRate = 1.0; 
        let baseDmg = 0;
        let mpCost = 0;
        let effectType = null;
        let element = null;
        let hitCount = 1;
        let rawSuccessRate = 100;

        if (cmd.type === 'skill') {
            skillName = data.name;
            effectType = data.type;
            isPhysical = (effectType === '物理' || effectType === '通常攻撃');
            if (data.rate !== undefined) skillRate = data.rate;
            baseDmg = data.base || 0;
            mpCost = data.mp || 0;
            element = data.elm;
            hitCount = (typeof data.count === 'number') ? data.count : 1;
            if (data.SuccessRate !== undefined) rawSuccessRate = data.SuccessRate;

            mpCost = Battle.getSkillMpCost(actor, data, 'spend');
            if (actor.mp < mpCost) {
                Battle.log(`${actor.name}は${skillName}を唱えたがMPが足りない！`);
                return;
            }
            actor.mp -= mpCost;
            Battle.renderPartyStatus();
        }

        // 特性 8: 二刀流 (特殊、強化、弱体、回復、攻撃、魔法、ブレス、物理の全てに対応)
        let totalActionLoops = 1;
        
        // アイテム使用以外で、かつ actor が「二刀流」の特性を持っている場合を判定
        const canDualWield =
			  cmd.type !== 'item' &&
			  Battle.isDualWieldActive(actor);

        if (canDualWield) {
            // 対象となるタイプを網羅 (物理・通常・魔法・ブレス・特殊・強化・弱体・回復)
            const isApplicableType = isPhysical || ['魔法', 'ブレス', '特殊', '強化', '弱体', '回復', 'MP回復'].includes(effectType);
            
            if (isApplicableType) {
                totalActionLoops = 2;
            }
        }

        // ループの前に元のレートを保持
        const baseSkillRate = skillRate;
		
		for (let loop = 0; loop < totalActionLoops; loop++) {
			// ループごとに現在の倍率を決定
            let currentSkillRate = baseSkillRate;
			
            if (loop === 1) {
                // ★修正: 追撃前に有効なターゲット（生存者）がいるかチェック
                let hasValidTarget = false;
                // 全体・ランダム攻撃・範囲指定文字の場合
                if (cmd.targetScope === '全体' || cmd.targetScope === 'ランダム' || ['all_enemy', 'all_ally'].includes(cmd.target)) {
                    const pool = cmd.isEnemy ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                    if (pool.length > 0) hasValidTarget = true;
                } 
                // 単体攻撃の場合
                else if (cmd.target && Battle.isBattleAlive(cmd.target)) {
                    hasValidTarget = true;
                }

                // ターゲットが全滅、または指定ターゲットが死亡している場合はループを終了（追撃しない）
                if (!hasValidTarget) break;

				Battle.log(`${actor.name}の 追撃！`);
				const dualBonus = PassiveSkill.getSumValue(actor, 'dual_dmg_mult');
                // ★元の倍率に対して二刀流補正を乗算する
                currentSkillRate = baseSkillRate * (dualBonus / 100);
            } else {
                Battle.log(`${actor.name}の${skillName}！`);
            }

            let successRate = rawSuccessRate;
            if (successRate <= 1 && successRate > 0) successRate *= 100;

            // --- [5] マダンテ系特殊処理 ---
            if (Battle.isMadanteSkill(data)) {
                let baseBaseDmg = mpCost * skillRate;
                const pool = cmd.isEnemy ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                let loopTargets = [];
                if (cmd.targetScope === 'ランダム') {
                    if (pool.length > 0) loopTargets = [pool[0]];
                } else if (cmd.targetScope === '単体' && cmd.target) {
                    if (Battle.isBattleAlive(cmd.target)) loopTargets = [cmd.target];
                } else {
                    loopTargets = pool;
                }
                for (let t of loopTargets) {
                    if (!Battle.isBattleAlive(actor)) break;
                    if (!t) continue;
                    for (let i = 0; i < hitCount; i++) {
                        if (!Battle.isBattleAlive(actor)) break;
                        let targetToHit = (cmd.targetScope === 'ランダム') ? pool[Math.floor(Math.random() * pool.length)] : t;
                        if (!Battle.isBattleAlive(targetToHit)) continue;
                        
                        let bonusRate = 0, cutRate = 0, isImmune = false; 
                        
                        if (element) {
                            if (targetToHit.absoluteElementImmunity === true) isImmune = true;
                            const elmAtkVal = (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                            bonusRate += elmAtkVal;
                            
                            // ★属性貫通計算の修正
							let pierce = 0;
							if (typeof PassiveSkill !== 'undefined') {
								// 全属性耐性無視 (ID 30: 解析)
								pierce += PassiveSkill.getSumValue(actor, 'all_elm_pierce_pct');
								// 個別属性耐性無視 (ID 23-29: 火の扱いなど)
								const spKey = {火:'fire',水:'water',風:'wind',雷:'thunder',光:'light',闇:'dark',混沌:'chaos'}[element];
								if(spKey) pierce += PassiveSkill.getSumValue(actor, spKey + '_pierce_pct');
							}

                            const baseRes = (targetToHit.getStat('elmRes') || {})[element] || 0;
                            const buffRes = (targetToHit.battleStatus.buffs['elmResUp'] || {}).val || 0;
                            const debuffRes = (targetToHit.battleStatus.debuffs['elmResDown'] || {}).val || 0; 
                            
                            let resVal = baseRes + buffRes - debuffRes - pierce;
                            if (!isImmune) {
                                if (resVal >= 100) isImmune = true; else cutRate += resVal;
                            }
                        }
                        
                        const finDmgVal = Battle.getBattleStat(actor, 'finDmg') || 0; bonusRate += finDmgVal;
                        bonusRate += PassiveSkill.getSumValue(actor, 'dmg_pct');
                        let finRed = Battle.getBattleStat(targetToHit, 'finRed') || 0;
                        if (finRed > 80) finRed = 80; cutRate += finRed;
                        
                        let dmg = baseBaseDmg;
                        if (dmg > 0) {
                            dmg = dmg * (1.0 + bonusRate / 100) * (1.0 - cutRate / 100) * (0.85 + Math.random() * 0.3); 
                            if (targetToHit.status && targetToHit.status.defend) dmg *= 0.5;
                            dmg = Math.floor(dmg); 
                            if (!isImmune && dmg < 1) dmg = 1; 
                        }
                        if (isImmune) dmg = 0;
                        const hpBeforeDamage = targetToHit.hp;
                        targetToHit.hp -= dmg;
                        Battle.stageHpVisualTransition(targetToHit, hpBeforeDamage);

                        Battle.recordMaxDamage(actor, data, dmg, cmd);

                        if (dmg > 0) {
                            let dRate = (data && data.drain) ? 0.5 : (actor.passive?.drain ? 0.2 : 0);
                            if (dRate > 0) {
                                const dAmt = Math.floor(dmg * dRate);
                                const oldHp = actor.hp; actor.hp = Math.min(actor.baseMaxHp, actor.hp + dAmt);
                                if(actor.hp - oldHp > 0) { Battle.playRecoverySe(); Battle.log(`${actor.name}は吸収効果でHPを${actor.hp - oldHp}回復した！`); }
                            }
                            if (actor.passive?.drainMp) {
                                const mpAmt = Math.max(1, Math.floor(dmg * Battle.DRAIN_MP_RATE));
                                actor.mp = Math.min(actor.baseMaxMp, actor.mp + mpAmt);
                            }
                        }

                        let dmgColor = element ? ({火:'#f88',水:'#88f',雷:'#ff0',風:'#8f8',光:'#ffc',闇:'#a8f',混沌:'#d4d'}[element] || '#fff') : '#fff';
                        if (dmg === 0) Battle.log(`ミス！ ${targetToHit.name}は ダメージを うけない！`);
                        else Battle.log(`${targetToHit.name}に<span style="color:${dmgColor}">${dmg}</span>のダメージ！`);
                        // [修正] マダンテ系ダメージでも根性判定を行う
                        if (targetToHit.hp <= 0) {
                            if (!Battle.tryGutsSurvive(targetToHit, hpBeforeDamage)) {
                                Battle.markDefeated(targetToHit);
                            }
                        }
                        Battle.renderEnemies(); Battle.renderPartyStatus();
                        await Battle.awaitActionVisualPhase();
                        if (hitCount > 1) await Battle.resultWait(150);
                    }
                }
                if (loop === 0 && totalActionLoops > 1) continue; 
                await Battle.resultWait(500);
                return;
            }

            // --- [6] ターゲット特定 ---
            let targets = [];
            let skillScope = cmd.targetScope;
            if (!skillScope && cmd.target === 'all_enemy') skillScope = '全体';
            if (!skillScope && cmd.target === 'all_ally') skillScope = '全体';
            if (!skillScope && cmd.target === 'random') skillScope = 'ランダム';
            
            const isSupport = Battle.isSupportSkill(data);
            const usesDirectEffectBranch = !!effectType && ['回復','蘇生','強化','弱体','特殊','MP回復'].includes(effectType);

            if (skillScope === '全体') {
                 if (cmd.isEnemy) {
                     targets = isSupport ? Battle.enemies.filter(e => !e.isFled) : Battle.party.filter(p => Battle.isBattleAlive(p));
                 } else {
                     targets = isSupport ? Battle.party.filter(p => p) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                 }
            } else if (skillScope === 'ランダム') {
                 let pool = cmd.isEnemy ? (isSupport ? Battle.enemies.filter(e => Battle.isBattleAlive(e)) : Battle.party.filter(p => Battle.isBattleAlive(p))) : (isSupport ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e)));
                 if (pool.length > 0) {
                     // 割合ダメージ・状態変化などの直接効果も count 回ぶん個別抽選する。
                     // 通常ダメージ分岐は後段のヒットループが回数を処理するため、ここでは1対象だけ選ぶ。
                     const drawCount = usesDirectEffectBranch ? Math.max(1, hitCount) : 1;
                     targets = Array.from({ length: drawCount }, () => pool[Math.floor(Math.random() * pool.length)]);
                 }
            } else {
                targets = [cmd.target];
            }

            // --- [7] 内部関数：効果適用ロジック (★特性ID31, 32の組み込み) ---
            const applyEffects = (t, d, ailmentMult = 1.0) => {
                // HP0・戦闘不能の対象には、追加状態異常・弱体・割合ダメージなどを発生させない。
                if (!t || t.isFled || !Battle.isBattleAlive(t)) return;
                // 特性による成功率ボーナスの算出
				const assaBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_instantdeath_bonus') : 0;
                const bodyBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_body_bonus') : 0;
                const curseBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_curse_bonus') : 0; // ★追加

                // 状態異常・弱体は一度だけ抽選する。
                // 成功率には特性・会心補正を先に反映し、最終成功率 = 成功率 - 対象耐性 とする。
                const getFinalEffectChance = (type, val, bonus = 0) => {
                    const baseRate = (typeof val === 'number') ? val : successRate;
                    const resistKey = Battle.RESIST_MAP[type] || type;
                    const resistVal = (Battle.getBattleStat(t, 'resists') || {})[resistKey] || 0;
                    return Math.max(0, Math.min(100, ((baseRate + bonus) * ailmentMult) - resistVal));
                };
                const tryEffect = (type, val, bonus = 0) => {
                    return Math.random() * 100 < getFinalEffectChance(type, val, bonus);
                };

                const ailmentMessages = {
                    Poison: "どくにかかった",
                    ToxicPoison: "もうどくにかかった",
                    Shock: "感電した",
                    Debuff: "ステータスが低下した",
                    Fear: "おびえている",
                    SpellSeal: "呪文を封じられた",
                    SkillSeal: "特技を封じられた",
                    HealSeal: "回復を封じられた"
                };
                const addA = (k, msg, chance=null) => {
                    const text = ailmentMessages[k] || msg || `${Battle.statNames[k]||k}にかかった`;
                    if (t.battleStatus.ailments[k]) {
                        const current = t.battleStatus.ailments[k];
                        current.turns = Math.max(Number(current.turns || 0), d.turn || 3);
                        if (chance !== null) current.chance = chance;
                        Battle.log(`${t.name}は ${text}！`);
                        return;
                    }
                    t.battleStatus.ailments[k] = { turns: d.turn || 3, chance: chance }; 
                    Battle.log(`${t.name}は ${text}！`);
                };
                const mergeEffectTurns = (existingTurns, nextTurns) => {
                    // 永続効果へ一時効果を重ねても有限化しない。再付与で残り時間を短縮しない。
                    if (existingTurns === null || nextTurns === null) return null;
                    if (existingTurns === undefined) return nextTurns;
                    if (nextTurns === undefined) return existingTurns;
                    return Math.max(Number(existingTurns) || 0, Number(nextTurns) || 0);
                };

                if (d.buff) {
                    for (let key in d.buff) {
                        const turn = Battle.getEffectTurn(d); 
                        if (key === 'elmResUp' || key.startsWith('resists_')) {
                            // 属性・状態耐性は倍率ではなく加算百分率。能力値バフの2.5倍上限を適用しない。
                            const existing = t.battleStatus.buffs[key];
                            t.battleStatus.buffs[key] = {
                                val: Math.max(Number(existing?.val || 0), Number(d.buff[key] || 0)),
                                turns: existing?.turns === null ? null : Math.max(Number(existing?.turns || 0), turn)
                            };
                            const label = key === 'elmResUp' ? '全属性耐性' : (Battle.statNames[key] || key);
                            Battle.log(`${t.name}の ${label} が あがった！`);
                        } else {
                            const existing = t.battleStatus.buffs[key];
                            const cur = Number(existing?.val || 1.0);
                            t.battleStatus.buffs[key] = {
                                val: Math.min(2.5, cur * d.buff[key]),
                                turns: mergeEffectTurns(existing?.turns, turn)
                            };
                            Battle.log(`${t.name}の ${Battle.statNames[key]||key} があがった！`);
                        }
                    }
                }
                if (d.HPRegen) {
                    const existing = t.battleStatus.buffs.HPRegen;
                    t.battleStatus.buffs.HPRegen = {
                        val: Math.max(Number(existing?.val || 0), Number(d.HPRegen || 0)),
                        turns: mergeEffectTurns(existing?.turns, Battle.getEffectTurn(d))
                    };
                    Battle.log(`${t.name}の HPが徐々に回復する！`);
                }
                if (d.MPRegen) {
                    const existing = t.battleStatus.buffs.MPRegen;
                    t.battleStatus.buffs.MPRegen = {
                        val: Math.max(Number(existing?.val || 0), Number(d.MPRegen || 0)),
                        turns: mergeEffectTurns(existing?.turns, Battle.getEffectTurn(d))
                    };
                    Battle.log(`${t.name}の MPが徐々に回復する！`);
                }
                if (d.CureAilments) { t.battleStatus.ailments = {}; Battle.log(`${t.name}の状態異常が 全て治った！`); }
                if (d.debuff_reset) { t.battleStatus.debuffs = {}; Battle.log(`${t.name}の 能力低下が 元に戻った！`); }
                
                if (d.debuff) {
                    const debuffKeys = Object.keys(d.debuff);
                    // 複数能力低下も、技1回・対象1体につき成功抽選は1回だけ。
                    // 自分専用強化に含まれる代償弱体（臥薪嘗胆など）は耐性で無効化しない。
                    const isSelfCost = t === actor && d.target === '自分' && d.type === '強化';
                    const debuffSucceeded = isSelfCost || tryEffect('Debuff', successRate, bodyBonus);
                    if (!debuffSucceeded) {
                        Battle.log(`${t.name}には 能力低下 は きかなかった！`);
                    }
                    for (const key of debuffSucceeded ? debuffKeys : []) {
                        const turn = Battle.getEffectTurn(d);
                        if (key === 'elmResDown') {
                            const existing = t.battleStatus.debuffs[key];
                            t.battleStatus.debuffs[key] = {
                                val: Math.max(Number(existing?.val || 0), Number(d.debuff[key] || 0)),
                                turns: existing?.turns === null ? null : Math.max(Number(existing?.turns || 0), turn)
                            };
                            Battle.log(`${t.name}の 全属性耐性 が さがった！`);
                        } else {
                            const existing = t.battleStatus.debuffs[key];
                            const cur = Number(existing?.val || 1.0);
                            t.battleStatus.debuffs[key] = {
                                val: Math.max(0.1, cur * d.debuff[key]),
                                turns: mergeEffectTurns(existing?.turns, turn)
                            };
                            Battle.log(`${t.name}の ${Battle.statNames[key]||key} がさがった！`);
                        }
                    }
                }
                if (d.buff_reset) { t.battleStatus.buffs = {}; Battle.log(`${t.name}の良い効果がかき消された！`); }
                
				// 1. 毒系・感電・弱体は「人体知識」の対象
				// 元のデータ(d.Poison等)が 0 より大きい場合のみ、ボーナスを乗せて判定する
				if (d.Poison > 0) tryEffect('Poison', d.Poison, bodyBonus) ? addA('Poison', `${t.name}は どくにおかされた！`) : Battle.log(`${t.name}には 毒 は きかなかった！`);
				if (d.ToxicPoison > 0) tryEffect('ToxicPoison', d.ToxicPoison, bodyBonus) ? addA('ToxicPoison', `${t.name}は もうどくにおかされた！`) : Battle.log(`${t.name}には 猛毒 は きかなかった！`);
				if (d.Shock > 0) tryEffect('Shock', d.Shock, bodyBonus) ? addA('Shock', `${t.name}は 感電してしまった！`) : Battle.log(`${t.name}には 感電 は きかなかった！`);
				if (d.Debuff > 0) tryEffect('Debuff', d.Debuff, bodyBonus) ? addA('Debuff', `${t.name}の ステータスが低下した！`) : Battle.log(`${t.name}には 弱体 は きかなかった！`);

				// 2. 怯え・封印系は「呪い体質」の対象
				if (d.Fear > 0) tryEffect('Fear', d.Fear, curseBonus) ? addA('Fear', `${t.name}は 怯えてしまった！`, 0.5) : Battle.log(`${t.name}には 怯え は きかなかった！`);
				if (d.SpellSeal > 0) tryEffect('SpellSeal', d.SpellSeal, curseBonus) ? addA('SpellSeal', `${t.name}の 呪文が封じられた！`) : Battle.log(`${t.name}には 呪文封印 は きかなかった！`);
				if (d.SkillSeal > 0) tryEffect('SkillSeal', d.SkillSeal, curseBonus) ? addA('SkillSeal', `${t.name}の 特技が封じられた！`) : Battle.log(`${t.name}には 特技封印 は きかなかった！`);
				if (d.HealSeal > 0) tryEffect('HealSeal', d.HealSeal, curseBonus) ? addA('HealSeal', `${t.name}の 回復が封じられた！`) : Battle.log(`${t.name}には 回復封印 は きかなかった！`);
                
                // [修正] 割合ダメージにも「呪い体質(curseBonus)」を適用し、死亡時の根性判定も追加
				if (d.PercentDamage) {
					const assaBonus = (typeof PassiveSkill !== 'undefined')
						? PassiveSkill.getSumValue(actor, 'proc_instantdeath_bonus')
						: 0;
					
					if (tryEffect('InstantDeath', successRate, assaBonus)) {
						const hpBeforeDamage = t.hp;
						let pdmg = Math.max(1, Math.floor(t.hp * d.PercentDamage));
						t.hp -= pdmg;
						Battle.stageHpVisualTransition(t, hpBeforeDamage);
						Battle.log(`${t.name}に ${pdmg} のダメージ！`);
                        if (t.hp <= 0) {
                            if (!Battle.tryGutsSurvive(t, hpBeforeDamage)) {
                                Battle.markDefeated(t);
                            }
                        }
					} else {
						Battle.log(`${t.name}にはきかなかった！`);
					}
				}
            };

            // --- [8] メイン実行ループ ---
            for (let t of targets) {
                if (!Battle.isBattleAlive(actor)) break;
                if (!t) continue;
                if (usesDirectEffectBranch) {
                    // 弱体・状態異常・割合ダメージは applyEffects 内で耐性込みの単一判定を行う。
                    // 回復・蘇生・強化だけは従来どおり技自体の成功判定を維持する。
                    const needsDirectSuccessRoll = ['回復', '蘇生', '強化', 'MP回復'].includes(effectType);
                    if (needsDirectSuccessRoll && successRate < 100 && Math.random() * 100 >= successRate) {
                        Battle.log(`ミス！ ${t.name}には効かなかった！`);
                        continue;
                    }
                    if (effectType === '蘇生') {
                        if (t.isDead) { 
                            t.isDead = false; 
                            t.hp = Math.max(1, Math.floor(t.baseMaxHp * (skillRate !== undefined ? skillRate : 0.5)));
                            Battle.applyPersistentBattlePassives(t);
                            if (Battle.party.includes(t)) Battle.refreshPartyFormationAuras();
                            Battle.playRecoverySe();
                            Battle.log(`${t.name}は生き返った！`); 
                        } else { 
                            Battle.log(`${t.name}には効果がなかった`); 
                            continue; 
                        }
                    }
					if (effectType === '回復' && Battle.isBattleAlive(t)) {
						const healBonus = 1 + (PassiveSkill.getSumValue(actor, 'heal_pct') / 100);
						let rec;
						if (data.ratio) {
							rec = Math.floor(t.baseMaxHp * data.ratio);
						} else {
							const baseValue = data.fix ? baseDmg : (Battle.getBattleStat(actor, 'mag') * skillRate + baseDmg);
							rec = baseValue * healBonus * (0.85 + Math.random() * 0.3);
						}
						const beforeHp = t.hp;
						t.hp = Math.min(t.baseMaxHp, t.hp + Math.floor(rec));
						Battle.stageHpVisualTransition(t, beforeHp);
                        if (t.hp > beforeHp) Battle.playRecoverySe();
						Battle.log(`${t.name}のHPが${t.hp - beforeHp}回復！`);
					}
                    if (effectType === 'MP回復' && Battle.isBattleAlive(t)) {
                        let rec = data.ratio ? Math.floor(t.baseMaxMp * data.ratio) : baseDmg;
                        const beforeMp = t.mp;
                        t.mp = Math.min(t.baseMaxMp, t.mp + Math.floor(rec));
                        if (t.mp > beforeMp) Battle.playRecoverySe();
                        Battle.log(`${t.name}のMPが${t.mp - beforeMp}回復！`);
                    }
                    if (Battle.isBattleAlive(t)) applyEffects(t, data);
                    Battle.renderEnemies(); Battle.renderPartyStatus(); 
                    continue;
                }

                for (let i = 0; i < hitCount; i++) {
                    if (!Battle.isBattleAlive(actor)) break;
                    let targetToHit = t;
                    let isCoveringHit = false;
                    if (skillScope === 'ランダム') {
                        const pool = cmd.isEnemy ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                        if (pool.length === 0) break;
                        targetToHit = pool[Math.floor(Math.random() * pool.length)];
                    }
                    if (!Battle.isBattleAlive(targetToHit)) { if (skillScope !== 'ランダム') break; continue; }
                    const isFixedDamage = data?.fix === true;

                    // --- 特性 19:献身 (かばう) ---
                    if (!isSupport) {
                        // 攻撃者が敵(cmd.isEnemy)なら「味方(party)」を、
                        // 攻撃者が味方なら「敵(enemies)」を、かばう候補として取得
                        const friends = cmd.isEnemy ? Battle.party : Battle.enemies;

                        // 同じ陣営の中から、瀕死(50%以下)の仲間を助けに来る者を探す
                        const coverCandidates = targetToHit.hp <= targetToHit.baseMaxHp * 0.5
                            ? friends.filter(p => p && p !== targetToHit && Battle.isBattleAlive(p))
                            : [];
                        const activatedCoverers = coverCandidates.filter(p => {
                            const chance = PassiveSkill.getSumValue(p, 'cover_rate_mult');
                            return chance > 0 && Math.random() * 100 < chance;
                        });

                        if (activatedCoverers.length > 0) {
                            const coverTarget = activatedCoverers[Math.floor(Math.random() * activatedCoverers.length)];
                            Battle.log(`${coverTarget.name}が ${targetToHit.name}を かばった！`);
                            // 攻撃対象を「かばった者」に差し替え
                            targetToHit = coverTarget;
                            isCoveringHit = true;
                        }
                    }

                    // 1. dataが未定義（通常攻撃等）でもエラーが出ないよう data?.isPerfect を使用
                    if (!data || !data.isPerfect) {
                        let baseHit;

						// スキル本来の命中率を取得（未定義なら100）
					const baseHitRate =
					  (data && data.hitRate !== undefined) ? data.hitRate :
					  (data && data.HitRate !== undefined) ? data.HitRate :
					  100;

					// 命中・回避補正は calcStats/getBattleStat に集約し、ここでは二重加算しない。
					const firstHitBase = baseHitRate;

					if (loop === 1) {
						// --- 2回目：半減(=dual_hit_base%) + 二刀流Lv×dual_hit_mult ---
						const dualLv = Battle.getDualWieldLevel(actor);

						// パッシブ(特性8)から調整可能にする
						const dualParams = (PassiveSkill.MASTER && PassiveSkill.MASTER[8] && PassiveSkill.MASTER[8].params) ? PassiveSkill.MASTER[8].params : {};
						const halfRatePct = (dualParams.dual_hit_base !== undefined) ? dualParams.dual_hit_base : 50; // 50%の部分
						const perLvPct    = (dualParams.dual_hit_mult !== undefined) ? dualParams.dual_hit_mult : 2;   // Lvあたり+2%の部分

						baseHit = (firstHitBase * (halfRatePct / 100)) + (dualLv * perLvPct);
					} else {
						// 1回目：従来通り（スキル命中 + hit_pct）
						baseHit = firstHitBase;
					}

                        // 3. targetToHit（モンスター等）の回避率が未定義の場合は 0(%) 扱いとする
                        const targetEva = Battle.getBattleStat(targetToHit, 'eva') || 0;
                        
                        const actorHit = Battle.getBattleStat(actor, 'hit') || 100;
                        const finalHitChance = (baseHit * (actorHit / 100)) - targetEva;
                        
                        if (Math.random() * 100 >= finalHitChance) {
                            Battle.log(`ミス！ ${targetToHit.name}は身をかわした！`);
                            await Battle.resultWait(200); continue; 
                        }
                    }

                    // [修正] 攻撃者が誰であっても、受ける側(targetToHit)が先制特性を持っていれば判定を行う
					if (isPhysical && !cmd.isReaction) {
						const isMonster = (targetToHit instanceof Monster);
						// モンスターなら武器制限を無視(ignoreWeapon=true)、プレイヤーなら制限あり
						const preemptRate = (typeof PassiveSkill !== 'undefined') 
							? PassiveSkill.getSumValue(targetToHit, 'preempt_rate_mult', isMonster) 
							: 0;

						if (preemptRate > 0 && Math.random() * 100 < preemptRate) {
							Battle.log(`${targetToHit.name}の 先制攻撃！`);
							await Battle.executeReactionAttack(targetToHit, actor);
							if (!Battle.isBattleAlive(actor)) {
							    Battle.renderEnemies(); Battle.renderPartyStatus();
							    break;
							}
						}
					}
					
                    // --- [1] 会心・暴走判定フェーズ ---
					let isCrit = false;
					let ailmentChanceMult = 1.0;

					if (!isFixedDamage && effectType !== 'ブレス') {
						// 装備・特性分はcalcStats済みなので、スキル固有値と戦闘ステータスだけを合算する。
						const totalCritRate = Number(data?.critRate ?? 0) +
											  (Battle.getBattleStat(actor, 'cri') || 0);

						// A. 通常の会心判定
						if (Math.random() * 100 < totalCritRate) {
							isCrit = true;
						} 
						// B. 魔法の場合のみ：スキルツリー等の magCrit パッシブによる独立 20% 判定
						else if (!isPhysical && actor.passive?.magCrit && Math.random() < 0.2) {
							isCrit = true;
						}
					}

					// --- [2] ステータス取得と防御無視判定フェーズ ---
					let atkVal = isPhysical ? Battle.getBattleStat(actor, 'atk') : Battle.getBattleStat(actor, 'mag');
					let defVal = isPhysical ? Battle.getBattleStat(targetToHit, 'def') : Battle.getBattleStat(targetToHit, 'mdef');

					let ignoreDefense = (data?.IgnoreDefense ?? false);

					// 会心・暴走が発生した場合は、物理・魔法問わず防御無視を適用
					if (isCrit) {
						ignoreDefense = true;
					} 
					// 会心でない場合のみ、各種パッシブによる確率防御無視（貫通）を判定
					else if (typeof PassiveSkill !== 'undefined') {
						// 物理：スキルツリー(atkIgnoreDef) or シナジー(pierce)
						if (isPhysical) {
							if (actor.passive?.atkIgnoreDef && Math.random() < 0.2) {
								ignoreDefense = true;
								Battle.log(`<span style="color:#ff4444; font-weight:bold;">防御を貫通！</span>`);
								}
							//if (actor.passive?.pierce && Math.random() < 0.2) ignoreDefense = true;
						}
						// ※魔法側の貫通パッシブを実装する場合はここに追加可能
					}

					// --- [3] 基礎ダメージ計算フェーズ ---
					let baseDmgCalc = 0;
					if (data?.fix) {
						baseDmgCalc = baseDmg;
					} else if (effectType === 'ブレス') {
						// ブレスは攻+魔の合計を参照
						baseDmgCalc = Math.floor(((Battle.getBattleStat(actor, 'atk') + Battle.getBattleStat(actor, 'mag')) / 6 + baseDmg));
					} else {
						// 物理・魔法：防御無視フラグにより、引き算の defVal/4 を 0 にする
						baseDmgCalc = Math.floor(((atkVal / 2) + baseDmg) - (ignoreDefense ? 0 : defVal / 4));
					}

					// 最低ダメージ保証（30%で1ダメージ）
					if (baseDmgCalc < 1) baseDmgCalc = (Math.random() < 0.3) ? 1 : 0;

					// --- [4] 特性・シナジーによる最終倍率計算フェーズ ---
					let totalMult = isFixedDamage ? 1 : currentSkillRate; // 固定ダメージはスキル倍率・二刀流倍率を参照しない

					// 隊列補正（物理のみ）
					if (!isFixedDamage && isPhysical) {
						if (actor.formation === 'back' && !['弓', '短剣', '杖'].includes(actor.weaponType)) totalMult *= 0.5;
						if (targetToHit.formation === 'back') totalMult *= 0.5;
					}

					// 特性(PassiveSkill)による種族特効・属性強化
					if (!isFixedDamage && typeof PassiveSkill !== 'undefined') {
						if (targetToHit.race === '死霊' || targetToHit.race === '魔族') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_demon_pct') / 100);
						if (targetToHit.race === '獣' || targetToHit.race === '獣人') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_beast_pct') / 100);
						if (targetToHit.race === '機械' || targetToHit.race === '無生物') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_machine_pct') / 100);
						if (targetToHit.race === '竜' || targetToHit.race === '竜人') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_dragon_pct') / 100);

						if (actor.hp <= actor.baseMaxHp * 0.5) totalMult *= (1 + PassiveSkill.getSumValue(actor, 'low_hp_dmg_mult') / 100);
						
						if (actor.revengeStack && actor.revengeStack > 0) {
							const isMonster = (actor instanceof Monster);
							const revPct = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'revenge_dmg_pct', isMonster) : 0;
							totalMult *= (1 + (actor.revengeStack * revPct) / 100);
						}
					}

					// --- [5] 会心・暴走による最終倍率適用とログ出力 ---
					if (isCrit) {
						// 防御無視に加え、ダメージを1.5倍にする（ご要望どおり魔法も1.5倍で統一）
						totalMult *= 1.5;
						
						// 会心時は状態異常付与率を1.5倍にする
						ailmentChanceMult = 1.5;
						
						if (isPhysical) {
							Battle.log(`<span style="color:#ff4444; font-weight:bold;">かいしんの一撃！</span>`);
						} else {
							Battle.log(`<span style="color:#4444ff; font-weight:bold;">魔力が暴走！</span>`);
						}
					}
					

                    let bonusRate = 0, cutRate = 0, isImmune = element && targetToHit.absoluteElementImmunity === true;
                    if (!isImmune && !isFixedDamage && element) {
                        bonusRate += (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                        let pierce = 0;
                        if (typeof PassiveSkill !== 'undefined') {
                            pierce = PassiveSkill.getSumValue(actor, 'all_elm_pierce_pct');
                            const spKey = {火:'fire',水:'water',風:'wind',雷:'thunder',光:'light',闇:'dark',混沌:'chaos'}[element];
                            if(spKey) pierce += PassiveSkill.getSumValue(actor, spKey + '_pierce_pct');
                        }
                        const finalRes = ((targetToHit.getStat('elmRes') || {})[element] || 0) + (targetToHit.battleStatus.buffs['elmResUp']?.val || 0) - (targetToHit.battleStatus.debuffs['elmResDown']?.val || 0) - pierce;
                        if (finalRes >= 100) isImmune = true; else cutRate += finalRes;
                    }
                    if (!isFixedDamage) {
                        bonusRate += Battle.getBattleStat(actor, 'finDmg') || 0;
                        bonusRate += PassiveSkill.getSumValue(actor, 'dmg_pct');
                    }
                    let finRed = Battle.getBattleStat(targetToHit, 'finRed') || 0;
                    
					if (isCoveringHit) finRed += PassiveSkill.getSumValue(targetToHit, 'cover_reduce_mult');
                    if (finRed > 80) finRed = 80; cutRate += finRed;

                    const variance = isFixedDamage ? 1 : (0.85 + Math.random() * 0.3);
                    let dmg = Math.floor(baseDmgCalc * totalMult * (1.0 + bonusRate / 100) * (1.0 - cutRate / 100) * variance);
                    
					// ★設計思想の反映: ダメージ計算の最後にタイプ別特性を計算
					if (typeof PassiveSkill !== 'undefined') {
						let typeDmgPct = 0;
						let typeRedPct = 0;

						if (isPhysical) {
							typeDmgPct = PassiveSkill.getSumValue(actor, 'physical_dmg_pct'); // ID 10
							typeRedPct = PassiveSkill.getSumValue(targetToHit, 'physical_reduce_pct'); // ID 15
						} else if (effectType === '魔法') {
							typeDmgPct = PassiveSkill.getSumValue(actor, 'magic_dmg_pct'); // ID 11
							typeRedPct = PassiveSkill.getSumValue(targetToHit, 'magic_reduce_pct'); // ID 16
						} else if (effectType === 'ブレス') {
							typeDmgPct = PassiveSkill.getSumValue(actor, 'breath_dmg_pct'); // ID 12
							typeRedPct = PassiveSkill.getSumValue(targetToHit, 'breath_reduce_pct'); // ID 17
						}

						// 最終乗算 (1.0 + 補正/100)
						if (!isFixedDamage) dmg = Math.floor(dmg * (1 + typeDmgPct / 100));
						dmg = Math.floor(dmg * (1 - typeRedPct / 100));
					}
					
					if (targetToHit.status?.defend) dmg = Math.floor(dmg * 0.5);
                    if (isImmune) dmg = 0; else if (dmg < 1 && baseDmgCalc > 0) dmg = 1;

                    const hpBeforeDamage = targetToHit.hp;

                    targetToHit.hp -= dmg;
                    Battle.stageHpVisualTransition(targetToHit, hpBeforeDamage, { critical: isCrit });
                    targetToHit.revengeStack = (targetToHit.revengeStack || 0) + 1;
                    actor.revengeStack = 0;

                    Battle.recordMaxDamage(actor, data, dmg, cmd);
                    
                    let dColor = element ? ({火:'#f88',水:'#88f',雷:'#ff0',風:'#8f8',光:'#ffc',闇:'#a8f',混沌:'#d4d'}[element] || '#fff') : '#fff';
                    if (dmg === 0) Battle.log(`ミス！ ${targetToHit.name}は ダメージを うけない！`);
                    else Battle.log(`${targetToHit.name}に<span style="color:${dColor}">${dmg}</span>のダメージ！`);
                    if (targetToHit.hp <= 0) {
                        if (!Battle.tryGutsSurvive(targetToHit, hpBeforeDamage)) {
                            Battle.markDefeated(targetToHit);
                        }
                    }

                    // 与ダメージ吸収は反射より先に確定する。反射死後にHPだけ増えて
                    // isDead=true / HP>0 になる矛盾を防ぎ、吸魔も全攻撃系統で発動させる。
                    if (dmg > 0 && Battle.isBattleAlive(actor)) {
                        if ((data?.drain ?? false) || actor.passive?.drain) {
                            const drainRate = (data?.drain ?? false) ? 0.5 : 0.2;
                            const beforeHp = actor.hp;
                            actor.hp = Math.min(actor.baseMaxHp, actor.hp + Math.floor(dmg * drainRate));
                            const recoveredHp = actor.hp - beforeHp;
                            if (recoveredHp > 0) { Battle.playRecoverySe(); Battle.log(`${actor.name}は吸収効果でHPを${recoveredHp}回復した！`); }
                        }
                        if (actor.passive?.drainMp) {
                            const beforeMp = actor.mp;
                            actor.mp = Math.min(actor.baseMaxMp, actor.mp + Math.max(1, Math.floor(dmg * Battle.DRAIN_MP_RATE)));
                            const recoveredMp = actor.mp - beforeMp;
                            if (recoveredMp > 0) Battle.log(`${actor.name}は吸魔効果でMPを${recoveredMp}回復した！`);
                        }
                    }

                    // --- 反射（理力の壁）判定箇所 ---
					if (dmg > 0 && Battle.isBattleAlive(targetToHit)) {
						const reflectRate = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(targetToHit, 'reflect_dmg_mult') : 0;
						const reflectTrigger = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(targetToHit, 'reflect_trigger_mult') : 0;

						// [修正] モンスターなら特性のみ、プレイヤーなら「杖装備 ＆ 特性所持」を条件にする
						const isMonster = (targetToHit instanceof Monster);
						const hasTrait = reflectRate > 0;

						// ★追加：weaponType(単数) だけでなく weaponTypes(複数) でも判定
						const types = targetToHit.weaponTypes || [targetToHit.weaponType || '素手'];
						const hasStaff = types.includes('杖');

						const canReflect = isMonster ? hasTrait : (hasStaff && hasTrait);

						if (canReflect && Math.random() * 100 < (reflectTrigger > 0 ? reflectTrigger : 10)) { 
							// getSumValue('reflect_dmg_mult') が固定10%も含むため、ここでは再加算しない。
							const refDmg = Math.floor(dmg * (reflectRate / 100));
							const actorHpBeforeDamage = actor.hp;
							actor.hp -= refDmg; 
							Battle.log(`${targetToHit.name}の理力の壁が 反射！ ${actor.name}に ${refDmg} のダメージ！`);

							// 反射による自爆死の判定と根性処理
                            if (actor.hp <= 0) {
                                if (!Battle.tryGutsSurvive(actor, actorHpBeforeDamage)) {
                                    Battle.markDefeated(actor);
                                }
                            }
						}
					}
					
                    // --- 通常攻撃時の追加状態異常判定 (★特性ID31, 32の組み込み) ---
                    if (dmg > 0 && isPhysical && Battle.isBattleAlive(targetToHit)) {
						const curseBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_curse_bonus') : 0;
						const assaBonus  = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_instantdeath_bonus') : 0;
						const bodyBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_body_bonus') : 0;

						const tryS = (key, name, ailmentKey, bonus = 0) => {
							const baseChance = (actor.getStat(key) || 0);
							const resist = (Battle.getBattleStat(targetToHit, 'resists') || {})[Battle.RESIST_MAP[ailmentKey] || ailmentKey] || 0;
							const finalChance = Math.max(0, Math.min(100, (baseChance > 0 ? (baseChance + bonus) * ailmentChanceMult : 0) - resist));
							if (finalChance > 0 && Math.random() * 100 < finalChance) {
								targetToHit.battleStatus.ailments[ailmentKey] = { turns: 3, chance: (ailmentKey==='Fear'?0.5:null) };
								Battle.log(`${targetToHit.name}は ${name}！`);
							}
						};
						tryS('attack_Poison', 'どくにおかされた', 'Poison', bodyBonus);
						tryS('attack_Fear', '怯えてしまった', 'Fear', curseBonus);
                        
                        // [1] まず、装備やスキルに元々設定されている「基礎即死率」を出す
						const baseID = (actor.getStat('attack_InstantDeath') || 0) + (data?.InstantDeath || 0);

						// [2] 基礎即死率が 0 より大きい場合のみ、特性ボーナスを上乗せする
						// 基礎が 0 なら、いくら暗殺術があっても 0 のまま
						const rv = (Battle.getBattleStat(targetToHit, 'resists') || {}).InstantDeath || 0;
						const finalID = Math.max(0, Math.min(100, (baseID > 0 ? (baseID + assaBonus) * ailmentChanceMult : 0) - rv));

						if (finalID > 0 && Math.random() * 100 < finalID) {
							targetToHit.hp = 0; 
							Battle.markDefeated(targetToHit, `<span style="color:#ff00ff; font-weight:bold;">急所を貫いた！ ${targetToHit.name}は 息絶えた！</span>`); 
						}
                    }

                    if (actor instanceof Player && Battle.isBattleAlive(targetToHit)) {
                        Battle.getUniqueEquips(actor).forEach(eq => {
                            if (eq && eq.isSynergy && eq.effects) {
                                eq.effects.forEach(effect => {
                                    if (effect === 'allResDown20' && Battle.isBattleAlive(targetToHit)) {
                                        const resist = (Battle.getBattleStat(targetToHit, 'resists') || {}).Debuff || 0;
                                        const chance = Math.max(0, 20 - resist);
                                        if (Math.random() * 100 < chance) { targetToHit.battleStatus.debuffs['elmResDown'] = { val: 50, turns: 5 }; Battle.log(`${targetToHit.name}の 全属性耐性が 少しさがった！`); }
                                    }
                                    if (effect === 'instantDeath20' && Battle.isBattleAlive(targetToHit)) {
                                        const resist = (Battle.getBattleStat(targetToHit, 'resists') || {}).InstantDeath || 0;
                                        const chance = Math.max(0, 20 - resist);
                                        if (Math.random() * 100 < chance) { targetToHit.hp = 0; Battle.markDefeated(targetToHit, `<span style="color:#ff00ff; font-weight:bold;">急所を貫いた！ ${targetToHit.name}は 息絶えた！</span>`); }
                                    }
                                });
                            }
                        });
                    }

                    // [修正] モンスターなら武器制限を無視、プレイヤーなら制限ありで反撃率を取得
					if (isPhysical && dmg > 0 && Battle.isBattleAlive(targetToHit) && !cmd.isReaction) {
						const isMonster = (targetToHit instanceof Monster);
						const counterRate = (typeof PassiveSkill !== 'undefined') 
							? PassiveSkill.getSumValue(targetToHit, 'counter_rate_mult', isMonster) 
							: 0;

						if (counterRate > 0 && Math.random() * 100 < counterRate) {
							Battle.log(`${targetToHit.name}の 反撃！`);
							await Battle.executeReactionAttack(targetToHit, actor);
							if (!Battle.isBattleAlive(actor)) {
							    Battle.renderEnemies(); Battle.renderPartyStatus();
							    break;
							}
						}
					}

                    if (cmd.type === 'skill' && Battle.isBattleAlive(targetToHit)) applyEffects(targetToHit, data, ailmentChanceMult);

					const isOpposingTarget = cmd.isEnemy
						? Battle.party.includes(targetToHit)
						: Battle.enemies.includes(targetToHit);
					const canTriggerAttackFollowups = () => (
						dmg > 0 &&
						!cmd.isReaction &&
						Battle.isBattleAlive(actor) &&
						Battle.isBattleAlive(targetToHit) &&
						!isSupport &&
						isOpposingTarget
					);

					// --- 連携部分：同陣営の仲間による追撃 ---
					// 回復・補助では発火させず、敵対対象へ実ダメージが出た攻撃だけ判定する。
					if (canTriggerAttackFollowups()) {
						const allies = cmd.isEnemy ? Battle.enemies : Battle.party;
						const partners = allies.filter(p => p && p !== actor && Battle.isBattleAlive(p));

						for (const p of partners) {
							// 仲間の攻撃によってターゲットが死亡した場合は、即座に連携ループを中断
							if (!Battle.isBattleAlive(targetToHit)) break;

							const isMonsterPartner = (p instanceof Monster);
							const chainChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(p, 'chain_rate_mult', isMonsterPartner) : 0;
							
							if (chainChance > 0 && Math.random() * 100 < chainChance) {
								// 実行直前にも生存確認を行う
								if (Battle.isBattleAlive(targetToHit)) {
									Battle.log(`${p.name}が 連携した！`);
									await Battle.executeReactionAttack(p, targetToHit);
								}
							}
						}
					}
					
					// --- 追い討ち部分：自分自身による追撃 ---
					// 連携の発生有無に関わらず、現時点でターゲットが生存・HP50%以下なら判定
					if (canTriggerAttackFollowups()) {
						if (targetToHit.hp <= targetToHit.baseMaxHp * 0.5) {
							const isMonster = (actor instanceof Monster);
							const chaseChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'chase_rate_mult', isMonster) : 0;
							
							if (chaseChance > 0 && Math.random() * 100 < chaseChance) {
								// 最終的な生存確認
								if (Battle.isBattleAlive(targetToHit)) {
									Battle.log(`${actor.name}の 追い討ち！`);
									await Battle.executeReactionAttack(actor, targetToHit);
								}
							}
						}
					}

                    if (!Battle.isBattleAlive(targetToHit)) {
                        Battle.markDefeated(targetToHit, false);
                        Battle.renderEnemies(); Battle.renderPartyStatus();
                        break;
                    }
                    Battle.renderEnemies(); Battle.renderPartyStatus();
                    await Battle.awaitActionVisualPhase();
                    if (hitCount > 1) await Battle.resultWait(150);
                }
            }
            // 二刀流は第1撃の全対象・全ヒット演出を完了してから第2撃へ進む。
            // 第1撃で戦闘不能になった対象は、この待機後の次ループ対象判定から除外される。
            await Battle.awaitActionVisualPhase();
            await Battle.resultWait(100);
        }
    },
	
	/**
     * リアクション系特性（反撃、先制、連携、追い討ち）用の簡易攻撃実行
     */
    executeReactionAttack: async (actor, target) => {
        // 通常攻撃 (ID: 1) のデータを取得
        const attackSkill = DB.SKILLS.find(s => s.id === 1);
        if (!attackSkill || !Battle.isBattleAlive(target) || !Battle.isBattleAlive(actor)) return;

        // 再帰呼び出しを防ぐため、isReaction フラグを立てて processAction を実行
        await Battle.processAction({
            type: 'skill',
            actor: actor,
            target: target,
            data: attackSkill,
            isReaction: true, // 重要：再帰（反撃の反撃など）を防止
            targetScope: '単体',
            isEnemy: !Battle.party.includes(actor)
        });
    },
	
    updateDeadState: () => {
        // 形態変化はモンスターIDを個別判定せず、マスタの phaseTransition 設定を正本にする。
        // これにより第二・第三形態が追加されても同じ戦闘チェーンと図鑑記録で処理できる。
        (Battle.enemies || []).slice().forEach((enemy, index) => {
            if (!enemy || Number(enemy.hp || 0) > 0 || enemy.isFled || enemy.phaseTransitioned || enemy.abyssPhaseTransitioned) return;
            const config = Battle.getPhaseTransitionConfig(enemy);
            if (config) Battle.transitionEnemyPhase(enemy, index, config);
        });

        let partyAuraDirty = false;
        [...Battle.party, ...Battle.enemies].forEach(e => {
            if (e && e.hp <= 0 && !e.isFled) {
                const newlyDead = !e.isDead;
                e.hp = 0;
                e.isDead = true;
                // このターン中に死んだことを記録する。
                e.hasDiedThisTurn = true;
                if (e.status) e.status.defend = false;
                e.battleStatus = { buffs: {}, debuffs: {}, ailments: {} };
                if (newlyDead && Battle.party.includes(e)) partyAuraDirty = true;
            }
        });
        if (partyAuraDirty) Battle.refreshPartyFormationAuras();

        const pillars = (Battle.enemies || []).filter(Battle.isVegnasisPillar);
        if (!pillars.length) return;

        // 全体攻撃で全柱が同時に0になっても、最後に残る一柱の専用段階を必ず作る。
        // 未覚醒の段階で生存柱が0になった場合は、未処理柱の最後の一体をHP1で残す。
        const unhandledDead = pillars
            .filter(enemy => enemy.isDead && !enemy.isFled && !enemy.abyssFallHandled)
            .sort((a, b) => Number(a.linkedDeathIndex ?? Battle.getMonsterBaseById?.(Battle.getUnitBaseId(a))?.linkedDeathIndex ?? 0)
                - Number(b.linkedDeathIndex ?? Battle.getMonsterBaseById?.(Battle.getUnitBaseId(b))?.linkedDeathIndex ?? 0));
        const finalAlreadyAwakened = pillars.some(enemy => enemy.vegnasisFinalAwakened);
        if (!finalAlreadyAwakened && !pillars.some(Battle.isBattleAlive) && unhandledDead.length > 0) {
            const survivor = unhandledDead.pop();
            survivor.hp = 1;
            survivor.isDead = false;
            survivor.isFled = false;
            survivor.hasDiedThisTurn = false;
        }

        // markDefeated() が先に isDead を立てるため、「未処理の死亡柱」を正本にする。
        // 複数同時撃破時も、崩壊会話は柱番号順に積み、最後の覚醒会話は全崩壊会話の後へ積む。
        const newlyFallenPillars = pillars
            .filter(enemy => enemy.isDead && !enemy.isFled && !enemy.abyssFallHandled)
            .sort((a, b) => Number(a.linkedDeathIndex ?? Battle.getMonsterBaseById?.(Battle.getUnitBaseId(a))?.linkedDeathIndex ?? 0)
                - Number(b.linkedDeathIndex ?? Battle.getMonsterBaseById?.(Battle.getUnitBaseId(b))?.linkedDeathIndex ?? 0));

        newlyFallenPillars.forEach(enemy => {
            enemy.abyssFallHandled = true;
            const remaining = pillars.filter(other => Battle.isBattleAlive(other));
            const fallCount = pillars.filter(other => other.abyssFallHandled).length;
            if (App.data?.battle) {
                App.data.battle.vegnasisFallCount = Math.max(Number(App.data.battle.vegnasisFallCount || 0), fallCount);
            }

            // 最終一柱になる前だけ、従来の段階強化を残す。
            // 最終一柱は後段で「初期値の1.5倍」へ再構築するため、累積倍率を持ち込まない。
            if (remaining.length > 1) {
                remaining.forEach(other => {
                    Battle.ensureLinkedInitialState(other);
                    const hpBeforeStrengthening = Math.max(1, Number(other.hp || 1));
                    other.baseMaxHp = Math.max(1, Math.floor(Number(other.baseMaxHp || other.maxHp || other.hp || 1) * 1.18));
                    other.maxHp = other.baseMaxHp;
                    other.baseMaxMp = Math.max(0, Math.floor(Number(other.baseMaxMp || other.maxMp || other.mp || 0) * 1.12));
                    other.maxMp = other.baseMaxMp;
                    const recovery = Math.max(1, Math.floor(other.baseMaxHp * 0.20));
                    other.hp = Math.min(other.baseMaxHp, hpBeforeStrengthening + recovery);
                    other.mp = other.baseMaxMp;
                    ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                        if (other.baseStats?.[key] !== undefined) {
                            other.baseStats[key] = Math.max(1, Math.floor(Number(other.baseStats[key]) * 1.18));
                        }
                        if (other[key] !== undefined) other[key] = Math.max(1, Math.floor(Number(other[key]) * 1.18));
                    });
                });
            }

            const linkedIndex = Number(
                enemy.linkedDeathIndex ??
                Battle.getMonsterBaseById?.(Battle.getUnitBaseId(enemy))?.linkedDeathIndex ??
                0
            ) + 1;
            const baseFallScriptKey = `ABYSS_VEGNASIS_FALL_${Math.max(1, Math.min(5, linkedIndex))}`;
            const profile = Battle.getVegnasisProfile(enemy);
            const fallScriptKey = remaining.length ? `${baseFallScriptKey}_ABSORB` : baseFallScriptKey;
            Battle.saveBattleState();
            Battle.queueBattleConversation(fallScriptKey, {
                persistId: `${fallScriptKey}:${enemy.battleUnitId || Battle.getUnitBaseId(enemy)}:${fallCount}`,
                resumePhase: 'input',
                visualEffect: {
                    type: 'vegnasis-fall',
                    stage: Math.min(4, fallCount),
                    elementKey: profile.elementKey
                }
            });
            if (remaining.length) {
                Battle.log(`${profile.powerName}の力がヴェグナシス本体へ流れ込んだ！`);
            }
        });

        // 四柱の崩壊会話をすべて予約した後で、最後の一柱を専用形態へ覚醒させる。
        const remainingAfterFalls = pillars.filter(Battle.isBattleAlive);
        const handledCount = pillars.filter(enemy => enemy.abyssFallHandled).length;
        if (remainingAfterFalls.length === 1 && handledCount >= pillars.length - 1 &&
            !remainingAfterFalls[0].vegnasisFinalAwakened) {
            const finalPillar = remainingAfterFalls[0];
            Battle.awakenVegnasisFinalPillar(finalPillar);
            const finalProfile = Battle.getVegnasisProfile(finalPillar);
            Battle.saveBattleState();
            if (finalProfile.lastStandConversation) {
                Battle.queueBattleConversation(finalProfile.lastStandConversation, {
                    persistId: `${finalProfile.lastStandConversation}:${finalPillar.battleUnitId || Battle.getUnitBaseId(finalPillar)}`,
                    resumePhase: 'input',
                    visualEffect: {
                        type: 'vegnasis-final',
                        stage: 4,
                        elementKey: finalProfile.elementKey
                    }
                });
            }
        }

    },

    scheduleBattleFinish: (type, delay = 800) => {
        if (!['win', 'loss'].includes(type)) return false;
        if (Battle.finishState !== 'idle') return true;
        const token = `finish-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const battleId = App.data?.battle?.battleId || null;
        const runtimeGeneration = Number(Battle.runtimeGeneration || 0);
        Battle.finishState = 'scheduled';
        Battle.finishToken = token;
        Battle.finishTimerId = Battle.schedule(async () => {
            Battle.finishTimerId = null;
            if (Battle.finishToken !== token || Battle.finishState !== 'scheduled') return;
            const cancelStaleFinish = () => {
                if (Battle.finishToken !== token) return;
                Battle.finishState = 'idle';
                Battle.finishToken = null;
            };
            if (!Battle.active || Battle.phase === 'result') {
                cancelStaleFinish();
                return;
            }
            if (battleId && App.data?.battle?.battleId && String(App.data.battle.battleId) !== String(battleId)) {
                cancelStaleFinish();
                return;
            }
            if (Number(Battle.runtimeGeneration || 0) !== runtimeGeneration) {
                cancelStaleFinish();
                return;
            }
            const stillFinished = type === 'loss'
                ? Battle.party.every(p => p.isDead)
                : Battle.enemies.every(e => e.isDead || e.isFled);
            if (!stillFinished) {
                Battle.finishState = 'idle';
                Battle.finishToken = null;
                if (Battle.active && Battle.phase !== 'result' && !Battle.hasPendingPhaseTransition()) {
                    Battle.scheduleInputRecovery?.('勝敗条件が確定待機中に変化しました。');
                }
                return;
            }
            Battle.finishState = 'processing';
            try {
                if (type === 'loss') await Battle.lose({ finishToken: token });
                else await Battle.win({ finishToken: token });
            } catch (error) {
                console.error(`[Battle] ${type} finalization failed:`, error);
                if (Battle.finishToken === token && Battle.phase !== 'result') {
                    Battle.finishState = 'idle';
                    Battle.finishToken = null;
                }
            }
        }, delay);
        return true;
    },

    checkFinish: () => {
        if (Battle.finishState !== 'idle') return true;
        if (Battle.party.every(p => p.isDead)) return Battle.scheduleBattleFinish('loss', 800);
        if (Battle.enemies.every(e => e.isDead || e.isFled)) return Battle.scheduleBattleFinish('win', 800);
        return false;
    },

    getRandomAliveEnemy: () => {
        const alive = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        if (alive.length === 0) return null;
        return alive[Math.floor(Math.random() * alive.length)];
    },

    getWeakWeightedAliveEnemy: () => {
        const alive = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        if (alive.length === 0) return null;
        if (alive.length === 1) return alive[0];

        // 味方オート用。HP割合が低い敵ほど重くしつつ、完全固定にはしない。
        const weighted = alive.map(e => {
            const maxHp = Math.max(1, Number(e.baseMaxHp || e.maxHp || e.hp || 1));
            const ratio = Math.max(0.01, Math.min(1, Number(e.hp || 0) / maxHp));
            const hpRankBias = Math.max(0, maxHp - Number(e.hp || 0)) / maxHp;
            const weight = 1 + Math.pow(1 - ratio, 2) * 8 + hpRankBias * 3;
            return { enemy: e, weight };
        });

        const total = weighted.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * total;
        for (const item of weighted) {
            roll -= item.weight;
            if (roll <= 0) return item.enemy;
        }
        return weighted[weighted.length - 1].enemy;
    },
	

    isStoryBossTrainingBattle: () => !!App.data?.battle?.storyBossTraining,

    getStoryBossTrainingContext: () => {
        const context = App.data?.battle?.storyBossTraining;
        return context && typeof context === 'object' ? context : null;
    },

    getStoryBossTrainingJournalContext: () => {
        const context = Battle.getStoryBossTrainingContext();
        if (!context) return null;
        return {
            version: Math.max(1, Number(context.version || 1)),
            trainingId: context.trainingId || null,
            opponentName: context.opponentName || null,
            monsterIds: Array.isArray(context.monsterIds) ? context.monsterIds.map(Number).filter(Number.isFinite) : [],
            strengthFloor: Math.max(101, Number(context.strengthFloor || 101)),
            difficultyId: context.difficultyId || null,
            difficultyLabel: context.difficultyLabel || null,
            startedAt: Number(context.startedAt || 0) || null
        };
    },

    restoreStoryBossTrainingPartyState: () => {
        const context = Battle.getStoryBossTrainingContext();
        const snapshot = Array.isArray(context?.partySnapshot) ? context.partySnapshot : [];
        if (!snapshot.length) return false;
        snapshot.forEach(entry => {
            const character = entry?.uid ? App.getChar?.(entry.uid) : null;
            if (!character) return;
            character.currentHp = Math.max(0, Number(entry.currentHp || 0));
            character.currentMp = Math.max(0, Number(entry.currentMp || 0));
            delete character.battleStatus;
            const runtime = Battle.party.find(member => member?.uid === entry.uid);
            if (runtime) {
                runtime.hp = character.currentHp;
                runtime.mp = character.currentMp;
                runtime.isDead = runtime.hp <= 0;
                delete runtime.battleStatus;
            }
        });
        return true;
    },

    getQuestProgressContext: () => {
        const currentMap = (typeof Field !== 'undefined') ? Field.currentMapData : null;
        const areaKey = String(
            (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function' ? Field.getCurrentAreaKey() : '') ||
            App.data?.location?.area ||
            'WORLD'
        );
        return {
            areaKey,
            canonicalAreaKey: String(currentMap?.canonicalAreaKey || areaKey),
            isDungeon: !!(currentMap?.isDungeon || areaKey === 'ABYSS'),
            isFixed: !!currentMap?.isFixed,
            floor: Math.max(1, Number(currentMap?.floor || App.data?.progress?.floor || 1)),
            abyssMode: String(App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode || currentMap?.abyssMode || ''),
            isBossBattle: !!App.data?.battle?.isBossBattle,
            guildPromotionTrial: !!App.data?.battle?.guildPromotionTrial,
            countsForGuildQuests: !App.data?.battle?.excludeGuildQuestProgress
        };
    },

	saveBattleState: () => { 
        const isB = App.data.battle.isBossBattle; 
        const isE = App.data.battle.isEstark; 
        const isS = App.data.battle.isSpecialBoss; 
        const fId = App.data.battle.fixedBossId; 
        const eId = App.data.battle.eventId; // ★eventIdを退避
        const storyWinEventId = App.data.battle.storyWinEventId || null;
        const storyLossEventId = App.data.battle.storyLossEventId || null;
        const fixedStoryEventId = App.data.battle.fixedStoryEventId || null;
        const fixedBossPosition = App.data.battle.fixedBossPosition || null;
        const fixedBossProgressKey = App.data.battle.fixedBossProgressKey || null;
        const fixedQuestId = App.data.battle.fixedQuestId || null;
        const keyReward = App.data.battle.keyReward || App.data.battle.fixedKeyReward || null;
        const bossStatMultiplier = App.data.battle.bossStatMultiplier || App.data.battle.bossScale || null;
        const suppressFixedBossDefeat = !!App.data.battle.suppressFixedBossDefeat;
        const trialEnemyBoost = App.data.battle.trialEnemyBoost || null;
        const angelTrial = App.data.battle.angelTrial || null;
        const fixedHunter = App.data.battle.fixedHunter || null;
        
        App.data.battle.enemies = Battle.enemies.filter(e => !e.isFled).map(Battle.serializeEnemyState).filter(Boolean);
        
        App.data.battle.isBossBattle = isB; 
        App.data.battle.isEstark = isE; 
        App.data.battle.isSpecialBoss = isS; 
        App.data.battle.fixedBossId = fId; 
        App.data.battle.eventId = eId; // ★eventIdを復元
        App.data.battle.isAmbushed = Battle.isAmbushed === true;
        App.data.battle.isPreemptive = Battle.isPreemptive === true;
        App.data.battle.keyReward = keyReward;
        if (keyReward) App.data.battle.fixedKeyReward = keyReward;
        if (storyWinEventId) App.data.battle.storyWinEventId = storyWinEventId;
        if (storyLossEventId) App.data.battle.storyLossEventId = storyLossEventId;
        if (fixedStoryEventId) App.data.battle.fixedStoryEventId = fixedStoryEventId;
        if (fixedBossPosition) App.data.battle.fixedBossPosition = fixedBossPosition;
        if (fixedBossProgressKey) App.data.battle.fixedBossProgressKey = fixedBossProgressKey;
        if (fixedQuestId) App.data.battle.fixedQuestId = fixedQuestId;
        if (bossStatMultiplier) App.data.battle.bossStatMultiplier = bossStatMultiplier;
        if (suppressFixedBossDefeat) App.data.battle.suppressFixedBossDefeat = true;
        if (trialEnemyBoost) App.data.battle.trialEnemyBoost = trialEnemyBoost;
        if (angelTrial) App.data.battle.angelTrial = angelTrial;
        if (fixedHunter) App.data.battle.fixedHunter = fixedHunter;
        
        Battle.party.forEach(p => { 
            const d = (typeof App.getChar === 'function') ? App.getChar(p.uid) : null;
            if(d) { d.currentHp = p.hp; d.currentMp = p.mp; d.battleStatus = p.battleStatus; } 
        }); 
        return App.save();
    },

    escapeAttr: (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),

    cleanMonsterDisplayName: (name) => String(name || '')
        .replace(/^(強・|真・|極・|神・)+/, '')
        .replace(/\s?Lv\d+[A-Z]?$/, '')
        .replace(/[A-Z]$/, '')
        .trim(),

    monsterImagePath: (name) => `assets/monsters/${encodeURIComponent(name)}.png`,

    monsterImageSourceByName: (name, graphicsImages = {}) => {
        const key = 'monster_' + name;
        if (graphicsImages[key]?.src) return graphicsImages[key].src;
        return Battle.monsterImagePath(name);
    },

    resolveMonsterImage: (monster, graphicsImages = {}) => {
        const baseName = Battle.cleanMonsterDisplayName(monster.name);
        const baseDefinition = Battle.getMonsterBaseById(monster?.baseId || monster?.id) || {};
        const imageSource = {
            ...baseDefinition,
            ...monster,
            imageId: monster?.imageId ?? baseDefinition.imageId ?? baseDefinition.baseImageId ?? null
        };
        const imageById = (typeof MonsterData !== 'undefined' && typeof MonsterData.getImagePath === 'function')
            ? MonsterData.getImagePath(imageSource)
            : (window.PRISMA_ASSETS?.getMonsterImagePath?.(imageSource) || null);
        const map = window.MonsterImageMap || {};
        const mapped = map[monster.baseId] || map[monster.id] || map[baseName];
        const mapSrc = mapped
            ? (graphicsImages[mapped]?.src || mapped)
            : null;
        const exactKey = 'monster_' + baseName;
        const exactSrc = imageById || mapSrc || monster.image || monster.img || graphicsImages[exactKey]?.src || Battle.monsterImagePath(baseName);

        let fallbackName = 'ジェリー';
        if (monster.isSpecialBoss || monster.isEstark || Number(monster.id) === 902000 || Number(monster.baseId) === 902000) {
            const legacySpecialImageName = '\u30a8\u30b9\u30bf\u30fc\u30af';
            fallbackName = graphicsImages['monster_' + legacySpecialImageName] ? legacySpecialImageName : '魔王ゼノン';
        }
        else if (monster.isBoss) fallbackName = '魔王ゼノン';
        else if (monster.isRare) fallbackName = 'メタルジェリー';
        else {
            const raceFallbacks = {
                '粘体': 'ジェリー',
                '獣': 'ホーンラビット',
                '獣人': 'ガレオン将軍',
                '精霊': 'ライトウィスプ',
                '植物': 'アビスヴァイン',
                '死霊': 'ゴースト',
                '魔族': 'ベビーデビル',
                '無生物': 'アーマーナイト',
                '機械': '機械兵士',
                '竜': 'レッドドラゴン',
                '竜人': 'りゅうじん',
            };
            fallbackName = raceFallbacks[monster.race] || fallbackName;
        }

        return {
            src: exactSrc,
            fallback: Battle.monsterImageSourceByName(fallbackName, graphicsImages),
        };
    },
	
	renderEnemies: () => {
		const container = Battle.getEl('enemy-container');
		if (!container) return;
		container.innerHTML = '';
		const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};

		const totalCount = Battle.enemies.length;
		const isBoss = App.data.battle ? App.data.battle.isBossBattle : false;
        const vegnasisEnemies = Battle.getSharedVisualMembers('vegnasis');
        const isVegnasisBattle = vegnasisEnemies.length > 0;
        const useFiveEnemyFormation = totalCount === 5 && !isVegnasisBattle;

        container.classList.toggle('enemy-five-formation', useFiveEnemyFormation);
        container.classList.toggle('vegnasis-formation', isVegnasisBattle);
        container.classList.toggle('enemy-two-row-layout', false);
        container.style.position = 'relative';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'flex-end';
        container.style.display = (useFiveEnemyFormation || isVegnasisBattle) ? 'block' : 'flex';

		const hasShowcaseBoss = Battle.enemies.some(enemy => {
            const id = Number(enemy.id);
            const baseId = Number(enemy.baseId);
            return enemy.isSpecialBoss || enemy.isEstark || id === 902000 || baseId === 902000 ||
                id === 401200 || baseId === 401200 ||
                id === 302101 || baseId === 302101;
        });
        const hasSpecialBoss = hasShowcaseBoss && totalCount === 1;

		let widthPerEnemy = 20;
		let scaleFactor = 1.0;
		let maxPixelWidth = 100;
		let paddingBottomVal = "30px";
		let marginTopVal = "5px";

		if (hasSpecialBoss) {
			widthPerEnemy = 65;
			maxPixelWidth = 450;
			paddingBottomVal = "15px";
			marginTopVal = "-30px";
			scaleFactor = 1.2;
		} else if (isBoss && totalCount === 1) {
			widthPerEnemy = 40;
			scaleFactor = 1.0;
			maxPixelWidth = 200;
			paddingBottomVal = "5px";
			marginTopVal = "-10px";
		} else if (isBoss && totalCount === 4) {
			widthPerEnemy = 22;
			scaleFactor = 0.8;
			paddingBottomVal = "0px";
		} else if (isBoss && totalCount === 3) {
			widthPerEnemy = 29;
			scaleFactor = 0.95;
			maxPixelWidth = 155;
			paddingBottomVal = "5px";
			marginTopVal = "-10px";
		} else if (isBoss && totalCount === 2) {
			widthPerEnemy = 37;
			scaleFactor = 1.0;
			maxPixelWidth = 200;
			paddingBottomVal = "5px";
			marginTopVal = "10px";
		} else if (useFiveEnemyFormation) {
			widthPerEnemy = 24;
			scaleFactor = 0.86;
            maxPixelWidth = 118;
            paddingBottomVal = "0px";
            marginTopVal = "-4px";
		} else {
			widthPerEnemy = 30;
			scaleFactor = 1.0;
		}

        const fiveEnemyPosition = (index) => {
            const positions = [
                { left: 24, bottom: 4,  z: 42, width: 22, maxWidth: 108, scale: 0.80, labelTop: '-7px', imgY: '8px' },
                { left: 50, bottom: 0,  z: 52, width: 28, maxWidth: 138, scale: 0.94, labelTop: '-5px', imgY: '9px' },
                { left: 76, bottom: 4,  z: 42, width: 22, maxWidth: 108, scale: 0.80, labelTop: '-7px', imgY: '8px' },
                { left: 39, bottom: 90, z: 18, width: 20, maxWidth: 98,  scale: 0.72, labelTop: '-9px', imgY: '6px' },
                { left: 61, bottom: 90, z: 18, width: 20, maxWidth: 98,  scale: 0.72, labelTop: '-9px', imgY: '6px' },
            ];
            return positions[index] || positions[1];
        };

        Battle.enemies.forEach((e, index) => {
            const sharedVisualGroup = Battle.getSharedVisualGroup(e);
            // ヴェグナシスは内部の五柱を個別管理するが、戦場上は一体のボスとして描画する。
            // 単体対象の選択肢は battle-target-window 側に残すため、ここでは五つのカードを作らない。
            if (isVegnasisBattle && sharedVisualGroup === 'vegnasis') return;

            const div = document.createElement('div');
            const isSharedVisualTarget = !!sharedVisualGroup;
            div.className = `enemy-sprite${isSharedVisualTarget ? ' shared-visual-target' : ''}`;
            div.dataset.battleIndex = String(index);
            if (e.id !== undefined) div.dataset.enemyId = String(e.id);
            if (e.battleUnitId) div.dataset.battleUnitId = String(e.battleUnitId);
            if (sharedVisualGroup) div.dataset.sharedVisualGroup = String(sharedVisualGroup);

            let perEnemyWidth = widthPerEnemy;
            let perEnemyMaxPixelWidth = maxPixelWidth;
            let perEnemyScaleFactor = scaleFactor;
            let perEnemyMarginTopVal = marginTopVal;
            let imgTranslateY = '10px';

            if (isBoss && totalCount === 3 && index === 1) {
                perEnemyWidth = 36;
                perEnemyMaxPixelWidth = 215;
                perEnemyScaleFactor = 1.05;
                perEnemyMarginTopVal = "-18px";
            }

            if (useFiveEnemyFormation) {
                const pos = fiveEnemyPosition(index);
                perEnemyWidth = pos.width;
                perEnemyMaxPixelWidth = pos.maxWidth;
                perEnemyScaleFactor = pos.scale;
                perEnemyMarginTopVal = pos.labelTop;
                imgTranslateY = pos.imgY;
                div.style.cssText = `
                    position: absolute;
                    left: ${pos.left}%;
                    bottom: ${pos.bottom}px;
                    width: ${perEnemyWidth}%;
                    max-width: ${perEnemyMaxPixelWidth}px;
                    margin: 0;
                    overflow: visible;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    align-items: center;
                    padding-bottom: ${paddingBottomVal};
                    transform: translateX(-50%);
                    z-index: ${pos.z};
                `;
            } else {
                div.style.cssText = `
                    position: relative;
                    width: ${perEnemyWidth}%;
                    max-width: ${perEnemyMaxPixelWidth}px;
                    margin: 0 1%;
                    overflow: visible;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    align-items: center;
                    padding-bottom: ${paddingBottomVal};
                `;
            }

            const keepDefeatedVisible = !e.isFled && window.PolishBattleFX &&
                typeof window.PolishBattleFX.shouldKeepDefeatedVisible === 'function' &&
                window.PolishBattleFX.shouldKeepDefeatedVisible(e);
            const defeated = e.isFled || (Number(e.hp || 0) <= 0 && !keepDefeatedVisible);

            if (defeated && !isSharedVisualTarget) {
                div.style.visibility = 'hidden';
                container.appendChild(div);
                return;
            }
            if (keepDefeatedVisible) div.classList.add('enemy-defeat-hold');
            if (defeated && isSharedVisualTarget) div.classList.add('is-defeated');

            const imageInfo = Battle.resolveMonsterImage(e, g);
            const src = Battle.escapeAttr(imageInfo.src);
            const fallback = Battle.escapeAttr(imageInfo.fallback);
            div.style.border = 'none';
            div.style.background = 'transparent';

            const imgHtml = isSharedVisualTarget
                ? ''
                : `<img src="${src}" onerror="this.onerror=null;this.src='${fallback}';" style="
                    width: 100%;
                    aspect-ratio: 1/1;
                    object-fit: contain;
                    object-position: center bottom;
                    filter: drop-shadow(0 4px 4px rgba(0,0,0,0.5));
                    display: block;
                    --enemy-img-y: ${imgTranslateY};
                    transform: translateY(var(--enemy-img-y));
                ">`;

            const displayHp = (window.PolishBattleFX && typeof window.PolishBattleFX.hpDisplayForEnemy === 'function')
                ? window.PolishBattleFX.hpDisplayForEnemy(e, e.hp)
                : e.hp;
            const hpPer = (e.baseMaxHp > 0)
                ? Math.max(0, Math.min(100, (displayHp / e.baseMaxHp) * 100))
                : 0;
            const hpRatio = e.baseMaxHp > 0 ? displayHp / e.baseMaxHp : 0;
            const nameColor = defeated ? '#8b8b8b' : (hpRatio < 0.5 ? '#ff4' : '#fff');
            const statusText = defeated
                ? '<div class="enemy-defeated-label">解放済</div>'
                : '';

            div.innerHTML = `
                ${imgHtml}
                <div class="enemy-status-panel" style="
                    width: ${isSharedVisualTarget ? '100%' : '140%'};
                    margin-top: ${perEnemyMarginTopVal};
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    z-index: 10;
                    pointer-events: none;
                    transform: scale(${perEnemyScaleFactor});
                    transform-origin: top center;
                    text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;">
                    <div class="enemy-name" style="font-size:${isSharedVisualTarget ? '9px' : '10px'}; color:${nameColor}; font-weight:bold; white-space:nowrap; margin-bottom:2px;">${e.name}</div>
                    <div class="enemy-hp-bar" style="width:${isSharedVisualTarget ? '92%' : '60%'}; height:${isSharedVisualTarget ? '7px' : '4px'}; border:1px solid #000; background:#333; border-radius:3px;">
                        <div class="enemy-hp-val" style="width:${defeated ? 0 : hpPer}%; height:100%; background:#ff4444; transition:width 0.2s; border-radius:2px;"></div>
                    </div>
                    ${statusText}
                </div>`;

            if (!defeated) {
                div.onclick = (event) => {
                    event.stopPropagation();
                    if (Battle.phase === 'target_select' &&
                        (Battle.selectingAction === 'attack' || Battle.selectingAction === 'skill')) {
                        Battle.selectTarget(e);
                    }
                };
            }
            container.appendChild(div);
        });

        if (isVegnasisBattle) {
            const visibleMembers = vegnasisEnemies.filter(enemy => {
                if (Battle.isBattleAlive(enemy)) return true;
                return !enemy.isFled && window.PolishBattleFX &&
                    typeof window.PolishBattleFX.shouldKeepDefeatedVisible === 'function' &&
                    window.PolishBattleFX.shouldKeepDefeatedVisible(enemy);
            });
            const sourceEnemy = visibleMembers[0] || null;

            // 五柱は一枚の画像を共有する。1〜4柱目の撃破では残し、
            // 最後の柱の撃破エフェクトが完了した時だけ共有画像と統合HP表示を消す。
            if (sourceEnemy) {
                const profile = Battle.getSharedVisualProfile('vegnasis');
                const hpSummary = Battle.getSharedVisualHpSummary('vegnasis');
                const imageInfo = Battle.resolveMonsterImage?.(sourceEnemy, g);
                if (imageInfo?.src) {
                    const sharedVisual = document.createElement('div');
                    sharedVisual.className = 'shared-enemy-visual vegnasis-shared-visual';
                    sharedVisual.dataset.sharedVisualGroup = 'vegnasis';
                    sharedVisual.setAttribute('aria-label', [profile.title, profile.name].filter(Boolean).join(' '));
                    const sharedImage = document.createElement('img');
                    sharedImage.alt = [profile.title, profile.name].filter(Boolean).join(' ');
                    sharedImage.src = imageInfo.src;
                    sharedImage.onerror = () => {
                        if (imageInfo.fallback) sharedImage.src = imageInfo.fallback;
                    };
                    sharedVisual.appendChild(sharedImage);
                    container.appendChild(sharedVisual);
                }

                const bossHud = document.createElement('div');
                bossHud.className = 'vegnasis-boss-hud';
                bossHud.dataset.sharedVisualGroup = 'vegnasis';
                bossHud.setAttribute('role', 'group');
                bossHud.setAttribute('aria-label', profile.name);
                const hpRatio = hpSummary.maxHp > 0 ? hpSummary.currentHp / hpSummary.maxHp : 0;
                const nameColor = hpRatio < 0.5 ? '#ff4' : '#fff';
                bossHud.innerHTML = `
                    <div class="enemy-status-panel" style="
                        width:140%;
                        margin-top:-30px;
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        z-index:10;
                        pointer-events:none;
                        transform:scale(1.2);
                        transform-origin:top center;
                        text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;">
                        <div class="enemy-name" style="font-size:10px;color:${nameColor};font-weight:bold;white-space:nowrap;margin-bottom:2px;">${Battle.escapeHtml(profile.name)}</div>
                        <div class="enemy-hp-bar vegnasis-aggregate-hp-bar" role="progressbar"
                            aria-label="${Battle.escapeAttr(profile.name)}のHP"
                            aria-valuemin="0"
                            aria-valuemax="${hpSummary.maxHp}"
                            aria-valuenow="${hpSummary.currentHp}"
                            style="width:60%;height:4px;border:1px solid #000;background:#333;border-radius:3px;">
                            <div class="enemy-hp-val vegnasis-aggregate-hp-value" style="width:${hpSummary.percent}%;height:100%;background:#ff4444;transition:width 0.2s;border-radius:2px;"></div>
                        </div>
                    </div>`;
                container.appendChild(bossHud);
            }
        }
    },

    renderPartyStatus: () => {
        const container = Battle.getEl('battle-party-bar'); if(!container) return;
        container.innerHTML = '';
        Battle.party.forEach((p, index) => {
            const div = document.createElement('div'); div.className = 'p-box'; div.style.justifyContent = 'flex-start'; div.style.paddingTop = '2px';
            div.dataset.battleIndex = String(index);
            if (p.uid) div.dataset.battleUid = String(p.uid);
            const hpPer = (p.baseMaxHp > 0) ? (p.hp / p.baseMaxHp) * 100 : 0; const mpPer = (p.baseMaxMp > 0) ? (p.mp / p.baseMaxMp) * 100 : 0;
            const isActor = (Battle.phase === 'input' && index === Battle.currentActorIndex);
            if(isActor) { div.style.border = "2px solid #ffd700"; div.style.background = "#333"; }
            let nameStyle = p.isDead ? 'color:red; text-decoration:line-through;' : 'color:white;';
			
            const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(p) : p.img;
            const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(p) : '';
            const imgHtml = imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:1px;">` : `<div style="width:32px; height:32px; background:#222; border-radius:4px; border:1px solid #444; display:flex; align-items:center; justify-content:center; color:#555; font-size:8px; margin-bottom:1px;">IMG</div>`;
            
            // --- 消えていた部分を復活 ---
            div.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; width:100%; overflow:hidden;">
                    ${imgHtml}
                    <div style="font-size:10px; font-weight:bold; ${nameStyle} overflow:hidden; white-space:nowrap; width:100%; text-align:center; line-height:1.2;">${p.name}</div>
                    <div style="font-size:8px; color:#aaa; margin-bottom:2px; line-height:1;">${p.job} Lv.${p.level}</div>
                </div>
                <div style="width:100%;">
                    <div class="bar-container"><div class="bar-hp" style="width:${hpPer}%"></div></div>
                    <div class="p-val">${p.hp}/${p.baseMaxHp}</div>
                    <div class="bar-container"><div class="bar-mp" style="width:${mpPer}%"></div></div>
                    <div class="p-val">${p.mp}/${p.baseMaxMp}</div>
                </div>
            `;
			
            div.onclick = () => { 
                if(Battle.phase !== 'input') return;
                Battle.openStatusModal(index);
            };
            
            container.appendChild(div);
        });
    },
	

    // --- ステータスモーダル制御 ---
    statusModalTargetIndex: 0,

    openStatusModal: (index) => {
        const modal = document.getElementById('battle-status-modal');
        if (modal) {
            Battle.statusModalTargetIndex = index;
            modal.style.display = 'flex';
            Battle.renderStatusModalContent();
        }
    },

    closeStatusModal: () => {
        const modal = document.getElementById('battle-status-modal');
        if (modal) modal.style.display = 'none';
    },

    switchStatusChar: (dir) => {
        const partySize = Battle.party.length;
        if (partySize === 0) return;

        Battle.statusModalTargetIndex += dir;
        if (Battle.statusModalTargetIndex >= partySize) Battle.statusModalTargetIndex = 0;
        if (Battle.statusModalTargetIndex < 0) Battle.statusModalTargetIndex = partySize - 1;

        Battle.renderStatusModalContent();
    },

    renderStatusModalContent: () => {
        const char = Battle.party[Battle.statusModalTargetIndex];
        if (!char) return;

        // 名前更新
        const nameEl = document.getElementById('modal-char-name');
        if (nameEl) nameEl.innerText = char.name;

        // コンテンツ生成
        const contentEl = document.getElementById('modal-char-content');
        if (!contentEl) return;

        const maxHp = char.baseMaxHp;
        const maxMp = char.baseMaxMp;
        const hpPer = Math.floor((char.hp / maxHp) * 100);
        const mpPer = Math.floor((char.mp / maxMp) * 100);
		
        const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(char) : char.img;
        const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(char) : '';

        // ★修正箇所: char.img ではなく imgUrl を使用
        let html = `
            <div style="display:flex; align-items:center; margin-bottom:10px;">
                <div style="width:48px; height:48px; border:1px solid #555; margin-right:10px; border-radius:4px; overflow:hidden; display:flex; justify-content:center; align-items:center; background:#333;">
                    ${imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:10px; color:#888;">IMG</span>'}
                </div>
                <div style="flex:1;">
                    <div style="font-size:12px; color:#aaa; margin-bottom:2px;">${char.job} Lv.${char.level}</div>
                    
                    <div style="display:flex; align-items:center; font-size:10px; margin-bottom:2px;">
                        <span style="width:20px; color:#f88; font-weight:bold;">HP</span>
                        <div style="flex:1; height:4px; background:#333; margin:0 5px; border-radius:2px;"><div style="width:${hpPer}%; height:100%; background:#f44; border-radius:2px;"></div></div>
                        <span style="width:85px; text-align:right; letter-spacing:-0.5px;">${char.hp}/${maxHp}</span>
                    </div>

                    <div style="display:flex; align-items:center; font-size:10px;">
                        <span style="width:20px; color:#88f; font-weight:bold;">MP</span>
                        <div style="flex:1; height:4px; background:#333; margin:0 5px; border-radius:2px;"><div style="width:${mpPer}%; height:100%; background:#48f; border-radius:2px;"></div></div>
                        <span style="width:85px; text-align:right; letter-spacing:-0.5px;">${char.mp}/${maxMp}</span>
                    </div>
                </div>
            </div>
            <div style="border-top:1px solid #444; padding-top:8px;">
                <div style="font-size:11px; color:#aaa; margin-bottom:4px;">状態変化</div>
        `;

        // バフ・デバフ一覧作成
        const statusList = [];
        const b = char.battleStatus;
        if (b) {
            // 状態異常 (Ailments) - 変更なし
            for (let key in b.ailments) {
                const turns = b.ailments[key].turns;
                const name = Battle.statNames[key] || key;
                statusList.push(`<div style="color:#f88;">● ${name} <span style="font-size:10px; color:#aaa;">(${turns}T)</span></div>`);
            }

            // バフ (Buffs) - ★修正: 耐性系の表示対応
            for (let key in b.buffs) {
                const turns = b.buffs[key].turns;
                const val = b.buffs[key].val;
                const tStr = (turns !== null && turns !== undefined) ? `${turns}T` : '∞';
                
                let name = Battle.statNames[key] || key;
                let valStr = '';

                // 全属性耐性
                if(key === 'elmResUp') {
                    name = '全属性耐性';
                    valStr = `(+${val}%)`;
                }
                // ★追加: 状態異常耐性 (resists_XX)
                else if (key.startsWith('resists_')) {
                    const baseKey = key.replace('resists_', '');
                    const label = Battle.statNames[baseKey] || baseKey;
                    name = `${label}耐性`; // 例: 毒耐性
                    valStr = `(+${val}%)`;
                }
                // HP/MPリジェネ
                else if(key === 'HPRegen' || key === 'MPRegen') {
                    valStr = ''; // リジェネは数値表示なし
                }
                // 通常ステータス (倍率表示)
                else {
                    valStr = `(x${val.toFixed(2)})`;
                }
                
                statusList.push(`<div style="color:#8f8;">▲ ${name}${valStr} <span style="font-size:10px; color:#aaa;">(${tStr})</span></div>`);
            }

            // デバフ (Debuffs) - ★修正: 耐性系の表示対応
            for (let key in b.debuffs) {
                const turns = b.debuffs[key].turns;
                const val = b.debuffs[key].val;
                const tStr = (turns !== null && turns !== undefined) ? `${turns}T` : '∞';
                
                let name = Battle.statNames[key] || key;
                let valStr = '';

                // 全属性耐性ダウン
                if(key === 'elmResDown') {
                    name = '全属性耐性';
                    valStr = `(${val}%)`; // マイナス表記は▼で表現されるので数値はそのまま
                }
                // ★追加: 状態異常耐性ダウン (resists_XX)
                else if (key.startsWith('resists_')) {
                    const baseKey = key.replace('resists_', '');
                    const label = Battle.statNames[baseKey] || baseKey;
                    name = `${label}耐性`;
                    valStr = `(-${val}%)`;
                }
                // 通常ステータス (倍率表示)
                else {
                    valStr = `(x${val.toFixed(2)})`;
                }

                statusList.push(`<div style="color:#88f;">▼ ${name}${valStr} <span style="font-size:10px; color:#aaa;">(${tStr})</span></div>`);
            }
        }

        if (statusList.length === 0) {
            html += `<div style="color:#666; font-size:12px; text-align:center; padding:10px;">なし</div>`;
        } else {
            html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">${statusList.join('')}</div>`;
        }

        html += `</div>`;
        contentEl.innerHTML = html;
    },
	
    tryCreateSkillBookDrop: (enemy, drops, rateMultiplier = 1) => {
        const chance = Math.min(1, 0.005 * Math.max(0, Number(rateMultiplier || 1)));
        if (!enemy || enemy.isFled || !enemy.isDead || Math.random() >= chance) return false;
        if (typeof App === 'undefined' || typeof App.extractMonsterSkillIds !== 'function' || typeof App.getSkillBookItemId !== 'function') return false;
        const base = Battle.getMonsterBaseById(enemy.baseId || enemy.id) || enemy;
        const skillIds = Array.from(new Set([
            ...App.extractMonsterSkillIds(base),
            ...App.extractMonsterSkillIds(enemy)
        ].map(Number).filter(id => Number.isFinite(id) && id >= 100)));
        if (!skillIds.length) return false;
        const skillId = skillIds[Math.floor(Math.random() * skillIds.length)];
        const itemId = App.getSkillBookItemId(skillId);
        const itemDef = DB.ITEMS.find(item => Number(item.id) === Number(itemId));
        if (!itemDef) return false;
        if (!App.data.items || typeof App.data.items !== 'object') App.data.items = {};
        App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
        drops.push({ name: itemDef.name, isRare: true, type: enemy.isBoss ? 'boss' : 'rare', kind: 'item', isSkillBook: true });
        return true;
    },

    prepareMonsterSkillEvolutionAfterBattle: () => {
        if (typeof App === 'undefined' || typeof App.getMonsterSkillEvolution !== 'function') return null;
        const candidates = Battle.party.map(member => member?.uid ? App.getChar(member.uid) : null)
            .filter((character, index, array) => character && App.isMonsterAlly?.(character) && array.indexOf(character) === index);
        for (const character of candidates) {
            const evolutions = (Array.isArray(character.skills) ? character.skills : []).map(Number)
                .filter(id => Number.isFinite(id) && id >= 100)
                .map(id => ({ fromId: id, to: App.getMonsterSkillEvolution(id) }))
                .filter(entry => entry.to && !(character.skills || []).map(Number).includes(Number(entry.to.id)));
            if (!evolutions.length || Math.random() >= 0.02) continue;
            const selected = evolutions[Math.floor(Math.random() * evolutions.length)];
            return {
                id: `skill-evo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                status: 'pending',
                charUid: character.uid,
                fromId: Number(selected.fromId),
                toId: Number(selected.to.id),
                toName: selected.to.name || `スキル${selected.to.id}`
            };
        }
        return null;
    },

    resolveMonsterSkillEvolution: async (candidate) => {
        if (!candidate || candidate.status === 'resolved') return null;
        const character = App.getChar?.(candidate.charUid);
        const to = DB.SKILLS.find(skill => Number(skill.id) === Number(candidate.toId));
        const from = DB.SKILLS.find(skill => Number(skill.id) === Number(candidate.fromId));
        if (!character || !to || !(character.skills || []).map(Number).includes(Number(candidate.fromId))) {
            candidate.status = 'resolved';
            candidate.accepted = false;
            candidate.resolvedAt = Date.now();
            App.save();
            return null;
        }
        const accepted = await new Promise(resolve => {
            if (typeof Menu === 'undefined' || typeof Menu.confirm !== 'function') {
                resolve(false);
                return;
            }
            Menu.confirm(`${character.name}の「${from?.name || `スキル${candidate.fromId}`}」が
「${to.name}」へ成長しそうだ！
変化させますか？`, () => resolve(true), () => resolve(false));
        });
        if (accepted) {
            character.skills = Array.from(new Set((character.skills || []).map(Number)
                .map(id => id === Number(candidate.fromId) ? Number(candidate.toId) : id))).slice(0, 8);
            character.skillBookSkills = [];
            App.remapCharacterSkillConfig?.(character, Number(candidate.fromId), Number(candidate.toId));
            App.ensureCharacterBattleConfig?.(character);
        }
        candidate.status = 'resolved';
        candidate.accepted = accepted;
        candidate.resolvedAt = Date.now();
        if (App.data?.progress?.pendingMonsterSkillEvolution?.id === candidate.id) {
            delete App.data.progress.pendingMonsterSkillEvolution;
        }
        App.save();
        return accepted
            ? `<span style="color:#7fffd4; font-weight:bold;">${Battle.escapeHtml(character.name)}の「${Battle.escapeHtml(from?.name || `スキル${candidate.fromId}`)}」が「${Battle.escapeHtml(to.name)}」へ成長した！</span>`
            : null;
    },

    tryMonsterSkillEvolutionAfterBattle: async () => {
        const journalCandidate = App.data?.battle?.resultJournal?.pendingMonsterSkillEvolution || null;
        return Battle.resolveMonsterSkillEvolution(journalCandidate);
    },

    resumePendingMonsterSkillEvolution: () => {
        const candidate = App.data?.progress?.pendingMonsterSkillEvolution;
        if (!candidate || candidate.status === 'resolved') return false;
        (async () => {
            const log = await Battle.resolveMonsterSkillEvolution(candidate);
            if (log) App.log(log);
        })();
        return true;
    },

	win: async (options = {}) => {
        const requestedToken = options.finishToken || Battle.finishToken ||
            `finish-win-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        if (Battle.finishState === 'finalized' || Battle.finishState === 'committed') return false;
        if (Battle.finishState === 'processing' && Battle.finishToken && Battle.finishToken !== requestedToken) return false;
        Battle.finishState = 'processing';
        Battle.finishToken = requestedToken;

        let rollbackSerialized = null;
        let transactionCommitted = false;
        try {
            rollbackSerialized = (typeof App.serializeSaveData === 'function')
                ? App.serializeSaveData(App.data)
                : JSON.stringify(App.data);
            if (!App.data.battle) App.data.battle = { active: true };
            if (!App.data.battle.battleId) {
                App.data.battle.battleId = `battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
            }
            App.data.battle.resultJournal = {
                version: 2,
                battleId: App.data.battle.battleId || null,
                type: 'win',
                status: 'preparing',
                finishToken: requestedToken,
                startedAt: Date.now()
            };
            // preparingは戦闘activeのまま保存する。保存できなければ副作用へ進まない。
            if (App.save() === false) throw new Error('勝利結果の準備状態を保存できませんでした。');
            if (typeof App.beginSaveTransaction === 'function') App.beginSaveTransaction();
		// --- [修正の要点] 演出前に戦闘を「非アクティブ」にし、内部処理を完結させる ---
		// これにより、演出中のリロード時に戦闘シーンに戻る（＝再度報酬が貰える）のを防ぎます
		Battle.phase = 'result'; 
		Battle.active = false;
		Battle.resultProcessing = true;
		Battle.resultReadyToEnd = false;
        Battle.resultEndIsGameOver = false;
        Battle.resultInputLocked = false;
        Battle.resultAdvanceResolver = null;
		Battle.resultSkipRequested = false;
        Battle.resultLevelSkipActive = false;
		Battle.resultWaiters = [];
        Battle.updateResultLevelSkipButton?.();
		if (App.data.battle) App.data.battle.active = false;
        // 保存トランザクションは開始済み。

        const isEstark = App.data.battle && (App.data.battle.isSpecialBoss || App.data.battle.isEstark);
        const isBossBattle = App.data.battle && App.data.battle.isBossBattle;
        const eventId = (App.data.battle && App.data.battle.eventId) ? App.data.battle.eventId : null;
        const storyWinEventId = App.data.battle?.storyWinEventId || null;
        const fixedStoryEventId = App.data.battle?.fixedStoryEventId || null;
        const keyReward = App.data.battle?.keyReward || App.data.battle?.fixedKeyReward || null;
        const fixedHunter = App.data.battle?.fixedHunter || null;
        const guildPromotionTarget = App.data.battle?.guildPromotionTarget || null;
        const isTrainingBattle = Battle.isStoryBossTrainingBattle();
        const trainingJournalContext = Battle.getStoryBossTrainingJournalContext();
        const abyssRiftResultContext = Battle.captureAbyssRiftResultContext(App.data?.battle, App.data?.dungeon);
        let guildPromotionMessage = null;
		
		// 戦闘データはフィールド復帰時に初期化されるため、勝利後会話で使う
		// ボス画像・座標をイベント予約と同時に progress へ退避する。
		const postBattleVisualEventId = storyWinEventId || fixedStoryEventId || eventId;
		const postBattleVisualPhase = (storyWinEventId || fixedStoryEventId) ? 'actions' : 'win';
		if (isBossBattle && postBattleVisualEventId && typeof StoryManager !== 'undefined' &&
			typeof StoryManager.capturePostBattleBossVisualContext === 'function') {
			StoryManager.capturePostBattleBossVisualContext(postBattleVisualEventId, App.data.battle, postBattleVisualPhase);
		}

		// 戦後イベントは削除先行の単一スロットではなく、token付きキューへ確定する。
		if (isBossBattle && eventId) {
            const phase = storyWinEventId ? 'actions' : 'win';
            const queuedEventId = storyWinEventId || eventId;
            if (typeof StoryManager !== 'undefined' && typeof StoryManager.queueEvent === 'function') {
                StoryManager.queueEvent(queuedEventId, phase, {
                    save: false,
                    dedupeKey: `battle:${App.data.battle?.battleId || App.data.battle?.battleChainId || 'unknown'}:${phase}:${queuedEventId}`,
                    meta: { battleChainId: App.data.battle?.battleChainId || null }
                });
            } else {
                if (!App.data.progress) App.data.progress = {};
                if (storyWinEventId) App.data.progress.pendingEventId = storyWinEventId;
                else App.data.progress.pendingBattleWinEventId = eventId;
            }
		}
		
		// ★ドロップ品質を決定する基準階層(floor)の計算
		let floor = App.data.progress.floor || 1;

		if (Field.currentMapData && Field.currentMapData.isFixed) {
			// 1. 固定ダンジョンの場合: マップデータの rank を使用
			floor = Field.currentMapData.rank || 1;
		} else if (!Field.currentMapData || Field.currentMapData.id === 'WORLD') {
			// 2. フィールド（ワールドマップ）の場合: storystep * 5 を使用
			const step = App.data.progress.storyStep || 0;
			floor = Math.max(1, step * 5); // 0にならないよう最低1を担保
		} else if (App.data?.location?.area === 'ABYSS' &&
            (globalThis.ABYSS_FLOOR_RULES?.isRandomMode?.(App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode) ||
             globalThis.ABYSS_FLOOR_RULES?.isMemoryMode?.(App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode))) {
            // 3. ランダム深淵は表示階層ではなく旧来のバランス階層で報酬を決める。
            floor = Math.max(1, Number(
                App.data?.battle?.abyssBalanceFloor ||
                Field.currentMapData?.balanceFloor ||
                globalThis.ABYSS_FLOOR_RULES.getBalanceFloor(
                    App.data?.battle?.abyssFloor || App.data?.progress?.floor || 1,
                    App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode || 'random'
                )
            ) || 1);
		}
		// 4. 物語深淵・ギルド依頼迷宮は従来どおり表示階層を使用する。

			let totalExp = 0, totalGold = 0;
			const drops = [];
            // 形態変化前に倒した形態も、最終形態と同じ戦闘結果へ含める。
            // マスタの phaseTransition 設定だけで第二・第三形態以降も図鑑・討伐数・報酬へ記録される。
            const defeatedResultEnemies = Battle.collectDefeatedEnemiesForResult();
            const rewardResultEnemies = isTrainingBattle ? [] : defeatedResultEnemies;
			const defeatedMonsterIds = [];
		let hasRareDrop = false;      // 白フラッシュ用
		let hasUltraRareDrop = false; // 赤黒フラッシュ用

		// --- [1] 内部データ集計（討伐数・図鑑・経験値・ゴールドの計算） ---
		rewardResultEnemies.forEach(e => {
			if (e.isDead && !e.isFled) {
				const id = e.baseId || e.id;
					if (id) {
						defeatedMonsterIds.push(Number(id));
						if (!App.data.book.killCounts) App.data.book.killCounts = {};
					App.data.book.killCounts[id] = (App.data.book.killCounts[id] || 0) + 1;
					if (!App.data.book.monsters.includes(id)) App.data.book.monsters.push(id);
				}
				const base = Battle.getMonsterBaseById(id);
				if(base) {
					// 深層生成・裂け目・マップ補正で個体報酬が設定された場合は、その確定値を使う。
					// 固定敵はインスタンスに報酬を持たないため、従来どおりマスタ値へフォールバックする。
					totalExp += Battle.getEnemyRewardValue(e, base, 'exp');
					totalGold += Battle.getEnemyRewardValue(e, base, 'gold');
				}
			}
		});

		// 討伐系クエストの進捗は、勝利時に確定した全撃破個体から一度だけ更新する。
		// ダンジョン指定のギルド依頼は戦闘場所も判定し、施設内で開始する昇格試験は除外する。
		if (!isTrainingBattle && typeof App.noteQuestKills === 'function') {
			App.noteQuestKills(defeatedMonsterIds, Battle.getQuestProgressContext(), { save: false });
		}

		// 報酬の内部加算処理（ログを出す前に実行）
		App.data.gold += totalGold;

		const surviveMembers = Battle.party.filter(p => Battle.isBattleAlive(p));
        const activeMemberByUid = new Map(Battle.party.filter(Boolean).map(member => [String(member.uid), member]));
        const expRecipients = (Array.isArray(App.data?.characters) ? App.data.characters : [])
            .filter(charData => charData?.uid)
            .map(charData => {
                const battleMember = activeMemberByUid.get(String(charData.uid)) || null;
                const active = !!battleMember;
                const alive = active && Battle.isBattleAlive(battleMember);
                return {
                    charData,
                    battleMember,
                    active,
                    alive,
                    rate: active ? (alive ? 1 : 0.5) : 0.25
                };
            });
		const lbGrowthLogs = (!isTrainingBattle && typeof App.noteBattleVictory === 'function')
			? App.noteBattleVictory(Battle.party.filter(p => p))
			: [];
        if (!isTrainingBattle && typeof Dungeon !== 'undefined' && typeof Dungeon.completeAngelTrialIfNeeded === 'function') {
            lbGrowthLogs.push(...Dungeon.completeAngelTrialIfNeeded());
        }
        const randomHunterContext = !isTrainingBattle && App.data?.battle?.randomHunter
            ? JSON.parse(JSON.stringify(App.data.battle.randomHunter))
            : null;
        const randomHunterDefeated = randomHunterContext && typeof Dungeon !== 'undefined'
            && typeof Dungeon.completeRandomHunterBattle === 'function'
            ? Dungeon.completeRandomHunterBattle(randomHunterContext)
            : false;
        const randomHunterOutcome = randomHunterContext ? {
            hunterId:String(randomHunterContext.id || ''),
            defeated:randomHunterDefeated === true,
            targetFloor:Math.max(1, Number(randomHunterContext.targetFloor || 1)),
            enemyCount:Math.max(1, Number(randomHunterContext.enemyCount || 3))
        } : null;
        const battleRewardRateModifiers = Battle.getBattleRewardRateModifiers(App.data?.battle);
        const rareDropMultiplier = battleRewardRateModifiers.rareDropMultiplier;
		
		// 特性「56:解体」のパーティ合計値算出
		let bonusNormal = 0, bonusRare = 0, bonusPlus3 = 0;
		surviveMembers.forEach(p => {
			const charData = App.getChar(p.uid);
			if (charData && typeof PassiveSkill !== 'undefined') {
				bonusNormal += PassiveSkill.getSumValue(charData, 'drop_normal_pct');
				bonusRare   += PassiveSkill.getSumValue(charData, 'drop_rare_pct');
				bonusPlus3  += PassiveSkill.getSumValue(charData, 'equip_plus3_pct');
			}
		});
        // 特殊階層の「+3抽選加算」は、装備特性による加算と同じ百分率ポイントとして扱う。
        bonusPlus3 += battleRewardRateModifiers.equipPlus3BonusPct;

		// オプション再抽選サブ関数 (内部用)
		const createEquipWithMinRarity = (floor, plus, minRarityList, forcePart = null) => {
			let eq = App.createEquipByFloor('drop', floor, plus);
			if (forcePart && eq.type !== forcePart) {
				let attempts = 0;
				while (eq.type !== forcePart && attempts < 50) {
					eq = App.createEquipByFloor('drop', floor, plus);
					attempts++;
				}
			}
			eq.opts = eq.opts.map(opt => {
				const rule = DB.OPT_RULES.find(r => r.key === opt.key);
				if (!rule) return opt;
				let r = opt.rarity;
				let att = 0;
				while (!minRarityList.includes(r) && att < 15) {
					const rarRnd = Math.random() + 0.3; 
					if(rarRnd > 0.95 && rule.allowed.includes('EX')) r='EX';
					else if(rarRnd > 0.80 && rule.allowed.includes('UR')) r='UR';
					else if(rarRnd > 0.65 && rule.allowed.includes('SSR')) r='SSR';
					else if(rarRnd > 0.45 && rule.allowed.includes('SR')) r='SR';
					else r='R';
					att++;
				}
				const min = rule.min[r]||1, max = rule.max[r]||10;
				return { ...opt, rarity: r, val: Math.floor(Math.random()*(max-min+1))+min };
			});
			return eq;
		};

		// --- [2] 報酬アイテムの生成と確定 ---
		let specialBossOutcome = null;
		if (isEstark) {
			const specialEnemy = rewardResultEnemies.find(e => e.isSpecialBoss || e.isEstark || Number(e.id) === 902000 || Number(e.baseId) === 902000);
			if (specialEnemy) {
				const specialId = Number(specialEnemy.baseId || specialEnemy.id || 902000);
				const completedDefeats = Math.max(1, Math.floor(Number(App.data.book?.killCounts?.[specialId]) || 1));
				specialBossOutcome = Battle.applySpecialBossVictoryOutcome(specialEnemy, {
					completedDefeats,
					drops,
					bonusRare,
					bonusNormal,
					createEquipment:createEquipWithMinRarity
				});
				if (specialBossOutcome?.equipmentName || specialBossOutcome?.linkedRareDropId) hasUltraRareDrop = true;
				if (specialBossOutcome?.rareDropId || specialBossOutcome?.linkedRareDropId) hasRareDrop = true;
			}
		} else {
			rewardResultEnemies.forEach(e => {
				if (e.isFled) return;
				const base = Battle.getMonsterBaseById(e.baseId || e.id) || e;
				// 追憶の魔境では元モンスター固有の低Rank／物語ボス報酬を持ち込まず、
				// 強化後Rankに連動する汎用ドロップへ統一する。
				const monsterDrops = (e.memoryRealm && !e.memoryRarePreserveDrops) ? null : base.drops;
				const rewardFloor = Battle.getEquipmentRewardFloor(e, floor);

				// 1. レアドロップ判定 (独立)
				if (monsterDrops && monsterDrops.rare) {
					if (Battle.rollConfiguredDrop(monsterDrops.rare, bonusRare, rareDropMultiplier)) {
						const itemDef = DB.ITEMS.find(i => i.id === monsterDrops.rare.id);
						if (itemDef) {
							App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
							hasRareDrop = true;
							const type = (itemDef.id === 107) ? 'kai' : 'boss';
							drops.push({ name: itemDef.name, isRare: true, type: type, kind: 'item' });
						}
					}
				} else if (floor >= 100) {
					if (Math.random() * 100 < Math.min(100, (0.5 + bonusRare) * rareDropMultiplier)) {
						let sid = 100 + Math.floor(Math.random() * 6);
						if (Math.random() < 0.1) sid = 106;
						if (Math.random() < 0.05) sid = 107;
						const itemDef = DB.ITEMS.find(i => i.id === sid);
						if (itemDef) {
							App.data.items[sid] = (App.data.items[sid] || 0) + 1;
							const isRare = (sid === 107);
							if (isRare) hasRareDrop = true;
							drops.push({ name: itemDef.name, isRare: isRare, type: isRare ? 'kai' : 'item', kind: 'item' });
						}
					}
				}
				
				// 2. 装備ドロップ判定 (独立)
				// 雑魚枠で出た物語ボスは、外見と仲間化IDだけを保持し報酬上は通常敵として扱う。
				const isBoss = e.isStoryBossEcho ? false : (e.memoryRealm ? !!e.isBoss : !!(base.isBoss || e.isBoss));
				const equipChance = isBoss ? 100 : 8;
				if (Math.random() * 100 < equipChance) {
					let eq;
					if (isBoss && Math.random() < 0.02) {
						// 2%の確率で発生する超強力な「改」装備
						eq = createEquipWithMinRarity(rewardFloor, 3, ['SSR', 'UR', 'EX'], '武器');
						eq.name = eq.name.replace(/\+3$/, "") + "・改+3";
						
						// ★追加修正：能力増加は基礎値（主要7ステータス）のみとする
						const BASE_SCALE_KEYS = new Set(['atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp']);
						for (let key in eq.data) {
							if (!BASE_SCALE_KEYS.has(key)) continue;
							if (typeof eq.data[key] === 'number') {
								eq.data[key] *= 2; // 基礎ステータスを2倍
							}
						}
						
						eq.val *= 4;
						hasUltraRareDrop = true;
						// 超レア演出用の type: 'kai'
						drops.push({ name: eq.name, isRare: true, type: 'kai', kind: 'equip' });
					} else {
						let fixedPlus = isBoss ? 3 : (Math.random() * 100 < (10 + bonusPlus3) ? 3 : 2);
						eq = App.createEquipByFloor('drop', rewardFloor, fixedPlus);
						const isPlus3 = (eq.plus === 3);
						if (isPlus3 || isBoss) hasRareDrop = true;
						drops.push({ name: eq.name, isRare: (isPlus3 || isBoss), type: isBoss ? 'boss' : 'normal', kind: 'equip' });
					}
					App.data.inventory.push(eq);
				}
				
				// 3. 通常ドロップ判定 (独立)
				if (monsterDrops && monsterDrops.normal) {
					if (Battle.rollConfiguredDrop(monsterDrops.normal, bonusNormal)) {
						const itemDef = DB.ITEMS.find(i => i.id === monsterDrops.normal.id);
						if (itemDef) {
							App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
							drops.push({ name: itemDef.name, isRare: false, type: 'item', kind: 'item' });
						}
					}
				} else {
					if (Math.random() * 100 < (10 + bonusNormal)) {
                        const memoryMode = globalThis.ABYSS_FLOOR_RULES?.isMemoryMode?.(App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode) === true;
						const candidates = memoryMode
                            ? Battle.getMemoryRealmItemDropCandidates(floor)
                            : DB.ITEMS.filter(i => i.rank <= Math.min(200, floor) && i.type !== '貴重品' && i.id < 100);
						if (candidates.length > 0) {
							const item = candidates[Math.floor(Math.random() * candidates.length)];
							App.data.items[item.id] = (App.data.items[item.id] || 0) + 1;
							drops.push({ name: item.name, isRare: false, type: 'item', kind: 'item' });
						}
					}
				}
			});
		}

        // ランダム深淵101階以降の通常ボスは、勝利結果確定時に10%で災厄の楔を追加する。
        // 専用ボス・裂け目・冒険者イベント等は対象外とし、結果ジャーナルへ抽選結果を残す。
        const endlessBossWedgeOutcome = isTrainingBattle
            ? null
            : Battle.applyEndlessBossWedgeDrop(drops);
        if (endlessBossWedgeOutcome?.granted) hasRareDrop = true;

		// 敵ごとに0.5%で、その個体が所持するID100以上のスキル書を抽選する。
		rewardResultEnemies.forEach(enemy => {
		    if (Battle.tryCreateSkillBookDrop(enemy, drops, rareDropMultiplier)) hasRareDrop = true;
		});

        const elementalTrialMessages = isTrainingBattle ? [] : Battle.completeAbyssElementalTrial(drops);
        if (elementalTrialMessages.length) hasRareDrop = true;

        // クリア後の通常ランダムダンジョンでは、合成の壺をごく低確率で追加する。
        const isPostgameRandomDungeon = App.data?.progress?.flags?.darkCastleCleared === true
            && App.data?.location?.area === 'ABYSS'
            && globalThis.ABYSS_FLOOR_RULES?.isRandomMode?.(App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode) === true
            && !App.data?.dungeon?.guildQuestRun;
        if (!isTrainingBattle && isPostgameRandomDungeon && Math.random() < 0.0005) {
            const potId = Number(window.PRISMA_SYNTHESIS_POT_ITEM_ID || 599999);
            const pot = DB.ITEMS.find(item => Number(item.id) === potId);
            if (pot) {
                App.data.items[potId] = (App.data.items[potId] || 0) + 1;
                drops.push({ name: pot.name, isRare: true, type: 'kai', kind: 'item' });
                hasUltraRareDrop = true;
            }
        }

		// --- [3] 深淵系ダンジョン限定：通常魔物は1%、裏ボスは専用の累積加入率で判定 ---
		const normalMonsterRecruitResult = (!isTrainingBattle && typeof App.tryRecruitMonsterAfterBattle === 'function')
			? App.tryRecruitMonsterAfterBattle(Battle.enemies)
			: null;
		const monsterRecruitResult = specialBossOutcome?.recruitResult?.ok
			? specialBossOutcome.recruitResult
			: normalMonsterRecruitResult;

		const resultLevelEvents = [];
        const resultLevelLooseLogs = [];
		const resultTraitGrowthLogs = [];

		const partyHpRegen = Battle.getSurvivingPartyPassiveSum('post_battle_hp_regen_pct');
		const partyMpRegen = Battle.getSurvivingPartyPassiveSum('post_battle_mp_regen_pct');
		
		let hpRecovered = false; 
		let mpRecovered = false;

		// 勝利リザルトの経験値処理。前衛生存100%、戦闘不能50%、控え25%。
        for (const recipient of expRecipients) {
            const { charData, battleMember: p, active, alive, rate } = recipient;
            if (!charData) continue;
            const awardedExp = Math.max(0, Math.floor(totalExp * rate));
            const oldLv = charData.level;

            // App.gainExp が [Lv通知, ステ上昇, スキル習得, 特性習得] の順で配列を返す
            const lvLogs = App.gainExp(charData, awardedExp, { save: false });

            // 各レベルの通知と、その直後に続く成長詳細をひとまとまりで保持する。
            let currentLevelEvent = null;
            for (const msg of lvLogs) {
                if (!msg) continue;
                const text = String(msg);
                if (text.includes('レベル') && text.includes('に上がった！')) {
                    currentLevelEvent = { notification: msg, details: [] };
                    resultLevelEvents.push(currentLevelEvent);
                } else if (currentLevelEvent) {
                    currentLevelEvent.details.push(msg);
                } else {
                    resultLevelLooseLogs.push(msg);
                }
            }

            // 戦闘後の特性成長・回復は、従来どおり生存して戦ったメンバーだけ。
            if (active && alive) {
                let traitGrowthLog = null;
                if (!isTrainingBattle && typeof PassiveSkill !== 'undefined' && PassiveSkill.checkTraitGrowth) {
                    traitGrowthLog = PassiveSkill.checkTraitGrowth(charData);
                }
                if (traitGrowthLog) {
                    const logs = traitGrowthLog.split('<br>');
                    for (const log of logs) {
                        if (log) resultTraitGrowthLogs.push(log);
                    }
                }
            }

            if (p && charData.level > oldLv) {
                const stats = App.calcStats(charData);
                p.level = charData.level;
                p.baseMaxHp = stats.maxHp;
                p.baseMaxMp = stats.maxMp;
                if (alive) {
                    p.hp = p.baseMaxHp;
                    p.mp = p.baseMaxMp;
                } else {
                    // レベルアップの全回復で戦闘不能が解除されないようにする。
                    p.hp = 0;
                    p.isDead = true;
                    charData.currentHp = 0;
                    p.mp = Math.min(p.baseMaxMp, Math.max(0, Number(p.mp || charData.currentMp || 0)));
                }
            } else if (p && active && alive) {
                if (partyHpRegen > 0 && p.hp < p.baseMaxHp) {
                    const amt = Math.floor(p.baseMaxHp * (partyHpRegen / 100));
                    if (amt > 0) {
                        p.hp = Math.min(p.baseMaxHp, p.hp + amt);
                        hpRecovered = true;
                    }
                }
                if (partyMpRegen > 0 && p.mp < p.baseMaxMp) {
                    const amt = Math.floor(p.baseMaxMp * (partyMpRegen / 100));
                    if (amt > 0) {
                        p.mp = Math.min(p.baseMaxMp, p.mp + amt);
                        mpRecovered = true;
                    }
                }
            } else if (p && active && !alive) {
                p.hp = 0;
                p.isDead = true;
                charData.currentHp = 0;
            }
        }


		// --- [4] 世界状態・フラグの先行確定 ---
		// 演出中のリロード対策として、ボスマスを階段にする等の処理をログ表示前に完結させます
		if (!isTrainingBattle && !App.data?.battle?.randomAdventurerDuel && ((isBossBattle && !isEstark) || fixedHunter)) {
			if (typeof Dungeon !== 'undefined' && typeof Dungeon.onBossDefeated === 'function') {
				Dungeon.onBossDefeated(); // ここで mapChanges 等が更新される
			}
			// 注：StoryManager.onBattleWin は会話を伴うため演出の最後に行いますが、
			// 討伐フラグ自体はこの上の App.save() で確実に永続化されます。
		}

        // ギルド昇格試験は通常の固定マップボス進行から分離し、
        // 勝利時にだけ冒険者ランクを確定する。
        if (!isTrainingBattle && guildPromotionTarget && typeof Guild !== 'undefined' && typeof Guild.completePromotionTrial === 'function') {
            guildPromotionMessage = Guild.completePromotionTrial(guildPromotionTarget);
        }
		const keyRewards = keyReward
			? (Array.isArray(keyReward.colors)
				? keyReward.colors.filter(Boolean).map(color => ({
					...keyReward,
					color: color
				}))
				: [keyReward])
			: [];

		if (!isTrainingBattle && keyRewards.length > 0 && typeof Dungeon !== 'undefined' && typeof Dungeon.completeKeyGuardianReward === 'function') {
			keyRewards.forEach(reward => {
				Dungeon.completeKeyGuardianReward(reward);
			});

			if (App.data.battle) {
				App.data.battle.keyReward = null;
				App.data.battle.fixedKeyReward = null;
			}
		}

        // 演出前に参加者の最終HP/MPと全報酬を同じcommitへ含める。
        if (isTrainingBattle) {
            Battle.restoreStoryBossTrainingPartyState();
        } else {
            Battle.party.forEach(member => {
                const charData = member?.uid ? App.getChar(member.uid) : null;
                if (!charData) return;
                charData.currentHp = Math.max(0, Number(member.hp || 0));
                charData.currentMp = Math.max(0, Number(member.mp || 0));
                delete charData.battleStatus;
            });
        }
        const pendingMonsterSkillEvolution = isTrainingBattle ? null : Battle.prepareMonsterSkillEvolutionAfterBattle();
        const abyssRiftOutcome = Battle.buildAbyssRiftResultOutcome(abyssRiftResultContext, App.data?.dungeon);
        const battleId = App.data.battle.battleId;
        App.data.battle.resultJournal = {
            version: 2,
            battleId,
            type: 'win',
            status: 'committed',
            finalized: false,
            committedAt: Date.now(),
            rewardsApplied: true,
            expApplied: true,
            worldApplied: true,
            eventQueued: !!(storyWinEventId || fixedStoryEventId || eventId),
            pendingMonsterSkillEvolution,
            storyBossTraining: trainingJournalContext,
            specialBossOutcome: specialBossOutcome ? { ...specialBossOutcome, recruitResult: undefined } : null,
            elementalSpiritTrialOutcome: App.data.battle.elementalSpiritTrialOutcome
                ? { ...App.data.battle.elementalSpiritTrialOutcome }
                : null,
            randomHunterOutcome,
            endlessBossWedgeOutcome,
            abyssRiftOutcome,
            angelTrialOutcome: App.data?.battle?.angelTrialOutcome
                ? JSON.parse(JSON.stringify(App.data.battle.angelTrialOutcome))
                : null,
            summary: {
                gold: totalGold,
                exp: totalExp,
                gems: Math.max(0, Number(specialBossOutcome?.gemReward) || 0),
                drops: drops.map(drop => ({ name: drop.name, kind: drop.kind || drop.type || null }))
            }
        };

		// --- [5] 全状態を一回の保存で確定し、その後は表示だけを行う ---
        App.save();
        if (typeof App.commitSaveTransaction === 'function') {
            const committed = App.commitSaveTransaction();
            if (committed === false) throw new Error('勝利結果の保存に失敗しました。');
        }
        transactionCommitted = true;
        Battle.finishState = 'committed';

		// --- [6] ここから勝利演出（ログ表示、レベルアップ、待機など） ---
		Battle.log(`<br><span style="color:#ffff00; font-size:1em; font-weight:bold;">戦闘に勝利した！</span>`);
        Battle.resultInputLocked = true;
        try {
            await Battle.playResultSeAndWait('battle_victory');
        } finally {
            Battle.resultInputLocked = false;
        }
        if (isTrainingBattle) {
            Battle.log('<span style="color:#d8b5ff;font-weight:bold;">訓練戦のため報酬・討伐記録は発生しない。HP・MPは開始前の状態へ戻った。</span>');
        } else {
		    Battle.log(`${totalGold} Goldを獲得！`);
		    Battle.log(`${totalExp} ポイントの経験値を 獲得した！`);
        }
        if (!isTrainingBattle && expRecipients.some(recipient => recipient.active && !recipient.alive)) {
            Battle.log('<span style="color:#bbb;">戦闘不能の仲間は経験値を50%取得した。</span>');
        }
        if (!isTrainingBattle && expRecipients.some(recipient => !recipient.active)) {
            Battle.log('<span style="color:#bbb;">控えの仲間は経験値を25%取得した。</span>');
        }
        if (guildPromotionMessage) {
            Battle.log(`<span style="color:#ffd56b; font-weight:bold;">${Battle.escapeHtml(guildPromotionMessage).replace(/\n/g, '<br>')}</span>`);
        }
        if (specialBossOutcome?.requiredItemConsumed) {
            Battle.log(`<span style="color:#d8b5ff; font-weight:bold;">${Battle.escapeHtml(specialBossOutcome.requiredItemName || '災厄の楔')}が砕け散った。</span>`);
        }
		if (monsterRecruitResult && monsterRecruitResult.message) {
			Battle.log(`<span style="color:#7fffd4; font-weight:bold;">${monsterRecruitResult.message}</span>`);
		}
        elementalTrialMessages.forEach(message => {
            Battle.log(`<span style="color:#9fe8ff; font-weight:bold;">${Battle.escapeHtml(message)}</span>`);
        });


        Battle.setResultLevelSkipActive(resultLevelEvents.length > 0 || resultLevelLooseLogs.length > 0 || resultTraitGrowthLogs.length > 0);
        try {
            for (const event of resultLevelEvents) {
                Battle.log(event.notification);
                Battle.resultInputLocked = true;
                try {
                    await Battle.playResultSeAndWait('battle_level_up', { levelSkippable:true });
                } finally {
                    Battle.resultInputLocked = false;
                }
                for (const detail of event.details) Battle.log(detail);
                if (!Battle.resultSkipRequested) {
                    Battle.log(`<span style="color:#aaa; font-size:0.85em;">▼</span>`);
                    await Battle.waitForResultAdvance();
                }
            }

            for (const msg of resultLevelLooseLogs) {
                Battle.log(msg);
                await Battle.resultWait(350);
            }

		    for (const msg of resultTraitGrowthLogs) {
			    Battle.log(msg);
			    await Battle.resultWait(250);
		    }
        } finally {
            Battle.setResultLevelSkipActive(false);
        }

        const monsterSkillEvolutionLog = await Battle.tryMonsterSkillEvolutionAfterBattle();
        if (monsterSkillEvolutionLog) {
            Battle.log(monsterSkillEvolutionLog);
            await Battle.resultWait(350);
        }

		const uniqueLbGrowthLogs = [];
		const seenLbGrowthLogs = new Set();
		for (const msg of lbGrowthLogs) {
			if (!msg || seenLbGrowthLogs.has(msg)) continue;
			seenLbGrowthLogs.add(msg);
			uniqueLbGrowthLogs.push(msg);
		}
		for (const msg of uniqueLbGrowthLogs) {
			Battle.log(msg);
			await Battle.resultWait(350);
		}

		if (hpRecovered) {
			Battle.log(`<span style="color:#8f8;">特性：応急手当でパーティのHPが回復した！</span>`);
		}
		if (mpRecovered) {
			Battle.log(`<span style="color:#88f;">特性：魔力充填でパーティのMPが回復した！</span>`);
		}
		
		// ドロップ演出（アイテム → 装備の順に表示）
		const itemDrops = drops.filter(d => (d.kind || (d.type === 'item' ? 'item' : 'equip')) === 'item');
		const equipDrops = drops.filter(d => (d.kind || (d.type === 'item' ? 'item' : 'equip')) !== 'item');
		const showDropLog = (d) => {
			if (d.isSpecialBoss || d.isEstark) {
				Battle.log(`<span style="color:#ffd700; font-weight:bold;">10,000 GEM</span> を獲得！`);
				Battle.log(`なんと <span style="color:#ffd700; font-weight:bold;">${d.name}</span> を手に入れた！`);
			} else if (d.type === 'kai') {
				Battle.log(`なんと <span style="color:#ff00ff; font-weight:bold;">${d.name}</span> を手に入れた！`);
			} else if (d.isRare) {
				Battle.log(`なんと <span class="log-rare-drop">${d.name}</span> を手に入れた！`);
			} else {
				Battle.log(`${d.name} を手に入れた！`);
			}
		};

		if (drops.length > 0) {
			Battle.log("<br>");
			await Battle.resultWait(500);
			
			if ((hasUltraRareDrop || hasRareDrop) && !Battle.resultSkipRequested) {
				const ultraFlash = document.getElementById('drop-flash-ultra');
				const rareFlash = document.getElementById('drop-flash');
				let targetEl = null;
				let activeClass = "";

				if (hasUltraRareDrop && ultraFlash) {
					targetEl = ultraFlash; activeClass = 'flash-ultra-active';
				} else if (hasRareDrop && rareFlash) {
					targetEl = rareFlash; activeClass = 'flash-active';
				}

				if (targetEl) {
					[ultraFlash, rareFlash].forEach(el => {
						if (el) { el.style.display = 'none'; el.classList.remove('flash-active', 'flash-ultra-active'); }
					});
					void targetEl.offsetWidth; 
					targetEl.style.display = 'block';
					targetEl.classList.add(activeClass);
					targetEl.onanimationend = () => {
						targetEl.style.display = 'none';
						targetEl.classList.remove(activeClass);
						targetEl.onanimationend = null;
					};
				}
			}

			for (const d of itemDrops) {
				showDropLog(d);
				await Battle.resultWait(150);
			}
			for (const d of equipDrops) {
				showDropLog(d);
				await Battle.resultWait(150);
			}
		}

		App.save(); 
		Battle.resultProcessing = false;
		Battle.resultReadyToEnd = true;
		Battle.log("\n▼ 画面タップ / Enterキーで終了 ▼");

		// ★削除：戦闘画面中にストーリーを実行しない
		
		// ストーリー後処理（会話イベント等の実行）
		// --- [修正] 演出の最後で予約を消化する ---
		//if (isBossBattle && !isEstark) {
		//	if (typeof Dungeon !== 'undefined' && typeof Dungeon.onBossDefeated === 'function') {
		//		Dungeon.onBossDefeated();
		//	}
		//	if (eventId && typeof StoryManager !== 'undefined' && typeof StoryManager.onBattleWin === 'function') {
		//		// 予約情報を消してから実行
		//		if (App.data.progress.pendingBattleWinEventId === eventId) {
		//			delete App.data.progress.pendingBattleWinEventId;
		//			App.save();
		//		}
		//		await StoryManager.onBattleWin(eventId);
		//	}
		//}
        } catch (error) {
            console.error('[Battle] win transaction failed:', error);
            if (!transactionCommitted) {
                try { App.cancelSaveTransaction?.(); } catch (_) {}
                try {
                    if (!rollbackSerialized) throw new Error('戦闘結果処理前の復元スナップショットがありません。');
                    const restored = JSON.parse(rollbackSerialized);
                    App.data = restored;
                    App.totalGoldGem?.();
                    if (!App.data.battle) App.data.battle = { active: true };
                    App.data.battle.active = true;
                    App.data.battle.lastResultError = String(error?.message || error);
                    App.data.battle.lastResultErrorAt = Date.now();
                    delete App.data.battle.resultJournal;
                    Battle.active = true;
                    Battle.phase = 'input_recovery';
                    Battle.resultProcessing = false;
                    Battle.resultReadyToEnd = false;
                    Battle.finishState = 'idle';
                    Battle.finishToken = null;
                    App.save();
                    Battle.recoverBattleRuntimeAfterResultError(error);
                } catch (rollbackError) {
                    console.error('[Battle] win rollback failed:', rollbackError);
                    try { App.load?.(); } catch (loadError) { console.error('[Battle] last committed save reload failed:', loadError); }
                    if (App.data?.battle) App.data.battle.active = true;
                    Battle.finishState = 'idle';
                    Battle.finishToken = null;
                    Battle.active = true;
                    Battle.phase = 'input_recovery';
                    Battle.recoverBattleRuntimeAfterResultError(rollbackError);
                }
                return false;
            }
            // commit後の表示例外では報酬を巻き戻さず、終了操作だけ復旧する。
            Battle.finishState = 'committed';
            Battle.resultProcessing = false;
            Battle.resultReadyToEnd = true;
            Battle.log('<span style="color:#ffb36b;">勝利演出の一部を省略しました。結果は保存済みです。</span>');
            Battle.log("\n▼ 画面タップ / Enterキーで終了 ▼");
            return true;
        }

	},
	
    recoverCommittedBattleResult: () => {
        const battleData = App.data?.battle;
        const journal = battleData?.resultJournal;
        if (!journal || journal.status !== 'committed' || journal.finalized === true) return false;

        // 勝敗のゲーム状態は表示前に確定済み。再読込時は表示層だけを破棄する。
        journal.finalized = true;
        journal.finalizedAt = Date.now();
        if (App.data?.progress?.tempStoryPower && typeof App.clearTemporaryStoryPower === 'function') {
            App.clearTemporaryStoryPower({ id: App.data.progress.tempStoryPower.id });
        }
        if (journal.type === 'win' && journal.pendingMonsterSkillEvolution?.status === 'pending') {
            if (!App.data.progress) App.data.progress = {};
            App.data.progress.pendingMonsterSkillEvolution = { ...journal.pendingMonsterSkillEvolution };
        }
        if (journal.type === 'loss') {
            const currentChainId = battleData.battleChainId || null;
            const contextChainId = App.data.progress?.activeFixedBossContext?.battleChainId || null;
            if (App.data.progress?.activeFixedBossContext &&
                (!currentChainId || !contextChainId || String(currentChainId) === String(contextChainId))) {
                delete App.data.progress.activeFixedBossContext;
            }
        }
        App.data.battle = { active: false };
        App.save();
        return true;
    },

    lose: async (options = {}) => {
        const requestedToken = options.finishToken || Battle.finishToken ||
            `finish-loss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        if (Battle.finishState === 'finalized' || Battle.finishState === 'committed') return false;
        if (Battle.finishState === 'processing' && Battle.finishToken && Battle.finishToken !== requestedToken) return false;
        Battle.finishState = 'processing';
        Battle.finishToken = requestedToken;
        let rollbackSerialized = null;
        let transactionCommitted = false;
        try {
        rollbackSerialized = (typeof App.serializeSaveData === 'function')
            ? App.serializeSaveData(App.data)
            : JSON.stringify(App.data);
        const isTrainingBattle = Battle.isStoryBossTrainingBattle();
        const trainingJournalContext = Battle.getStoryBossTrainingJournalContext();
        Battle.phase = 'result';
        Battle.active = false;
        Battle.resultProcessing = true;
        Battle.resultReadyToEnd = false;
        Battle.resultEndIsGameOver = !isTrainingBattle;
        Battle.resultInputLocked = false;
        Battle.resultAdvanceResolver = null;
        Battle.resultSkipRequested = false;
        Battle.resultLevelSkipActive = false;
        Battle.resultWaiters = [];
        Battle.updateResultLevelSkipButton?.();
        if (!App.data.battle) App.data.battle = {};
        App.data.battle.active = false;
        if (typeof App.beginSaveTransaction === 'function') App.beginSaveTransaction();
        Battle.log(isTrainingBattle ? "訓練戦に敗北した..." : "全滅した...");

        if (App.data.battle?.isChestTrapBattle && App.data.battle?.fixedChestTrap &&
            typeof Dungeon !== 'undefined' && typeof Dungeon.rollbackFixedChestTrap === 'function') {
            Dungeon.rollbackFixedChestTrap(App.data.battle);
        }
        if (typeof App.clearPendingLimitBreakTrial === 'function') App.clearPendingLimitBreakTrial();
        if (App.data.battle?.guildPromotionTarget && App.data.progress?.guild) {
            App.data.progress.guild.pendingPromotion = null;
        }
        if (!isTrainingBattle && App.data.stats) App.data.stats.wipeoutCount = (App.data.stats.wipeoutCount || 0) + 1;
        const elementalSpiritTrialOutcome = !isTrainingBattle ? Battle.recordAbyssElementalTrialLoss() : null;

        const eventId = App.data.battle?.eventId || null;
        const storyLossEventId = App.data.battle?.storyLossEventId || null;
        let queuedLossEventId = null;
        if (eventId === 'game_start' || eventId === 'game_start_retry') {
            if (typeof App.clearTemporaryStoryPower === 'function') {
                App.clearTemporaryStoryPower({ id: 'game_start_retry_lb99' });
            }
            queuedLossEventId = 'game_start_retry';
            if (App.data.stats) App.data.stats.wipeoutCount = Math.max(0, (App.data.stats.wipeoutCount || 1) - 1);
            Battle.resultEndIsGameOver = false;
        } else if (storyLossEventId) {
            queuedLossEventId = storyLossEventId;
            Battle.resultEndIsGameOver = false;
        }
        if (queuedLossEventId) {
            if (typeof StoryManager !== 'undefined' && typeof StoryManager.queueEvent === 'function') {
                StoryManager.queueEvent(queuedLossEventId, 'actions', {
                    save: false,
                    dedupeKey: `battle-loss:${App.data.battle?.battleId || App.data.battle?.battleChainId || 'unknown'}:${queuedLossEventId}`,
                    meta: { battleChainId: App.data.battle?.battleChainId || null }
                });
            } else {
                if (!App.data.progress) App.data.progress = {};
                App.data.progress.pendingEventId = queuedLossEventId;
            }
        }

        if (isTrainingBattle) {
            Battle.restoreStoryBossTrainingPartyState();
        } else {
            Battle.party.forEach(member => {
                const charData = member?.uid ? App.getChar(member.uid) : null;
                if (!charData) return;
                charData.currentHp = Math.max(0, Number(member.hp || 0));
                charData.currentMp = Math.max(0, Number(member.mp || 0));
                delete charData.battleStatus;
            });
        }

        let returnPoint = null;
        if (Battle.resultEndIsGameOver) {
            (App.data.characters || []).forEach(character => {
                if ((App.data.party || []).includes(character.uid)) {
                    character.currentHp = 1;
                    delete character.battleStatus;
                }
            });
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.exit === 'function') {
                returnPoint = Dungeon.exit(true, null, {
                    save: false,
                    changeScene: false,
                    log: false,
                    clearAction: false
                });
            } else {
                App.data.location.area = 'WORLD';
                App.data.location.worldKey = 'WORLD';
                App.data.location.x = 58;
                App.data.location.y = 65;
                returnPoint = { area: 'WORLD', worldKey: 'WORLD', x: 58, y: 65 };
            }
        }

        const currentChainId = App.data.battle?.battleChainId || null;
        const contextChainId = App.data.progress?.activeFixedBossContext?.battleChainId || null;
        if (App.data.progress?.activeFixedBossContext &&
            (!currentChainId || !contextChainId || String(currentChainId) === String(contextChainId))) {
            delete App.data.progress.activeFixedBossContext;
        }

        const battleId = App.data.battle?.battleId ||
            `battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        App.data.battle.battleId = battleId;
        App.data.battle.resultJournal = {
            version: 2,
            battleId,
            type: 'loss',
            status: 'committed',
            finalized: false,
            committedAt: Date.now(),
            gameOver: Battle.resultEndIsGameOver,
            returnPoint,
            eventQueued: !!queuedLossEventId,
            storyBossTraining: trainingJournalContext,
            elementalSpiritTrialOutcome: elementalSpiritTrialOutcome ? { ...elementalSpiritTrialOutcome } : null
        };
        App.save();
        if (typeof App.commitSaveTransaction === 'function') {
            const committed = App.commitSaveTransaction();
            if (committed === false) throw new Error('敗北結果の保存に失敗しました。');
        }
        transactionCommitted = true;
        Battle.finishState = 'committed';

        if (typeof AudioManager !== 'undefined') AudioManager.playBgm?.('battle_wipeout', { resume: false });
        if (isTrainingBattle) {
            Battle.log('<span style="color:#d8b5ff;font-weight:bold;">訓練開始前のHP・MPへ戻った。</span>');
        }
        Battle.resultProcessing = false;
        Battle.resultReadyToEnd = true;
        Battle.log("\n▼ 画面タップ / Enterキーで終了 ▼");
        return true;
        } catch (error) {
            console.error('[Battle] loss transaction failed:', error);
            if (!transactionCommitted) {
                try { App.cancelSaveTransaction?.(); } catch (_) {}
                try {
                    if (!rollbackSerialized) throw new Error('戦闘結果処理前の復元スナップショットがありません。');
                    App.data = JSON.parse(rollbackSerialized);
                    App.totalGoldGem?.();
                    if (!App.data.battle) App.data.battle = { active: true };
                    App.data.battle.active = true;
                    App.data.battle.lastResultError = String(error?.message || error);
                    App.data.battle.lastResultErrorAt = Date.now();
                    delete App.data.battle.resultJournal;
                    Battle.active = true;
                    Battle.phase = 'input_recovery';
                    Battle.resultProcessing = false;
                    Battle.resultReadyToEnd = false;
                    Battle.finishState = 'idle';
                    Battle.finishToken = null;
                    App.save();
                    Battle.recoverBattleRuntimeAfterResultError(error);
                } catch (rollbackError) {
                    console.error('[Battle] loss rollback failed:', rollbackError);
                    try { App.load?.(); } catch (loadError) { console.error('[Battle] last committed save reload failed:', loadError); }
                    if (App.data?.battle) App.data.battle.active = true;
                    Battle.finishState = 'idle';
                    Battle.finishToken = null;
                    Battle.active = true;
                    Battle.phase = 'input_recovery';
                    Battle.recoverBattleRuntimeAfterResultError(rollbackError);
                }
                return false;
            }
            Battle.finishState = 'committed';
            Battle.resultProcessing = false;
            Battle.resultReadyToEnd = true;
            Battle.log('敗北結果は保存済みです。画面を押して戻ってください。');
            return true;
        }

    },

    endBattle: (isGameOver = false) => {
        Battle.phaseTransitionRestartPending = false;
        Battle.phaseTransitionResumeToken = null;
        Battle.deferredPhaseTransitionResumeToken = null;
        Battle.phaseTransitionRunnerActive = false;
        Battle.phaseTransitionRunnerToken = null;
        Battle.phaseTransitionRunnerScheduled = false;
        Battle.turnExecutionActive = false;
        Battle.turnExecutionToken = null;
        if (Battle.finishTimerId) clearTimeout(Battle.finishTimerId);
        Battle.finishState = 'finalized';
        Battle.finishToken = null;
        Battle.finishTimerId = null;
        Battle.deferredInputStart = false;
        Battle.pendingBattleEvent = null;
        Battle.specialCutsceneAutoBefore = undefined;
        Battle.runtimeGeneration = Math.max(0, Number(Battle.runtimeGeneration || 0)) + 1;
        Battle.inputGeneration = Math.max(0, Number(Battle.inputGeneration || 0)) + 1;
        const committedJournal = App.data?.battle?.resultJournal;
        if (committedJournal?.status === 'committed') {
            committedJournal.finalized = true;
            committedJournal.finalizedAt = Date.now();
            if (App.data?.progress?.tempStoryPower && typeof App.clearTemporaryStoryPower === 'function') {
                App.clearTemporaryStoryPower({ id: App.data.progress.tempStoryPower.id });
            }
            App.data.battle = { active: false };
            Battle.resultProcessing = false;
            Battle.resultReadyToEnd = false;
            Battle.resultEndIsGameOver = false;
            Battle.resultInputLocked = false;
            Battle.resultSkipRequested = false;
            Battle.resultLevelSkipActive = false;
            Battle.resultWaiters = [];
            Battle.updateResultLevelSkipButton?.();
            App.save();
            Battle.schedule(() => {
                App.changeScene('field');
                if (typeof App.resetFieldLog === 'function') App.resetFieldLog();
            }, 500);
            return;
        }
        if (Battle.phase === 'result' && Battle.resultProcessing && !Battle.resultReadyToEnd && !isGameOver) {
            Battle.handleResultTap();
            return;
        }
        Battle.resultProcessing = false;
        Battle.resultReadyToEnd = false;
        Battle.resultEndIsGameOver = false;
        Battle.resultInputLocked = false;
        Battle.resultSkipRequested = false;
        Battle.resultLevelSkipActive = false;
        Battle.updateResultLevelSkipButton?.();
        if (typeof Battle.resultAdvanceResolver === 'function') {
            const resolveAdvance = Battle.resultAdvanceResolver;
            Battle.resultAdvanceResolver = null;
            try { resolveAdvance(); } catch (e) {}
        }
        if (Array.isArray(Battle.resultWaiters)) {
            const waiters = Battle.resultWaiters.splice(0);
            waiters.forEach(fn => { try { fn(); } catch(e) {} });
        }
        ['drop-flash-ultra', 'drop-flash'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.classList.remove('flash-active', 'flash-ultra-active');
                el.onanimationend = null;
            }
        });
        const isDungeon = (typeof Dungeon !== 'undefined' && Field.currentMapData && Field.currentMapData.isDungeon);
        
		// ★追加：戦闘データを消去する前に、必要な情報を退避
        const isBossBattle = App.data.battle?.isBossBattle || false;
        const isEstark = App.data.battle?.isEstark || false;
        const eventId = App.data.battle?.eventId || null;
		
        // 戦闘データの初期化
        App.data.battle = { active: false };

        // パーティの状態を同期
        Battle.party.forEach(p => { 
            const d = App.getChar(p.uid); 
            if(d) { 
                d.currentHp = p.hp; 
                d.currentMp = p.mp; 
                delete d.battleStatus; // 状態異常はリセット
            } 
        });

        // ストーリー専用の一時強化は戦闘終了時点で必ず解除する。
        // これにより、勝利後イベントが中断・リロードされてもLB99がフィールドへ漏れない。
        if (App.data?.progress?.tempStoryPower && typeof App.clearTemporaryStoryPower === 'function') {
            App.clearTemporaryStoryPower({ id: App.data.progress.tempStoryPower.id });
        }

        App.save();
		
        if (isGameOver) {
            // ★全滅時: HPを1にしてフィールドに戻る (全ての戦闘で共通)
            App.data.characters.forEach(c => {
                if(App.data.party.includes(c.uid)) c.currentHp = 1;
            });
            App.save();

            // Battle.log("\n意識が遠のいていく……");
            Battle.schedule(() => {
                // ダンジョン内の全滅なら引数 true を渡して脱出
                if (isDungeon) {
                    Dungeon.exit(true); 
                } else {
                    // 通常フィールドでの全滅時はそのままフィールドシーンへ
					Dungeon.exit(true); 
                    App.changeScene('field');
                }
                if (typeof App.resetFieldLog === 'function') App.resetFieldLog();
            }, 500);
        } else {
            // ★修正：setTimeoutをasync化し、画面切り替え後にmain.jsのinit処理でストーリーを実行（復帰と同対応）
            Battle.schedule(async () => {
                App.changeScene('field');
                if (typeof App.resetFieldLog === 'function') App.resetFieldLog();
            }, 500);
        }
    },
    toggleAuto: () => {
        const shouldStartAuto = !Battle.auto;
        Battle.auto = shouldStartAuto;

        if (typeof App !== 'undefined' && typeof App.setBattleAutoStartSetting === 'function') {
            App.setBattleAutoStartSetting(Battle.auto);
        } else if (typeof App !== 'undefined' && App.data) {
            if (!App.data.settings || typeof App.data.settings !== 'object') App.data.settings = {};
            App.data.settings.battleAutoStart = Battle.auto;
            if (typeof App.save === 'function') App.save();
        }
        Battle.updateAutoButton();

        if (shouldStartAuto) {
            const canResumeInput = ['input', 'skill_select', 'item_select', 'target_select'].includes(Battle.phase);
            if (canResumeInput) {
                Battle.closeSubMenu();
                Battle.closeStrategyModal();
                Battle.selectingAction = null;
                Battle.selectedItemOrSkill = null;
                Battle.phase = 'input';
                Battle.findNextActor();
            }
        }
    },
    updateAutoButton: () => {
        ['btn-auto', 'btn-auto-bottom'].forEach(id => {
            const btn = Battle.getEl(id);
            if(btn) {
                btn.innerText = `AUTO: ${Battle.auto?'ON':'OFF'}`;
                btn.style.background = Battle.auto ? '#d00' : '#333';
                btn.setAttribute('aria-pressed', Battle.auto ? 'true' : 'false');
                btn.title = Battle.auto ? 'オート戦闘: ON' : 'オート戦闘: OFF';
            }
        });
    },

    handleResultTap: () => {
        if (Battle.phase !== 'result' || Battle.resultInputLocked) return;
        if (typeof Battle.resultAdvanceResolver === 'function') {
            const resolveAdvance = Battle.resultAdvanceResolver;
            Battle.resultAdvanceResolver = null;
            resolveAdvance();
            return;
        }
        if (Battle.resultReadyToEnd) {
            Battle.endBattle(Battle.resultEndIsGameOver === true);
        }
    },

    resultWait: (ms) => {
        // 勝利リザルト中のログ表示は、戦闘速度「最速」でも通常テンポで見せる。
        // ただし戦闘中に resultWait() を使っている箇所は従来通り battleSpeed の影響を受ける。
        if (Battle.phase !== 'result') return Battle.wait(ms);
        const waitMs = Math.max(0, Math.floor(Number(ms) || 0));
        if (waitMs <= 0 || (Battle.resultLevelSkipActive && Battle.resultSkipRequested)) return Promise.resolve();
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            const timer = setTimeout(finish, waitMs);
            if (!Array.isArray(Battle.resultWaiters)) Battle.resultWaiters = [];
            Battle.resultWaiters.push(() => {
                clearTimeout(timer);
                finish();
            });
        });
    },

    wait: (ms) => {
        const waitMs = Battle.getBattleWaitMs(ms);
        return waitMs <= 0 ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, waitMs));
    }
};
