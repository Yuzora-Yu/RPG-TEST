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
    const LEGACY_QUEST_ID_MAP = global.GUILD_QUEST_LEGACY_ID_MAP || {};
    const GENERATOR_MASTER = global.GUILD_QUEST_GENERATOR_MASTER || {};
    const GENERATOR_SCHEMA_VERSION = Math.max(0, Math.floor(Number(GENERATOR_MASTER.schemaVersion) || 0));


    const Guild = {
        maxOffers: Math.max(1, Number(MASTER.maxOffers) || 5),
        ranks: RANKS,
        rankDefinitions: RANK_DEFS,
        expThresholds: EXP_THRESHOLDS,
        promotionTrials: PROMOTION_TRIALS,
        exchangeEntries: EXCHANGE,

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

        rankForAbyssFloor(floor) {
            const bands = Array.isArray(GENERATOR_MASTER.abyss?.rankBands) ? GENERATOR_MASTER.abyss.rankBands : [];
            const value = Math.max(1, Math.floor(Number(floor) || 1));
            const match = bands.find(entry => value <= Math.max(1, Math.floor(Number(entry.maxFloor) || 1)));
            return String(match?.rank || 'S').toUpperCase();
        },

        isDefinitionUnlocked(def) {
            const state = Guild.ensureState();
            if (!def || !state) return false;
            const flags = App.data?.progress?.flags || {};
            const required = def.requiredRank || 'G';
            const unlockFlags = Array.isArray(def.unlockFlags) ? def.unlockFlags : [];
            const requiredMaxAbyssFloor = Math.max(0, Math.floor(Number(def.requiredMaxAbyssFloor || 0)));
            const reachedAbyssFloor = Math.max(0, Math.floor(Number(App.data?.dungeon?.maxFloor || 0)));
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
            if (abyss.enabled !== false && flags.abyssFirstEntered && reached >= minFloor) {
                for (let floorMin = minFloor; floorMin <= reached; floorMin += bandSize) {
                    const floorMax = Math.min(reached, floorMin + bandSize - 1);
                    const signature = `abyss:${floorMin}-${floorMax}`;
                    if (excludedSignatures.has(signature)) continue;
                    const requiredRank = Guild.rankForAbyssFloor(floorMax);
                    const probe = {
                        requiredRank,
                        unlockFlags: ['abyssFirstEntered'],
                        requiredMaxAbyssFloor: floorMax
                    };
                    if (!Guild.isDefinitionUnlocked(probe)) continue;
                    specs.push({ kind: 'abyss', signature, floorMin, floorMax, requiredRank });
                }
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
                const count = Guild.randomInt(template.countMin, template.countMax);
                const baseCount = Math.max(1, Math.floor(Number(base.targetCount) || count));
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
                    objective: `${label}内で魔物を合計${count}体討伐する。`,
                    startText: `${label}の通行路を確保するため、種類を問わない臨時討伐依頼が出された。`,
                    progressText: `${label}内で魔物を${count}体討伐し、ライザーク要塞のギルド受付へ報告しよう。`,
                    completeText: `${label}の安全が確保され、依頼は完了となった。`,
                    targetCount: count,
                    targetMonsterIds: undefined,
                    spawnAreaLabel: undefined,
                    rewardItems: [],
                    guildExp: Math.max(1, Math.round(Number(base.guildExp || 0) + (count - baseCount) * expPerExtra + expJitter)),
                    guildPoints: Math.max(1, Math.round(Number(base.guildPoints || 0) + (count - baseCount) * pointsPerExtra + pointsJitter)),
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
            } else if (spec.kind === 'abyss') {
                const abyss = GENERATOR_MASTER.abyss || {};
                const bandSize = Math.max(1, Math.floor(Number(abyss.bandSize) || 10));
                const bandIndex = Math.max(1, Math.ceil(Number(spec.floorMax || 1) / bandSize));
                const stepEvery = Math.max(1, Math.floor(Number(abyss.countStepEveryBands) || 4));
                const countStep = Math.floor((bandIndex - 1) / stepEvery);
                const count = Guild.randomInt(
                    Math.max(1, Math.floor(Number(abyss.countBaseMin) || 5) + countStep),
                    Math.max(1, Math.floor(Number(abyss.countBaseMax) || 8) + countStep)
                );
                const namePrefix = Guild.pickRandom(abyss.names) || '深淵巡回';
                const rangeLabel = `地下${spec.floorMin}～${spec.floorMax}階`;
                const guildExp = Math.max(1, Math.round(
                    Number(abyss.expBase || 0)
                    + bandIndex * Number(abyss.expPerBand || 0)
                    + count * Number(abyss.expPerKill || 0)
                ));
                const guildPoints = Math.max(1, Math.round(
                    Number(abyss.pointsBase || 0)
                    + bandIndex * Number(abyss.pointsPerBand || 0)
                    + count * Number(abyss.pointsPerKill || 0)
                ));
                def = {
                    id,
                    name: `${namePrefix}・${rangeLabel}`,
                    area: `深淵の魔窟 ${rangeLabel}`,
                    kind: 'hunt',
                    unlockFlags: ['abyssFirstEntered'],
                    requiredMaxAbyssFloor: spec.floorMax,
                    objective: `深淵の魔窟 ${rangeLabel}で、通常戦闘の魔物を合計${count}体討伐する。`,
                    startText: `到達済みの観測路 ${rangeLabel}について、魔物の間引き依頼が発行された。種類は問わない。`,
                    progressText: `深淵の魔窟 ${rangeLabel}で通常戦闘の魔物を${count}体討伐し、ライザーク要塞のギルド受付へ報告しよう。`,
                    targetCount: count,
                    completeText: `深淵の魔窟 ${rangeLabel}の観測路が安定し、巡回依頼を完了した。`,
                    rewardItems: [],
                    requiredRank: spec.requiredRank,
                    guildExp,
                    guildPoints,
                    guildQuest: true,
                    repeatable: true,
                    regionKey: 'ABYSS',
                    requestType: 'hunt',
                    reportAt: 'guildReception',
                    sortOrder: 2000 + bandIndex * 10 + guildState.generatorSerial,
                    huntScope: {
                        mode: 'floorRange',
                        areaKeys: ['ABYSS'],
                        label: '深淵の魔窟',
                        floorMin: spec.floorMin,
                        floorMax: spec.floorMax,
                        normalBattlesOnly: true
                    },
                    spawnAreaLabel: `深淵の魔窟 ${rangeLabel}`,
                    generatedQuest: true,
                    generatorKind: 'abyss',
                    generatorKey: `${spec.floorMin}-${spec.floorMax}`,
                    generatorSignature: spec.signature,
                    generatedAt: Date.now()
                };
            }

            if (!def) return null;
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

        migrateGeneratorState(state) {
            if (!state) return;
            if (!state.generatedQuests || typeof state.generatedQuests !== 'object' || Array.isArray(state.generatedQuests)) {
                state.generatedQuests = {};
            }
            Object.entries(state.generatedQuests).forEach(([id, def]) => {
                if (!def || typeof def !== 'object' || Array.isArray(def) || def.generatedQuest !== true || String(def.id || '') !== String(id)) {
                    delete state.generatedQuests[id];
                }
            });
            state.generatorSerial = Math.max(0, Math.floor(Number(state.generatorSerial) || 0));
            state.generatedCompletionTotal = Math.max(0, Math.floor(Number(state.generatedCompletionTotal) || 0));
            const storedVersion = Math.max(0, Math.floor(Number(state.generatorSchemaVersion) || 0));
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
            let specs = Guild.buildGeneratorSpecs(signatures);
            let abyssOfferCount = [...signatures].filter(signature => String(signature).startsWith('abyss:')).length;
            const maxAbyssOffers = Math.max(1, Math.floor(Number(GENERATOR_MASTER.abyss?.maxOffersOnBoard) || 2));
            const abyssOfferWeight = Math.max(0, Math.min(1, Number(GENERATOR_MASTER.abyss?.offerWeight) || 0.35));
            let forceAbyss = abyssOfferCount === 0 && specs.some(spec => spec.kind === 'abyss');
            let guard = 0;

            while (state.offers.length < Guild.maxOffers && guard < Guild.maxOffers * 8) {
                guard += 1;
                const staticCandidates = Guild.availableCandidates([...state.offers, ...avoidIds]).filter(id => {
                    const signature = Guild.getQuestGeneratorSignature(id, Guild.getStaticDefinitions()[id]);
                    return !signature || !signatures.has(signature);
                });
                specs = Guild.buildGeneratorSpecs(signatures).filter(spec => spec.kind !== 'abyss' || abyssOfferCount < maxAbyssOffers);
                let generatedPreferred = forceAbyss || (specs.length > 0 && (staticCandidates.length === 0 || Math.random() < ratio));
                let addedId = null;

                if (generatedPreferred && specs.length) {
                    const normalSpecs = specs.filter(spec => spec.kind === 'normal');
                    const abyssSpecs = specs.filter(spec => spec.kind === 'abyss');
                    let pool = specs;
                    if (forceAbyss && abyssSpecs.length) pool = abyssSpecs;
                    else if (normalSpecs.length && abyssSpecs.length) pool = Math.random() < abyssOfferWeight ? abyssSpecs : normalSpecs;
                    else if (normalSpecs.length) pool = normalSpecs;
                    else if (abyssSpecs.length) pool = abyssSpecs;
                    const spec = Guild.pickRandom(pool);
                    const def = Guild.createGeneratedQuest(spec, state);
                    if (def) {
                        addedId = def.id;
                        signatures.add(spec.signature);
                        if (spec.kind === 'abyss') {
                            abyssOfferCount += 1;
                            forceAbyss = false;
                        }
                    }
                }

                if (!addedId && staticCandidates.length) {
                    addedId = Guild.pickCandidates(staticCandidates, 1, state.refreshCount + state.generatorSerial)[0] || null;
                }

                if (!addedId && specs.length) {
                    const spec = Guild.pickRandom(specs);
                    const def = Guild.createGeneratedQuest(spec, state);
                    if (def) {
                        addedId = def.id;
                        signatures.add(spec.signature);
                        if (spec.kind === 'abyss') abyssOfferCount += 1;
                    }
                }

                if (!addedId) break;
                const addedDef = Guild.getDefinitions()[addedId];
                const addedSignature = Guild.getQuestGeneratorSignature(addedId, addedDef);
                if (addedSignature && !signatures.has(addedSignature)) {
                    signatures.add(addedSignature);
                    if (addedSignature.startsWith('abyss:')) {
                        abyssOfferCount += 1;
                        forceAbyss = false;
                    }
                }
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
            state.questStates[id] = { state: 'accepted', startedAt: Date.now(), progress: {} };
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
            (def.rewardItems || []).forEach(reward => {
                const itemId = Number(reward.id ?? reward.itemId);
                const item = DB.ITEMS?.find(entry => Number(entry.id) === itemId);
                rows.push(`${item?.name || `アイテム${itemId}`} x${Math.max(1, Number(reward.count || 1))}`);
            });
            rows.push(`ギルド経験値 +${Number(def.guildExp || 0)}`);
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

        reportQuest(id) {
            id = Guild.resolveQuestId(id);
            const state = Guild.ensureState();
            const def = Guild.getDefinitions()[id];
            if (!state || !def || !Guild.isObjectiveComplete(id) || !Guild.consumeRequirements(def)) return null;
            if (!App.data.items) App.data.items = {};
            (def.rewardItems || []).forEach(reward => {
                const itemId = Number(reward.id ?? reward.itemId);
                App.data.items[itemId] = Number(App.data.items[itemId] || 0) + Math.max(1, Number(reward.count || 1));
            });
            state.exp += Math.max(0, Number(def.guildExp || 0));
            state.points += Math.max(0, Number(def.guildPoints || 0));
            if (def.generatedQuest) state.generatedCompletionTotal = Number(state.generatedCompletionTotal || 0) + 1;
            else state.completionCounts[id] = Number(state.completionCounts[id] || 0) + 1;
            state.questStates[id] = { state: 'completed', completedAt: Date.now(), progress: {} };
            state.offers = state.offers.filter(offerId => offerId !== id);
            Guild.pruneGeneratedQuests(state);
            Guild.fillOfferSlots({ avoidIds: [id] });
            App.save();
            if (typeof MenuStatus !== 'undefined' && typeof MenuStatus.render === 'function') MenuStatus.render();
            return { def, guildExp: Number(def.guildExp || 0), guildPoints: Number(def.guildPoints || 0) };
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

        questCard(id, options = {}) {
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return '';
            const ready = Guild.isObjectiveComplete(id);
            const status = ready ? '報告可能' : state.state === 'accepted' ? '受注中' : '受注可能';
            const color = ready ? '#8cff9d' : state.state === 'accepted' ? '#ffd56b' : '#b9d9ff';
            return `<button class="btn guild-quest-entry" data-guild-quest-id="${App.escapeHtml(id)}" style="width:100%; text-align:left; margin-top:8px; padding:10px; background:#17191d; border:1px solid #655b43; color:#fff; border-radius:6px;">
                <span style="display:flex; justify-content:space-between; gap:8px;"><strong>${App.escapeHtml(def.name)}</strong><small style="color:${color};">${status}</small></span>
                <span style="display:block; color:#c8b998; font-size:10px; margin-top:4px;">必要ランク ${App.escapeHtml(def.requiredRank || 'G')} / ${App.escapeHtml(App.getQuestKindLabel?.(def.kind) || def.kind)}</span>
                <span style="display:block; color:#aaa; font-size:11px; line-height:1.5; margin-top:5px; white-space:pre-wrap;">${App.escapeHtml(def.objective || '')}</span>
            </button>`;
        },

        showQuestDetail(id) {
            id = Guild.resolveQuestId(id);
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return;
            const ready = Guild.isObjectiveComplete(id);
            const accepted = state.state === 'accepted';
            const actionButton = accepted
                ? `<button id="guild-detail-cancel" class="menu-btn" style="width:100%; margin-top:12px; border-color:#a65b5b; color:#ffd4d4;">依頼をキャンセルする</button>`
                : `<button id="guild-detail-accept" class="menu-btn" style="width:100%; margin-top:12px;">受注する</button>`;
            Facilities.showModal('guild-scene', def.name, `
                <div style="font-size:11px; color:#d9bd7d;">必要ランク ${def.requiredRank || 'G'} / ${App.getQuestKindLabel?.(def.kind) || def.kind}</div>
                <div style="font-size:12px; line-height:1.65; margin-top:10px; white-space:pre-wrap;">${App.escapeHtml(state.state === 'accepted' ? (def.progressText || def.objective) : (def.startText || def.objective))}</div>
                <div style="margin-top:10px; padding:9px; border:1px solid #444; white-space:pre-wrap; font-size:11px;">${App.escapeHtml(Guild.targetSummary(id))}</div>
                <div style="margin-top:8px; padding:9px; border:1px solid #5e4d2e; color:#dff0c8; white-space:pre-wrap; font-size:11px;">${App.escapeHtml(Guild.rewardSummary(def))}</div>
                ${ready ? '<div style="color:#8cff9d; margin-top:8px; font-size:11px;">達成済みです。受付職員へ報告してください。</div>' : ''}
                ${actionButton}
            `, { onClose: () => Guild.openBoard() });
            const accept = document.getElementById('guild-detail-accept');
            if (accept) accept.onclick = () => {
                Guild.acceptQuest(id);
                Guild.openBoard();
            };
            const cancel = document.getElementById('guild-detail-cancel');
            if (cancel) cancel.onclick = () => {
                const execute = () => {
                    if (!Guild.cancelQuest(id)) return;
                    Guild.openBoard();
                };
                if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
                    Menu.confirm('この依頼をキャンセルしますか？\n現在の進捗は失われます。', execute);
                } else {
                    execute();
                }
            };
        },

        openBoard() {
            const scene = document.getElementById('guild-scene');
            if (!scene || scene.style.display === 'none') App.changeScene('guild');
            const state = Guild.ensureState();
            Guild.ensureOffers({ save: false });
            const html = state.offers.map(id => Guild.questCard(id)).join('');
            Facilities.showModal('guild-scene', '依頼掲示板', `
                <div style="font-size:11px; color:#aaa;">依頼は最大5件。討伐数と報酬は依頼ごとに変動します。深淵の依頼は到達済み階層だけが対象となり、深層ほど報酬が増えます。更新しても受注中の依頼は残ります。</div>
                ${html || '<div style="padding:16px; color:#888;">現在紹介できる依頼はありません。</div>'}
                <button id="guild-board-refresh" class="menu-btn" style="width:100%; margin-top:12px;">依頼を更新する</button>
            `, { onClose: () => App.changeScene('field') });
            document.querySelectorAll('.guild-quest-entry').forEach(button => {
                button.onclick = () => Guild.showQuestDetail(button.dataset.guildQuestId);
            });
            const refresh = document.getElementById('guild-board-refresh');
            if (refresh) refresh.onclick = () => { Guild.refreshOffers(); Guild.openBoard(); };
        },

        openReportMenu() {
            const state = Guild.ensureState();
            const accepted = Object.keys(state.questStates).filter(id => state.questStates[id]?.state === 'accepted');
            const rows = accepted.map(id => {
                const def = Guild.getDefinitions()[id];
                const ready = Guild.isObjectiveComplete(id);
                return `<button class="btn guild-report-entry" data-guild-quest-id="${App.escapeHtml(id)}" ${ready ? '' : 'disabled'} style="width:100%; text-align:left; margin-top:8px; padding:10px; background:${ready ? '#263b25' : '#222'}; border:1px solid ${ready ? '#79c878' : '#444'}; color:${ready ? '#fff' : '#777'};">
                    <strong>${App.escapeHtml(def?.name || id)}</strong><span style="float:right; font-size:10px;">${ready ? '報告する' : '未達成'}</span>
                    <span style="display:block; clear:both; font-size:10px; margin-top:5px; white-space:pre-wrap;">${App.escapeHtml(Guild.targetSummary(id))}</span>
                </button>`;
            }).join('');
            Facilities.showModal('guild-scene', '依頼の報告', rows || '<div style="padding:18px; color:#888; text-align:center;">受注中の依頼はありません。</div>');
            document.querySelectorAll('.guild-report-entry:not([disabled])').forEach(button => {
                button.onclick = () => {
                    const result = Guild.reportQuest(button.dataset.guildQuestId);
                    if (!result) return;
                    Guild.initFacility();
                    Facilities.showModal('guild-scene', '報告完了', `<div style="line-height:1.7;">${App.escapeHtml(result.def.completeText || '依頼を達成した。')}<br><br><span style="color:#ffd56b;">ギルド経験値 +${result.guildExp}<br>ギルドポイント +${result.guildPoints}</span></div>`);
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
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Guild.openReportMenu()">報告する</button>
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Guild.openTrialMenu()">試験を受ける</button>
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff; grid-column:span 2;" onclick="Guild.openExchangeMenu()">交換する</button>`;
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
