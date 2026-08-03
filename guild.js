/* guild.js - Adventurer Guild rank, rotating requests, reports, trials and exchange */
(function(global) {
    'use strict';

    const MASTER = global.GUILD_MASTER_DATA;
    if (!MASTER || !Array.isArray(MASTER.ranks)) {
        throw new Error('guild_master.js must be loaded before guild.js');
    }

    const RANK_DEFS = MASTER.ranks;
    const RANKS = RANK_DEFS.map(rank => String(rank.id));
    const EXP_THRESHOLDS = Object.fromEntries(RANK_DEFS.map(rank => [String(rank.id), Math.max(0, Number(rank.requiredTotalExp) || 0)]));
    const PROMOTION_TRIALS = MASTER.promotionTrials || {};
    const EXCHANGE = Array.isArray(MASTER.exchangeEntries) ? MASTER.exchangeEntries : [];
    const RARITY_DEFS = Array.isArray(MASTER.questRarities) && MASTER.questRarities.length
        ? MASTER.questRarities.map(def => ({ ...def, id: String(def.id || 'R').toUpperCase() }))
        : [{ id: 'R', label: 'R', minGuildRank: 'G', weight: 1, countMultiplier: 1, expMultiplier: 1, gpMultiplier: 1, color: '#9fd8ff', bonusItemChance: 0, bonusItemPool: [] }];
    const RARITY_MAP = Object.fromEntries(RARITY_DEFS.map(def => [def.id, def]));
    const LEGACY_QUEST_ID_MAP = global.GUILD_QUEST_LEGACY_ID_MAP || {};
    const GENERATOR_MASTER = global.GUILD_QUEST_GENERATOR_MASTER || {};
    const GENERATOR_SCHEMA_VERSION = Math.max(0, Math.floor(Number(GENERATOR_MASTER.schemaVersion) || 0));


    const Guild = {
        maxOffers: Math.max(1, Number(MASTER.maxOffers) || 5),
        boardReturnMode: 'field',
        ranks: RANKS,
        rankDefinitions: RANK_DEFS,
        expThresholds: EXP_THRESHOLDS,
        promotionTrials: PROMOTION_TRIALS,
        exchangeEntries: EXCHANGE,
        rarityDefinitions: RARITY_DEFS,

        getRarityDefinition(rarity) {
            return RARITY_MAP[String(rarity || 'R').toUpperCase()] || RARITY_MAP.R || RARITY_DEFS[0];
        },

        getRarityColor(rarity) {
            return Guild.getRarityDefinition(rarity)?.color || '#9fd8ff';
        },

        getRarityLabel(rarity) {
            const def = Guild.getRarityDefinition(rarity);
            return String(def?.label || def?.id || 'R');
        },

        getDifficultyLabel(definition) {
            const rarity = Guild.getRarityDefinition(definition?.rarity || 'R');
            return String(definition?.difficultyLabel || rarity?.difficultyLabel || '標準');
        },

        rarityBadgeHtml(definition) {
            const rarity = Guild.getRarityDefinition(definition?.rarity || 'R');
            const label = App.escapeHtml(String(rarity?.label || rarity?.id || 'R'));
            const color = String(rarity?.color || '#9fd8ff');
            return `<span class="guild-rarity-badge" style="display:inline-flex; align-items:center; justify-content:center; min-width:30px; padding:2px 6px; margin-right:6px; border:1px solid ${color}; color:${color}; background:rgba(0,0,0,.38); border-radius:10px; font-size:10px; font-weight:bold;">${label}</span>`;
        },

        getEligibleRarities(options = {}) {
            const guildState = options.state || Guild.ensureState();
            const floorMax = Math.max(0, Math.floor(Number(options.floorMax || 0)));
            const balanceFloorMax = floorMax > 0 ? Guild.getRandomAbyssBalanceFloor(floorMax) : 0;
            return RARITY_DEFS.filter(def => {
                if (Guild.rankIndex(guildState?.rank || 'G') < Guild.rankIndex(def.minGuildRank || 'G')) return false;
                if (balanceFloorMax > 0 && balanceFloorMax < Math.max(1, Math.floor(Number(def.minAbyssFloor || 1)))) return false;
                return Number(def.weight || 0) > 0;
            });
        },

        rollRarity(options = {}) {
            const pool = Guild.getEligibleRarities(options);
            if (!pool.length) return Guild.getRarityDefinition('R');
            const total = pool.reduce((sum, def) => sum + Math.max(0, Number(def.weight || 0)), 0);
            if (total <= 0) return pool[0];
            let roll = Math.random() * total;
            for (const def of pool) {
                roll -= Math.max(0, Number(def.weight || 0));
                if (roll <= 0) return def;
            }
            return pool[pool.length - 1];
        },

        getRarityBonusRewards(rarityDef) {
            const def = rarityDef || Guild.getRarityDefinition('R');
            const pool = Array.isArray(def.bonusItemPool) ? def.bonusItemPool.map(Number).filter(Number.isFinite) : [];
            if (!pool.length || Math.random() >= Math.max(0, Math.min(1, Number(def.bonusItemChance || 0)))) return [];
            const itemId = Guild.pickRandom(pool);
            return Number.isFinite(Number(itemId)) ? [{ id: Number(itemId), count: 1 }] : [];
        },

        getMinimumHuntMaterialReward(definition = {}) {
            // 最低ランクの討伐依頼にも、必ず持ち帰れる素材を1枠付ける。
            // 依頼IDから素材系統を決めるため、旧セーブを読み直しても報酬が変化しない。
            const rankIndex = Math.max(0, Guild.rankIndex(definition.requiredRank || 'G'));
            const gradeIndex = Math.max(0, Math.min(7, Math.floor(rankIndex / 2)));
            const seedText = String(definition.id || definition.name || definition.area || 'guild-hunt');
            let hash = 0;
            for (let index = 0; index < seedText.length; index += 1) {
                hash = ((hash * 31) + seedText.charCodeAt(index)) >>> 0;
            }
            const categoryIndex = hash % 8;
            return { id: 2000 + categoryIndex * 8 + gradeIndex, count: 1 };
        },

        getEffectiveRewardItems(definition = {}) {
            const rewards = (Array.isArray(definition.rewardItems) ? definition.rewardItems : [])
                .map(reward => ({
                    id: Number(reward?.id ?? reward?.itemId),
                    count: Math.max(1, Math.floor(Number(reward?.count || 1)))
                }))
                .filter(reward => Number.isFinite(reward.id));
            if (rewards.length) return rewards;
            return definition.kind === 'hunt' ? [Guild.getMinimumHuntMaterialReward(definition)] : [];
        },

        getCompactRewardSummary(definition = {}) {
            const itemRewards = Guild.getEffectiveRewardItems(definition);
            const itemLabels = itemRewards.map(reward => {
                const item = DB.ITEMS?.find(entry => Number(entry.id) === Number(reward.id));
                return `${item?.name || `アイテム${reward.id}`}×${reward.count}`;
            });
            const equipmentCount = Array.isArray(definition.rewardEquipment) ? definition.rewardEquipment.length : 0;
            const rewardParts = itemLabels.slice(0, 2);
            if (itemLabels.length > 2) rewardParts.push(`ほか${itemLabels.length - 2}種`);
            if (equipmentCount > 0) rewardParts.push(`装備${equipmentCount}枠`);
            const itemText = rewardParts.length ? rewardParts.join('・') : 'アイテム報酬なし';
            return `ギルドEXP +${Math.max(0, Number(definition.guildExp || 0))} / GP +${Math.max(0, Number(definition.guildPoints || 0))} / ${itemText}`;
        },

        getStaticDefinitions() {
            return global.GUILD_QUEST_DATA || {};
        },

        getGeneratedDefinitions() {
            if (typeof App === 'undefined') return {};
            const generated = App.data?.progress?.guild?.generatedQuests;
            return generated && typeof generated === 'object' && !Array.isArray(generated) ? generated : {};
        },

        getDefinitions() {
            return { ...Guild.getStaticDefinitions(), ...Guild.getGeneratedDefinitions() };
        },

        randomInt(min, max) {
            const low = Math.ceil(Math.min(Number(min) || 0, Number(max) || 0));
            const high = Math.floor(Math.max(Number(min) || 0, Number(max) || 0));
            if (high <= low) return low;
            return low + Math.floor(Math.random() * (high - low + 1));
        },

        pickRandom(values = []) {
            if (!Array.isArray(values) || !values.length) return null;
            return values[Guild.randomInt(0, values.length - 1)];
        },

        getQuestGeneratorSignature(id, def = null) {
            const definition = def || Guild.getDefinitions()[id];
            if (!definition) return '';
            if (definition.generatorSignature) return String(definition.generatorSignature);
            const scope = Guild.getHuntScope(definition);
            if (scope.mode === 'floorRange' && scope.areaKeys.includes('ABYSS')) {
                return `abyss:${scope.floorMin}-${scope.floorMax}`;
            }
            const template = (Array.isArray(GENERATOR_MASTER.normalHunts) ? GENERATOR_MASTER.normalHunts : [])
                .find(entry => String(entry.baseQuestId || '') === String(id || definition.id || ''));
            return template ? `normal:${template.key}` : '';
        },

        getCurrentOfferSignatures(state = null) {
            const guildState = state || (typeof App !== 'undefined' ? App.data?.progress?.guild : null);
            if (!guildState) return new Set();
            const defs = Guild.getDefinitions();
            const ids = new Set(guildState.offers || []);
            Object.entries(guildState.questStates || {}).forEach(([id, questState]) => {
                if (questState?.state === 'accepted') ids.add(id);
            });
            const signatures = new Set();
            ids.forEach(id => {
                const signature = Guild.getQuestGeneratorSignature(id, defs[id]);
                if (signature) signatures.add(signature);
            });
            return signatures;
        },

        getRandomAbyssBalanceFloor(floor) {
            const displayFloor = Math.max(1, Math.floor(Number(floor) || 1));
            return globalThis.ABYSS_FLOOR_RULES?.getBalanceFloor
                ? globalThis.ABYSS_FLOOR_RULES.getBalanceFloor(displayFloor, 'random')
                : displayFloor + 100;
        },

        rankForAbyssFloor(floor) {
            const bands = Array.isArray(GENERATOR_MASTER.abyss?.rankBands) ? GENERATOR_MASTER.abyss.rankBands : [];
            const value = Guild.getRandomAbyssBalanceFloor(floor);
            const match = bands.find(entry => value <= Math.max(1, Math.floor(Number(entry.maxFloor) || 1)));
            return String(match?.rank || 'S').toUpperCase();
        },

        rarityIndex(rarity) {
            return Math.max(0, RARITY_DEFS.findIndex(def => def.id === String(rarity || 'R').toUpperCase()));
        },

        isRarityAtLeast(rarity, minimum) {
            return Guild.rarityIndex(rarity) >= Guild.rarityIndex(minimum);
        },

        getLocalDateKey(date = new Date()) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        },

        ensureDailyAcceptState(state = null) {
            const guildState = state || Guild.ensureState();
            if (!guildState) return null;
            const today = Guild.getLocalDateKey();
            if (!guildState.dailyAccept || typeof guildState.dailyAccept !== 'object' || guildState.dailyAccept.dateKey !== today) {
                guildState.dailyAccept = { dateKey: today, acceptedCount: 0, bonusLimit: 0, adUsed: false };
            }
            guildState.dailyAccept.acceptedCount = Math.max(0, Math.floor(Number(guildState.dailyAccept.acceptedCount) || 0));
            guildState.dailyAccept.bonusLimit = Math.max(0, Math.floor(Number(guildState.dailyAccept.bonusLimit) || 0));
            guildState.dailyAccept.adUsed = guildState.dailyAccept.adUsed === true;
            return guildState.dailyAccept;
        },

        getDailyAcceptInfo(state = null) {
            const daily = Guild.ensureDailyAcceptState(state);
            const baseLimit = 10;
            const limit = baseLimit + Number(daily?.bonusLimit || 0);
            const used = Number(daily?.acceptedCount || 0);
            return { daily, baseLimit, limit, used, remaining: Math.max(0, limit - used), adAvailable: !!daily && !daily.adUsed };
        },

        grantDailyAcceptAdBonus() {
            const state = Guild.ensureState();
            const info = Guild.getDailyAcceptInfo(state);
            if (!state || !info.adAvailable) return false;
            const grant = () => {
                const current = Guild.getDailyAcceptInfo(state);
                if (!current.adAvailable) return;
                current.daily.adUsed = true;
                current.daily.bonusLimit += 10;
                App.save();
                if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') {
                    Menu.msg('本日のギルド依頼受注可能数が10件追加された！', () => Guild.openBoard({ preserveReturn: true }));
                } else {
                    Guild.openBoard({ preserveReturn: true });
                }
            };
            if (typeof AdManager !== 'undefined' && typeof AdManager.prepareRewardAd === 'function') {
                AdManager.prepareRewardAd(grant);
            } else {
                grant();
            }
            return true;
        },

        getChallengeMaster() {
            return GENERATOR_MASTER.challengeDungeons || {};
        },

        rollChallengeRarity(state = null) {
            const guildState = state || Guild.ensureState();
            const minimum = String(Guild.getChallengeMaster().minRarity || 'SSR').toUpperCase();
            const pool = Guild.getEligibleRarities({ state: guildState }).filter(def => Guild.isRarityAtLeast(def.id, minimum));
            if (!pool.length) return null;
            const total = pool.reduce((sum, def) => sum + Math.max(0.01, Number(def.weight || 0)), 0);
            let roll = Math.random() * total;
            for (const def of pool) {
                roll -= Math.max(0.01, Number(def.weight || 0));
                if (roll <= 0) return def;
            }
            return pool[pool.length - 1];
        },

        getChallengePower(state = null, rarity = 'SSR') {
            const guildState = state || Guild.ensureState();
            const master = Guild.getChallengeMaster();
            const rankMap = master.referenceRankByGuildRank || {};
            const rankPower = Math.max(1, Number(rankMap[String(guildState?.rank || 'G').toUpperCase()]) || 35);
            const storyMultiplier = Math.max(0, Number(master.storyStepRankMultiplier || 8));
            const storyCap = Math.max(rankPower, Number(master.storyStepRankCap || 160));
            const storyPower = Math.min(storyCap, Math.max(0, Number(App.data?.progress?.storyStep || 0)) * storyMultiplier);
            const legacyFloor = Math.max(0, Number(
                App.getAbyssLegacyProgressFloor?.() ||
                (Number(App.data?.dungeon?.maxFloor || 0) > 0 ? Number(App.data.dungeon.maxFloor) + 100 : Number(App.data?.dungeon?.storyMaxFloor || 0))
            ));
            const floorPower = Math.min(Math.max(1, Number(master.abyssProgressRankCap || 200)), legacyFloor);
            const rarityKey = String(rarity || 'SSR').toUpperCase();
            const rarityBonus = Math.max(0, Number(master.rarityRankBonus?.[rarityKey] || 0));
            const maxReferenceRank = Math.max(rankPower, Number(master.maxReferenceRank || 220));
            return Math.max(35, Math.min(maxReferenceRank, Math.floor(Math.max(rankPower, storyPower, floorPower) + rarityBonus)));
        },

        getChallengeScaling(rarity = 'SSR', gimmickIds = []) {
            const master = Guild.getChallengeMaster();
            const rarityKey = String(rarity || 'SSR').toUpperCase();
            const normalBase = Math.max(1, Number(master.normalStatMultiplier?.[rarityKey] || 1));
            const bossStatMultiplier = Math.max(1, Number(master.bossStatMultiplier?.[rarityKey] || 1));
            const eliteMultiplier = Math.max(1, Number(master.eliteGimmickMultiplier || 1.35));
            const normalStatMultiplier = gimmickIds.includes('rare50_elite')
                ? Number((normalBase * eliteMultiplier).toFixed(3))
                : Number(normalBase.toFixed(3));
            return { normalStatMultiplier, bossStatMultiplier: Number(bossStatMultiplier.toFixed(3)) };
        },

        getChallengeGuildRewards(power, rarity = 'SSR', bossOnly = false) {
            const master = Guild.getChallengeMaster();
            const rarityKey = String(rarity || 'SSR').toUpperCase();
            const clearMultiplier = bossOnly ? 1.10 : 1;
            const expRate = Math.max(0.1, Number(master.guildExpPerReferenceRank?.[rarityKey] || 2.2));
            const gpRate = Math.max(0.1, Number(master.guildPointsPerReferenceRank?.[rarityKey] || 4));
            return {
                guildExp: Math.max(120, Math.round(Math.max(1, Number(power || 1)) * expRate * clearMultiplier)),
                guildPoints: Math.max(80, Math.round(Math.max(1, Number(power || 1)) * gpRate * clearMultiplier))
            };
        },

        createChallengeBossEnemyBoost(enemyBoost = {}) {
            return {
                ...JSON.parse(JSON.stringify(enemyBoost || {})),
                statMultiplier: 1,
                rareStatMultiplier: 1,
                applyToRares: false
            };
        },

        getMonsterSkillIds(base) {
            const acts = Array.isArray(base?.acts) ? base.acts : [];
            return [...new Set(acts.map(act => Math.floor(Number(typeof act === 'object' ? act.id : act))).filter(id => id >= 100))];
        },

        monsterMatchesChallengeTheme(base, theme) {
            if (!base || !theme?.element || typeof DB === 'undefined' || !Array.isArray(DB.SKILLS)) return false;
            return Guild.getMonsterSkillIds(base).some(id => DB.SKILLS.find(skill => Number(skill.id) === id)?.elm === theme.element);
        },

        selectChallengeMonsterIds(theme, power, options = {}) {
            const monsters = (typeof DB !== 'undefined' && Array.isArray(DB.MONSTERS)) ? DB.MONSTERS : [];
            const boss = options.boss === true;
            const rare = options.rare === true;
            const referenceRank = Math.max(1, Number(power || 1));
            let pool = monsters.filter(base => base && !!base.isBoss === boss && !!base.isRare === rare
                && !base.isGuildPromotionBoss && !base.isSpecialBoss && !base.isEstark);
            const themed = pool.filter(base => Guild.monsterMatchesChallengeTheme(base, theme));
            if (themed.length) pool = themed;

            const minRatio = boss ? 0.65 : (rare ? 0.45 : 0.55);
            const maxRatio = boss ? 1.15 : (rare ? 1.25 : 1.05);
            const withinReference = pool.filter(base => {
                const rank = Math.max(1, Number(base.rank || base.minF || 1));
                return rank >= referenceRank * minRatio && rank <= referenceRank * maxRatio;
            });
            if (withinReference.length) {
                pool = withinReference;
            } else {
                const fallback = pool.filter(base => {
                    const rank = Math.max(1, Number(base.rank || base.minF || 1));
                    return rank >= referenceRank * 0.35 && rank <= referenceRank * 1.35;
                });
                if (fallback.length) pool = fallback;
            }

            pool = Array.from(new Map(pool.filter(base => Number.isFinite(Number(base.id))).map(base => [Number(base.id), base])).values())
                .sort((a, b) => Math.abs(Number(a.rank || a.minF || 1) - referenceRank) - Math.abs(Number(b.rank || b.minF || 1) - referenceRank));
            const candidateLimit = Math.min(pool.length, Math.max(options.count || (boss ? 6 : 14), boss ? 12 : 28));
            const copy = pool.slice(0, candidateLimit);
            const count = Math.min(copy.length, options.count || (boss ? 6 : 14));
            const result = [];
            while (copy.length && result.length < count) {
                const index = Guild.randomInt(0, copy.length - 1);
                result.push(Number(copy.splice(index, 1)[0].id));
            }
            return result;
        },

        getChallengeThemeSkillIds(theme, count = 5) {
            const pool = ((typeof DB !== 'undefined' && Array.isArray(DB.SKILLS)) ? DB.SKILLS : []).filter(skill => Number(skill?.id) >= 100
                && skill.elm === theme?.element && !['回復', '特殊'].includes(String(skill.type || '')));
            return pool.sort((a, b) => Number(a.id) - Number(b.id)).slice(-Math.max(1, count)).map(skill => Number(skill.id));
        },

        pickChallengeGimmicks(rarity) {
            const master = Guild.getChallengeMaster();
            const eligible = (Array.isArray(master.gimmicks) ? master.gimmicks : [])
                .filter(gimmick => Guild.isRarityAtLeast(rarity, gimmick.minRarity || 'SSR'));
            if (!eligible.length) return [];
            const result = [];
            if (String(rarity).toUpperCase() === 'EX') {
                const exPool = eligible.filter(gimmick => String(gimmick.id).startsWith('rare50'));
                // 「レア出現率50%」系はEXでも稀な特殊依頼として扱う。
                if (exPool.length && Math.random() < 0.18) result.push(Guild.pickRandom(exPool));
            }
            const normalPool = eligible.filter(gimmick => !String(gimmick.id).startsWith('rare50'));
            if (normalPool.length) result.push(Guild.pickRandom(normalPool));
            return result.filter(Boolean);
        },

        getNonExchangeTraitBookIds() {
            const exchangeIds = new Set(EXCHANGE.map(entry => Number(entry.itemId)).filter(Number.isFinite));
            return ((typeof DB !== 'undefined' && Array.isArray(DB.ITEMS)) ? DB.ITEMS : [])
                .filter(item => {
                    const traitId = Number(item?.traitId);
                    if (item?.type !== '特性書' || !Number.isInteger(traitId) || traitId <= 0) return false;
                    if (exchangeIds.has(Number(item.id)) || item.fieldUsable === false || item.traitBookImplemented === false) return false;
                    if (typeof PassiveSkill !== 'undefined') {
                        if (!PassiveSkill.MASTER?.[traitId]) return false;
                        if (Array.isArray(PassiveSkill.TRAIT_BOOK_TRAIT_IDS) && !PassiveSkill.TRAIT_BOOK_TRAIT_IDS.includes(traitId)) return false;
                    }
                    return true;
                })
                .map(item => Number(item.id));
        },

        isDefinitionUnlocked(def) {
            const state = Guild.ensureState();
            if (!def || !state) return false;
            const flags = App.data?.progress?.flags || {};
            const required = def.requiredRank || 'G';
            const unlockFlags = Array.isArray(def.unlockFlags) ? def.unlockFlags : [];
            const requiredMaxAbyssFloor = Math.max(0, Math.floor(Number(def.requiredMaxAbyssFloor || 0)));
            const scopeMode = String(def.requiredAbyssMode || def.huntScope?.abyssMode || '');
            const requiredAbyssMode = scopeMode === 'story' || scopeMode === 'random'
                ? scopeMode
                : (unlockFlags.includes('abyssRandomUnlocked') ? 'random' : 'story');
            const reachedAbyssFloor = requiredAbyssMode === 'story'
                ? Math.max(0, Math.floor(Number(App.data?.dungeon?.storyMaxFloor || 0)))
                : Math.max(0, Math.floor(Number(App.data?.dungeon?.maxFloor || 0)));
            return Guild.rankIndex(state.rank) >= Guild.rankIndex(required)
                && unlockFlags.every(flag => !!flags[flag])
                && (!requiredMaxAbyssFloor || reachedAbyssFloor >= requiredMaxAbyssFloor);
        },

        buildGeneratorSpecs(excludedSignatures = new Set()) {
            const specs = [];
            const staticDefs = Guild.getStaticDefinitions();
            (Array.isArray(GENERATOR_MASTER.normalHunts) ? GENERATOR_MASTER.normalHunts : []).forEach(template => {
                const base = staticDefs[String(template.baseQuestId || '')];
                const signature = `normal:${template.key}`;
                if (!base || base.kind !== 'hunt' || excludedSignatures.has(signature) || !Guild.isDefinitionUnlocked(base)) return;
                specs.push({ kind: 'normal', signature, template, base });
            });

            const abyss = GENERATOR_MASTER.abyss || {};
            const flags = App.data?.progress?.flags || {};
            const reached = Math.min(
                Math.max(0, Math.floor(Number(App.data?.dungeon?.maxFloor || 0))),
                Math.max(1, Math.floor(Number(abyss.maxFloor) || 200))
            );
            const minFloor = Math.max(1, Math.floor(Number(abyss.minFloor) || 1));
            const bandSize = Math.max(1, Math.floor(Number(abyss.bandSize) || 10));
            if (abyss.enabled !== false && flags.abyssRandomUnlocked && reached >= minFloor) {
                for (let floorMin = minFloor; floorMin <= reached; floorMin += bandSize) {
                    const floorMax = Math.min(reached, floorMin + bandSize - 1);
                    const signature = `abyss:${floorMin}-${floorMax}`;
                    if (excludedSignatures.has(signature)) continue;
                    const requiredRank = Guild.rankForAbyssFloor(floorMax);
                    const probe = {
                        requiredRank,
                        unlockFlags: ['abyssRandomUnlocked'],
                        requiredMaxAbyssFloor: floorMax
                    };
                    if (!Guild.isDefinitionUnlocked(probe)) continue;
                    specs.push({ kind: 'abyss', signature, floorMin, floorMax, requiredRank });
                }
            }

            const challenge = Guild.getChallengeMaster();
            if (challenge.enabled !== false && Guild.rankIndex(Guild.ensureState()?.rank || 'G') >= Guild.rankIndex(challenge.minGuildRank || 'C')) {
                (Array.isArray(challenge.themes) ? challenge.themes : []).forEach(theme => {
                    const signature = `challenge:${theme.id}`;
                    if (!excludedSignatures.has(signature)) specs.push({ kind: 'challenge', signature, theme });
                });
            }
            return specs;
        },

        createGeneratedQuest(spec, state = null) {
            const guildState = state || Guild.ensureState();
            if (!guildState || !spec) return null;
            guildState.generatorSerial = Math.max(0, Math.floor(Number(guildState.generatorSerial) || 0)) + 1;
            const id = `guild_auto_${Date.now().toString(36)}_${guildState.generatorSerial.toString(36)}`;
            let def = null;

            if (spec.kind === 'normal') {
                const template = spec.template || {};
                const base = spec.base || {};
                const rarityDef = Guild.rollRarity({ state: guildState });
                const generatedRequiredRank = Guild.rankIndex(base.requiredRank || 'G') >= Guild.rankIndex(rarityDef.minGuildRank || 'G')
                    ? String(base.requiredRank || 'G')
                    : String(rarityDef.minGuildRank || 'G');
                const rawCount = Guild.randomInt(template.countMin, template.countMax);
                const count = Math.max(1, Math.round(rawCount * Math.max(1, Number(rarityDef.countMultiplier || 1))));
                const baseCount = Math.max(1, Math.floor(Number(base.targetCount) || rawCount));
                const expPerExtra = Math.max(0, Number(template.expPerExtraKill) || 0);
                const pointsPerExtra = Math.max(0, Number(template.pointsPerExtraKill) || 0);
                const expJitter = Guild.randomInt(0, Math.max(1, Math.floor(expPerExtra)));
                const pointsJitter = Guild.randomInt(0, Math.max(1, Math.floor(pointsPerExtra)));
                const scope = JSON.parse(JSON.stringify(base.huntScope || {}));
                if (template.forceDungeonHunt) scope.mode = 'dungeon';
                const label = String(scope.label || base.area || '指定ダンジョン');
                def = {
                    ...JSON.parse(JSON.stringify(base)),
                    id,
                    name: Guild.pickRandom(template.names) || `${label}の臨時討伐`,
                    area: label,
                    requiredRank: generatedRequiredRank,
                    objective: `${label}内で魔物を合計${count}体討伐する。`,
                    startText: `${label}の通行路を確保するため、種類を問わない臨時討伐依頼が出された。`,
                    progressText: `${label}内で魔物を${count}体討伐し、ライザーク要塞のギルド受付へ報告しよう。`,
                    completeText: `${label}の安全が確保され、依頼は完了となった。`,
                    targetCount: count,
                    targetMonsterIds: undefined,
                    spawnAreaLabel: undefined,
                    rewardItems: Guild.getRarityBonusRewards(rarityDef),
                    guildExp: Math.max(1, Math.round((Number(base.guildExp || 0) + Math.max(0, count - baseCount) * expPerExtra + expJitter) * Math.max(1, Number(rarityDef.expMultiplier || 1)) + Math.max(0, Number(rarityDef.expFlat || 0)))),
                    guildPoints: Math.max(1, Math.round((Number(base.guildPoints || 0) + Math.max(0, count - baseCount) * pointsPerExtra + pointsJitter) * Math.max(1, Number(rarityDef.gpMultiplier || 1)) + Math.max(0, Number(rarityDef.gpFlat || 0)))),
                    rarity: rarityDef.id,
                    difficultyLabel: rarityDef.difficultyLabel || '',
                    difficultyMultiplier: Math.max(1, Number(rarityDef.countMultiplier || 1)),
                    requestType: 'dungeonHunt',
                    huntScope: scope,
                    generatedQuest: true,
                    generatorKind: 'normal',
                    generatorKey: String(template.key || ''),
                    generatorSignature: spec.signature,
                    generatedAt: Date.now(),
                    sortOrder: 1000 + guildState.generatorSerial
                };
                delete def.targetMonsterIds;
                delete def.spawnAreaLabel;
            } else if (spec.kind === 'challenge') {
                const challengeMaster = Guild.getChallengeMaster();
                const rarityDef = Guild.rollChallengeRarity(guildState);
                if (!rarityDef) return null;
                const rarity = String(rarityDef.id || 'SSR').toUpperCase();
                const theme = spec.theme || Guild.pickRandom(challengeMaster.themes || []);
                const power = Guild.getChallengePower(guildState, rarity);
                const floorRange = challengeMaster.floorRanges?.[rarity] || [3, 5];
                const bossOnlyChance = Math.max(0, Math.min(1, Number(challengeMaster.bossOnlyChance?.[rarity] || 0)));
                const bossOnly = Guild.isRarityAtLeast(rarity, 'UR') && Math.random() < bossOnlyChance;
                const floorCount = bossOnly ? 1 : Guild.randomInt(floorRange[0], floorRange[1]);
                const visualThemeId = Guild.pickRandom(theme?.visualThemeIds || ['abyss']) || 'abyss';
                let normalMonsterIds = Guild.selectChallengeMonsterIds(theme, power, { count: 16 });
                if (!normalMonsterIds.length) normalMonsterIds = Guild.selectChallengeMonsterIds(null, power, { count: 16 });
                const rareMonsterIds = Guild.selectChallengeMonsterIds(theme, power, { rare: true, count: 5 });
                const bossCandidates = Guild.selectChallengeMonsterIds(theme, power, { boss: true, count: rarity === 'EX' ? 8 : 6 });
                const selectedBossId = Guild.pickRandom(bossCandidates) || 401100;
                // 依頼生成時に最下層ボス1体を固定し、ロードで別個体へ変わらないよう保存する。
                const bossMonsterIds = [Number(selectedBossId)];
                const gimmicks = Guild.pickChallengeGimmicks(rarity);
                const gimmickIds = gimmicks.map(gimmick => String(gimmick.id));
                const scaling = Guild.getChallengeScaling(rarity, gimmickIds);
                const enemyBoost = {
                    statMultiplier: scaling.normalStatMultiplier,
                    rareStatMultiplier: scaling.normalStatMultiplier,
                    applyToRares: true,
                    nameSuffix: rarity === 'EX' ? '・異常個体' : '',
                    elmAtk: {},
                    traits: [],
                    extraSkillIds: Guild.getChallengeThemeSkillIds(theme, rarity === 'EX' ? 7 : 5)
                };
                if (gimmickIds.includes('element50') && theme?.element) enemyBoost.elmAtk[theme.element] = 50;
                if (gimmickIds.includes('regen10')) enemyBoost.traits.push({ id: 52, level: 10 });
                if (gimmickIds.includes('guts10')) enemyBoost.traits.push({ id: 18, level: 10 });
                const bossEnemyBoost = Guild.createChallengeBossEnemyBoost(enemyBoost);
                const rareChance = gimmickIds.some(idValue => idValue.startsWith('rare50')) ? 0.50 : (rarity === 'EX' ? 0.12 : rarity === 'UR' ? 0.06 : 0.03);
                const rewardItems = Guild.getRarityBonusRewards(rarityDef);
                if (rarity === 'EX' && Math.random() < 0.38) {
                    const traitBookId = Guild.pickRandom(Guild.getNonExchangeTraitBookIds());
                    if (traitBookId) rewardItems.push({ id: traitBookId, count: 1 });
                }
                const challengeRewards = Guild.getChallengeGuildRewards(power, rarity, bossOnly);
                const guildExp = challengeRewards.guildExp;
                const guildPoints = challengeRewards.guildPoints;
                const gimmickLabel = gimmicks.length ? gimmicks.map(value => value.label).join('／') : '追加ギミックなし';
                const questName = Guild.pickRandom(theme?.names) || `${theme?.label || '変異'}迷宮の討伐任務`;
                const generatedRequiredRank = Guild.rankIndex(challengeMaster.minGuildRank || 'C') >= Guild.rankIndex(rarityDef.minGuildRank || 'G')
                    ? String(challengeMaster.minGuildRank || 'C')
                    : String(rarityDef.minGuildRank || 'C');
                def = {
                    id,
                    name: `${questName}${bossOnly ? '・単独決戦' : ''}`,
                    area: `${theme?.label || '変異'}の依頼迷宮`,
                    kind: 'guildDungeon',
                    requiredRank: generatedRequiredRank,
                    objective: bossOnly
                        ? `指定された規格外ボスを撃破する。
特殊条件: ${gimmickLabel}`
                        : `${floorCount}階層の依頼迷宮を踏破し、最下層ボスを撃破する。
特殊条件: ${gimmickLabel}`,
                    startText: `ギルドが一時観測した${theme?.label || '変異'}属性の迷宮です。内容は依頼ごとに固定され、最下層の討伐確認で達成となります。`,
                    progressText: `依頼迷宮へ挑戦し、最下層のボスを討伐してください。
特殊条件: ${gimmickLabel}`,
                    completeText: `${theme?.label || '変異'}の依頼迷宮における最下層ボスの討伐が確認された。`,
                    rewardItems,
                    rewardEquipment: [{ floor: power, plus: 3, type: '武器', label: `RANK${power} 武器+3` }],
                    guildExp,
                    guildPoints,
                    guildQuest: true,
                    rarity,
                    difficultyLabel: rarityDef.difficultyLabel || '',
                    repeatable: true,
                    requestType: 'randomDungeonChallenge',
                    reportAt: 'guildReception',
                    generatedQuest: true,
                    generatorKind: 'challenge',
                    generatorKey: String(theme?.id || 'random'),
                    generatorSignature: spec.signature,
                    generatedAt: Date.now(),
                    sortOrder: 3000 + guildState.generatorSerial,
                    challenge: {
                        version: 2,
                        questId: id,
                        rarity,
                        themeId: String(theme?.id || 'random'),
                        themeLabel: String(theme?.label || '変異'),
                        element: theme?.element || null,
                        visualThemeId,
                        floorCount,
                        bossOnly,
                        power,
                        encounterRank: power,
                        normalMonsterIds,
                        rareMonsterIds,
                        rareChance,
                        bossMonsterIds,
                        bossStatMultiplier: scaling.bossStatMultiplier,
                        enemyBoost,
                        bossEnemyBoost,
                        allyAilments: gimmickIds.includes('rare50_toxic') ? ['ToxicPoison'] : [],
                        gimmicks: gimmicks.map(value => ({ id: value.id, label: value.label }))
                    }
                };
            } else if (spec.kind === 'abyss') {
                const abyss = GENERATOR_MASTER.abyss || {};
                const bandSize = Math.max(1, Math.floor(Number(abyss.bandSize) || 10));
                const balanceFloorMax = Guild.getRandomAbyssBalanceFloor(spec.floorMax);
                const bandIndex = Math.max(1, Math.ceil(balanceFloorMax / bandSize));
                const stepEvery = Math.max(1, Math.floor(Number(abyss.countStepEveryBands) || 4));
                const countStep = Math.floor((bandIndex - 1) / stepEvery);
                const rarityDef = Guild.rollRarity({ state: guildState, floorMax: spec.floorMax });
                const generatedRequiredRank = Guild.rankIndex(spec.requiredRank || 'G') >= Guild.rankIndex(rarityDef.minGuildRank || 'G')
                    ? String(spec.requiredRank || 'G')
                    : String(rarityDef.minGuildRank || 'G');
                const rawCount = Guild.randomInt(
                    Math.max(1, Math.floor(Number(abyss.countBaseMin) || 5) + countStep),
                    Math.max(1, Math.floor(Number(abyss.countBaseMax) || 8) + countStep)
                );
                const count = Math.max(1, Math.round(rawCount * Math.max(1, Number(rarityDef.countMultiplier || 1))));
                const namePrefix = Guild.pickRandom(abyss.names) || '深淵巡回';
                const rangeLabel = `地下${spec.floorMin}～${spec.floorMax}階`;
                const guildExp = Math.max(1, Math.round((
                    Number(abyss.expBase || 0)
                    + bandIndex * Number(abyss.expPerBand || 0)
                    + rawCount * Number(abyss.expPerKill || 0)
                ) * Math.max(1, Number(rarityDef.expMultiplier || 1)) + Math.max(0, Number(rarityDef.expFlat || 0))));
                const guildPoints = Math.max(1, Math.round((
                    Number(abyss.pointsBase || 0)
                    + bandIndex * Number(abyss.pointsPerBand || 0)
                    + rawCount * Number(abyss.pointsPerKill || 0)
                ) * Math.max(1, Number(rarityDef.gpMultiplier || 1)) + Math.max(0, Number(rarityDef.gpFlat || 0))));
                def = {
                    id,
                    name: `${namePrefix}・${rangeLabel}`,
                    area: `ランダム深淵 ${rangeLabel}`,
                    kind: 'hunt',
                    unlockFlags: ['abyssRandomUnlocked'],
                    requiredMaxAbyssFloor: spec.floorMax,
                    objective: `ランダム深淵 ${rangeLabel}で、通常戦闘の魔物を合計${count}体討伐する。`,
                    startText: `到達済みのランダム深淵 ${rangeLabel}について、魔物の間引き依頼が発行された。種類は問わない。`,
                    progressText: `ランダム深淵 ${rangeLabel}で通常戦闘の魔物を${count}体討伐し、ライザーク要塞のギルド受付へ報告しよう。`,
                    targetCount: count,
                    completeText: `ランダム深淵 ${rangeLabel}の観測路が安定し、巡回依頼を完了した。`,
                    rewardItems: Guild.getRarityBonusRewards(rarityDef),
                    requiredRank: generatedRequiredRank,
                    guildExp,
                    guildPoints,
                    guildQuest: true,
                    rarity: rarityDef.id,
                    difficultyLabel: rarityDef.difficultyLabel || '',
                    difficultyMultiplier: Math.max(1, Number(rarityDef.countMultiplier || 1)),
                    repeatable: true,
                    regionKey: 'ABYSS',
                    requestType: 'hunt',
                    reportAt: 'guildReception',
                    sortOrder: 2000 + bandIndex * 10 + guildState.generatorSerial,
                    huntScope: {
                        mode: 'floorRange',
                        areaKeys: ['ABYSS'],
                        label: 'ランダム深淵',
                        floorMin: spec.floorMin,
                        floorMax: spec.floorMax,
                        abyssMode: 'random',
                        normalBattlesOnly: true
                    },
                    spawnAreaLabel: `ランダム深淵 ${rangeLabel}`,
                    generatedQuest: true,
                    generatorKind: 'abyss',
                    generatorKey: `${spec.floorMin}-${spec.floorMax}`,
                    generatorSignature: spec.signature,
                    generatedAt: Date.now()
                };
            }

            if (!def) return null;
            if (def.kind === 'hunt' && (!Array.isArray(def.rewardItems) || !def.rewardItems.length)) {
                def.rewardItems = Guild.getEffectiveRewardItems(def);
            }
            guildState.generatedQuests[id] = def;
            return def;
        },

        pruneGeneratedQuests(state = null) {
            const guildState = state || (typeof App !== 'undefined' ? App.data?.progress?.guild : null);
            if (!guildState?.generatedQuests) return;
            const keep = new Set(guildState.offers || []);
            Object.entries(guildState.questStates || {}).forEach(([id, questState]) => {
                if (questState?.state === 'accepted') keep.add(id);
            });
            Object.keys(guildState.generatedQuests).forEach(id => {
                if (keep.has(id)) return;
                delete guildState.generatedQuests[id];
                if (guildState.questStates?.[id]?.state !== 'accepted') delete guildState.questStates[id];
                delete guildState.completionCounts?.[id];
            });
        },

        migrateGeneratedAbyssQuestDefinition(def, storedVersion = 0) {
            if (!def || def.generatorKind !== 'abyss' || storedVersion >= 6) return def;
            const scope = def.huntScope && typeof def.huntScope === 'object' ? def.huntScope : {};
            const oldFloorMin = Math.max(1, Math.floor(Number(scope.floorMin || 1)));
            const oldFloorMax = Math.max(oldFloorMin, Math.floor(Number(scope.floorMax || oldFloorMin)));
            const wasLegacyRandom = oldFloorMin > 100;
            const floorMin = wasLegacyRandom ? Math.max(1, oldFloorMin - 100) : oldFloorMin;
            const floorMax = wasLegacyRandom ? Math.max(floorMin, oldFloorMax - 100) : oldFloorMax;
            const abyssMode = 'random';
            const areaLabel = 'ランダム深淵';
            const rangeLabel = `地下${floorMin}～${floorMax}階`;
            const count = Math.max(1, Math.floor(Number(def.targetCount || 1)));
            const namePrefix = String(def.name || '深淵巡回').replace(/・地下\d+～\d+階.*$/, '') || '深淵巡回';

            def.name = `${namePrefix}・${rangeLabel}`;
            def.area = `${areaLabel} ${rangeLabel}`;
            def.unlockFlags = ['abyssRandomUnlocked'];
            def.requiredMaxAbyssFloor = floorMax;
            def.objective = `${areaLabel} ${rangeLabel}で、通常戦闘の魔物を合計${count}体討伐する。`;
            def.startText = `到達済みの${areaLabel} ${rangeLabel}について、魔物の間引き依頼が発行された。種類は問わない。`;
            def.progressText = `${areaLabel} ${rangeLabel}で通常戦闘の魔物を${count}体討伐し、ライザーク要塞のギルド受付へ報告しよう。`;
            def.regionKey = 'ABYSS';
            def.huntScope = {
                ...scope,
                mode: 'floorRange',
                areaKeys: ['ABYSS'],
                label: areaLabel,
                floorMin,
                floorMax,
                abyssMode,
                normalBattlesOnly: true
            };
            def.spawnAreaLabel = `${areaLabel} ${rangeLabel}`;
            def.generatorKey = `${floorMin}-${floorMax}`;
            def.generatorSignature = `abyss:${floorMin}-${floorMax}`;
            return def;
        },

        migrateGeneratedChallengeQuestDefinition(def, storedVersion = 0) {
            if (!def || def.generatorKind !== 'challenge') return def;
            const challenge = def.challenge && typeof def.challenge === 'object' ? def.challenge : {};
            if (storedVersion >= 7 && Number(challenge.version || 0) >= 2) return def;

            const rarity = String(challenge.rarity || def.rarity || 'SSR').toUpperCase();
            const maxReferenceRank = Math.max(35, Number(Guild.getChallengeMaster().maxReferenceRank || 220));
            const power = Math.max(35, Math.min(maxReferenceRank, Math.floor(Number(
                challenge.encounterRank || challenge.power || def.rewardEquipment?.[0]?.floor || 90
            ) || 90)));
            const gimmickIds = (Array.isArray(challenge.gimmicks) ? challenge.gimmicks : [])
                .map(gimmick => String(gimmick?.id || gimmick || ''))
                .filter(Boolean);
            const scaling = Guild.getChallengeScaling(rarity, gimmickIds);
            const enemyBoost = challenge.enemyBoost && typeof challenge.enemyBoost === 'object'
                ? JSON.parse(JSON.stringify(challenge.enemyBoost))
                : {};
            enemyBoost.statMultiplier = scaling.normalStatMultiplier;
            enemyBoost.rareStatMultiplier = scaling.normalStatMultiplier;
            enemyBoost.applyToRares = true;

            const rewards = Guild.getChallengeGuildRewards(power, rarity, challenge.bossOnly === true);
            def.guildExp = rewards.guildExp;
            def.guildPoints = rewards.guildPoints;
            if (Array.isArray(def.rewardEquipment) && def.rewardEquipment[0]) {
                def.rewardEquipment[0].floor = power;
                def.rewardEquipment[0].label = `RANK${power} 武器+${Number(def.rewardEquipment[0].plus ?? 3)}`;
            }
            def.challenge = {
                ...challenge,
                version: 2,
                rarity,
                power,
                encounterRank: power,
                bossStatMultiplier: scaling.bossStatMultiplier,
                enemyBoost,
                bossEnemyBoost: Guild.createChallengeBossEnemyBoost(enemyBoost)
            };
            return def;
        },

        migrateGeneratorState(state) {
            if (!state) return;
            if (!state.generatedQuests || typeof state.generatedQuests !== 'object' || Array.isArray(state.generatedQuests)) {
                state.generatedQuests = {};
            }
            const storedVersion = Math.max(0, Math.floor(Number(state.generatorSchemaVersion) || 0));
            Object.entries(state.generatedQuests).forEach(([id, def]) => {
                if (!def || typeof def !== 'object' || Array.isArray(def) || def.generatedQuest !== true || String(def.id || '') !== String(id)) {
                    delete state.generatedQuests[id];
                    return;
                }
                Guild.migrateGeneratedAbyssQuestDefinition(def, storedVersion);
                Guild.migrateGeneratedChallengeQuestDefinition(def, storedVersion);
                if (!def.rarity) def.rarity = 'R';
                const rarityDef = Guild.getRarityDefinition(def.rarity);
                def.rarity = rarityDef.id;
                if (!def.difficultyLabel) def.difficultyLabel = rarityDef.difficultyLabel || '';
                if (def.kind === 'hunt' && (!Array.isArray(def.rewardItems) || !def.rewardItems.length)) {
                    def.rewardItems = Guild.getEffectiveRewardItems(def);
                }
            });
            state.generatorSerial = Math.max(0, Math.floor(Number(state.generatorSerial) || 0));
            state.generatedCompletionTotal = Math.max(0, Math.floor(Number(state.generatedCompletionTotal) || 0));
            if (storedVersion < GENERATOR_SCHEMA_VERSION) {
                state.offers = (state.offers || []).filter(id => state.questStates?.[id]?.state === 'accepted');
                state.generatorSchemaVersion = GENERATOR_SCHEMA_VERSION;
            }
            Guild.pruneGeneratedQuests(state);
        },

        fillOfferSlots(options = {}) {
            const state = Guild.ensureState();
            if (!state) return [];
            const avoidIds = new Set(Array.isArray(options.avoidIds) ? options.avoidIds : []);
            const ratio = Math.max(0, Math.min(1, Number(GENERATOR_MASTER.generatedOfferRatio) || 0));
            let signatures = Guild.getCurrentOfferSignatures(state);
            let abyssOfferCount = [...signatures].filter(signature => String(signature).startsWith('abyss:')).length;
            let challengeOfferCount = [...signatures].filter(signature => String(signature).startsWith('challenge:')).length;
            const maxAbyssOffers = Math.max(1, Math.floor(Number(GENERATOR_MASTER.abyss?.maxOffersOnBoard) || 2));
            const challengeMaster = Guild.getChallengeMaster();
            const maxChallengeOffers = Math.max(1, Math.floor(Number(challengeMaster.maxOffersOnBoard) || 2));
            const abyssWeight = Math.max(0, Math.min(1, Number(GENERATOR_MASTER.abyss?.offerWeight) || 0.35));
            const challengeWeight = Math.max(0, Math.min(1, Number(challengeMaster.offerWeight) || 0.48));
            let specs = Guild.buildGeneratorSpecs(signatures);
            let forceChallenge = challengeOfferCount === 0 && specs.some(spec => spec.kind === 'challenge');
            let forceAbyss = abyssOfferCount === 0 && specs.some(spec => spec.kind === 'abyss');
            let guard = 0;

            const registerGenerated = (spec, def) => {
                if (!def) return null;
                signatures.add(spec.signature);
                if (spec.kind === 'challenge') {
                    challengeOfferCount += 1;
                    forceChallenge = false;
                }
                if (spec.kind === 'abyss') {
                    abyssOfferCount += 1;
                    forceAbyss = false;
                }
                return def.id;
            };

            while (state.offers.length < Guild.maxOffers && guard < Guild.maxOffers * 10) {
                guard += 1;
                const staticCandidates = Guild.availableCandidates([...state.offers, ...avoidIds]).filter(id => {
                    const signature = Guild.getQuestGeneratorSignature(id, Guild.getStaticDefinitions()[id]);
                    return !signature || !signatures.has(signature);
                });
                specs = Guild.buildGeneratorSpecs(signatures).filter(spec => {
                    if (spec.kind === 'abyss' && abyssOfferCount >= maxAbyssOffers) return false;
                    if (spec.kind === 'challenge' && challengeOfferCount >= maxChallengeOffers) return false;
                    return true;
                });
                const generatedPreferred = forceChallenge || forceAbyss
                    || (specs.length > 0 && (staticCandidates.length === 0 || Math.random() < ratio));
                let addedId = null;

                if (generatedPreferred && specs.length) {
                    const challengeSpecs = specs.filter(spec => spec.kind === 'challenge');
                    const abyssSpecs = specs.filter(spec => spec.kind === 'abyss');
                    const normalSpecs = specs.filter(spec => spec.kind === 'normal');
                    let pool = specs;
                    if (forceChallenge && challengeSpecs.length) pool = challengeSpecs;
                    else if (forceAbyss && abyssSpecs.length) pool = abyssSpecs;
                    else {
                        const roll = Math.random();
                        if (challengeSpecs.length && roll < challengeWeight) pool = challengeSpecs;
                        else if (abyssSpecs.length && roll < challengeWeight + abyssWeight * (1 - challengeWeight)) pool = abyssSpecs;
                        else if (normalSpecs.length) pool = normalSpecs;
                        else if (challengeSpecs.length) pool = challengeSpecs;
                        else if (abyssSpecs.length) pool = abyssSpecs;
                    }
                    const spec = Guild.pickRandom(pool);
                    addedId = registerGenerated(spec, Guild.createGeneratedQuest(spec, state));
                }

                if (!addedId && staticCandidates.length) {
                    addedId = Guild.pickCandidates(staticCandidates, 1, state.refreshCount + state.generatorSerial)[0] || null;
                }

                if (!addedId && specs.length) {
                    const spec = Guild.pickRandom(specs);
                    addedId = registerGenerated(spec, Guild.createGeneratedQuest(spec, state));
                }

                if (!addedId) break;
                state.questStates[addedId] = { state: 'available', progress: {} };
                state.offers.push(addedId);
            }
            Guild.pruneGeneratedQuests(state);
            return state.offers;
        },

        getHuntScope(def) {
            const raw = (def && def.huntScope && typeof def.huntScope === 'object') ? def.huntScope : {};
            const areaKeys = [...new Set((Array.isArray(raw.areaKeys) ? raw.areaKeys : (Array.isArray(def?.targetAreaKeys) ? def.targetAreaKeys : []))
                .map(value => String(value || '').trim())
                .filter(Boolean))];
            const allowedModes = new Set(['monster', 'dungeon', 'floorRange']);
            const mode = allowedModes.has(String(raw.mode || '')) ? String(raw.mode) : 'monster';
            const floorMin = Math.max(1, Math.floor(Number(raw.floorMin || 1)));
            const floorMax = Math.max(floorMin, Math.floor(Number(raw.floorMax || floorMin)));
            return {
                mode,
                areaKeys,
                label: String(raw.label || def?.area || '').trim(),
                floorMin,
                floorMax,
                abyssMode: raw.abyssMode ? String(raw.abyssMode) : '',
                normalBattlesOnly: raw.normalBattlesOnly === true
            };
        },

        normalizeBattleContext(context = {}) {
            const fieldAvailable = typeof Field !== 'undefined';
            const currentMap = fieldAvailable ? Field.currentMapData : null;
            const areaKey = String(
                context.areaKey ||
                context.mapAreaKey ||
                (fieldAvailable && typeof Field.getCurrentAreaKey === 'function' ? Field.getCurrentAreaKey() : '') ||
                App.data?.location?.area ||
                'WORLD'
            );
            const canonicalAreaKey = String(context.canonicalAreaKey || currentMap?.canonicalAreaKey || areaKey);
            return {
                areaKey,
                canonicalAreaKey,
                isDungeon: context.isDungeon !== undefined
                    ? !!context.isDungeon
                    : !!(currentMap?.isDungeon || areaKey === 'ABYSS'),
                isFixed: context.isFixed !== undefined ? !!context.isFixed : !!currentMap?.isFixed,
                floor: Math.max(1, Number(context.floor || currentMap?.floor || App.data?.progress?.floor || 1)),
                abyssMode: String(context.abyssMode || App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode || currentMap?.abyssMode || ''),
                isBossBattle: context.isBossBattle !== undefined
                    ? !!context.isBossBattle
                    : !!App.data?.battle?.isBossBattle,
                guildPromotionTrial: context.guildPromotionTrial !== undefined
                    ? !!context.guildPromotionTrial
                    : !!App.data?.battle?.guildPromotionTrial,
                countsForGuildQuests: context.countsForGuildQuests !== false
            };
        },

        isHuntBattleEligible(def, context = {}) {
            const scope = Guild.getHuntScope(def);
            const battle = Guild.normalizeBattleContext(context);
            if (!battle.countsForGuildQuests || battle.guildPromotionTrial) return false;
            const battleKeys = new Set([battle.areaKey, battle.canonicalAreaKey].filter(Boolean));
            if (scope.areaKeys.length && !scope.areaKeys.some(key => battleKeys.has(key))) return false;
            if (scope.abyssMode && battle.abyssMode !== scope.abyssMode) return false;
            if ((scope.mode === 'dungeon' || scope.mode === 'floorRange') && !battle.isDungeon) return false;
            if (scope.normalBattlesOnly && battle.isBossBattle) return false;
            if (scope.mode === 'floorRange' && (battle.floor < scope.floorMin || battle.floor > scope.floorMax)) return false;
            return true;
        },

        getHuntProgressIncrement(def, monsterIds = [], context = {}) {
            if (!def || def.kind !== 'hunt' || !Guild.isHuntBattleEligible(def, context)) return 0;
            const normalizedIds = (Array.isArray(monsterIds) ? monsterIds : [])
                .map(Number)
                .filter(id => Number.isFinite(id) && id > 0);
            if (!normalizedIds.length) return 0;
            const scope = Guild.getHuntScope(def);
            if (scope.mode === 'dungeon' || scope.mode === 'floorRange') return normalizedIds.length;
            const targets = (def.targetMonsterIds || []).map(Number).filter(Number.isFinite);
            if (!targets.length) return 0;
            return normalizedIds.filter(monsterId => targets.includes(monsterId)).length;
        },

        rankIndex(rank) {
            const index = RANKS.indexOf(String(rank || 'G').toUpperCase());
            return index >= 0 ? index : 0;
        },

        nextRank(rank) {
            const index = Guild.rankIndex(rank);
            return index < RANKS.length - 1 ? RANKS[index + 1] : null;
        },

        resolveQuestId(id) {
            const value = String(id || '');
            return LEGACY_QUEST_ID_MAP[value] || value;
        },

        mergeQuestState(current, incoming) {
            if (!current) return incoming ? JSON.parse(JSON.stringify(incoming)) : null;
            if (!incoming) return current;
            const priority = { accepted: 3, completed: 2, available: 1 };
            const currentPriority = priority[current.state] || 0;
            const incomingPriority = priority[incoming.state] || 0;
            if (incomingPriority > currentPriority) return JSON.parse(JSON.stringify(incoming));
            if (incomingPriority < currentPriority) return current;
            const currentTime = Number(current.completedAt || current.startedAt || 0);
            const incomingTime = Number(incoming.completedAt || incoming.startedAt || 0);
            return incomingTime > currentTime ? JSON.parse(JSON.stringify(incoming)) : current;
        },

        migrateStateToMaster(state) {
            const defs = Guild.getDefinitions();
            const normalizedStates = {};
            Object.entries(state.questStates || {}).forEach(([storedId, questState]) => {
                const id = Guild.resolveQuestId(storedId);
                if (!defs[id]) return;
                normalizedStates[id] = Guild.mergeQuestState(normalizedStates[id], questState);
            });
            state.questStates = normalizedStates;

            const normalizedCounts = {};
            Object.entries(state.completionCounts || {}).forEach(([storedId, count]) => {
                const id = Guild.resolveQuestId(storedId);
                if (!defs[id]) return;
                normalizedCounts[id] = Math.max(Number(normalizedCounts[id] || 0), Math.max(0, Math.floor(Number(count) || 0)));
            });
            state.completionCounts = normalizedCounts;

            state.offers = [...new Set((state.offers || [])
                .map(id => Guild.resolveQuestId(id))
                .filter(id => !!defs[id]))];

            // 旧版では町別掲示板依頼が通常クエスト領域へ保存されていた。
            // 旧IDと新IDの両方を受け取り、ギルド専用領域へ移してから削除する。
            const legacyQuests = App.data.progress.quests || {};
            Object.keys(legacyQuests).forEach(storedId => {
                const id = Guild.resolveQuestId(storedId);
                if (!defs[id]) return;
                const old = legacyQuests[storedId];
                if (old?.state === 'accepted') {
                    state.questStates[id] = Guild.mergeQuestState(state.questStates[id], old);
                } else if (old?.state === 'completed') {
                    state.completionCounts[id] = Math.max(1, Number(state.completionCounts[id] || 0));
                }
                delete legacyQuests[storedId];
            });

            state.masterSchemaVersion = Math.max(1, Number(global.GUILD_QUEST_SCHEMA_VERSION) || 1);
            state.migrationV1 = true;
        },

        ensureState() {
            if (typeof App === 'undefined' || !App.data) return null;
            if (!App.data.progress) App.data.progress = {};
            const current = App.data.progress.guild;
            if (!current || typeof current !== 'object' || Array.isArray(current)) {
                App.data.progress.guild = {};
            }
            const state = App.data.progress.guild;
            if (!RANKS.includes(state.rank)) state.rank = 'G';
            state.exp = Math.max(0, Math.floor(Number(state.exp) || 0));
            state.points = Math.max(0, Math.floor(Number(state.points) || 0));
            if (!Array.isArray(state.offers)) state.offers = [];
            if (!state.questStates || typeof state.questStates !== 'object' || Array.isArray(state.questStates)) state.questStates = {};
            if (!state.completionCounts || typeof state.completionCounts !== 'object' || Array.isArray(state.completionCounts)) state.completionCounts = {};
            if (!state.generatedQuests || typeof state.generatedQuests !== 'object' || Array.isArray(state.generatedQuests)) state.generatedQuests = {};
            state.refreshCount = Math.max(0, Math.floor(Number(state.refreshCount) || 0));
            state.generatorSerial = Math.max(0, Math.floor(Number(state.generatorSerial) || 0));

            Guild.migrateGeneratorState(state);
            Guild.migrateStateToMaster(state);
            Guild.ensureDailyAcceptState(state);

            return state;
        },

        getQuestState(id) {
            id = Guild.resolveQuestId(id);
            const state = Guild.ensureState();
            return state?.questStates?.[id] || { state: 'available', progress: {} };
        },

        isQuestUnlocked(id) {
            id = Guild.resolveQuestId(id);
            return Guild.isDefinitionUnlocked(Guild.getDefinitions()[id]);
        },

        availableCandidates(exclude = []) {
            const excluded = new Set(exclude);
            const state = Guild.ensureState();
            return Object.keys(Guild.getStaticDefinitions()).filter(id => {
                if (excluded.has(id) || !Guild.isQuestUnlocked(id)) return false;
                return Guild.getQuestState(id).state !== 'accepted';
            }).sort((a, b) => {
                const ca = Number(state.completionCounts[a] || 0);
                const cb = Number(state.completionCounts[b] || 0);
                if (ca !== cb) return ca - cb;
                const da = Guild.getStaticDefinitions()[a];
                const db = Guild.getStaticDefinitions()[b];
                return Guild.rankIndex(da.requiredRank) - Guild.rankIndex(db.requiredRank) || a.localeCompare(b);
            });
        },

        pickCandidates(candidates, count, salt = 0) {
            const pool = [...candidates];
            const picked = [];
            let seed = (Date.now() + Number(salt || 0) * 1103515245) >>> 0;
            while (pool.length && picked.length < count) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                const index = seed % pool.length;
                picked.push(pool.splice(index, 1)[0]);
            }
            return picked;
        },

        ensureOffers(options = {}) {
            const state = Guild.ensureState();
            if (!state) return [];
            const defs = Guild.getDefinitions();
            const accepted = Object.keys(state.questStates).filter(id => state.questStates[id]?.state === 'accepted' && defs[id]);
            const keep = [];
            [...accepted, ...state.offers].forEach(id => {
                if (!defs[id] || keep.includes(id)) return;
                if (Guild.getQuestState(id).state === 'accepted' || Guild.isQuestUnlocked(id)) keep.push(id);
            });
            state.offers = keep.slice(0, Guild.maxOffers);
            Guild.fillOfferSlots(options);
            if (options.save !== false && typeof App.save === 'function') App.save();
            return state.offers;
        },

        refreshOffers() {
            const state = Guild.ensureState();
            if (!state) return [];
            const accepted = state.offers.filter(id => Guild.getQuestState(id).state === 'accepted');
            const previousAvailable = state.offers.filter(id => Guild.getQuestState(id).state !== 'accepted');
            state.refreshCount += 1;
            state.offers = [...accepted];
            Guild.pruneGeneratedQuests(state);
            Guild.fillOfferSlots({ avoidIds: previousAvailable });
            App.save();
            return state.offers;
        },

        acceptQuest(id) {
            id = Guild.resolveQuestId(id);
            const state = Guild.ensureState();
            if (!state || !state.offers.includes(id) || !Guild.isQuestUnlocked(id)) return false;
            if (Guild.getQuestState(id).state === 'accepted') return true;
            const dailyInfo = Guild.getDailyAcceptInfo(state);
            if (!dailyInfo || dailyInfo.remaining <= 0) {
                Guild.lastAcceptError = '本日の依頼受注可能数を使い切っています。';
                return false;
            }
            state.questStates[id] = { state: 'accepted', startedAt: Date.now(), progress: {} };
            dailyInfo.daily.acceptedCount += 1;
            Guild.lastAcceptError = '';
            App.save();
            return true;
        },

        noteQuestKills(monsterIds = [], context = {}, options = {}) {
            if (!Array.isArray(monsterIds) || !monsterIds.length) return [];
            const state = Guild.ensureState();
            if (!state) return [];
            const updated = [];
            Object.entries(state.questStates).forEach(([id, questState]) => {
                if (questState?.state !== 'accepted') return;
                const def = Guild.getDefinitions()[id];
                const gained = Guild.getHuntProgressIncrement(def, monsterIds, context);
                if (!gained) return;
                if (!questState.progress || typeof questState.progress !== 'object') questState.progress = {};
                questState.progress.kills = Math.min(Number(def.targetCount || 1), Number(questState.progress.kills || 0) + gained);
                updated.push(id);
            });
            if (updated.length && options.save !== false) App.save();
            return updated;
        },

        cancelQuest(id) {
            id = Guild.resolveQuestId(id);
            const state = Guild.ensureState();
            const def = Guild.getDefinitions()[id];
            const current = state?.questStates?.[id];
            if (!state || !def || current?.state !== 'accepted') return false;

            // Cancellation discards only this attempt's progress and releases the occupied
            // board slot. A different unlocked request is preferred for the replacement so
            // the player does not immediately see the cancelled request forced back on them.
            state.questStates[id] = {
                state: 'available',
                progress: {},
                cancelledAt: Date.now()
            };
            state.offers = state.offers.filter(offerId => offerId !== id);
            state.refreshCount += 1;

            Guild.pruneGeneratedQuests(state);
            Guild.fillOfferSlots({ avoidIds: [id] });
            App.save();
            if (typeof MenuStatus !== 'undefined' && typeof MenuStatus.render === 'function') MenuStatus.render();
            return true;
        },

        isObjectiveComplete(id) {
            id = Guild.resolveQuestId(id);
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def || state.state !== 'accepted') return false;
            if (def.kind === 'hunt') return Number(state.progress?.kills || 0) >= Math.max(1, Number(def.targetCount || 1));
            if (def.kind === 'guildDungeon') return state.progress?.bossDefeated === true;
            if (Array.isArray(def.itemRequirements)) {
                return def.itemRequirements.every(req => Number(App.data?.items?.[Number(req.id ?? req.itemId)] || 0) >= Math.max(1, Number(req.count || 1)));
            }
            return false;
        },

        targetSummary(id) {
            id = Guild.resolveQuestId(id);
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return '';
            if (def.kind === 'hunt') {
                const scope = Guild.getHuntScope(def);
                const current = Math.min(Number(def.targetCount || 1), Number(state.progress?.kills || 0));
                const required = Math.max(1, Number(def.targetCount || 1));
                if (scope.mode === 'floorRange') {
                    const location = scope.label || '深淵の魔窟';
                    return `対象階層: ${location} 地下${scope.floorMin}～${scope.floorMax}階
対象: 通常戦闘の魔物（種類不問）
進捗: ${current}/${required}`;
                }
                if (scope.mode === 'dungeon') {
                    const location = scope.label ? `討伐場所: ${scope.label}
` : '';
                    return `${location}対象: ダンジョン内の魔物（種類不問）
進捗: ${current}/${required}`;
                }
                const names = (def.targetMonsterIds || []).map(monsterId => App.getQuestMonsterName?.(monsterId) || `モンスター${monsterId}`).join(' / ');
                const spawnArea = String(def.spawnAreaLabel || scope.label || def.area || '').trim();
                const location = spawnArea ? `出現地域: ${spawnArea}
` : '';
                return `${location}対象: ${names || '指定魔物'}
進捗: ${current}/${required}`;
            }
            if (def.kind === 'guildDungeon') {
                const challenge = def.challenge || {};
                const gimmicks = (challenge.gimmicks || []).map(value => value.label || value.id).filter(Boolean).join('／') || 'なし';
                const status = state.progress?.bossDefeated ? '最下層ボス討伐済み' : '未討伐';
                return `依頼迷宮: ${challenge.themeLabel || def.area || '変異迷宮'}
階層: ${challenge.bossOnly ? 'ボス戦のみ' : `${Math.max(1, Number(challenge.floorCount || 1))}階層`}
特殊条件: ${gimmicks}
進捗: ${status}`;
            }
            if (Array.isArray(def.itemRequirements)) {
                return def.itemRequirements.map(req => {
                    const itemId = Number(req.id ?? req.itemId);
                    const item = DB.ITEMS?.find(entry => Number(entry.id) === itemId);
                    const required = Math.max(1, Number(req.count || 1));
                    return `${item?.name || `アイテム${itemId}`}: ${Math.min(required, Number(App.data?.items?.[itemId] || 0))}/${required}`;
                }).join('\n');
            }
            return '';
        },

        rewardSummary(def) {
            const rows = [];
            Guild.getEffectiveRewardItems(def).forEach(reward => {
                const itemId = Number(reward.id ?? reward.itemId);
                const item = DB.ITEMS?.find(entry => Number(entry.id) === itemId);
                rows.push(`${item?.name || `アイテム${itemId}`} x${Math.max(1, Number(reward.count || 1))}`);
            });
            (def.rewardEquipment || []).forEach(reward => rows.push(String(reward.label || `RANK${reward.floor || 1} 装備+${reward.plus || 0}`)));
            rows.push(`ギルド経験値 +${Number(def.guildExp || 0)}`)
            rows.push(`ギルドポイント +${Number(def.guildPoints || 0)}`);
            return rows.join('\n');
        },

        consumeRequirements(def) {
            if (!Array.isArray(def.itemRequirements) || !def.consumeItemsOnComplete) return true;
            if (!def.itemRequirements.every(req => Number(App.data.items?.[Number(req.id ?? req.itemId)] || 0) >= Math.max(1, Number(req.count || 1)))) return false;
            def.itemRequirements.forEach(req => {
                const id = Number(req.id ?? req.itemId);
                const remain = Number(App.data.items[id] || 0) - Math.max(1, Number(req.count || 1));
                if (remain > 0) App.data.items[id] = remain;
                else delete App.data.items[id];
            });
            return true;
        },

        createRewardEquipment(reward = {}) {
            const requiredType = String(reward.type || '武器');
            const matches = equip => requiredType === '武器'
                ? (equip?.type === '武器' || equip?.type === 'weapon')
                : equip?.type === requiredType;
            let equip = null;
            for (let attempt = 0; attempt < 80 && !matches(equip); attempt += 1) {
                equip = App.createEquipByFloor('guildQuest', Math.max(1, Number(reward.floor || 1)), Number(reward.plus ?? 3));
            }
            if (!matches(equip) && Array.isArray(global.EQUIP_MASTER)) {
                const pool = global.EQUIP_MASTER.filter(base => !base.noRandom && matches(base))
                    .filter(base => Number(base.rank || 1) <= Math.max(1, Number(reward.floor || 1)));
                const base = Guild.pickRandom(pool);
                if (base && typeof App.createEquipById === 'function') equip = App.createEquipById(base.eid, Number(reward.plus ?? 3));
            }
            if (equip) equip.source = 'guildQuest';
            return matches(equip) ? equip : null;
        },

        reportQuest(id) {
            id = Guild.resolveQuestId(id);
            const state = Guild.ensureState();
            const def = Guild.getDefinitions()[id];
            if (!state || !def || !Guild.isObjectiveComplete(id) || !Guild.consumeRequirements(def)) return null;
            if (!App.data.items) App.data.items = {};
            Guild.getEffectiveRewardItems(def).forEach(reward => {
                const itemId = Number(reward.id ?? reward.itemId);
                App.data.items[itemId] = Number(App.data.items[itemId] || 0) + Math.max(1, Number(reward.count || 1));
            });
            if (!Array.isArray(App.data.inventory)) App.data.inventory = [];
            const equipmentRewards = (def.rewardEquipment || []).map(reward => Guild.createRewardEquipment(reward)).filter(Boolean);
            equipmentRewards.forEach(equip => App.data.inventory.push(equip));
            state.exp += Math.max(0, Number(def.guildExp || 0));
            state.points += Math.max(0, Number(def.guildPoints || 0));
            if (def.generatedQuest) state.generatedCompletionTotal = Number(state.generatedCompletionTotal || 0) + 1;
            else state.completionCounts[id] = Number(state.completionCounts[id] || 0) + 1;
            App.incrementLifetimeStat?.('totalGuildQuestCompletions', 1, { save: false });
            state.questStates[id] = { state: 'completed', completedAt: Date.now(), progress: {} };
            state.offers = state.offers.filter(offerId => offerId !== id);
            Guild.pruneGeneratedQuests(state);
            Guild.fillOfferSlots({ avoidIds: [id] });
            App.save();
            if (typeof MenuStatus !== 'undefined' && typeof MenuStatus.render === 'function') MenuStatus.render();
            return { def, guildExp: Number(def.guildExp || 0), guildPoints: Number(def.guildPoints || 0), equipmentRewards };
        },

        startChallengeQuest(id) {
            id = Guild.resolveQuestId(id);
            const def = Guild.getDefinitions()[id];
            const questState = Guild.getQuestState(id);
            if (!def || def.kind !== 'guildDungeon' || questState.state !== 'accepted' || questState.progress?.bossDefeated) return false;
            if (typeof Dungeon === 'undefined' || typeof Dungeon.startGuildQuestRun !== 'function') return false;
            if (typeof Facilities !== 'undefined' && typeof Facilities.closeModal === 'function') Facilities.closeModal('guild-scene');
            return Dungeon.startGuildQuestRun(id, def.challenge || {});
        },

        markChallengeBossDefeated(id) {
            id = Guild.resolveQuestId(id);
            const state = Guild.ensureState();
            const questState = state?.questStates?.[id];
            if (!questState || questState.state !== 'accepted') return false;
            if (!questState.progress || typeof questState.progress !== 'object') questState.progress = {};
            questState.progress.bossDefeated = true;
            questState.progress.bossDefeatedAt = Date.now();
            App.save();
            return true;
        },

        currentExpProgress() {
            const state = Guild.ensureState();
            const next = Guild.nextRank(state?.rank);
            if (!state || !next) return { current: state?.exp || 0, required: state?.exp || 0, remaining: 0, next: null };
            const required = EXP_THRESHOLDS[next];
            return { current: state.exp, required, remaining: Math.max(0, required - state.exp), next };
        },

        canTakePromotion() {
            const state = Guild.ensureState();
            const progress = Guild.currentExpProgress();
            return !!(state && progress.next && state.exp >= progress.required);
        },

        startPromotionTrial() {
            const state = Guild.ensureState();
            const next = Guild.nextRank(state?.rank);
            if (!next || !Guild.canTakePromotion()) return false;
            const trial = PROMOTION_TRIALS[next];
            const opponent = trial ? global.MonsterData?.getMonsterById?.(Number(trial.monsterId)) : null;
            if (!trial || !opponent?.isGuildPromotionBoss || opponent.promotionRank !== next) return false;
            App.data.battle = {
                active: false,
                isBossBattle: true,
                fixedBossId: trial.monsterId,
                preventEscape: true,
                suppressFixedBossDefeat: true,
                guildPromotionTrial: true,
                guildPromotionTrialId: trial.id,
                guildPromotionTarget: next
            };
            state.pendingPromotion = next;
            App.save();
            if (typeof Facilities !== 'undefined' && typeof Facilities.closeModal === 'function') Facilities.closeModal('guild-scene');
            App.changeScene('battle');
            return true;
        },

        completePromotionTrial(targetRank) {
            const state = Guild.ensureState();
            const next = Guild.nextRank(state?.rank);
            if (!state || !targetRank || next !== targetRank
                || state.pendingPromotion !== targetRank
                || state.exp < EXP_THRESHOLDS[targetRank]) return null;
            state.rank = targetRank;
            state.pendingPromotion = null;
            Guild.ensureOffers({ save: false });
            App.save();
            return `${targetRank}ランク昇格試験に合格した！\n冒険者ランクが ${targetRank} になった。`;
        },

        exchange(entryId) {
            const state = Guild.ensureState();
            const entry = EXCHANGE.find(value => value.id === entryId);
            if (!state || !entry || state.points < entry.cost) return false;
            if (entry.requiredRank && Guild.rankIndex(state.rank) < Guild.rankIndex(entry.requiredRank)) return false;
            state.points -= entry.cost;
            if (entry.gems) App.data.gems = Number(App.data.gems || 0) + Number(entry.gems);
            if (entry.itemId) {
                if (!App.data.items) App.data.items = {};
                App.data.items[entry.itemId] = Number(App.data.items[entry.itemId] || 0) + Math.max(1, Number(entry.count || 1));
            }
            App.save();
            return true;
        },

        freeRest() {
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('heal_spring');
            (App.data.characters || []).forEach(character => {
                const stats = App.calcStats(character);
                character.currentHp = stats.maxHp;
                character.currentMp = stats.maxMp;
            });
            App.save();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            Menu.msg('要塞の宿泊所で休んだ。\nＨＰ・ＭＰが全回復した！');
            return true;
        },

        returnFromBoard() {
            const mode = Guild.boardReturnMode || 'field';
            Guild.boardReturnMode = 'field';
            App.changeScene('field');
            if (mode === 'magicCommunication' && typeof Menu !== 'undefined') {
                setTimeout(() => Menu.openSubScreen?.('crafting'), 0);
            }
        },

        getQuestReferenceRank(definition = {}) {
            if (definition.kind !== 'guildDungeon') return null;
            const rank = Math.floor(Number(definition.challenge?.encounterRank || definition.challenge?.power || 0));
            return Number.isFinite(rank) && rank > 0 ? rank : null;
        },

        questCard(id, options = {}) {
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return '';
            const ready = Guild.isObjectiveComplete(id);
            const status = ready ? '報告可能' : state.state === 'accepted' ? '受注中' : '受注可能';
            const color = ready ? '#8cff9d' : state.state === 'accepted' ? '#ffd56b' : '#b9d9ff';
            const rewardSummary = Guild.getCompactRewardSummary(def);
            return `<button class="btn guild-quest-entry" data-guild-quest-id="${App.escapeHtml(id)}" style="width:100%; text-align:left; margin:0 0 8px; padding:10px; background:#17191d; border:1px solid #655b43; color:#fff; border-radius:6px;">
                <span style="display:flex; justify-content:space-between; gap:8px; align-items:center;"><strong style="display:flex; align-items:center; min-width:0;">${Guild.rarityBadgeHtml(def)}<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${App.escapeHtml(def.name)}</span></strong><small style="color:${color}; white-space:nowrap;">${status}</small></span>
                <span style="display:block; color:#c8b998; font-size:10px; margin-top:4px;">必要ランク ${App.escapeHtml(def.requiredRank || 'G')}${Guild.getQuestReferenceRank(def) ? ` / 参考Rank ${Guild.getQuestReferenceRank(def)}` : ''} / 危険度 ${App.escapeHtml(Guild.getDifficultyLabel(def))} / ${App.escapeHtml(App.getQuestKindLabel?.(def.kind) || def.kind)}</span>
                <span style="display:block; color:#aaa; font-size:11px; line-height:1.45; margin-top:5px; white-space:pre-wrap;">${App.escapeHtml(def.objective || '')}</span>
                <span style="display:block; color:#dff0c8; font-size:9px; line-height:1.45; margin-top:6px; padding-top:5px; border-top:1px solid #3c4432; white-space:normal;">報酬: ${App.escapeHtml(rewardSummary)}</span>
            </button>`;
        },

        showQuestDetail(id) {
            id = Guild.resolveQuestId(id);
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return;
            const ready = Guild.isObjectiveComplete(id);
            const accepted = state.state === 'accepted';
            const challengeButton = accepted && def.kind === 'guildDungeon' && !ready
                ? `<button id="guild-detail-challenge" class="menu-btn" style="width:100%; margin-top:12px; border-color:#7ca4ff; color:#e6eeff; background:#15284b;">依頼迷宮へ挑戦</button>`
                : '';
            const actionButton = accepted
                ? `${challengeButton}<button id="guild-detail-cancel" class="menu-btn" style="width:100%; margin-top:8px; border-color:#a65b5b; color:#ffd4d4;">依頼をキャンセルする</button>`
                : `<button id="guild-detail-accept" class="menu-btn" style="width:100%; margin-top:12px;">受注する</button>`;
            const travelAreaKey = accepted ? App.resolveQuestTravelAreaKey?.(def) : null;
            const travelButton = travelAreaKey
                ? `<button id="guild-detail-travel" class="menu-btn" style="width:100%; margin-top:8px; border-color:#5c96b5; color:#dff4ff; background:#183445;">対象エリア入口へ移動</button>`
                : '';
            Facilities.showModal('guild-scene', def.name, `
                <div style="font-size:11px; color:#d9bd7d; display:flex; align-items:center; flex-wrap:wrap;">${Guild.rarityBadgeHtml(def)}必要ランク ${def.requiredRank || 'G'}${Guild.getQuestReferenceRank(def) ? ` / 参考Rank ${Guild.getQuestReferenceRank(def)}` : ''} / ${App.getQuestKindLabel?.(def.kind) || def.kind} / 危険度 ${App.escapeHtml(Guild.getDifficultyLabel(def))}</div>
                <div style="font-size:12px; line-height:1.65; margin-top:10px; white-space:pre-wrap;">${App.escapeHtml(state.state === 'accepted' ? (def.progressText || def.objective) : (def.startText || def.objective))}</div>
                <div style="margin-top:10px; padding:9px; border:1px solid #444; white-space:pre-wrap; font-size:11px;">${App.escapeHtml(Guild.targetSummary(id))}</div>
                <div style="margin-top:8px; padding:9px; border:1px solid #5e4d2e; color:#dff0c8; white-space:pre-wrap; font-size:11px;">${App.escapeHtml(Guild.rewardSummary(def))}</div>
                ${ready ? '<div style="color:#8cff9d; margin-top:8px; font-size:11px;">達成済みです。受付職員へ報告してください。</div>' : ''}
                ${actionButton}
                ${travelButton}
            `, { onClose: () => Guild.openBoard({ preserveReturn: true }) });
            const accept = document.getElementById('guild-detail-accept');
            if (accept) accept.onclick = () => {
                if (Guild.acceptQuest(id)) Guild.openBoard({ preserveReturn: true });
                else if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') Menu.msg(Guild.lastAcceptError || '依頼を受注できませんでした。', () => Guild.showQuestDetail(id));
            };
            const challenge = document.getElementById('guild-detail-challenge');
            if (challenge) challenge.onclick = () => Guild.startChallengeQuest(id);
            const travel = document.getElementById('guild-detail-travel');
            if (travel) travel.onclick = () => {
                Facilities.closeModal?.('guild-scene');
                App.requestSkyPrismTravelTo?.(travelAreaKey, def.area || def.name || travelAreaKey);
            };
            const cancel = document.getElementById('guild-detail-cancel');
            if (cancel) cancel.onclick = () => {
                const execute = () => {
                    if (!Guild.cancelQuest(id)) return;
                    Guild.openBoard({ preserveReturn: true });
                };
                if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
                    Menu.confirm('この依頼をキャンセルしますか？\n現在の進捗は失われます。', execute);
                } else {
                    execute();
                }
            };
        },

        openBoard(options = {}) {
            if (options.returnMode) Guild.boardReturnMode = String(options.returnMode);
            else if (!options.preserveReturn) Guild.boardReturnMode = 'field';

            const scene = document.getElementById('guild-scene');
            if (!scene || scene.style.display === 'none') App.changeScene('guild');
            const state = Guild.ensureState();
            Guild.ensureOffers({ save: false });
            const html = state.offers.map(id => Guild.questCard(id)).join('');
            const dailyInfo = Guild.getDailyAcceptInfo(state);
            const adButton = dailyInfo.adAvailable
                ? '<button id="guild-board-ad-bonus" class="menu-btn" style="min-height:38px; padding:7px 6px; border-color:#8bbcff; color:#dcecff; font-size:10px; line-height:1.35;">広告視聴で受注枠 +10</button>'
                : '<button class="menu-btn" disabled style="min-height:38px; padding:7px 6px; border-color:#444; color:#666; background:#171717; font-size:10px; line-height:1.35;">広告追加済み</button>';
            Facilities.showModal('guild-scene', '依頼掲示板', `
                <div style="height:100%; min-height:0; display:flex; flex-direction:column;">
                    <div style="flex-shrink:0;">
                        <div style="font-size:10px; line-height:1.5; color:#aaa;">依頼は最大5件。Cランク以上ではSSR以上の依頼迷宮が発生します。受注中の依頼は更新しても残ります。</div>
                        <div style="margin-top:7px; padding:8px; border:1px solid #5d513a; background:rgba(67,48,16,.18);">
                            <div style="display:flex; justify-content:space-between; gap:8px; align-items:center; color:${dailyInfo.remaining > 0 ? '#ffe49a' : '#ff9f9f'}; font-size:11px; font-weight:bold;">
                                <span>本日の受注: ${dailyInfo.used}/${dailyInfo.limit}</span>
                                <span>残り ${dailyInfo.remaining}件</span>
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:7px;">
                                <button id="guild-board-refresh" class="menu-btn" style="min-height:38px; padding:7px 6px; font-size:10px;">依頼を更新</button>
                                ${adButton}
                            </div>
                        </div>
                        <div style="font-size:10px; color:#ffd56b; margin:9px 2px 6px;">紹介中のギルドクエスト</div>
                    </div>
                    <div id="guild-board-quest-list" class="scroll-area" style="flex:1 1 auto; min-height:0; overflow-y:auto; padding-right:5px; overscroll-behavior:contain;">
                        ${html || '<div style="padding:16px; color:#888; text-align:center;">現在紹介できる依頼はありません。</div>'}
                    </div>
                </div>
            `, {
                onClose: () => Guild.returnFromBoard(),
                modalMaxWidth: '420px',
                modalHeight: 'calc(100% - 24px)',
                modalMaxHeight: 'calc(100% - 24px)',
                bodyFlex: true,
                bodyMaxHeight: 'none',
                bodyOverflowY: 'hidden',
                closeMarginTop: '9px',
                layerPadding: '12px'
            });
            document.querySelectorAll('.guild-quest-entry').forEach(button => {
                button.onclick = () => Guild.showQuestDetail(button.dataset.guildQuestId);
            });
            const refresh = document.getElementById('guild-board-refresh');
            if (refresh) refresh.onclick = () => {
                Guild.refreshOffers();
                Guild.openBoard({ preserveReturn: true });
            };
            const adBonus = document.getElementById('guild-board-ad-bonus');
            if (adBonus) adBonus.onclick = () => Guild.grantDailyAcceptAdBonus();
        },

        openReportMenu() {
            const state = Guild.ensureState();
            const accepted = Object.keys(state.questStates).filter(id => state.questStates[id]?.state === 'accepted');
            const rows = accepted.map(id => {
                const def = Guild.getDefinitions()[id];
                const ready = Guild.isObjectiveComplete(id);
                return `<button class="btn guild-report-entry" data-guild-quest-id="${App.escapeHtml(id)}" ${ready ? '' : 'disabled'} style="width:100%; text-align:left; margin-top:8px; padding:10px; background:${ready ? '#263b25' : '#222'}; border:1px solid ${ready ? '#79c878' : '#444'}; color:${ready ? '#fff' : '#777'};">
                    <strong>${Guild.rarityBadgeHtml(def)}${App.escapeHtml(def?.name || id)}</strong><span style="float:right; font-size:10px;">${ready ? '報告する' : '未達成'}</span>
                    <span style="display:block; clear:both; font-size:10px; margin-top:5px; white-space:pre-wrap;">${App.escapeHtml(Guild.targetSummary(id))}</span>
                </button>`;
            }).join('');
            Facilities.showModal('guild-scene', '依頼の報告', rows || '<div style="padding:18px; color:#888; text-align:center;">受注中の依頼はありません。</div>');
            document.querySelectorAll('.guild-report-entry:not([disabled])').forEach(button => {
                button.onclick = () => {
                    const result = Guild.reportQuest(button.dataset.guildQuestId);
                    if (!result) return;
                    Guild.initFacility();
                    const equipmentText = (result.equipmentRewards || []).map(equip => `装備獲得: ${equip.name}${Number(equip.plus || 0) > 0 ? ` +${equip.plus}` : ''}`).join('<br>');
                    Facilities.showModal('guild-scene', '報告完了', `<div style="line-height:1.7;">${App.escapeHtml(result.def.completeText || '依頼を達成した。')}<br><br><span style="color:#ffd56b;">ギルド経験値 +${result.guildExp}<br>ギルドポイント +${result.guildPoints}${equipmentText ? `<br>${App.escapeHtml(equipmentText).replace(/&lt;br&gt;/g, '<br>')}` : ''}</span></div>`);
                };
            });
        },

        openTrialMenu() {
            const state = Guild.ensureState();
            const progress = Guild.currentExpProgress();
            if (!progress.next) {
                Facilities.showModal('guild-scene', '昇格試験', '<div style="padding:18px; text-align:center; color:#ffd56b;">すでに最高ランクです。</div>');
                return;
            }
            const trial = PROMOTION_TRIALS[progress.next];
            const opponent = trial ? global.MonsterData?.getMonsterById?.(Number(trial.monsterId)) : null;
            if (!trial || !opponent?.isGuildPromotionBoss || opponent.promotionRank !== progress.next) {
                Facilities.showModal('guild-scene', '昇格試験', '<div style="padding:18px; text-align:center; color:#f88;">昇格試験マスターが見つかりません。</div>');
                return;
            }
            const ready = Guild.canTakePromotion();
            Facilities.showModal('guild-scene', '昇格試験', `
                <div style="line-height:1.7;">次のランク: <b style="color:#ffd56b;">${progress.next}</b><br>必要経験値: ${progress.required}<br>現在経験値: ${state.exp}</div>
                <div style="margin-top:10px; padding:10px; border:1px solid #555;">${App.escapeHtml(trial.name)}<br><span style="color:#ddd;">対戦相手: ${App.escapeHtml(opponent.name)}</span><br><span style="font-size:12px; color:#bbb;">${App.escapeHtml(trial.objective || '')}</span><br><small style="color:#f88;">この戦闘からは逃げられません。</small></div>
                <button id="guild-trial-start" class="menu-btn" ${ready ? '' : 'disabled'} style="width:100%; margin-top:12px;">${ready ? '試験を受ける' : `あと ${progress.remaining} 経験値必要`}</button>
            `);
            const start = document.getElementById('guild-trial-start');
            if (start && ready) start.onclick = () => Guild.startPromotionTrial();
        },

        exchangeName(entry) {
            if (entry.gems) return `${entry.gems} GEM`;
            const item = DB.ITEMS?.find(value => Number(value.id) === Number(entry.itemId));
            return `${item?.name || `アイテム${entry.itemId}`} x${entry.count || 1}`;
        },

        openExchangeMenu() {
            const state = Guild.ensureState();
            const rows = EXCHANGE.map(entry => {
                const locked = entry.requiredRank && Guild.rankIndex(state.rank) < Guild.rankIndex(entry.requiredRank);
                const affordable = state.points >= entry.cost && !locked;
                return `<button class="btn guild-exchange-entry" data-exchange-id="${entry.id}" ${affordable ? '' : 'disabled'} style="width:100%; display:flex; justify-content:space-between; padding:10px; margin-top:7px; background:#202020; border:1px solid #555; color:${affordable ? '#fff' : '#777'};">
                    <span>${App.escapeHtml(Guild.exchangeName(entry))}${locked ? ` <small>(${entry.requiredRank}ランク)</small>` : ''}</span><strong>${entry.cost} GP</strong>
                </button>`;
            }).join('');
            Facilities.showModal('guild-scene', 'ギルドポイント交換', `<div style="color:#ffd56b;">所持: ${state.points} GP</div>${rows}`);
            document.querySelectorAll('.guild-exchange-entry:not([disabled])').forEach(button => {
                button.onclick = () => {
                    const entry = EXCHANGE.find(value => value.id === button.dataset.exchangeId);
                    if (!Guild.exchange(button.dataset.exchangeId)) return;
                    Guild.initFacility();
                    Menu.msg(`${Guild.exchangeName(entry)}と交換した！`, () => Guild.openExchangeMenu());
                };
            });
        },

        initFacility() {
            const state = Guild.ensureState();
            if (!state || typeof Facilities === 'undefined') return;
            Guild.ensureOffers({ save: false });
            const progress = Guild.currentExpProgress();
            const commands = `
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Guild.openReportMenu()">クエスト報告</button>
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Guild.openTrialMenu()">昇格試験</button>
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Guild.openExchangeMenu()">GP交換</button>`;
            Facilities.setupBaseLayout('guild-scene', 'ライザーク冒険者ギルド', 'facility_bg_guild', commands, "App.changeScene('field')");
            const body = document.getElementById('guild-scene-msg-content');
            if (body) body.innerHTML = `
                「依頼の受注は掲示板、達成報告はこちらで承ります」<br><br>
                <div style="border:1px solid #665438; padding:10px; background:rgba(20,12,4,.7);">
                    <div style="display:flex; justify-content:space-between;"><span>冒険者ランク</span><strong style="font-size:24px; color:#ffd56b;">${state.rank}</strong></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px;"><span>ギルド経験値</span><strong>${state.exp}${progress.next ? ` / ${progress.required}` : ''}</strong></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px;"><span>次のランクまで</span><strong>${progress.next ? `${progress.remaining} EXP` : '最高ランク'}</strong></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px;"><span>ギルドポイント</span><strong style="color:#9cf;">${state.points} GP</strong></div>
                </div>`;
        }
    };

    global.Guild = Guild;

    if (typeof App !== 'undefined') {
        App.getGuildQuestDefinitions = () => Guild.getDefinitions();
        App.getGuildQuestState = id => Guild.getQuestState(id);
        App.isGuildQuestObjectiveComplete = id => Guild.isObjectiveComplete(id);
    }
})(typeof window !== 'undefined' ? window : globalThis);
