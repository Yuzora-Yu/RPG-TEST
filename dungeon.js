/* dungeon.js (完全統合版: 物語深淵 / ランダム深淵の階層分離) */

// 深淵の表示階層と、旧来のバランス階層を分離する唯一の正本。
// story : 従来の物語深淵 1～100階（表示階層＝バランス階層）
// random: 旧101階以降を1階から表示（バランス階層＝表示階層+100）
const ABYSS_FLOOR_RULES = Object.freeze({
    SCHEMA_VERSION: 2,
    MODE_STORY: 'story',
    MODE_RANDOM: 'random',
    MODE_GUILD: 'guild',
    MODE_MEMORY: 'memory',
    RANDOM_BALANCE_OFFSET: 100,
    MEMORY_BALANCE_OFFSET: 90,
    RANDOM_ENDLESS_START_FLOOR: 101,
    normalizeFloor(value, fallback = 1) {
        const floor = Math.floor(Number(value));
        return Number.isFinite(floor) ? Math.max(1, floor) : Math.max(1, Math.floor(Number(fallback) || 1));
    },
    normalizeMode(mode, fallback = 'story') {
        return ['story', 'random', 'guild', 'memory'].includes(String(mode)) ? String(mode) : fallback;
    },
    getMode(data = globalThis.App?.data) {
        const guildRun = data?.dungeon?.guildQuestRun;
        if (guildRun?.active && guildRun?.questId) return 'guild';
        return this.normalizeMode(data?.dungeon?.abyssMode, 'random');
    },
    getBalanceFloor(displayFloor, mode = null) {
        const floor = this.normalizeFloor(displayFloor);
        const normalizedMode = this.normalizeMode(mode || this.getMode());
        if (normalizedMode === 'random') return floor + this.RANDOM_BALANCE_OFFSET;
        if (normalizedMode === 'memory') return floor + this.MEMORY_BALANCE_OFFSET;
        return floor;
    },
    isRandomMode(mode = null) {
        return this.normalizeMode(mode || this.getMode()) === 'random';
    },
    isStoryMode(mode = null) {
        return this.normalizeMode(mode || this.getMode()) === 'story';
    },
    isMemoryMode(mode = null) {
        return this.normalizeMode(mode || this.getMode()) === 'memory';
    },
    isEndlessFloor(displayFloor, mode = null) {
        return this.isRandomMode(mode) && this.normalizeFloor(displayFloor) >= this.RANDOM_ENDLESS_START_FLOOR;
    },
    legacyToRandomDisplayFloor(legacyFloor) {
        return Math.max(1, this.normalizeFloor(legacyFloor) - this.RANDOM_BALANCE_OFFSET);
    }
});
globalThis.ABYSS_FLOOR_RULES = ABYSS_FLOOR_RULES;

const Dungeon = {
    floor: 0, width: 30, height: 30, map: [], pendingAction: null,
    fixedProceduralGenerationVersion: 3,

    getPhase2IMaster: () => globalThis.ABYSS_REGION_CONTENT?.randomDungeonPhase2IMaster || {},

    floodFill: (map, startX, startY, isWalkable = tile => String(tile || 'W').toUpperCase() !== 'W') => {
        const result = new Set();
        if (!Array.isArray(map) || !Array.isArray(map[0])) return result;
        const height = map.length;
        const width = map[0].length;
        const sx = Number(startX), sy = Number(startY);
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sy < 0 || sx >= width || sy >= height) return result;
        if (!isWalkable(map[sy][sx], sx, sy)) return result;
        const queue = [{ x:sx, y:sy }];
        result.add(`${sx},${sy}`);
        for (let i = 0; i < queue.length; i++) {
            const current = queue[i];
            for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const x = current.x + dx, y = current.y + dy;
                const key = `${x},${y}`;
                if (x < 0 || y < 0 || x >= width || y >= height || result.has(key)) continue;
                if (!isWalkable(map[y][x], x, y)) continue;
                result.add(key);
                queue.push({ x, y });
            }
        }
        return result;
    },

    rollWeightedMasterEntry: (entries, randomValue = Math.random()) => {
        const source = Array.isArray(entries) ? entries : [];
        const roll = Math.max(0, Math.min(0.999999999, Number(randomValue) || 0));
        let cursor = 0;
        for (const entry of source) {
            cursor += Math.max(0, Number(entry?.rate) || 0);
            if (roll < cursor) return entry;
        }
        return source[source.length - 1] || null;
    },

    rollRandomFloorModifier: (randomValue = Math.random()) => {
        if (!App.data?.dungeon || Dungeon.isMemoryRealm() || Dungeon.getGuildQuestRun() || Dungeon.isBossFloor() || App.data.dungeon.isTreasureRoom) {
            if (App.data?.dungeon) App.data.dungeon.floorModifier = null;
            return null;
        }
        const entries = Dungeon.getPhase2IMaster().floorModifiers || [];
        const roll = Math.max(0, Math.min(0.999999999, Number(randomValue) || 0));
        let cursor = 0;
        let selected = null;
        for (const entry of entries) {
            cursor += Math.max(0, Number(entry?.rate) || 0);
            if (roll < cursor) { selected = entry; break; }
        }
        App.data.dungeon.floorModifier = selected ? JSON.parse(JSON.stringify(selected)) : null;
        App.data.dungeon.pendingFloorModifierAnnouncement = selected ? {
            active:true,
            floor:Number(Dungeon.floor || 0),
            modifierId:selected.id,
            title:selected.title || '特殊階層',
            message:selected.message || ''
        } : null;
        return App.data.dungeon.floorModifier;
    },

    getCurrentFloorModifier: () => {
        const modifier = App.data?.dungeon?.floorModifier;
        return modifier && Number(App.data?.progress?.floor || Dungeon.floor || 0) === Number(Dungeon.floor || 0) ? modifier : modifier || null;
    },

    resumePendingFloorModifierAnnouncement: async () => {
        const pending = App.data?.dungeon?.pendingFloorModifierAnnouncement;
        if (!pending?.active || Number(pending.floor) !== Number(Dungeon.floor)) return false;
        // 実行開始を先に保存し、会話途中の再読込でも同じ説明を何度も重ねない。
        pending.active = false;
        pending.status = 'running';
        pending.startedAt = pending.startedAt || Date.now();
        App.save();
        const title = String(pending.title || '特殊階層');
        const message = String(pending.message || 'この階には特殊な気配が漂っている。');
        const key = '__DUNGEON_FLOOR_MODIFIER_ANNOUNCEMENT__';
        try {
            if (typeof StoryManager !== 'undefined' && StoryManager.scripts && typeof StoryManager.showConversation === 'function') {
                StoryManager.scripts[key] = [
                    { charId:1000, hidePortrait:true, name:'システム', text:`【${title}】` },
                    { charId:1000, hidePortrait:true, name:'システム', text:message }
                ];
                StoryManager.active = true;
                const result = await Dungeon.showConversationReliably(key, 0);
                if (result?.status !== 'completed') throw new Error(`特殊階層説明を完了できませんでした: ${result?.status || 'unknown'}`);
                StoryManager.endConversation?.();
            } else {
                App.log(`<span style="color:#ffd78a;">【${title}】${message}</span>`);
            }
        } catch (error) {
            console.error('[Dungeon] floor modifier announcement failed:', error);
            App.log(`<span style="color:#ffd78a;">【${title}】${message}</span>`);
        } finally {
            if (typeof StoryManager !== 'undefined' && StoryManager.scripts) delete StoryManager.scripts[key];
            if (App.data?.dungeon?.pendingFloorModifierAnnouncement === pending) {
                pending.status = 'completed';
                pending.completedAt = Date.now();
                App.data.dungeon.pendingFloorModifierAnnouncement = null;
            }
            App.save();
            Field.refreshCurrentAction?.({ silent:true });
        }
        return true;
    },

    showConversationReliably: async (scriptKey, startFromIndex = 0, options = {}) => {
        if (typeof StoryManager === 'undefined' || typeof StoryManager.showConversation !== 'function') {
            return { status: 'unavailable', scriptKey };
        }
        let result = await StoryManager.showConversation(scriptKey, startFromIndex);
        while (result?.status === 'busy') {
            await new Promise(resolve => setTimeout(resolve, Math.max(20, Number(options.pollMs || 50))));
            if (typeof options.abortWhen === 'function' && options.abortWhen()) {
                return { status: 'aborted', scriptKey };
            }
            result = await StoryManager.showConversation(scriptKey, startFromIndex);
        }
        const status = result?.status || (result === false ? 'error' : 'completed');
        return result && typeof result === 'object' ? result : { status, scriptKey };
    },

    memoryRealmName: '追憶の魔境',
    memoryRealmMaxFloor: 30,
    memoryRealmBossIds: Object.freeze([
        301010, 301020, 301030, 301040, 301050, 301061, 301070, 301080, 301081, 301082,
        303201, 303202, 303203, 303204, 303205, 303206, 303207, 303208
    ]),
    // 追憶の魔境では、モチーフにかかわらず役割固定の6種を全エリア共通候補にする。
    memoryRealmGlobalMonsterIds: Object.freeze([503, 507, 604, 752, 654, 655]),
    memoryRealmGlobalMonsterProfiles: Object.freeze({
        503: Object.freeze({ role:'magic', elements:Object.freeze(['火']) }),
        507: Object.freeze({ role:'magic', elements:Object.freeze(['水']) }),
        604: Object.freeze({ role:'magic', elements:Object.freeze(['光']) }),
        752: Object.freeze({ role:'physical', elements:Object.freeze(['闇']) }),
        654: Object.freeze({ role:'magic', elements:Object.freeze(['風']), allPartyHeal:true }),
        655: Object.freeze({ role:'physical', elements:Object.freeze(['雷']) })
    }),
    memoryRealmRestFloors: Object.freeze([10, 20]),
    memoryRealmThemes: Object.freeze([
        Object.freeze({ id:'start-cave', label:'北東の洞穴', sourceMapIds:['MAP000001','MAP000003'], themeKey:'START_CAVE', battleBg:'battle_bg_dungeon', elements:['無','風'] }),
        Object.freeze({ id:'wind-hole', label:'森の風穴', sourceMapIds:['MAP000004'], themeKey:'WIND_HOLE', battleBg:'battle_bg_wind_hole', elements:['風'] }),
        Object.freeze({ id:'ignis', label:'イグナ火山', sourceMapIds:['MAP000005','MAP000007'], themeKey:'FIRE_VILLAGE', battleBg:'battle_bg_fire', elements:['火'] }),
        Object.freeze({ id:'forbidden', label:'禁忌の森・風の神殿', sourceMapIds:['MAP000008','MAP000010','MAP000011'], themeKey:'FORBIDDEN_FOREST', battleBg:'battle_bg_forest', elements:['風'] }),
        Object.freeze({ id:'crena', label:'クレナ鍾乳洞', sourceMapIds:['MAP000012','MAP000013'], themeKey:'CRENA_CAVE', battleBg:'battle_bg_crena', elements:['水'] }),
        Object.freeze({ id:'seabed', label:'海底神殿', sourceMapIds:['MAP000014','MAP000016','MAP000017'], themeKey:'SEABED_TEMPLE', battleBg:'battle_bg_seabed', elements:['水','雷'] }),
        Object.freeze({ id:'thunder', label:'雷の要塞', sourceMapIds:['MAP000018','MAP000019'], themeKey:'THUNDER_FORT', battleBg:'battle_bg_thunder_fort', elements:['雷'] }),
        Object.freeze({ id:'tower', label:'大灯台', sourceMapIds:['MAP000020','MAP000021'], themeKey:'BIG_TOWER', battleBg:'battle_bg_big_tower', elements:['雷','光'] }),
        Object.freeze({ id:'light', label:'光の宮殿', sourceMapIds:['MAP000022','MAP000023'], themeKey:'LIGHT_PALACE', battleBg:'battle_bg_light_palace', elements:['光'], wallFaceImg:'tile_light_wall_face', wallFaceTorchImg:'tile_light_wall_face_prism' }),
        Object.freeze({ id:'dark-shrine', label:'闇の神殿跡', sourceMapIds:['MAP000024'], themeKey:'DARK_SHRINE_RUINS', battleBg:'battle_bg_dark_shrine', elements:['闇'] }),
        Object.freeze({ id:'galvania', label:'ガルヴァニア洞窟', sourceMapIds:['MAP000025'], themeKey:'GALVANIA_CAVE', battleBg:'battle_bg_galvania_cave', elements:['闇'] }),
        Object.freeze({ id:'dark-castle', label:'魔王城', sourceMapIds:['MAP000026','MAP000027'], themeKey:'DARK_CASTLE', battleBg:'battle_bg_dark_castle', elements:['闇'] }),
        Object.freeze({ id:'grezelia', label:'禁足地グレゼリア', sourceMapIds:['MAP000028','MAP000030','MAP000031'], themeKey:'GREZELIA_CAVE', battleBg:'battle_bg_grezelia', elements:['闇','混沌'] })
    ]),

    // ランダム生成ダンジョン内の特殊オブジェクト設定。
    // タイル文字を増やすと既存の宝箱/階段/エンカウント処理に影響しやすいため、
    // 冒険者・回復の泉・深淵の裂け目は App.data.dungeon.* で別管理する。
    // 迷路マップ(genType === 2)だけは検証・メリハリ用に全特殊オブジェクトを100%出現させる。
    adventurerSpawnRate: 0.10,
    adventurerImagePath: 'assets/map/overlays/overlay_dungeon_adventurer.png',
    adventurerGraphicKeys: Object.freeze({
        down: Object.freeze(['overlay_dungeon_adventurer_down_1', 'overlay_dungeon_adventurer_down_2']),
        left: Object.freeze(['overlay_dungeon_adventurer_left_1', 'overlay_dungeon_adventurer_left_2']),
        right: Object.freeze(['overlay_dungeon_adventurer_right_1', 'overlay_dungeon_adventurer_right_2']),
        up: Object.freeze(['overlay_dungeon_adventurer_up_1', 'overlay_dungeon_adventurer_up_2'])
    }),
    adventurerPromptOpen: false,

    // 回復の泉: 通常フロアでは5%、迷路では100%。
    // 触れただけでは回復せず、アクションボタン押下で初めて回復する。
    healSpringSpawnRate: 0.05,
    healSpringImagePath: 'assets/map/overlays/overlay_shrine_healing_spring.png',

    // 深淵の裂け目: 通常フロアでは10%、迷路では100%。
    // 勝利後報酬のため、戦闘時の eventId はこの定数に統一する。
    abyssRiftSpawnRate: 0.10,
    abyssRiftImagePath: 'assets/effect/fx-abyss-vortex-ai.png',
    abyssRiftPromptOpen: false,
    riftBattleEventId: '__DUNGEON_ABYSS_RIFT__',
    mazeFloorSpawnRate: 0.03,
    mazeMemorySightRadius: 4,
    trialAngelSpawnRate: 0.05,
    trialAngelMinFloor: 50,
    trialAngelMinEncounterRank: 50,
    trialAngelImagePath: 'assets/map/overlays/overlay_dungeon_trial_angel.png',

    // 生成形態は rollRandomFloorPlan() の単一抽選表で決定する。
    // 50階以降は、溶岩10%・浸水10%・迷路3%・宝物庫2%・深淵25%・
    // 既存マップ再利用10%・ランダム外観40%。生成再試行では同じ抽選結果を維持する。
    randomFloorPlanRates: Object.freeze({
        lava: 0.10,
        flooded: 0.10,
        maze: 0.03,
        treasure: 0.02,
        abyss: 0.25,
        reused: 0.10,
        random: 0.40
    }),

    // 溶岩フロア: 50階以降の単一抽選表で10%発生。
    // 発生時は通常宝箱を消し、床の25%を溶岩(M)にしてレア宝箱を2つだけ配置する。
    // Mは通行可能だが、踏むたびに最大HPの3%ダメージを受ける。
    lavaFloorMinFloor: 50,
    lavaFloorSpawnRate: 0.10,
    lavaTileImagePath: 'assets/map/terrain/magma.png',
    lavaBattleBgKey: 'battle_bg_fire',

    // 浸水フロア: 41階以降の通常ランダムフロアで10%発生。
    // Wはダンジョン壁として予約済みなので、通行可能な水面は ~ で表す。
    // 船所持判定は深淵挑戦の前提条件とし、フロア内では専用の船表示を使う。
    floodedFloorMinFloor: 41,
    floodedFloorSpawnRate: 0.10,
    floodedTile: '~',
    floodedBattleBgKey: 'battle_bg_flooded',

    // 外観経路の実機検証時だけテーマIDを入れる。通常版では必ず null。
    randomVisualThemeTestOverrideId: null,

    keyDoorTiles: { X: 'red', Y: 'blue', Z: 'gold' },
    keyDoorSymbols: { red: 'X', blue: 'Y', gold: 'Z' },
    keyItemTiles: { Q: 'red', N: 'blue', O: 'gold' },
    keyItemSymbols: { red: 'Q', blue: 'N', gold: 'O' },
    keyColorLabels: { red: '赤', blue: '青', gold: '金' },
    keyGuardianImagePath: 'assets/monsters/monster_000103.png',
    isRandomChestRewardEligible: (item) => {
        if (!item || Number(item.id) <= 0) return false;
        const type = String(item.type || '');
        return type !== '貴重品' && type !== '乗り物' && type !== '移動'
            && type !== 'スキル書' && type !== '特性書'
            && item.medalOnly !== true && item.abyssDrop !== false;
    },

    // アイテムIDはマップエディタやセーブ復元経由で文字列になる可能性があるため、
    // 固定コンテナを含む取得処理では数値化して照合する。
    findItemDefinition: (itemId) => {
        const numericId = Number(itemId);
        if (!Number.isFinite(numericId) || typeof DB === 'undefined' || !Array.isArray(DB.ITEMS)) return null;
        return DB.ITEMS.find(item => Number(item?.id) === numericId) || null;
    },

    recordMedalAcquisition: (count = 1) => {
        const amount = Math.max(0, Math.floor(Number(count) || 0));
        if (amount <= 0) return Number(App.data?.stats?.totalMedals || 0);
        if (typeof App.incrementLifetimeStat === 'function') {
            return App.incrementLifetimeStat('totalMedals', amount, { save: false });
        }
        if (!App.data.stats || typeof App.data.stats !== 'object' || Array.isArray(App.data.stats)) App.data.stats = {};
        App.data.stats.totalMedals = Math.max(0, Number(App.data.stats.totalMedals || 0) + amount);
        return App.data.stats.totalMedals;
    },

    grantContainerItem: (itemId, count = 1) => {
        const item = Dungeon.findItemDefinition(itemId);
        const amount = Math.max(1, Math.floor(Number(count) || 1));
        if (!item) return null;
        if (!App.data.items || typeof App.data.items !== 'object' || Array.isArray(App.data.items)) App.data.items = {};
        const numericId = Number(item.id);
        App.data.items[numericId] = Number(App.data.items[numericId] || 0) + amount;
        if (numericId === 99) Dungeon.recordMedalAcquisition(amount);
        return item;
    },
    // Random-dungeon appearance catalog. This is the single source of truth for both
    // map tiles (themeKey) and battle backgrounds (battleBg). Later thresholds add
    // candidates without removing earlier appearances.
    randomVisualThemes: Object.freeze([
        Object.freeze({ id: 'abyss', label: '深淵', sourceAreaKey: 'ABYSS', themeKey: 'ABYSS', battleBg: 'battle_bg_dungeon', minFloor: 1 }),
        Object.freeze({ id: 'forbidden-forest', label: '禁忌の森', sourceAreaKey: 'FORBIDDEN_FOREST', themeKey: 'FORBIDDEN_FOREST', battleBg: 'battle_bg_forest', minFloor: 11 }),
        Object.freeze({ id: 'thunder-fort', label: '雷要塞', sourceAreaKey: 'THUNDER_FORT', themeKey: 'THUNDER_FORT', battleBg: 'battle_bg_thunder_fort', minFloor: 21 }),
        Object.freeze({ id: 'seabed-temple', label: '海底神殿', sourceAreaKey: 'SEABED_TEMPLE', themeKey: 'SEABED_TEMPLE', battleBg: 'battle_bg_seabed', minFloor: 41 }),
        Object.freeze({ id: 'ignis-volcano', label: 'イグナ火山', sourceAreaKey: 'IGNIS_VOLCANO', themeKey: 'FIRE_VILLAGE', battleBg: 'battle_bg_fire', minFloor: 51 }),
        Object.freeze({ id: 'great-lighthouse', label: '大灯台', sourceAreaKey: 'BIG_TOWER', themeKey: 'BIG_TOWER', battleBg: 'battle_bg_big_tower', minFloor: 61 }),
        Object.freeze({
            id: 'light-palace',
            label: '光の宮殿',
            sourceAreaKey: 'LIGHT_PALACE',
            themeKey: 'LIGHT_PALACE',
            battleBg: 'battle_bg_light_palace',
            wallFaceImg: 'tile_light_wall_face',
            wallFaceTorchImg: 'tile_light_wall_face_prism',
            minFloor: 71
        }),
        Object.freeze({ id: 'dark-castle', label: '魔王城', sourceAreaKey: 'DARK_CASTLE', themeKey: 'DARK_CASTLE', battleBg: 'battle_bg_dark_castle', minFloor: 81 }),
        Object.freeze({ id: 'galvania-cave', label: 'ガルヴァニア洞窟', sourceAreaKey: 'GALVANIA_CAVE', themeKey: 'GALVANIA_CAVE', battleBg: 'battle_bg_galvania_cave', minFloor: 81 }),
        Object.freeze({ id: 'forest-wind-hole', label: '森の風穴', sourceAreaKey: 'FOREST_WIND_HOLE', themeKey: 'WIND_HOLE', battleBg: 'battle_bg_wind_hole', minFloor: 81 }),
        Object.freeze({ id: 'crena-cave', label: 'クレナ鍾乳洞', sourceAreaKey: 'CRENA_LIMESTONE_CAVE', themeKey: 'CRENA_CAVE', battleBg: 'battle_bg_crena', minFloor: 81 }),
        Object.freeze({ id: 'dark-shrine', label: '闇の神殿跡', sourceAreaKey: 'DARK_SHRINE_RUINS', themeKey: 'DARK_SHRINE_RUINS', battleBg: 'battle_bg_dark_shrine', minFloor: 81 }),
        Object.freeze({ id: 'grezelia', label: '禁足地グレゼリア', sourceAreaKey: 'GREZELIA_FORBIDDEN', themeKey: 'GREZELIA_CAVE', battleBg: 'battle_bg_grezelia', minFloor: 81 })
    ]),

    buildFixedBossBattleContext: (bossDef, x, y, mapDef = null) => {
        if (!bossDef) return null;
        const fx = Number(x);
        const fy = Number(y);
        if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;

        const currentMapDef = mapDef || (typeof Field !== 'undefined' ? Field.currentMapData : null);
        const areaKey = (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function')
            ? Field.getCurrentAreaKey()
            : (currentMapDef?.areaKey || App.data?.location?.area || null);
        const progressKey = areaKey && typeof Dungeon.getFixedProgressKey === 'function'
            ? Dungeon.getFixedProgressKey(areaKey)
            : areaKey;
        const rawKeyRewardColors = Array.isArray(bossDef?.keyRewardColors)
            ? bossDef.keyRewardColors
            : (bossDef?.keyRewardColor || bossDef?.keyColor)
                ? [bossDef.keyRewardColor || bossDef.keyColor]
                : [];
        const keyRewardColors = rawKeyRewardColors.filter(Boolean);
        const defeatGroupId = bossDef?.defeatGroupId ? String(bossDef.defeatGroupId) : null;
        const defeatGroupPositions = defeatGroupId && Array.isArray(currentMapDef?.bosses)
            ? currentMapDef.bosses
                .filter(entry => String(entry?.defeatGroupId || '') === defeatGroupId)
                .map(entry => ({ x: Number(entry.x), y: Number(entry.y) }))
                .filter(entry => Number.isFinite(entry.x) && Number.isFinite(entry.y))
            : [{ x: fx, y: fy }];
        const clearedFlags = Array.isArray(bossDef?.clearedFlags)
            ? bossDef.clearedFlags.filter(Boolean)
            : (bossDef?.clearedFlag ? [bossDef.clearedFlag] : []);

        const nonce = `boss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        const startEventId = bossDef.startEventId || null;
        const battleChainId = `${areaKey || 'MAP'}:${startEventId || bossDef.monsterId || 'boss'}:${fx},${fy}:${nonce}`;
        return {
            type: 'fixedBoss',
            nonce,
            battleChainId,
            phase: 0,
            startEventId,
            areaKey,
            progressKey,
            mapId: currentMapDef?.id || currentMapDef?.key || currentMapDef?.areaKey || areaKey || null,
            fixedBossPosition: { x: fx, y: fy },
            defeatGroupId,
            defeatGroupPositions,
            clearedFlags,
            fixedQuestId: bossDef?.questId || null,
            bossStatMultiplier: Math.max(1, Number(bossDef?.bossStatMultiplier || 1) || 1),
            fixedKeyReward: keyRewardColors.length ? {
                colors: keyRewardColors,
                color: keyRewardColors[0],
                x: fx,
                y: fy,
                scopeKey: (typeof Dungeon.getKeyScopeKey === 'function') ? Dungeon.getKeyScopeKey() : null
            } : null
        };
    },

    // 固定ボスの表示・接触・アクション・戦闘開始で共有する最終ゲート。
    // questId を持つボスは「解放済み」だけでは足りず、必ず受注中であることを要求する。
    // ボタン表示後にクエスト状態が変わった場合も、戦闘開始直前の再判定で防ぐ。
    isFixedBossTriggerAllowed: (bossDef, x, y, mapDef = null) => {
        const currentMapDef = mapDef || (typeof Field !== 'undefined' ? Field.currentMapData : null);
        if (!bossDef || !currentMapDef?.isFixed) return false;
        if (typeof Field === 'undefined' || typeof Field.isFixedBossAvailable !== 'function' || !Field.isFixedBossAvailable(bossDef)) {
            return false;
        }

        const fx = Number(x);
        const fy = Number(y);
        if (!Number.isFinite(fx) || !Number.isFinite(fy)) return false;
        const areaKey = (typeof Field.getCurrentAreaKey === 'function')
            ? Field.getCurrentAreaKey()
            : (currentMapDef.areaKey || App.data?.location?.area || null);
        const progressKey = areaKey ? Dungeon.getFixedProgressKey(areaKey) : null;
        return !(typeof Field.isFixedBossDefeatedAt === 'function'
            ? Field.isFixedBossDefeatedAt(bossDef, fx, fy, progressKey)
            : (progressKey && App.data?.progress?.defeatedBosses?.[progressKey]?.includes(`${fx},${fy}`)));
    },
    
    getAbyssMode: () => ABYSS_FLOOR_RULES.getMode(App.data),
    isStoryAbyss: () => ABYSS_FLOOR_RULES.isStoryMode(Dungeon.getAbyssMode()),
    isRandomAbyss: () => ABYSS_FLOOR_RULES.isRandomMode(Dungeon.getAbyssMode()),
    isMemoryRealm: () => ABYSS_FLOOR_RULES.isMemoryMode(Dungeon.getAbyssMode()),
    isMemoryRealmBossId: (id) => Dungeon.memoryRealmBossIds.includes(Number(id)),
    getMemoryRealmGlobalMonsterProfile: (id) => Dungeon.memoryRealmGlobalMonsterProfiles?.[Number(id)] || null,
    getBalanceFloor: (floor = Dungeon.floor, mode = null) => ABYSS_FLOOR_RULES.getBalanceFloor(floor, mode || Dungeon.getAbyssMode()),
    getCurrentRewardRank: (floor = Dungeon.floor) => {
        const guildRun = Dungeon.getGuildQuestRun();
        if (guildRun) return Math.max(1, Math.floor(Number(guildRun.encounterRank || guildRun.power || floor) || 1));
        return Dungeon.getBalanceFloor(floor);
    },
    getModeMaxFloor: (mode = Dungeon.getAbyssMode()) => {
        const dungeon = App.data?.dungeon || {};
        const normalized = ABYSS_FLOOR_RULES.normalizeMode(mode);
        if (normalized === 'story') return Math.max(0, Number(dungeon.storyMaxFloor || 0));
        if (normalized === 'memory') return Math.max(0, Number(dungeon.memoryMaxFloor || 0));
        return Math.max(0, Number(dungeon.maxFloor || 0));
    },
    isRandomAbyssUnlocked: () => !!App.data?.progress?.flags?.abyssRandomUnlocked,

	getEntryChoices: (mode = 'random') => {
		const maxF = Dungeon.getModeMaxFloor(mode);

		const choices = [];
		const usedFloors = new Set();

		const addChoice = (floor, label, latest = false) => {
			if (!floor || usedFloors.has(floor)) return;
			choices.push({
				label,
				floor,
				latest
			});
			usedFloors.add(floor);
		};

		const latestCheckpoint = maxF > 1
			? Math.floor((maxF - 1) / 10) * 10 + 1
			: 1;

		// 1. 最新階層だけ最上部に表示
		if (latestCheckpoint > 1) {
			addChoice(
				latestCheckpoint,
				`${latestCheckpoint}階から (最新)`,
				true
			);
		}

		// 2. その下に1階から
		addChoice(1, "1階から", false);

		// 3. さらに下に主要チェックポイント
		for (let checkpoint = 51; checkpoint <= maxF; checkpoint += 50) {
			addChoice(
				checkpoint,
				`${checkpoint}階から`,
				false
			);
		}

		return choices;
	},

	initMenu: () => {
		const sub = document.getElementById('sub-screen-dungeon');
		if (!sub) return;

		sub.style.display = 'flex';
		sub.style.flexDirection = 'column';

		Dungeon.renderMenu();
	},

	renderMenu: () => {
        const content = document.getElementById('dungeon-menu-content');
        if (!content) return;

        const areaKey = App.data?.location?.area;
        const isFixedDungeonArea = !!(areaKey && typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]);
        const isInDungeon = !!(Field.currentMapData?.isDungeon || areaKey === 'ABYSS' || isFixedDungeonArea);
        const isBossFloor = isInDungeon && Dungeon.isBossFloor();
        const isOnBossTile = isInDungeon && Dungeon.map?.[Field.y]?.[Field.x] === 'B';
        const cannotExit = isBossFloor && isOnBossTile;

        if (isInDungeon) {
            const modeLabel = Dungeon.isMemoryRealm()
                ? Dungeon.memoryRealmName
                : (Dungeon.isGuildQuestRunActive()
                    ? 'ギルド依頼迷宮'
                    : (Field.currentMapData?.isFixed && areaKey !== 'ABYSS'
                        ? (Field.currentMapData.displayName || Field.currentMapData.name || '深淵の迷宮')
                        : 'ランダム深淵'));
            content.innerHTML = `
                <div style="max-width:420px; margin:0 auto; display:flex; flex-direction:column; gap:14px;">
                    <div style="font-size:22px; color:#ffd700; text-align:center; margin-bottom:4px;">${modeLabel}</div>
                    <div style="border:1px solid rgba(244,201,93,0.48); border-radius:8px; padding:14px; background:rgba(255,255,255,0.04); line-height:1.6;">
                        <div style="font-size:12px; color:#aaa;">現在地</div>
                        <div style="font-size:20px; color:#fff; font-weight:bold;">地下 ${Dungeon.floor || App.data.progress.floor || 1} 階</div>
                    </div>
                    <button class="menu-btn" style="width:100%; min-height:52px; ${cannotExit ? 'opacity:0.45;' : ''}" ${cannotExit ? 'disabled' : ''} onclick="Dungeon.exitFromMenu()">
                        ${cannotExit ? '今は脱出できない' : 'ダンジョンから脱出する'}
                    </button>
                    ${cannotExit ? `<div style="font-size:11px; color:#f88; text-align:center;">ボスを倒すまで脱出できません。</div>` : ''}
                </div>`;
            return;
        }

        const renderMode = (mode, title, description) => {
            const maxF = Dungeon.getModeMaxFloor(mode);
            const tryCount = mode === 'story'
                ? Number(App.data.dungeon?.storyTryCount || 0)
                : Number(App.data.dungeon?.randomTryCount || 0);
            const choices = Dungeon.getEntryChoices(mode);
            const choiceHtml = choices.map(c => `
                <button class="menu-btn dungeon-entry-card" style="width:100%; min-height:58px; display:flex; flex-direction:column; align-items:flex-start; text-align:left;" onclick="Dungeon.startFromMenu(${c.floor}, '${mode}')">
                    <div style="font-size:16px; font-weight:bold; color:#fff;">${c.label}</div>
                    <div style="font-size:10px; color:#aaa; margin-top:3px;">${c.floor === 1 ? '1階から挑戦します' : `地下 ${c.floor} 階から再開します`}</div>
                </button>`).join('');
            return `<section style="border:1px solid rgba(244,201,93,0.36);border-radius:9px;padding:12px;background:rgba(255,255,255,.035);">
                <div style="font-size:17px;color:#ffd700;font-weight:bold;">${title}</div>
                <div style="font-size:10px;color:#aaa;line-height:1.5;margin:4px 0 9px;">${description}</div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:#bbb;margin-bottom:8px;"><span>最高 ${maxF}階</span><span>挑戦 ${tryCount}回</span></div>
                <div style="display:flex;flex-direction:column;gap:8px;">${choiceHtml}</div>
            </section>`;
        };

        const randomHtml = Dungeon.isRandomAbyssUnlocked()
            ? renderMode('random', 'ランダム深淵', 'さらに深く続く亀裂を探索します。入るたびに構造と宝箱の位置が変化します。')
            : '<div style="border:1px solid rgba(244,201,93,.28);border-radius:9px;padding:16px;color:#aaa;line-height:1.7;">終焉の祭壇に生じた亀裂を見つけると解放されます。</div>';
        content.innerHTML = `<div style="max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:13px;"><div style="font-size:22px;color:#ffd700;text-align:center;">深淵へ挑む</div>${randomHtml}</div>`;
    },

	startFromMenu: (startFloor) => {
		if (!Dungeon.isRandomAbyssUnlocked()) { App.log('終焉の祭壇の亀裂は、まだ見つかっていない。'); return; }
		if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('abyss')) return;
		if (typeof Menu !== 'undefined') Menu.closeAll();
		Dungeon.start(startFloor, { mode: 'random' });
	},

	exitFromMenu: () => {
		Menu.confirm("ダンジョンから脱出しますか？", () => {
			if (typeof Menu !== 'undefined') Menu.closeAll();
			Dungeon.exit(false);
		});
	},
	
	enter: () => {
		if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('abyss')) return;
		if (!Dungeon.isRandomAbyssUnlocked()) { App.log('終焉の祭壇の亀裂は、まだ見つかっていない。'); return; }
		if (typeof App !== 'undefined' && typeof App.unlockFeature === 'function') App.unlockFeature('dungeonMenu');
		if (typeof Menu !== 'undefined' && typeof Menu.openSubScreen === 'function') {
			Menu.openSubScreen('dungeon');
			return;
		}

		Dungeon.start(1, { mode: 'random' });
	},
	
    // --- ダンジョン突入・進行 ---
    start: (startFloor, options = {}) => {
        const requestedMode = ABYSS_FLOOR_RULES.normalizeMode(options.mode, 'random');
        const mode = requestedMode === 'guild' ? 'guild' : (requestedMode === 'memory' ? 'memory' : 'random');
        if (mode !== 'memory') {
            if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('abyss')) return false;
            if (typeof App !== 'undefined' && typeof App.unlockFeature === 'function') App.unlockFeature('dungeonMenu');
        }
		if (!App.data.progress.flags) App.data.progress.flags = {};
		if (!App.data.progress.unlocked) App.data.progress.unlocked = {};
        if (mode === 'random' && !Dungeon.isRandomAbyssUnlocked()) {
            App.log('終焉の祭壇の亀裂は、まだ見つかっていない。');
            return false;
        }
        const normalizedStartFloor = mode === 'memory' ? 1 : ABYSS_FLOOR_RULES.normalizeFloor(startFloor);
        App.data.dungeon.abyssMode = mode;
        if (mode !== 'memory') {
		    App.data.progress.flags.abyssFirstEntered = true;
		    // 転送の扉はランダム深淵の解放状態だけに同期する。
		    // ギルド依頼迷宮や初回進入だけで先行表示しない。
		    App.data.progress.unlocked.teleport = !!App.data.progress.flags.abyssRandomUnlocked;
        }
		if (!App.data.dungeon.returnPoint) {
			App.data.dungeon.returnPoint = {
				x: App.data.location.x,
				y: App.data.location.y,
				areaKey: typeof Field.getCurrentAreaKey === 'function' ? Field.getCurrentAreaKey() : 'WORLD',
                worldKey: App.data.location.worldKey || (typeof MapRegistry !== 'undefined' && MapRegistry.getActiveWorldKey ? MapRegistry.getActiveWorldKey() : 'WORLD'),
                mapData: Field.currentMapData ? JSON.parse(JSON.stringify(Field.currentMapData)) : null
			};
		}

        App.data.location.area = 'ABYSS';
        // 追憶の魔境は地上世界上の独立入口なので、描画・帰還用worldKeyを地上側に保つ。
        App.data.location.worldKey = mode === 'memory'
            ? (App.data.dungeon.returnPoint?.worldKey || 'WORLD')
            : 'ABYSS_WORLD';
        App.data.progress.floor = normalizedStartFloor;
        // tryCountは深淵系の通算として既存実績・表示に使われるため、
        // 独立コンテンツの追憶の魔境はmemoryTryCountだけを増やす。
        if (mode !== 'memory') App.data.dungeon.tryCount = Number(App.data.dungeon.tryCount || 0) + 1;
        if (mode === 'random') App.data.dungeon.randomTryCount = Number(App.data.dungeon.randomTryCount || 0) + 1;
        if (mode === 'memory') App.data.dungeon.memoryTryCount = Number(App.data.dungeon.memoryTryCount || 0) + 1;
        App.data.dungeon.map = null;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
        App.data.dungeon.abyssBossEncounter = null;
        App.data.dungeon.memoryRewardChests = null;
        App.data.dungeon.memoryBossCleared = false;
        App.data.dungeon.memoryRestFloor = false;
        App.data.dungeon.memoryThemeId = null;
        App.data.dungeon.memoryMonsterPool = null;
        Dungeon.loadFloor();
        return true;
    },

    startMemoryRealm: () => {
        if (typeof App !== 'undefined' && typeof App.discoverFixedMap === 'function') {
            App.discoverFixedMap('MEMORY_REALM', { save: false });
        }
        App.log('<span style="color:#c9a7ff;">追憶の魔境へ足を踏み入れた。挑戦は1階から始まる。</span>');
        return Dungeon.start(1, { mode: 'memory' });
    },

    getGuildQuestRun: () => {
        const run = App.data?.dungeon?.guildQuestRun;
        return run && run.active && run.questId ? run : null;
    },

    isGuildQuestRunActive: () => !!Dungeon.getGuildQuestRun(),

    startGuildQuestRun: (questId, challenge = {}) => {
        if (!questId || !App.data?.dungeon) return false;
        if (Dungeon.isGuildQuestRunActive()) {
            App.log('すでに依頼迷宮を探索中だ。');
            return false;
        }
        const returnPoint = {
            x: App.data.location.x,
            y: App.data.location.y,
            areaKey: typeof Field.getCurrentAreaKey === 'function' ? Field.getCurrentAreaKey() : (App.data.location.area || 'WORLD'),
            worldKey: App.data.location.worldKey || (MapRegistry?.getActiveWorldKey?.() || 'WORLD'),
            mapData: Field.currentMapData ? JSON.parse(JSON.stringify(Field.currentMapData)) : null
        };
        App.data.dungeon.returnPoint = returnPoint;
        const normalizedChallenge = JSON.parse(JSON.stringify(challenge || {}));
        const normalEnemyBoost = normalizedChallenge.enemyBoost && typeof normalizedChallenge.enemyBoost === 'object'
            ? normalizedChallenge.enemyBoost
            : {};
        const bossEnemyBoost = normalizedChallenge.bossEnemyBoost && typeof normalizedChallenge.bossEnemyBoost === 'object'
            ? normalizedChallenge.bossEnemyBoost
            : {
                ...JSON.parse(JSON.stringify(normalEnemyBoost)),
                statMultiplier: 1,
                rareStatMultiplier: 1,
                applyToRares: false
            };
        App.data.dungeon.guildQuestRun = {
            ...normalizedChallenge,
            enemyBoost: normalEnemyBoost,
            bossEnemyBoost,
            active: true,
            completed: false,
            questId: String(questId),
            floorCount: Math.max(1, Number(challenge.floorCount || 1)),
            startedAt: Date.now()
        };
        App.data.location.area = 'ABYSS';
        App.data.location.worldKey = App.data.dungeon.returnPoint?.worldKey || 'WORLD';
        App.data.dungeon.abyssMode = 'guild';
        App.data.progress.floor = 1;
        Dungeon.floor = 1;
        App.data.dungeon.map = null;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
        App.data.dungeon.abyssBossEncounter = null;
        App.save();
        Dungeon.loadFloor();
        App.log(`${challenge.themeLabel || '変異'}の依頼迷宮へ入った。`);
        return true;
    },
	
    getFixedFloorDef: (mapKey = App.data?.location?.area, floorNo = App.data?.progress?.floor || 1) => {
        if (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonFloor) {
            return MapRegistry.getFixedDungeonFloor(mapKey, floorNo);
        }
        const base = (typeof FIXED_DUNGEON_MAPS !== 'undefined') ? FIXED_DUNGEON_MAPS[mapKey] : null;
        return base ? { ...base, isDungeon: true, isFixed: true, floor: floorNo } : null;
    },

    getFixedProgressKey: (areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area) => {
        if (typeof Field !== 'undefined' && Field.getCurrentProgressMapKey) return Field.getCurrentProgressMapKey();
        if (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonProgressKey) {
            return MapRegistry.getFixedDungeonProgressKey(areaKey, App.data?.progress?.floor || 1);
        }
        return areaKey;
    },

    getMapChangeKey: (areaKey = null) => {
        if (typeof Field !== 'undefined' && Field.currentMapData?.isFixed && Field.getCurrentProgressMapKey) {
            return Field.getCurrentProgressMapKey();
        }
        return areaKey || (typeof Field !== 'undefined' && Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area || 'ABYSS');
    },

    getKeyScopeKey: (areaKey = null) => {
        if (typeof Field !== 'undefined' && Field.currentMapData?.isFixed) {
            const fixedAreaKey = Field.currentMapData?.canonicalAreaKey || areaKey || (Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area);
            return `FIXED:${fixedAreaKey || Field.currentMapData?.areaKey || 'UNKNOWN'}`;
        }
        const key = areaKey || (typeof Field !== 'undefined' && Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area || 'ABYSS');
        if (key === 'ABYSS') return `ABYSS:${Dungeon.getAbyssMode()}:F${Number(Dungeon.floor || App.data?.progress?.floor || 1)}`;
        return key;
    },

    isRandomKeyScope: (scopeKey = null) => {
        const key = scopeKey || Dungeon.getKeyScopeKey();
        const areaKey = typeof Field !== 'undefined' && Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area || 'ABYSS';
        return !Field.currentMapData?.isFixed && (areaKey === 'ABYSS' || String(key).startsWith('ABYSS:'));
    },

    initKeyState: (state) => {
        if (!state || typeof state !== 'object') return {};
        if (!Array.isArray(state._order)) {
            state._order = ['red', 'blue', 'gold'].filter(color => !!state[color]);
        }
        return state;
    },

    ensureKeyState: (scopeKey = null) => {
        if (!App.data.progress) App.data.progress = {};
        const key = scopeKey || Dungeon.getKeyScopeKey();
        if (Dungeon.isRandomKeyScope(key)) {
            if (!App.data.dungeon) App.data.dungeon = {};
            if (!App.data.dungeon.randomKeys) App.data.dungeon.randomKeys = {};
            if (!App.data.dungeon.randomKeys[key]) App.data.dungeon.randomKeys[key] = {};
            return Dungeon.initKeyState(App.data.dungeon.randomKeys[key]);
        }
        if (!App.data.progress.fixedDungeonKeys) App.data.progress.fixedDungeonKeys = {};
        if (!App.data.progress.fixedDungeonKeys[key]) App.data.progress.fixedDungeonKeys[key] = {};
        return Dungeon.initKeyState(App.data.progress.fixedDungeonKeys[key]);
    },

    getHeldKeyOrder: (scopeKey = null) => {
        const state = Dungeon.ensureKeyState(scopeKey);
        const order = Array.isArray(state._order) ? state._order : [];
        const ordered = order.filter(color => !!state[color]);
        ['red', 'blue', 'gold'].forEach(color => {
            if (state[color] && !ordered.includes(color)) ordered.push(color);
        });
        return ordered;
    },

    clearRandomKeyState: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.randomKeys = null;
    },

    hasDungeonKey: (color, scopeKey = null) => {
        const state = Dungeon.ensureKeyState(scopeKey);
        return !!state[color];
    },

    consumeDungeonKey: (color, scopeKey = null) => {
        if (!color) return false;
        const state = Dungeon.ensureKeyState(scopeKey);
        if (!state[color]) return false;
        delete state[color];
        if (Array.isArray(state._order)) {
            state._order = state._order.filter(heldColor => heldColor !== color);
        }
        App.save();
        if (typeof Field !== 'undefined' && typeof Field.updateHeldKeyHud === 'function') Field.updateHeldKeyHud();
        return true;
    },

    grantDungeonKey: (color, source = 'key', scopeKey = null) => {
        const label = Dungeon.keyColorLabels[color] || color;
        const state = Dungeon.ensureKeyState(scopeKey);
        if (state[color]) {
            App.log(`<span style="color:#ffd78a;">${label}の鍵は既に持っている。</span>`);
            return false;
        }
        state[color] = true;
        if (!Array.isArray(state._order)) state._order = [];
        if (!state._order.includes(color)) state._order.push(color);
        App.log(`<span style="color:#ffd78a;">${label}の鍵を手に入れた！</span>`);
        App.save();
        if (typeof Field !== 'undefined' && typeof Field.updateHeldKeyHud === 'function') Field.updateHeldKeyHud();
        return true;
    },

    isLockedDoorTile: (tile) => {
        return !!Dungeon.keyDoorTiles[String(tile || '').toUpperCase()];
    },

    getDoorColor: (tile) => {
        return Dungeon.keyDoorTiles[String(tile || '').toUpperCase()] || null;
    },

    isKeyItemTile: (tile) => {
        return !!Dungeon.keyItemTiles[String(tile || '').toUpperCase()];
    },

    getKeyItemColor: (tile) => {
        return Dungeon.keyItemTiles[String(tile || '').toUpperCase()] || null;
    },

    findRandomFloorKey: (x, y) => {
        const list = App.data?.dungeon?.floorKeys;
        if (!Array.isArray(list)) return null;
        return list.find(key => key && key.active && Number(key.floor) === Number(Dungeon.floor) && Number(key.x) === Number(x) && Number(key.y) === Number(y)) || null;
    },

    pickupFloorKeyAt: (x, y, tile = null) => {
        const floorKey = Dungeon.findRandomFloorKey(x, y);
        const color = floorKey?.color || Dungeon.getKeyItemColor(tile);
        if (!color) return false;
        if (floorKey) floorKey.active = false;
        const isFixedMap = !!Field.currentMapData?.isFixed;
        if (isFixedMap) {
            const areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area;
            const changeKey = Dungeon.getMapChangeKey(areaKey);
            if (!App.data.progress.mapChanges) App.data.progress.mapChanges = {};
            if (!App.data.progress.mapChanges[changeKey]) App.data.progress.mapChanges[changeKey] = {};
            App.data.progress.mapChanges[changeKey][`${Number(x)},${Number(y)}`] = 'T';
        } else if (Dungeon.map?.[y]?.[x]) {
            Dungeon.map[y][x] = 'T';
        }
        Dungeon.grantDungeonKey(color, 'floor');
        if (isFixedMap) {
            App.save();
        } else {
            Dungeon.saveMapData();
        }
        if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
        return true;
    },

    unlockDoorAt: (x, y, tile) => {
        const color = Dungeon.getDoorColor(tile);
        const label = Dungeon.keyColorLabels[color] || color;
        if (!color) return false;
        const areaKey = typeof Field !== 'undefined' && Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area || 'ABYSS';
        const scopeKey = Dungeon.getKeyScopeKey(areaKey);
        if (!Dungeon.hasDungeonKey(color, scopeKey)) {
            App.log(`<span style="color:#ff9a9a;">${label}の扉だ。同じ色の鍵が必要だ。</span>`);
            return false;
        }
        Dungeon.consumeDungeonKey(color, scopeKey);
        const changeKey = Dungeon.getMapChangeKey(areaKey);
        if (!App.data.progress.mapChanges) App.data.progress.mapChanges = {};
        if (!App.data.progress.mapChanges[changeKey]) App.data.progress.mapChanges[changeKey] = {};
        App.data.progress.mapChanges[changeKey][`${x},${y}`] = 'T';
        if (Field.currentMapData && !Field.currentMapData.isFixed && Dungeon.map?.[y]?.[x]) {
            Dungeon.map[y][x] = 'T';
            Dungeon.saveMapData();
        }
        App.log(`<span style="color:#ffd78a;">${label}の鍵で扉を開けた。</span>`);
        App.save();
        return true;
    },

    findRandomKeyChest: (x, y) => {
        const list = App.data?.dungeon?.keyChests;
        if (!Array.isArray(list)) return null;
        return list.find(chest => chest && chest.active && Number(chest.floor) === Number(Dungeon.floor) && Number(chest.x) === Number(x) && Number(chest.y) === Number(y)) || null;
    },

    isFixedChestOpenedAt: (x, y) => {
        if (!Field.currentMapData?.isFixed) return false;
        const progressKey = Dungeon.getFixedProgressKey(Field.getCurrentAreaKey());
        return !!App.data.progress.openedChests?.[progressKey]?.includes(`${Number(x)},${Number(y)}`);
    },

    shouldRemoveOpenedFixedChest: (mapDef = Field.currentMapData) => !!(
        mapDef?.isFixed && mapDef?.generatedFromAbyssLogic === true
    ),

    getOpenedFixedChestBaseTile: (chestDef = null, mapDef = Field.currentMapData) => {
        const explicit = String(chestDef?.baseTile || '').toUpperCase();
        if (explicit && !['C', 'R'].includes(explicit)) return explicit;
        const source = mapDef && Number.isFinite(Number(chestDef?.x)) && Number.isFinite(Number(chestDef?.y))
            ? String(mapDef.tiles?.[Number(chestDef.y)] || '')[Number(chestDef.x)]
            : '';
        if (source && !['C', 'R'].includes(String(source).toUpperCase())) return String(source).toUpperCase();
        return 'T';
    },

    markFixedChestOpened: (progressKey, posKey, x, y, chestDef = null, mapDef = Field.currentMapData) => {
        if (!App.data.progress.openedChests) App.data.progress.openedChests = {};
        if (!Array.isArray(App.data.progress.openedChests[progressKey])) App.data.progress.openedChests[progressKey] = [];
        if (!App.data.progress.openedChests[progressKey].includes(posKey)) {
            App.data.progress.openedChests[progressKey].push(posKey);
        }
        if (Dungeon.shouldRemoveOpenedFixedChest(mapDef)) {
            if (!App.data.progress.mapChanges) App.data.progress.mapChanges = {};
            if (!App.data.progress.mapChanges[progressKey]) App.data.progress.mapChanges[progressKey] = {};
            App.data.progress.mapChanges[progressKey][posKey] = Dungeon.getOpenedFixedChestBaseTile(chestDef, mapDef);
        }
    },

    getContainerPresentation: (containerDef = null) => {
        const explicitKind = String(containerDef?.containerKind || containerDef?.objectKind || '').toLowerCase();
        const imageKey = String(containerDef?.imageKey || '').toLowerCase();
        const kind = explicitKind
            || (imageKey.includes('barrel') ? 'barrel' : '')
            || (imageKey.includes('pot') ? 'pot' : '')
            || 'chest';
        const defaults = {
            pot: {
                kind: 'pot', closed: 'ツボがある。', blocked: 'ツボが置かれている。',
                opened: '空のツボだ。', action: 'ツボを覗く', inspect: 'ツボを覗いた。', empty: 'ツボの中は空だった。'
            },
            barrel: {
                kind: 'barrel', closed: 'タルがある。', blocked: 'タルが置かれている。',
                opened: '空のタルだ。', action: 'タルを調べる', inspect: 'タルの中を調べた。', empty: 'タルの中は空だった。'
            },
            chest: {
                kind: 'chest', closed: '宝箱がある。', blocked: '宝箱が道を塞いでいる。',
                opened: '開いたままの空箱がある。', action: '調べる', inspect: '宝箱を開けた！', empty: 'なにもなかった。'
            }
        };
        const base = defaults[kind] || defaults.chest;
        return {
            ...base,
            ...(containerDef?.presentation || {})
        };
    },

    isKeyGuardianAt: (x, y) => {
        const g = App.data?.dungeon?.keyGuardian;
        return !!(g && g.active && Number(g.floor) === Number(Dungeon.floor) && Number(g.x) === Number(x) && Number(g.y) === Number(y));
    },

    startKeyGuardianBattle: () => {
        const guardian = App.data?.dungeon?.keyGuardian;
        if (!guardian || !guardian.active) return false;
        const label = Dungeon.keyColorLabels[guardian.color] || guardian.color;
        App.log(`<span style="color:#ffd78a;">${label}の鍵を守る魔物が立ちはだかった！</span>`);
        App.data.battle = {
            active: false,
            isBossBattle: false,
            fixedBossId: null,
            fixedEnemyIds: [Number(guardian.monsterId || 101)],
            keyReward: {
                color: guardian.color,
                x: guardian.x,
                y: guardian.y,
                floor: guardian.floor
            }
        };
        App.save();
        App.changeScene('battle');
        return true;
    },

    getChestTrapMonsterForFloor: (floor) => {
        if (window.CHEST_MIMIC_DATA?.getForFloor) return window.CHEST_MIMIC_DATA.getForFloor(floor);
        const fallbackId = Number(floor) >= 151 ? 120303 : (Number(floor) >= 101 ? 120302 : 120301);
        return window.MonsterData?.getMonsterById?.(fallbackId)
            || (Array.isArray(DB?.MONSTERS) ? DB.MONSTERS.find(monster => Number(monster.id) === fallbackId) : null)
            || null;
    },

    waitForChestTrapReveal: (ms = 650) => {
        const waitMs = Math.max(0, Math.floor(Number(ms) || 0));
        if (typeof App.lockFieldInput === 'function') App.lockFieldInput(waitMs + 150);
        return waitMs > 0 ? new Promise(resolve => setTimeout(resolve, waitMs)) : Promise.resolve();
    },

    startChestTrapBattle: async (monsterId, options = {}) => {
        const numericId = Number(monsterId);
        const monster = window.MonsterData?.getMonsterById?.(numericId)
            || (Array.isArray(DB?.MONSTERS) ? DB.MONSTERS.find(entry => Number(entry.id) === numericId) : null);
        if (!monster || !monster.isChestTrap) {
            console.error(`[Dungeon] 未登録の宝箱トラップ monsterId=${monsterId}`);
            App.log('宝箱の中で何かが蠢いたが、姿を現さなかった…。');
            return false;
        }

        const currentFloor = Math.max(1, Number(options.floor)
            || Number(Field.currentMapData?.encounterRank)
            || Number(Field.currentMapData?.rank)
            || Number(Dungeon.floor)
            || Number(App.data.progress?.floor)
            || Number(monster.rank)
            || 1);
        App.log(`宝箱を開けた！<br><span style="color:#ff8a72;font-weight:bold;">${monster.name}</span> が襲いかかってきた！`);
        // 開封ログは通常宝箱と同様に即時表示し、驚き演出の待機は表示後に置く。
        await Dungeon.waitForChestTrapReveal(options.revealWaitMs ?? 650);
        App.data.battle = {
            active: false,
            isBossBattle: false,
            isSpecialBoss: false,
            isEstark: false,
            isChestTrapBattle: true,
            preventEscape: true,
            chestTrapMonsterId: numericId,
            chestTrapFloor: currentFloor,
            encounterRank: currentFloor,
            fixedChestTrap: options.fixedChestTrap ? {
                progressKey: String(options.fixedChestTrap.progressKey || ''),
                posKey: String(options.fixedChestTrap.posKey || '')
            } : null,
            fixedEnemyIds: [numericId],
            enemies: []
        };
        App.save();
        const startBattleScene = () => App.changeScene('battle');
        if (typeof App.playEncounterTransition === 'function') {
            if (typeof App.lockFieldInput === 'function') App.lockFieldInput(1200);
            App.playEncounterTransition(startBattleScene, { eventBattle: true });
        } else {
            startBattleScene();
        }
        return true;
    },

    // 固定マップの擬態箱だけ、全滅時に未開封へ戻す。
    // 深淵のランダム宝箱はマップ生成データ側で消費済みにする従来仕様を維持する。
    rollbackFixedChestTrap: (battleData = null) => {
        const marker = battleData?.fixedChestTrap;
        const progressKey = String(marker?.progressKey || '');
        const posKey = String(marker?.posKey || '');
        if (!progressKey || !posKey) return false;
        const opened = App.data?.progress?.openedChests?.[progressKey];
        if (!Array.isArray(opened)) return false;
        const next = opened.filter(entry => String(entry) !== posKey);
        if (next.length === opened.length) return false;
        App.data.progress.openedChests[progressKey] = next;
        if (App.data?.progress?.mapChanges?.[progressKey]) {
            delete App.data.progress.mapChanges[progressKey][posKey];
            if (Object.keys(App.data.progress.mapChanges[progressKey]).length === 0) delete App.data.progress.mapChanges[progressKey];
        }
        App.save();
        return true;
    },

    completeKeyGuardianReward: (reward) => {
        if (!reward || !reward.color) return;
        Dungeon.grantDungeonKey(reward.color, 'guardian');
        const guardian = App.data?.dungeon?.keyGuardian;
        if (guardian && Number(guardian.floor) === Number(reward.floor) && Number(guardian.x) === Number(reward.x) && Number(guardian.y) === Number(reward.y)) {
            guardian.active = false;
        }
        if (Dungeon.map?.[reward.y]?.[reward.x]) Dungeon.map[reward.y][reward.x] = 'T';
        Dungeon.saveMapData();
    },

    changeFixedFloor: (toFloor, targetX = null, targetY = null, targetMarker = null) => {
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('stairs');
        const areaKey = App.data.location.area;
        const nextDef = Dungeon.getFixedFloorDef(areaKey, toFloor);
        if (!nextDef) return;

        App.data.progress.floor = nextDef.floor || Number(toFloor) || 1;
        Dungeon.floor = App.data.progress.floor;
        App.data.dungeon.map = null;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;

        Field.currentMapData = nextDef;
        if (typeof Dungeon.resetFixedHunterStateForCurrentMap === 'function') Dungeon.resetFixedHunterStateForCurrentMap();
        let resolvedTarget = null;
        if (targetX !== null && targetX !== undefined && targetY !== null && targetY !== undefined) {
            resolvedTarget = { x: Number(targetX), y: Number(targetY) };
        } else if (targetMarker && Array.isArray(nextDef.tiles)) {
            const marker = String(targetMarker).toUpperCase();
            for (let y = 0; y < nextDef.tiles.length && !resolvedTarget; y++) {
                const x = String(nextDef.tiles[y] || '').toUpperCase().indexOf(marker);
                if (x >= 0) resolvedTarget = { x, y };
            }
        }
        Field.x = resolvedTarget?.x ?? (nextDef.entryPoint?.x || 1);
        Field.y = resolvedTarget?.y ?? (nextDef.entryPoint?.y || 1);
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
        Dungeon.rollTrialAngelSpawn({ fixed: true });
        if (typeof Dungeon.markFixedVisibleArea === 'function') Dungeon.markFixedVisibleArea(Field.x, Field.y, nextDef.revealRadius || 3);

        App.save();
        App.changeScene('field');
        App.log(`${nextDef.displayName || nextDef.name}へ移動した。`);
    },

    followFixedFloorLink: (link, mapDef = null) => {
        if (!link || !Field.currentMapData?.isFixed) return false;
        if (link.to === 'EXIT') {
            if (link.setFlag) {
                if (!App.data.progress.flags) App.data.progress.flags = {};
                App.data.progress.flags[link.setFlag] = true;
            }
            if (Array.isArray(link.setFlags)) {
                if (!App.data.progress.flags) App.data.progress.flags = {};
                link.setFlags.forEach(flag => { if (flag) App.data.progress.flags[flag] = true; });
            }
            const forced = link.exitPoint ? {
                x: Number(link.exitPoint.x),
                y: Number(link.exitPoint.y),
                areaKey: link.exitPoint.areaKey || link.exitPoint.area || 'WORLD',
                worldKey: link.exitPoint.worldKey || link.exitPoint.areaKey || link.exitPoint.area || 'WORLD',
                mapData: link.exitPoint.mapData || null
            } : null;
            Dungeon.exit(false, forced);
            return true;
        }
        if (link.toDungeon) {
            Dungeon.startFixed(link.toDungeon, { entryKey: link.entryKey || null, nestedReturn: true });
            return true;
        }
        if (link.toFloor !== undefined && link.toFloor !== null) {
            const currentFloor = Math.max(1, Number(Field.currentMapData?.floor || App.data.progress?.floor || 1));
            const targetMarker = Number(link.toFloor) < currentFloor ? 'D' : 'U';
            Dungeon.changeFixedFloor(link.toFloor, link.targetX, link.targetY, link.targetMarker || targetMarker);
            return true;
        }
        return false;
    },

    isFixedExitStepTile: (tile, link = null) => {
        const upper = String(tile || '').toUpperCase();
        return upper === 'S' && (!link || link.to === 'EXIT');
    },

    tryFixedAutoFloorLink: (tile, x, y) => {
        if (!Field.currentMapData?.isFixed || !Field.currentMapData?.isDungeon) return false;
        const upper = String(tile || '').toUpperCase();
        if (!['S', 'D', 'U'].includes(upper)) return false;
        const link = (typeof MapRegistry !== 'undefined' && MapRegistry.findFloorLink)
            ? MapRegistry.findFloorLink(Field.currentMapData, x, y)
            : null;

        // Every fixed-dungeon exit is contact-driven. S tiles that lead to another
        // floor remain governed by their explicit floor-link auto setting.
        if (Dungeon.isFixedExitStepTile(upper, link)) {
            const flags = App.data?.progress?.flags || {};
            if (link?.requiredFlag && !flags[link.requiredFlag]) {
                App.clearAction();
                if (link.lockedEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                    StoryManager.executeEvent(link.lockedEventId);
                } else {
                    App.log(link.lockedLog || '封じられていて、今は外へ出られない。');
                }
                return true;
            }
            if (link?.openLog || link?.log) App.log(link.openLog || link.log);
            if (link) return Dungeon.followFixedFloorLink(link, Field.currentMapData);
            const exitPoint = Field.currentMapData.exitPoint;
            const forced = exitPoint ? {
                x: Number(exitPoint.x),
                y: Number(exitPoint.y),
                areaKey: exitPoint.areaKey || exitPoint.area || 'WORLD',
                mapData: exitPoint.mapData || null
            } : null;
            Dungeon.exit(false, forced);
            return true;
        }
        if (!link || !link.auto) return false;
        const flags = App.data?.progress?.flags || {};
        if (link.requiredFlag && !flags[link.requiredFlag]) {
            return false;
        }
        if (link.openLog || link.log) App.log(link.openLog || link.log);
        return Dungeon.followFixedFloorLink(link, Field.currentMapData);
    },

    prepareFixedTileAction: (tile, x, y, options = {}) => {
        if (!Field.currentMapData?.isFixed) return false;
        const silent = options.silent !== false;
        const logIfNeeded = (message) => { if (!silent && message) App.log(message); };
        const mapDef = Field.currentMapData;

        if (tile === 'S' || tile === 'D' || tile === 'U') {
            const link = (typeof MapRegistry !== 'undefined' && MapRegistry.findFloorLink)
                ? MapRegistry.findFloorLink(mapDef, x, y)
                : null;

            // Exit S tiles are activated only after the player steps onto them.
            // Do not expose an adjacent/on-tile action button for these cells.
            if (Dungeon.isFixedExitStepTile(tile, link)) {
                App.clearAction();
                return false;
            }

            if (link) {
                const flags = App.data?.progress?.flags || {};
                if (link.auto && !(link.requiredFlag && !flags[link.requiredFlag])) {
                    return false;
                }
                if (link.requiredFlag && !flags[link.requiredFlag]) {
                    logIfNeeded(link.lockedLog || '封印されていて、今は通れない。');
                    App.setAction(link.lockedLabel || '調べる', () => {
                        if (link.lockedEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                            StoryManager.executeEvent(link.lockedEventId);
                        } else {
                            App.log(link.lockedLog || '封印されていて、今は通れない。');
                        }
                    });
                    return true;
                }

                const label = (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedFloorActionLabel)
                    ? MapRegistry.getFixedFloorActionLabel(mapDef, link, App.data?.progress?.floor || mapDef.floor || 1, Field.getCurrentAreaKey())
                    : (link.to === 'EXIT' ? (link.label || '外に出る') : (link.label || '進む'));
                logIfNeeded(link.openLog || link.log || (link.to === 'EXIT' ? '外への出口がある。' : (link.toDungeon ? '奥へ続く入口がある。' : '階段がある。')));
                App.setAction(label, () => Dungeon.followFixedFloorLink(link, mapDef));
                return true;
            }
        }

        if (tile === 'B') {
            const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
                ? MapRegistry.findFixedBoss(mapDef, x, y)
                : null;
            const areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : (mapDef.areaKey || App.data.location.area);
            const progressKey = Dungeon.getFixedProgressKey(areaKey);
            const posKey = `${x},${y}`;
            let defeated = App.data.progress.defeatedBosses?.[progressKey]?.includes(posKey);
            const flags = App.data?.progress?.flags || {};

            // イグナ火山の兵士戦→グラド戦は同一ボスタイル上の連戦。
            // 旧データで兵士戦勝利時にタイルだけ討伐済みになっていた場合も、
            // 火のプリズム未復旧ならグラド再戦用タイルとして復旧する。
            const isIgnisGladRetryTile = bossDef?.startEventId === 'fire_volcano_soldiers_encounter' &&
                !flags.firePrismRestored &&
                Number(App.data.progress?.storyStep || 0) === 2 &&
                Number(App.data.progress?.subStep || 0) >= 3;
            if (defeated && isIgnisGladRetryTile) {
                App.data.progress.defeatedBosses[progressKey] = (App.data.progress.defeatedBosses[progressKey] || []).filter(key => key !== posKey);
                flags.fireVolcanoSoldiersCleared = true;
                defeated = false;
                if (typeof App.save === 'function') App.save();
            }

            if (!Dungeon.isFixedBossTriggerAllowed(bossDef, x, y, mapDef)) {
                App.clearAction();
                return false;
            }

            if (bossDef?.inspectLog) logIfNeeded(bossDef.inspectLog);

            const actionLabel = (isIgnisGladRetryTile && flags.fireVolcanoSoldiersCleared)
                ? 'グラドに挑む'
                : (bossDef?.actionLabel || null);

            if (bossDef?.startEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                App.setAction(actionLabel || '対峙する', () => {
                    if (!Dungeon.isFixedBossTriggerAllowed(bossDef, x, y, mapDef)) {
                        App.clearAction();
                        Field.refreshCurrentAction?.({ silent: true });
                        return false;
                    }
                    const fixedBossContext = Dungeon.buildFixedBossBattleContext(bossDef, x, y, mapDef);
                    if (fixedBossContext) {
                        if (!App.data.progress) App.data.progress = {};
                        App.data.progress.activeFixedBossContext = fixedBossContext;
                        if (typeof App.save === 'function') App.save();
                    }
                    StoryManager.executeEvent(bossDef.startEventId, false, 0, 0, {
                        meta: { battleChainId: fixedBossContext?.battleChainId || null }
                    });
                });
                return true;
            }

            App.setAction(actionLabel || '対峙する', () => Dungeon.confirmFixedBossChallenge(x, y));
            return true;
        }

        return false;
    },

    confirmFixedBossChallenge: async (x, y) => {
        const mapDef = Field.currentMapData;
        const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
            ? MapRegistry.findFixedBoss(mapDef, x, y)
            : null;
        if (!Dungeon.isFixedBossTriggerAllowed(bossDef, x, y, mapDef)) return false;
        const rawId = Array.isArray(bossDef?.monsterId) ? bossDef.monsterId[0] : bossDef?.monsterId;
        const monster = window.MonsterData?.getMonsterById?.(Number(rawId));
        const name = monster?.name || '強敵';
        const prompt = bossDef?.challengeText || `${name}が行く手を塞いでいる。\n覚悟を決めて挑みますか？`;
        let accepted = true;
        if (typeof StoryManager !== 'undefined' && typeof StoryManager.showChoice === 'function') {
            accepted = !!(await StoryManager.showChoice(prompt));
        } else if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
            accepted = await new Promise(resolve => Menu.confirm(prompt, () => resolve(true), () => resolve(false)));
        }
        if (!accepted) {
            if (typeof StoryManager !== 'undefined' && typeof StoryManager.dismissChoiceUI === 'function') {
                StoryManager.dismissChoiceUI({ hideOverlay: true });
            }
            App.log(`${name}は、こちらの出方を窺っている。`);
            Field.refreshCurrentAction?.({ silent: true });
            return false;
        }
        if (!Dungeon.isFixedBossTriggerAllowed(bossDef, x, y, mapDef)) {
            Field.refreshCurrentAction?.({ silent: true });
            return false;
        }
        if (typeof StoryManager !== 'undefined' && typeof StoryManager.prepareBattleTransitionUI === 'function') {
            StoryManager.prepareBattleTransitionUI();
        }
        Dungeon.startFixedBoss(x, y);
        return true;
    },

    startFixedBoss: (x, y) => {
        const mapDef = Field.currentMapData;
        const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
            ? MapRegistry.findFixedBoss(mapDef, x, y)
            : null;
        if (!Dungeon.isFixedBossTriggerAllowed(bossDef, x, y, mapDef)) {
            App.clearAction();
            Field.refreshCurrentAction?.({ silent: true });
            return false;
        }
        if (typeof StoryManager !== 'undefined' && typeof StoryManager.prepareBattleTransitionUI === 'function') {
            StoryManager.prepareBattleTransitionUI();
        }
        const fixedBossId = bossDef?.monsterId || null;
        const fixedBossIds = Array.isArray(fixedBossId) ? fixedBossId : [fixedBossId].filter(id => id !== null);
        const isSpecialBoss = fixedBossIds.some(id => {
            const numericId = Number(id);
            const base = window.MonsterData?.getMonsterById?.(numericId);
            return !!(base?.isSpecialBoss || base?.isEstark || numericId === 902000);
        });
        const fixedBossContext = Dungeon.buildFixedBossBattleContext(bossDef, x, y, mapDef);
        if (fixedBossContext) {
            if (!App.data.progress) App.data.progress = {};
            App.data.progress.activeFixedBossContext = fixedBossContext;
        }

        App.data.battle = {
            active: false,
            isBossBattle: true,
            isSpecialBoss,
            isEstark: isSpecialBoss,
            fixedBossId,
            fixedBossPosition: fixedBossContext?.fixedBossPosition || { x: Number(x), y: Number(y) },
            fixedBossProgressKey: fixedBossContext?.progressKey || null,
            fixedBossDefeatGroupId: fixedBossContext?.defeatGroupId || null,
            fixedBossDefeatGroupPositions: fixedBossContext?.defeatGroupPositions || null,
            fixedBossClearedFlags: fixedBossContext?.clearedFlags || null,
            fixedQuestId: fixedBossContext?.fixedQuestId || bossDef?.questId || null,
            bossStatMultiplier: fixedBossContext?.bossStatMultiplier || Math.max(1, Number(bossDef?.bossStatMultiplier || 1) || 1),
            fixedKeyReward: fixedBossContext?.fixedKeyReward || null,
            fixedStoryEventId: bossDef?.storyEventId || null,
            battleChainId: fixedBossContext?.battleChainId || null,
            battleChainPhase: fixedBossContext?.phase || 0,
            fixedBossContextNonce: fixedBossContext?.nonce || null,
            enemies: []
        };
        App.save();
        const startBattleScene = () => App.changeScene('battle');
        if (typeof App !== 'undefined' && typeof App.playEncounterTransition === 'function') {
            if (typeof App.lockFieldInput === 'function') App.lockFieldInput(1800);
            App.playEncounterTransition(startBattleScene, { eventBattle: true });
        } else {
            startBattleScene();
        }
        return true;
    },

	
    // --- 固定ダンジョン（試練の洞窟など）への進入 ---
    canEnterFixedDungeon: (mapKey, options = {}) => {
        const progress = App.data?.progress || {};
        const flags = progress.flags || {};
        const step = Number(progress.storyStep || 0);
        const sub = Number(progress.subStep || 0);
        const atLeast = (targetStep, targetSub = 0) => step > targetStep || (step === targetStep && sub >= targetSub);
        const hasLeila = typeof App.hasStoryAlly === 'function' && App.hasStoryAlly(204);
        const ok = () => ({ ok: true });
        const block = (message, eventId = null) => ({ ok: false, message, eventId });

        switch (mapKey) {
            case 'IGNIS_VOLCANO':
            case 'FORBIDDEN_FOREST':
                return ok();
            case 'WIND_TEMPLE':
                return (flags.windForestCleansed || atLeast(3, 2))
                    ? ok()
                    : block('森の奥の風が荒れ、神殿への道が閉ざされている。', 'locked_wind_temple');
            case 'SEABED_TEMPLE':
                return (flags.kateJoinedAtWaterCity || atLeast(4, 1))
                    ? ok()
                    : block('海の底に沈む神殿が見えるが、このままでは入ることができない。', 'locked_seabed_temple');
            case 'THUNDER_FORT':
                if (!(flags.waterCityCleared || flags.hasShip || atLeast(5, 0))) {
                    return block('川の流れが速く、岸からでは雷の要塞へ近づけない。', 'locked_thunder_fort');
                }
                if (!flags.josephJoinedAtThunderFort && typeof StoryManager !== 'undefined' && StoryManager.events?.thunder_fort_entry) {
                    return { ok: false, eventId: 'thunder_fort_entry' };
                }
                return ok();
            case 'BIG_TOWER':
                // 大灯台はいつでも入場可能。
                // ただし map.js のボス定義側で thunderFortCleared を要求するため、
                // 雷の要塞イベント前はボスが出現せず、金鍵も得られない。
                return ok();
            case 'LIGHT_PALACE':
                return flags.lighthouseCleared
                    ? ok()
                    : block('光の神殿は、触れる前から肌を刺すような結界に包まれている。', 'locked_light_palace');
            case 'GALVANIA_CAVE': {
                const entryKey = options.entryKey || 'north';
                if (entryKey === 'south') {
                    return flags.galvaniaCaveSouthOpened
                        ? ok()
                        : block('南口の岩戸は内側から開けられていない。北口から洞窟を抜ける必要がある。', null);
                }
                return hasLeila
                    ? ok()
                    : block('すさまじい結界でふさがれている。', 'galvania_cave_north_blocked');
            }
            case 'GALVANIA_CAVE_NORTH':
                return hasLeila
                    ? ok()
                    : block('すさまじい結界でふさがれている。', 'galvania_cave_north_blocked');
            case 'GALVANIA_CAVE_SOUTH':
                return flags.galvaniaCaveSouthOpened
                    ? ok()
                    : block('南口の岩戸は内側から開けられていない。北口から洞窟を抜ける必要がある。', null);
            case 'DARK_CASTLE':
                return hasLeila
                    ? ok()
                    : block('王宮聖騎士の結界が道を閉ざしている。', 'locked_dark_castle');
            case 'DARK_SHRINE_RUINS':
                return hasLeila
                    ? ok()
                    : block('王国聖騎士の結界が入口を閉ざしている。', 'locked_dark_shrine');
            default:
                return ok();
        }
    },

    ensureFixedProceduralStores: () => {
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.fixedProceduralFloors || typeof App.data.progress.fixedProceduralFloors !== 'object') {
            App.data.progress.fixedProceduralFloors = {};
        }
        if (!App.data.progress.fixedProceduralRunIds || typeof App.data.progress.fixedProceduralRunIds !== 'object') {
            App.data.progress.fixedProceduralRunIds = {};
        }
        return App.data.progress;
    },

    isValidFixedProceduralFloor: (floorDef) => {
        if (!floorDef || !Array.isArray(floorDef.tiles) || floorDef.tiles.length < 3) return false;
        const width = Number(floorDef.width || floorDef.tiles[0]?.length || 0);
        const height = Number(floorDef.height || floorDef.tiles.length);
        const rectangular = Number.isInteger(width) && width >= 3 && height === floorDef.tiles.length
            && floorDef.tiles.every(row => (typeof row === 'string' || Array.isArray(row)) && row.length === width);
        if (!rectangular) return false;
        if (!floorDef.generatedFromAbyssLogic || !Array.isArray(floorDef.chests)) return true;
        if (Number(floorDef.proceduralGenerationVersion || 0) !== Number(Dungeon.fixedProceduralGenerationVersion)) return false;
        const items = globalThis.DB?.ITEMS || globalThis.ITEMS_DATA || [];
        return floorDef.chests.every(chest => {
            const item = items.find(entry => Number(entry.id) === Number(chest?.itemId));
            return Dungeon.isRandomChestRewardEligible(item);
        });
    },

    beginFixedProceduralRun: (areaKey) => {
        const base = typeof FIXED_DUNGEON_MAPS !== 'undefined' ? FIXED_DUNGEON_MAPS[areaKey] : null;
        if (!base?.floors?.some(floor => floor?.procedural)) return;
        const progress = Dungeon.ensureFixedProceduralStores();
        progress.fixedProceduralRunIds[areaKey] = Math.max(0, Number(progress.fixedProceduralRunIds[areaKey] || 0)) + 1;
        const prefix = `${areaKey}:`;
        Object.keys(progress.fixedProceduralFloors)
            .filter(key => key.startsWith(prefix))
            .forEach(key => delete progress.fixedProceduralFloors[key]);
    },

    getOrCreateFixedProceduralFloor: (areaKey, floorNo, template) => {
        const progress = Dungeon.ensureFixedProceduralStores();
        if (!Number(progress.fixedProceduralRunIds[areaKey])) progress.fixedProceduralRunIds[areaKey] = 1;
        const runId = Math.max(1, Number(progress.fixedProceduralRunIds[areaKey]));
        const cacheKey = `${areaKey}:R${runId}:F${Number(floorNo)}`;
        const cached = progress.fixedProceduralFloors[cacheKey];
        if (Dungeon.isValidFixedProceduralFloor(cached)) return JSON.parse(JSON.stringify(cached));

        const previousDungeonData = JSON.parse(JSON.stringify(App.data.dungeon || {}));
        const previousDungeonState = {
            floor: Dungeon.floor,
            width: Dungeon.width,
            height: Dungeon.height,
            map: Dungeon.map,
            lastGenVariant: Dungeon.lastGenVariant
        };
        const previousFieldState = { x: Field.x, y: Field.y, currentMapData: Field.currentMapData };
        let generated = [];
        let generatedAnchor = null;
        try {
            App.data.dungeon = { ...previousDungeonData };
            Dungeon.floor = Math.max(1, Number(template.encounterRank || template.rank || floorNo));
            Dungeon.buildRandomFloorLayout(Object.freeze({
                floor: Dungeon.floor,
                category: template.forceMaze ? 'maze' : 'abyss',
                themeId: 'abyss'
            }));
            const raw = Array.isArray(Dungeon.map) ? Dungeon.map : [];
            const width = Math.max(0, ...raw.map(row => row?.length || 0));
            generated = raw.map(row => Array.from({ length: width }, (_, x) => {
                const tile = String(row?.[x] || 'W').toUpperCase();
                return tile === 'W' ? 'W' : ((tile === 'C' || tile === 'R') ? tile : 'T');
            }));
            if (Number.isFinite(Number(Field.x)) && Number.isFinite(Number(Field.y))) {
                generatedAnchor = { x: Number(Field.x), y: Number(Field.y) };
            }
        } catch (error) {
            console.warn(`[FixedDungeon] ${areaKey} ${floorNo}階の可変MAP生成に失敗したため、安全な代替構造を使用します。`, error);
        } finally {
            App.data.dungeon = previousDungeonData;
            Dungeon.floor = previousDungeonState.floor;
            Dungeon.width = previousDungeonState.width;
            Dungeon.height = previousDungeonState.height;
            Dungeon.map = previousDungeonState.map;
            Dungeon.lastGenVariant = previousDungeonState.lastGenVariant;
            Field.x = previousFieldState.x;
            Field.y = previousFieldState.y;
            Field.currentMapData = previousFieldState.currentMapData;
        }

        if (!generated.length || !generated[0]?.length) {
            const width = 39;
            const height = 29;
            generated = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
                (x === 0 || y === 0 || x === width - 1 || y === height - 1) ? 'W' : 'T'
            ));
        }

        const neighbors = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
            .filter(point => point.y >= 0 && point.y < generated.length && point.x >= 0 && point.x < generated[0].length && generated[point.y][point.x] !== 'W');

        // 可変階は入口・出口・宝箱をすべて同じ連結領域へ収める。
        // 旧ジャゴレアで発生した、右側だけ巨大な独立区画になる生成結果や、
        // 到達不能な小島へ宝箱が残る結果は、生成開始点を含む連結領域以外を壁へ戻して破棄する。
        const connectedComponents = [];
        const componentSeen = new Set();
        for (let y = 0; y < generated.length; y++) {
            for (let x = 0; x < generated[0].length; x++) {
                const startKey = `${x},${y}`;
                if (generated[y][x] === 'W' || componentSeen.has(startKey)) continue;
                const component = [];
                const queue = [{ x, y }];
                componentSeen.add(startKey);
                for (let index = 0; index < queue.length; index++) {
                    const current = queue[index];
                    component.push(current);
                    neighbors(current.x, current.y).forEach(next => {
                        const key = `${next.x},${next.y}`;
                        if (componentSeen.has(key)) return;
                        componentSeen.add(key);
                        queue.push(next);
                    });
                }
                connectedComponents.push(component);
            }
        }
        const anchorKey = generatedAnchor ? `${generatedAnchor.x},${generatedAnchor.y}` : null;
        const anchoredComponent = anchorKey
            ? connectedComponents.find(component => component.some(point => `${point.x},${point.y}` === anchorKey))
            : null;
        const mainComponent = anchoredComponent || connectedComponents.sort((a, b) => b.length - a.length)[0] || [];
        const mainCells = new Set(mainComponent.map(point => `${point.x},${point.y}`));
        generated.forEach((row, y) => row.forEach((tile, x) => {
            if (tile !== 'W' && !mainCells.has(`${x},${y}`)) row[x] = 'W';
        }));

        const farthest = (start) => {
            const queue = [{ ...start, distance: 0 }];
            const seen = new Set([`${start.x},${start.y}`]);
            let result = queue[0];
            for (let index = 0; index < queue.length; index++) {
                const current = queue[index];
                if (current.distance > result.distance) result = current;
                neighbors(current.x, current.y).forEach(next => {
                    const key = `${next.x},${next.y}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    queue.push({ ...next, distance: current.distance + 1 });
                });
            }
            return { x: result.x, y: result.y };
        };
        generated.forEach(row => row.forEach((tile, x) => {
            if (['S', 'D', 'U', 'B'].includes(tile)) row[x] = 'T';
        }));
        const walkable = [];
        generated.forEach((row, y) => row.forEach((tile, x) => {
            if (tile !== 'W' && tile !== 'C' && tile !== 'R') walkable.push({ x, y });
        }));
        const entryPoint = farthest(walkable[0] || { x: 1, y: 1 });
        const exitPoint = farthest(entryPoint);
        generated[entryPoint.y][entryPoint.x] = 'U';
        generated[exitPoint.y][exitPoint.x] = 'D';
        const itemCandidates = (globalThis.DB?.ITEMS || globalThis.ITEMS_DATA || []).filter(item => {
            const rank = Number(item?.rank || 1);
            return Dungeon.isRandomChestRewardEligible(item)
                && rank <= Number(template.encounterRank || 1)
                && Number(item.price || 0) >= 0;
        });
        const pickItemId = () => itemCandidates[Math.floor(Math.random() * itemCandidates.length)]?.id || 1;
        const chests = [];
        generated.forEach((row, y) => row.forEach((tile, x) => {
            if (tile === 'C' || tile === 'R') chests.push({ x, y, itemId: pickItemId(), rare: tile === 'R' });
        }));
        const result = {
            ...template,
            procedural: false,
            generatedFromAbyssLogic: true,
            proceduralGenerationVersion: Dungeon.fixedProceduralGenerationVersion,
            proceduralRunId: runId,
            width: generated[0].length,
            height: generated.length,
            tiles: generated.map(row => row.join('')),
            entryPoint,
            chests,
            floorLinks: [
                { x: entryPoint.x, y: entryPoint.y, toFloor: Number(floorNo) - 1, label: '前の階へ' },
                { x: exitPoint.x, y: exitPoint.y, toFloor: Number(floorNo) + 1, label: '次の階へ' }
            ]
        };
        progress.fixedProceduralFloors[cacheKey] = result;
        return JSON.parse(JSON.stringify(result));
    },

    startFixed: (mapKey, options = {}) => {
        const gate = Dungeon.canEnterFixedDungeon(mapKey, options);
        if (!gate.ok) {
            if (gate.eventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                StoryManager.executeEvent(gate.eventId);
                return false;
            }
            if (gate.message) App.log(gate.message);
            return false;
        }
        const baseDef = (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonBase)
            ? MapRegistry.getFixedDungeonBase(mapKey)
            : ((typeof FIXED_DUNGEON_MAPS !== 'undefined') ? FIXED_DUNGEON_MAPS[mapKey] : null);
        if (App.data?.location?.area !== mapKey) Dungeon.beginFixedProceduralRun(mapKey);
        const entryFromKey = (options.entryKey && baseDef?.entryPoints && baseDef.entryPoints[options.entryKey])
            ? baseDef.entryPoints[options.entryKey]
            : null;
        const startFloor = Math.max(1, Number(options.floor || entryFromKey?.floor || baseDef?.entryFloor || 1) || 1);
        const areaDef = Dungeon.getFixedFloorDef(mapKey, startFloor);
        if (!areaDef) return false;

        // 帰還地点の保存。
        // 固定ダンジョン内から別の固定ダンジョンへ入る場合は、元の帰還地点をスタックへ退避する。
        const makeReturnPoint = () => ({
            x: App.data.location.x,
            y: App.data.location.y,
            areaKey: App.data.location.area || 'WORLD',
            worldKey: App.data.location.worldKey || (MapRegistry?.getActiveWorldKey?.() || 'WORLD'),
            mapData: Field.currentMapData ? JSON.parse(JSON.stringify(Field.currentMapData)) : null
        });
        if (options.nestedReturn) {
            if (!Array.isArray(App.data.dungeon.returnStack)) App.data.dungeon.returnStack = [];
            if (App.data.dungeon.returnPoint) App.data.dungeon.returnStack.push(App.data.dungeon.returnPoint);
            App.data.dungeon.returnPoint = makeReturnPoint();
        } else if (!App.data.dungeon.returnPoint) {
            App.data.dungeon.returnPoint = makeReturnPoint();
        }

        App.data.progress.floor = areaDef.floor || 1;
        Dungeon.floor = App.data.progress.floor;
        App.data.location.area = mapKey;
        App.data.location.worldKey = STORY_DATA?.areas?.[mapKey]?.worldKey || App.data.location.worldKey || 'WORLD';
        App.data.dungeon.map = null;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;

        Field.currentMapData = areaDef;
        if (typeof Dungeon.resetFixedHunterStateForCurrentMap === 'function') Dungeon.resetFixedHunterStateForCurrentMap();

        const selectedEntry = entryFromKey
            || ((options.entryKey && areaDef.entryPoints && areaDef.entryPoints[options.entryKey])
                ? areaDef.entryPoints[options.entryKey]
                : ((Number(baseDef?.entryFloor || 1) === startFloor && baseDef?.entryPoint) ? baseDef.entryPoint : areaDef.entryPoint));
        Field.x = selectedEntry ? selectedEntry.x : 1;
        Field.y = selectedEntry ? selectedEntry.y : 1;
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
        Dungeon.rollTrialAngelSpawn({ fixed: true });
        if (typeof Dungeon.markFixedVisibleArea === 'function') Dungeon.markFixedVisibleArea(Field.x, Field.y, areaDef.revealRadius || 3);

        if (typeof App.discoverFixedMap === 'function') App.discoverFixedMap(mapKey, { save: false });

        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('floor_move');
        App.save();
        App.changeScene('field');
        App.log(`${areaDef.displayName || areaDef.name}に入った。`);
        return true;
    },

    nextFloor: () => {
        if (Dungeon.isMemoryRealm() && Number(App.data?.progress?.floor || Dungeon.floor || 1) >= Dungeon.memoryRealmMaxFloor) {
            App.log('最奥のゲートから地上へ戻ってください。');
            App.clearAction?.();
            return;
        }
        if (Dungeon.isStoryAbyss() && Number(App.data?.progress?.floor || Dungeon.floor || 1) >= 100) {
            App.log('物語深淵は100階で踏破済みです。メニューから帰還し、ランダム深淵へ挑戦してください。');
            App.clearAction?.();
            return;
        }
        if (Field.currentMapData?.isFixed) {
            Dungeon.changeFixedFloor((App.data.progress.floor || 1) + 1);
            return;
        }
        const guildRun = Dungeon.getGuildQuestRun();
        if (guildRun?.completed && Number(Dungeon.floor || 1) >= Math.max(1, Number(guildRun.floorCount || 1))) {
            App.log('依頼迷宮の出口が開いた。');
            Dungeon.exit(false);
            return;
        }
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('stairs');
        App.data.progress.floor++;
        App.data.dungeon.map = null; 
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
        App.data.dungeon.memoryRewardChests = null;
        App.data.dungeon.memoryBossCleared = false;
        App.data.dungeon.memoryRestFloor = false;
        App.data.dungeon.memoryThemeId = null;
        App.data.dungeon.memoryMonsterPool = null;
        Dungeon.loadFloor();
    },

    loadFloor: () => {
        const areaKey = App.data.location.area;
        // ★追加：固定ダンジョンの復元チェック
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]) {
            Dungeon.floor = App.data.progress.floor || 1;
            Field.currentMapData = Dungeon.getFixedFloorDef(areaKey, Dungeon.floor);
            if (typeof Dungeon.resetFixedHunterStateForCurrentMap === 'function') Dungeon.resetFixedHunterStateForCurrentMap();
            App.changeScene('field');
            return;
        }

        Dungeon.floor = App.data.progress.floor;
        const generatedNewFloor = !App.data.dungeon.map;
        
        if (App.data.dungeon.map) {
            Dungeon.map = App.data.dungeon.map;
            Dungeon.width = App.data.dungeon.width;
            Dungeon.height = App.data.dungeon.height;
            if (Dungeon.isMemoryRealm()) {
                const memoryTheme = Dungeon.getMemoryRealmTheme();
                Dungeon.setRandomVisualTheme({
                    id: `memory-${memoryTheme.id}`,
                    themeKey: memoryTheme.themeKey,
                    battleBg: memoryTheme.battleBg,
                    wallFaceImg: memoryTheme.wallFaceImg || null,
                    wallFaceTorchImg: memoryTheme.wallFaceTorchImg || null
                });
            } else {
                Dungeon.ensureRandomVisualTheme(Dungeon.floor);
            }
            // v3.18以前に保存された階層にも、孤立した1マス壁が残っている場合がある。
            // 復元時に地形だけ整形し、階段・鍵・宝箱など既存の進行状態は維持する。
            const removedIsolatedWalls = Dungeon.removeIsolatedWallTiles(Dungeon.map);
            if (removedIsolatedWalls > 0) {
                App.data.dungeon.map = Dungeon.map;
                App.save();
            }
            if (App.data.dungeon.adventurer && Number(App.data.dungeon.adventurer.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.adventurer = null;
            }
            if (App.data.dungeon.healSpring && Number(App.data.dungeon.healSpring.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.healSpring = null;
            }
            if (App.data.dungeon.abyssRift && Number(App.data.dungeon.abyssRift.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.abyssRift = null;
            }
            if (App.data.dungeon.trialAngel && Number(App.data.dungeon.trialAngel.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.trialAngel = null;
            }
            if (Array.isArray(App.data.dungeon.randomHunters)) {
                App.data.dungeon.randomHunters = App.data.dungeon.randomHunters.filter(hunter => hunter?.active && Number(hunter.floor) === Number(Dungeon.floor));
                if (!App.data.dungeon.randomHunters.length) App.data.dungeon.randomHunters = null;
            }
            if (Array.isArray(App.data.dungeon.keyChests)) {
                App.data.dungeon.keyChests = App.data.dungeon.keyChests.filter(chest => Number(chest.floor) === Number(Dungeon.floor));
                if (!App.data.dungeon.keyChests.length) App.data.dungeon.keyChests = null;
            }
            if (Array.isArray(App.data.dungeon.floorKeys)) {
                App.data.dungeon.floorKeys = App.data.dungeon.floorKeys.filter(key => Number(key.floor) === Number(Dungeon.floor));
                if (!App.data.dungeon.floorKeys.length) App.data.dungeon.floorKeys = null;
            }
            if (App.data.dungeon.keyGuardian && Number(App.data.dungeon.keyGuardian.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.keyGuardian = null;
            }
            if (App.data.dungeon.visitedMap && Number(App.data.dungeon.visitedMap.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.visitedMap = null;
            }
            if (!Dungeon.isBossFloor()) Dungeon.repairLoadedRandomFloorIntegrity();
            const activeAbyssBossEncounter = App.data.dungeon.abyssBossEncounter &&
                App.data.dungeon.abyssBossEncounter.active &&
                Number(App.data.dungeon.abyssBossEncounter.floor) === Number(Dungeon.floor) &&
                ABYSS_FLOOR_RULES.normalizeMode(App.data.dungeon.abyssBossEncounter.mode, Dungeon.getAbyssMode()) === Dungeon.getAbyssMode();
            const hasAbyssBossTile = Dungeon.hasCurrentAbyssBossTile();
            if (Dungeon.isBossFloor() && (hasAbyssBossTile || activeAbyssBossEncounter)) {
                const layout = Dungeon.getAbyssBossRoomLayout ? Dungeon.getAbyssBossRoomLayout() : null;
                if (layout && (App.data.dungeon.bossRoomLayout !== layout.id || !hasAbyssBossTile)) {
                    const preservedEncounter = App.data.dungeon.abyssBossEncounter;
                    Dungeon.generateAbyssBossRoom({ preserveEncounter: preservedEncounter });
                    App.data.dungeon.map = Dungeon.map;
                    App.data.dungeon.width = Dungeon.width;
                    App.data.dungeon.height = Dungeon.height;
                } else {
                    Dungeon.ensureAbyssBossEncounter({ floor: Dungeon.floor });
                }
                if (typeof App.save === 'function') App.save();
            } else if (App.data.dungeon.abyssBossEncounter && Number(App.data.dungeon.abyssBossEncounter.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.abyssBossEncounter = null;
            }
            App.log(Dungeon.isMemoryRealm() ? `追憶の魔境 ${Dungeon.floor}階の探索を再開します。` : `地下 ${Dungeon.floor} 階の冒険を再開します。`);
        } else {
            if (!Dungeon.isGuildQuestRunActive() && Dungeon.floor > Dungeon.getModeMaxFloor()) {
                if (Dungeon.isStoryAbyss()) App.data.dungeon.storyMaxFloor = Dungeon.floor;
                else if (Dungeon.isMemoryRealm()) App.data.dungeon.memoryMaxFloor = Math.min(Dungeon.memoryRealmMaxFloor, Dungeon.floor);
                else App.data.dungeon.maxFloor = Dungeon.floor;
				
				// 主人公の限界突破を新基準で再計算（story.jsの関数を呼び出すのが安全）
				if (typeof StoryManager !== 'undefined' && StoryManager.syncHeroLimitBreak) {
					StoryManager.syncHeroLimitBreak(); // story.jsの新ロジックを呼び出し
				} else {
					// フォールバック用
					const hero = App.data.characters?.find(c => c.charId === 301 || c.uid === 'p1');
					if (hero) {
						if (typeof App.syncDerivedLimitBreaks === 'function') App.syncDerivedLimitBreaks({ heroOnly: true });
						if (typeof App.calcStats === 'function') App.calcStats(hero);
					}
				}
			}
            Dungeon.generateFloor();
            Dungeon.saveMapData();
            Dungeon.logFloorArrival();
        }
        if (!Dungeon.isBossFloor() && generatedNewFloor) Dungeon.rollRandomFloorModifier();
        else if (Dungeon.isBossFloor()) {
            App.data.dungeon.floorModifier = null;
            App.data.dungeon.pendingFloorModifierAnnouncement = null;
        }
        
        Field.currentMapData = Dungeon.createRandomFieldMapData();

        App.data.location.x = Field.x;
        App.data.location.y = Field.y;

        // 迷路フロアでは、現在見えている範囲をミニマップ記憶へ残す。
        Dungeon.markVisibleArea(Field.x, Field.y);

        App.changeScene('field');
        
        if (App.data.battle) {
            App.data.battle.isBossBattle = false;
            App.data.battle.isSpecialBoss = false;
            App.data.battle.isEstark = false;
        }
        App.clearAction();
    },

    saveMapData: () => {
        App.data.dungeon.map = Dungeon.map;
        App.data.dungeon.width = Dungeon.width;
        App.data.dungeon.height = Dungeon.height;
        App.save();
    },

    repairLoadedRandomFloorIntegrity: () => {
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length || Dungeon.isBossFloor()) return false;
        let changed = false;
        const actualHeight = Dungeon.map.length;
        const actualWidth = Array.isArray(Dungeon.map[0]) ? Dungeon.map[0].length : 0;
        if (actualWidth && (Number(Dungeon.width) !== actualWidth || Number(Dungeon.height) !== actualHeight)) {
            Dungeon.width = actualWidth;
            Dungeon.height = actualHeight;
            App.data.dungeon.width = actualWidth;
            App.data.dungeon.height = actualHeight;
            changed = true;
        }

        if (Dungeon.pruneUnreachableFromPlayer() > 0) changed = true;
        const dist = Dungeon.distanceMap(Dungeon.map, { x: Number(Field.x), y: Number(Field.y) });
        let stairs = Dungeon.collectTiles(Dungeon.map, ['S']).filter(pos => dist[pos.y]?.[pos.x] >= 0);
        if (stairs.length !== 1) {
            const keep = stairs.sort((a, b) => dist[b.y][b.x] - dist[a.y][a.x])[0] || null;
            Dungeon.collectTiles(Dungeon.map, ['S']).forEach(pos => {
                Dungeon.map[pos.y][pos.x] = keep && pos.x === keep.x && pos.y === keep.y ? 'S' : 'T';
            });
            if (!keep) {
                const candidates = Dungeon.collectTiles(Dungeon.map, ['T', 'G'])
                    .filter(pos => dist[pos.y]?.[pos.x] >= 0)
                    .sort((a, b) => dist[b.y][b.x] - dist[a.y][a.x]);
                if (candidates[0]) Dungeon.map[candidates[0].y][candidates[0].x] = 'S';
            }
            changed = true;
        }

        let reachable = Dungeon.getProgressionReachableCells();
        const occupied = new Set();
        for (const { name, object } of Dungeon.getActiveRandomFloorObjects()) {
            const currentKey = `${Number(object.x)},${Number(object.y)}`;
            if (reachable.has(currentKey) && !occupied.has(currentKey)) {
                occupied.add(currentKey);
                continue;
            }
            const candidates = Dungeon.getSpecialSpawnCandidates()
                .filter(pos => !occupied.has(`${pos.x},${pos.y}`));
            const replacement = candidates[0] || null;
            if (replacement) {
                object.x = replacement.x;
                object.y = replacement.y;
                occupied.add(`${replacement.x},${replacement.y}`);
                changed = true;
                reachable = Dungeon.getProgressionReachableCells();
            } else if (!name.startsWith('key') && !name.startsWith('floorKey')) {
                object.active = false;
                changed = true;
            }
        }

        if (changed) {
            App.data.dungeon.map = Dungeon.map;
            App.data.dungeon.width = Dungeon.width;
            App.data.dungeon.height = Dungeon.height;
            if (typeof App.save === 'function') App.save();
        }
        return changed;
    },

    // --- 脱出処理 (安全装置付き) ---
    // 引数 isWipedOut が true の場合は強制的にデフォルトへ
    exit: (isWipedOut = false, forcedReturnPoint = null, options = {}) => {
        const returnPoint = forcedReturnPoint || App.data.dungeon.returnPoint;
        const leavingGuildQuestRun = Dungeon.getGuildQuestRun();
        const returnStack = Array.isArray(App.data.dungeon.returnStack) ? App.data.dungeon.returnStack : [];
        const nestedReturnPoint = (!isWipedOut && !forcedReturnPoint && returnStack.length > 0) ? returnStack.pop() : null;

        // ダンジョン一時情報のクリア
        App.data.dungeon.map = null;
        App.data.dungeon.width = 30;
        App.data.dungeon.height = 30;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
        App.data.dungeon.abyssBossEncounter = null;
        App.data.dungeon.memoryRewardChests = null;
        App.data.dungeon.memoryBossCleared = false;
        App.data.dungeon.memoryRestFloor = false;
        App.data.dungeon.memoryThemeId = null;
        App.data.dungeon.memoryMonsterPool = null;
        App.data.dungeon.guildQuestRun = null;
        App.data.progress.floor = 0;
        
        // 保存していた帰還ポイントを一度抽出してからクリア
        App.data.dungeon.returnPoint = null;
        if (forcedReturnPoint || isWipedOut) App.data.dungeon.returnStack = null;

        // デフォルトの帰還先 (ワールドマップの安全圏)
        let targetX = 58;
        let targetY = 65;
        let targetArea = 'WORLD';
        let targetWorldKey = 'WORLD';
        let targetMapData = null; 

        // 1. 全滅しておらず、かつ帰還データがある場合は一旦その場所を仮セット
        if (!isWipedOut && returnPoint) {
            targetX = returnPoint.x;
            targetY = returnPoint.y;
            targetArea = returnPoint.areaKey;
            targetWorldKey = returnPoint.worldKey || STORY_DATA?.areas?.[targetArea]?.worldKey || (targetArea === 'ABYSS_WORLD' ? 'ABYSS_WORLD' : 'WORLD');
            targetMapData = returnPoint.mapData;
        }

        // 2. ★安全装置: 帰還先が属するワールド定義または固定マップを正本として判定する。
        let isSafe = true;
        try {
            const worldDef = (typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS[targetArea]) ? WORLD_MAPS[targetArea] : null;
            if (!targetMapData && worldDef) {
                const worldTiles = worldDef.tiles;
                const tile = String(worldTiles?.[targetY]?.[targetX] || 'W').toUpperCase();
                if (tile === 'W' || tile === 'M') isSafe = false;
            } else if (!targetMapData && targetArea === 'WORLD') {
                const tile = String(MAP_DATA?.[targetY]?.[targetX] || 'W').toUpperCase();
                if (tile === 'W' || tile === 'M') isSafe = false;
            } else {
                const tile = String(targetMapData?.tiles?.[targetY]?.[targetX] || 'W').toUpperCase();
                if (tile === 'W') isSafe = false;
            }
        } catch (e) {
            isSafe = false;
        }

        if (!isSafe) {
            App.log("<span style='color:#f88;'>帰還先が不安定だったため、安全な場所へ移動しました。</span>");
            if (targetArea === 'ABYSS_WORLD' && typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS.ABYSS_WORLD) {
                targetX = 39;
                targetY = 57;
                targetArea = 'ABYSS_WORLD';
                targetWorldKey = 'ABYSS_WORLD';
            } else {
                targetX = 58;
                targetY = 65;
                targetArea = 'WORLD';
                targetWorldKey = 'WORLD';
            }
            targetMapData = null;
        }

        // アプリケーションデータへの反映
        App.data.location.area = targetArea;
        App.data.location.worldKey = targetWorldKey;
        App.data.location.x = targetX;
        App.data.location.y = targetY;
        
        if(typeof Field !== 'undefined') {
            Field.x = targetX;
            Field.y = targetY;
            Field.currentMapData = targetMapData;
        }

        if (!isWipedOut && !forcedReturnPoint && nestedReturnPoint) {
            App.data.dungeon.returnPoint = nestedReturnPoint;
            App.data.dungeon.returnStack = returnStack;
        }

        if (targetMapData?.isDungeon) {
            App.data.progress.floor = targetMapData.floor || 1;
            Dungeon.floor = App.data.progress.floor;
        } else {
            App.data.progress.floor = 0;
            Dungeon.floor = 0;
        }
        // ダンジョン外で追憶専用判定が残留しないよう、退出完了時に通常モードへ戻す。
        if (Dungeon.isMemoryRealm()) App.data.dungeon.abyssMode = 'random';
        
        if (options.save !== false) App.save();
        if (options.changeScene !== false) App.changeScene('field');
        
        if (options.log !== false) {
            if (isWipedOut) {
                App.log("命からがら逃げ出した……");
            } else if (leavingGuildQuestRun?.completed) {
                App.log('依頼迷宮を攻略し、帰還した。');
            } else if (leavingGuildQuestRun) {
                App.log('依頼迷宮から撤退した。依頼は再挑戦できる。');
            } else {
                App.log("ダンジョンから脱出した");
            }
        }
        if (options.clearAction !== false) App.clearAction();
        return { x: targetX, y: targetY, area: targetArea, worldKey: targetWorldKey };
    },
	
    // --- 移動・イベント処理 (全文) ---
    // 旧1～100階の固定ボス列は廃止済み。物語進行は深淵世界の固定MAPを正本とする。
    getAbyssBossStoryDefinition: () => null,

    isAbyssBossStoryDefeated: (floor = Dungeon.floor) => {
        const f = Number(floor || 0);
        const definition = Dungeon.getAbyssBossStoryDefinition(f);
        if (!definition) return false;

        const progress = App.data?.progress || {};
        if (definition.clearFlag && progress.flags?.[definition.clearFlag]) return true;

        // 勝利直後、クリア会話が始まる前にも再戦イベントを防げるよう、
        // ストーリー会話用フラグとは別に討伐済み階を記録する。
        const defeatedFloors = progress.abyssStoryBossDefeatedFloors;
        if (Array.isArray(defeatedFloors)) {
            return defeatedFloors.some(value => Number(value) === f);
        }
        return !!(defeatedFloors && typeof defeatedFloors === 'object' && defeatedFloors[String(f)]);
    },

    markAbyssBossStoryDefeated: (floor = Dungeon.floor) => {
        const f = Number(floor || 0);
        if (!Dungeon.getAbyssBossStoryDefinition(f)) return false;
        if (!App.data.progress) App.data.progress = {};

        const current = App.data.progress.abyssStoryBossDefeatedFloors;
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            const normalized = {};
            if (Array.isArray(current)) {
                current.forEach(value => {
                    const savedFloor = Number(value);
                    if (Number.isFinite(savedFloor) && savedFloor > 0) normalized[String(savedFloor)] = true;
                });
            }
            App.data.progress.abyssStoryBossDefeatedFloors = normalized;
        }
        App.data.progress.abyssStoryBossDefeatedFloors[String(f)] = true;
        return true;
    },

    getAbyssBossStoryEventId: (floor = Dungeon.floor, options = {}) => {
        const definition = Dungeon.getAbyssBossStoryDefinition(floor);
        if (!definition) return null;
        if (options.includeCleared !== true && Dungeon.isAbyssBossStoryDefeated(floor)) return null;
        return definition.eventId;
    },

    getAbyssStoryBossDisplayMonsterId: () => null,

    getAbyssBossRoomLayout: () => Dungeon.isMemoryRealm() ? ({
        id: 'memory-realm-final-v1',
        width: 15,
        height: 21,
        centerX: 7,
        boss: { x: 7, y: 8 },
        entry: { x: 7, y: 19 },
        stair: { x: 7, y: 1 },
        spring: { x: 7, y: 3 },
        rareChest: { x: 7, y: 5 },
        rewardChests: [
            { id:'equip-1', type:'equipment', x:3, y:5 },
            { id:'equip-2', type:'equipment', x:5, y:5 },
            { id:'skill', type:'skillBook', x:7, y:5 },
            { id:'equip-3', type:'equipment', x:9, y:5 },
            { id:'trait', type:'traitBook', x:11, y:5 }
        ],
        exitGate: { x: 7, y: 1 }
    }) : ({
        id: 'narrow-v2',
        width: 9,
        height: 21,
        centerX: 4,
        boss: { x: 4, y: 5 },
        entry: { x: 4, y: 19 },
        stair: { x: 4, y: 1 },
        spring: { x: 3, y: 3 },
        rareChest: { x: 5, y: 3 }
    }),

    getAbyssBossDisplayMonsterId: (monsterIds, fallbackId = null) => {
        const ids = (Array.isArray(monsterIds) ? monsterIds : [monsterIds])
            .map(id => Number(id))
            .filter(id => Number.isFinite(id) && id > 0);
        // 3体編成は配置順の中央（2番目）をフィールド代表として描画する。
        if (ids.length === 3) return ids[1];
        if (ids.length > 0) return ids[0];
        const fallback = Number(fallbackId);
        return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
    },

    normalizeAbyssBossEncounter: (encounter) => {
        if (!encounter || !Array.isArray(encounter.monsterIds)) return encounter;
        let ids = encounter.monsterIds
            .map(id => Number(id))
            .filter(id => Number.isFinite(id) && id > 0);
        if (ids.length === 0) return encounter;

        // 旧セーブではストーリー階の代表IDだけが保存されている場合がある。
        // 代表IDと同じminFのボス編成が複数体なら、現在の定義から編成全体を復元する。
        const floor = Math.max(1, Number(encounter.displayFloor || encounter.floor) || 1);
        encounter.floor = floor;
        encounter.displayFloor = floor;
        encounter.mode = ABYSS_FLOOR_RULES.normalizeMode(encounter.mode, Dungeon.getAbyssMode());
        encounter.balanceFloor = Math.max(1, Number(encounter.balanceFloor) || Dungeon.getBalanceFloor(floor, encounter.mode));
        if (encounter.mode === 'memory') {
            ids = ids.filter(id => Dungeon.isMemoryRealmBossId(id));
            if (ids.length === 0) ids = [Dungeon.memoryRealmBossIds[0] || 301010];
        }
        const storyDisplayId = Dungeon.getAbyssStoryBossDisplayMonsterId(floor);
        const monsterData = (typeof window !== 'undefined') ? window.MonsterData : null;
        if (encounter.mode === 'story' && storyDisplayId && ids.includes(Number(storyDisplayId)) && monsterData && typeof monsterData.getBossesForFloor === 'function') {
            const floorIds = (monsterData.getBossesForFloor(floor) || [])
                .map(base => Number(base?.id))
                .filter(id => Number.isFinite(id) && id > 0);
            if (floorIds.length > ids.length && floorIds.includes(Number(storyDisplayId))) ids = floorIds;
        }

        encounter.monsterIds = ids;
        encounter.displayMonsterId = Dungeon.getAbyssBossDisplayMonsterId(ids, encounter.displayMonsterId);
        return encounter;
    },

    selectAbyssBossEncounter: (floor = Dungeon.floor) => {
        const displayFloor = ABYSS_FLOOR_RULES.normalizeFloor(floor);
        const mode = Dungeon.getAbyssMode();
        const balanceFloor = Dungeon.getBalanceFloor(displayFloor, mode);
        const layout = Dungeon.getAbyssBossRoomLayout ? Dungeon.getAbyssBossRoomLayout() : { boss: { x: 5, y: 5 } };
        const guildRun = Dungeon.getGuildQuestRun();
        if (mode === 'memory') {
            const bossId = Dungeon.memoryRealmBossIds[Math.floor(Math.random() * Dungeon.memoryRealmBossIds.length)] || 301010;
            return { active:true, floor:displayFloor, displayFloor, balanceFloor:120, mode, x:layout.boss.x, y:layout.boss.y, monsterIds:[bossId], displayMonsterId:bossId, source:'memory-realm' };
        }
        if (guildRun && displayFloor >= Math.max(1, Number(guildRun.floorCount || 1))) {
            const ids = (Array.isArray(guildRun.bossMonsterIds) ? guildRun.bossMonsterIds : []).map(Number).filter(id => Number.isFinite(id) && id > 0);
            const monsterIds = ids.length ? ids : [401200];
            return { active:true, floor:displayFloor, displayFloor, balanceFloor, mode:'guild', x:layout.boss.x, y:layout.boss.y, monsterIds, displayMonsterId:Dungeon.getAbyssBossDisplayMonsterId(monsterIds), source:'guild-quest', guildQuestId:guildRun.questId };
        }
        const monsterData = globalThis.MonsterData;
        if (mode === 'story') {
            const storyDisplayId = Dungeon.getAbyssStoryBossDisplayMonsterId(displayFloor);
            if (storyDisplayId) {
                const storyBossIds = monsterData?.getBossesForFloor?.(displayFloor)?.map(base => Number(base?.id)).filter(id => Number.isFinite(id) && id > 0) || [];
                const ids = storyBossIds.length ? storyBossIds : [storyDisplayId];
                return { active:true, floor:displayFloor, displayFloor, balanceFloor, mode, x:layout.boss.x, y:layout.boss.y, monsterIds:ids, displayMonsterId:Dungeon.getAbyssBossDisplayMonsterId(ids, storyDisplayId), source:'story' };
            }
        }

        let ids = [];
        if (ABYSS_FLOOR_RULES.isEndlessFloor(displayFloor, mode)) {
            let candidates = (monsterData?.bossMonsters || DB.MONSTERS || []).filter(base => base?.isBoss && !base.isRare && Number(base.id) >= 400000 && Number(base.id) < 500000);
            candidates = Array.from(new Map(candidates.map(base => [Number(base.id), base])).values());
            const count = Math.min(1 + Math.floor(Math.random() * 3), candidates.length);
            const pool = candidates.slice();
            for (let i=0;i<count;i++) { const index=Math.floor(Math.random()*pool.length); const [base]=pool.splice(index,1); if(base) ids.push(Number(base.id)); }
        } else if (monsterData?.getBossesForFloor) {
            let bosses = monsterData.getBossesForFloor(balanceFloor) || [];
            if (!bosses.length) bosses = monsterData.getBossesForFloor(200) || [];
            ids = bosses.map(base => Number(base?.id)).filter(id => Number.isFinite(id) && id > 0);
        }
        if (!ids.length) ids = [401200];
        return { active:true, floor:displayFloor, displayFloor, balanceFloor, mode, x:layout.boss.x, y:layout.boss.y, monsterIds:ids, displayMonsterId:Dungeon.getAbyssBossDisplayMonsterId(ids), source:ABYSS_FLOOR_RULES.isEndlessFloor(displayFloor,mode)?'deep-random':'floor-band' };
    },

    ensureAbyssBossEncounter: (options = {}) => {
        if (!App.data?.dungeon) return null;
        const floor = Math.max(1, Number(options.floor || Dungeon.floor || App.data.progress?.floor || 1));
        const current = App.data.dungeon.abyssBossEncounter;
        const mode = Dungeon.getAbyssMode();
        if (!options.force && current && current.active &&
            Number(current.floor) === floor &&
            ABYSS_FLOOR_RULES.normalizeMode(current.mode, mode) === mode &&
            Array.isArray(current.monsterIds) && current.monsterIds.length) {
            return Dungeon.normalizeAbyssBossEncounter(current);
        }
        const encounter = Dungeon.normalizeAbyssBossEncounter(Dungeon.selectAbyssBossEncounter(floor));
        App.data.dungeon.abyssBossEncounter = encounter;
        return encounter;
    },

    hasCurrentAbyssBossTile: () => {
        if (App.data?.location?.area !== 'ABYSS') return false;
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return false;
        return Dungeon.map.some(row => Array.isArray(row) && row.some(tile => String(tile || '').toUpperCase() === 'B'));
    },

    getCurrentAbyssBossEncounter: () => {
        if (App.data?.location?.area !== 'ABYSS') return null;
        const floor = Math.max(1, Number(Dungeon.floor || App.data?.progress?.floor || 1));
        const encounter = App.data?.dungeon?.abyssBossEncounter;
        const mode = Dungeon.getAbyssMode();
        if (encounter && encounter.active &&
            Number(encounter.floor) === floor &&
            ABYSS_FLOOR_RULES.normalizeMode(encounter.mode, mode) === mode) {
            return Dungeon.normalizeAbyssBossEncounter(encounter);
        }
        if (Dungeon.isBossFloor() && Dungeon.hasCurrentAbyssBossTile()) {
            return Dungeon.ensureAbyssBossEncounter({ floor });
        }
        return null;
    },

    isAbyssBossAt: (x, y) => {
        const encounter = Dungeon.getCurrentAbyssBossEncounter ? Dungeon.getCurrentAbyssBossEncounter() : null;
        return !!(encounter && encounter.active &&
            Number(encounter.floor) === Number(Dungeon.floor) &&
            Number(encounter.x) === Number(x) &&
            Number(encounter.y) === Number(y));
    },

    prepareAbyssBossTileAction: (x, y, options = {}) => {
        if (App.data?.location?.area !== 'ABYSS') return false;
        if (!Dungeon.isAbyssBossAt(x, y)) return false;
        const silent = options.silent !== false;
        const eventId = Dungeon.getAbyssBossStoryEventId(Dungeon.floor);
        if (!silent) App.log("ボスの気配が立ちはだかっている。");
        if (eventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
            App.setAction("対峙する", () => StoryManager.executeEvent(eventId));
        } else {
            App.setAction("ボスと戦う", () => Dungeon.startAbyssBossBattle(x, y));
        }
        return true;
    },

    startAbyssBossBattle: (x = null, y = null) => {
        const encounter = Dungeon.getCurrentAbyssBossEncounter ? Dungeon.getCurrentAbyssBossEncounter() : null;
        if (!encounter) return false;
        if (!App.data.battle) App.data.battle = {};

        // 討伐済み階の再戦は通常ボス戦として開始する。
        // 前回のイベント戦闘情報が残っていても、会話や勝利イベントを再予約しない。
        App.data.battle.active = false;
        App.data.battle.isBossBattle = true;
        App.data.battle.isSpecialBoss = false;
        App.data.battle.isEstark = false;
        App.data.battle.isRiftBattle = false;
        App.data.battle.fixedBossId = null;
        App.data.battle.eventId = null;
        App.data.battle.storyWinEventId = null;
        App.data.battle.storyLossEventId = null;
        App.data.battle.abyssBossEncounter = encounter;
        App.data.battle.abyssMode = ABYSS_FLOOR_RULES.normalizeMode(encounter.mode, Dungeon.getAbyssMode());
        App.data.battle.abyssFloor = ABYSS_FLOOR_RULES.normalizeFloor(encounter.displayFloor ?? encounter.floor);
        App.data.battle.abyssBalanceFloor = Math.max(1, Number(encounter.balanceFloor) || Dungeon.getBalanceFloor(App.data.battle.abyssFloor, App.data.battle.abyssMode));
        App.data.battle.memoryRealm = Dungeon.isMemoryRealm();
        App.data.battle.memoryElements = Dungeon.isMemoryRealm()
            ? [...(Dungeon.getMemoryRealmTheme()?.elements || [])]
            : [];
        const guildRun = Dungeon.getGuildQuestRun();
        App.data.battle.guildQuestChallengeId = guildRun?.questId || null;
        App.data.battle.bossStatMultiplier = guildRun ? Math.max(1, Number(guildRun.bossStatMultiplier || 1)) : 1;
        App.data.battle.guildChallengeEnemyBoost = guildRun ? JSON.parse(JSON.stringify(guildRun.enemyBoost || {})) : null;
        App.data.battle.guildChallengeBossBoost = guildRun ? JSON.parse(JSON.stringify(guildRun.bossEnemyBoost || {
            ...(guildRun.enemyBoost || {}), statMultiplier: 1, rareStatMultiplier: 1, applyToRares: false
        })) : null;
        App.data.battle.guildChallengeAllyAilments = guildRun ? [...(guildRun.allyAilments || [])] : [];
        App.data.battle.abyssBossPosition = {
            x: Number(x ?? encounter.x ?? 5),
            y: Number(y ?? encounter.y ?? 5),
            floor: Number(Dungeon.floor)
        };
        App.save();
        App.changeScene('battle');
        return true;
    },

    handleMove: (x, y) => {
		const tiles = (Field.currentMapData && Field.currentMapData.tiles) ? Field.currentMapData.tiles : Dungeon.map;
		const areaKey = (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function') ? Field.getCurrentAreaKey() : 'ABYSS';
        const changeKey = (typeof Field !== 'undefined' && typeof Field.getCurrentMapChangeKey === 'function') ? Field.getCurrentMapChangeKey(areaKey) : areaKey;
		const posKey = `${x},${y}`;
		let tile = (App.data.progress.mapChanges?.[changeKey]?.[posKey] || App.data.progress.mapChanges?.[areaKey]?.[posKey] || tiles[y][x] || 'W').toUpperCase();

        // 迷路フロアのミニマップは、移動後に見えている範囲を記憶する。
        Dungeon.markVisibleArea(x, y);
        
		//App.clearAction();

        if (Dungeon.isKeyGuardianAt(x, y)) {
            Dungeon.startKeyGuardianBattle();
            return;
        }

        // 深淵の裂け目。接触時は会話選択を出し、承諾時のみ強敵戦へ入る。
        if (Dungeon.isAbyssRiftAt(x, y)) {
            Dungeon.encounterAbyssRift({ auto: true });
            return;
        }

        // 冒険者NPCは主人公が4マス移動するごとに1マス移動する。
        // Field.move()ではなく、移動完了後のDungeon.handleMove()側で処理することで、
        // 壁への移動失敗・足踏みアニメ・メニュー操作ではカウントされない。
        Dungeon.tickAdventurerMovement();

        // 回復の泉。触れただけでは回復せず、ボタン押下で初めて回復する。
        if (Dungeon.prepareHealSpringActionAt(x, y, { silent:false })) return;

        // 溶岩マス。通行はできるが、乗るたびに最大HPの3%ダメージ。
        // その後の通常エンカウント判定は床と同様に行う。
        if (tile === 'M') {
            Dungeon.stepOnLava();
        }

        // 宝箱は移動先ではなく、隣接状態から「調べる」で開ける。
        // 旧セーブで宝箱上に立っている場合のみ、ここから調査アクションを復元する。
        if (Dungeon.isKeyItemTile(tile) || Dungeon.findRandomFloorKey(x, y)) {
            Dungeon.pickupFloorKeyAt(x, y, tile);
            return;
        }

        if(tile === 'C') { 
            const container = Dungeon.getContainerPresentation(Field.getFixedChestAt?.(x, y));
            App.log(Dungeon.isFixedChestOpenedAt(x, y) ? container.opened : container.closed);
            App.setAction(container.action, () => Dungeon.openChest(x, y, 'normal'));
            return; 
        }
        if(tile === 'R') { 
            const container = Dungeon.getContainerPresentation(Field.getFixedChestAt?.(x, y));
            App.log(Dungeon.isFixedChestOpenedAt(x, y) ? container.opened : '赤い宝箱がある。');
            App.setAction(container.action, () => Dungeon.openChest(x, y, 'rare'));
            return; 
        }

        // 地続き遷移・階段・出口判定
        if(tile === 'S' || tile === 'D' || tile === 'U') {
            if (Field.currentMapData.isFixed) {
                if (Dungeon.tryFixedAutoFloorLink(tile, x, y)) return;
                if (Dungeon.prepareFixedTileAction(tile, x, y, { silent: false })) return;
            } else if (tile === 'S') {
                App.log("階段がある。");
                App.setAction("次の階へ", Dungeon.nextFloor);
            }
        } 
        
		// ★修正点: StoryManager によるアクション（イベントボス等）が既にある場合は処理を抜ける
        if (App.pendingAction) return;
		
		// ボス判定
        if(tile === 'B') {
            if (Field.currentMapData.isFixed) {
                // 固定ボスは専用ゲートで完結させる。未受注・未解放・討伐済みでも、
                // 汎用ボス処理へフォールスルーさせてはならない。
                Dungeon.prepareFixedTileAction(tile, x, y, { silent: false });
                return;
            }

            App.log("ボスの気配が…");
            const abyssBossEventId = (areaKey === 'ABYSS') ? Dungeon.getAbyssBossStoryEventId(Dungeon.floor) : null;
            if (abyssBossEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                App.setAction("対峙する", () => StoryManager.executeEvent(abyssBossEventId));
                return;
            }
            App.setAction("ボスと戦う", () => {
                if (Field.currentMapData.isFixed) {
                    Dungeon.startFixedBoss(x, y);
                    return;
                }
                if (areaKey === 'ABYSS' && Dungeon.startAbyssBossBattle(x, y)) return;
                if (App.data.battle) App.data.battle.isBossBattle = true;
                App.changeScene('battle');
            });
        } 
		
		// 10n階のボスフロアでは通常床でもランダムエンカウントを発生させない。
		// ボス撃破後の階段・泉・レア宝箱へ向かう余韻を邪魔しないため。
		if (Field.currentMapData?.disableRandomEncounters === true) {
			return;
		}

		if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) {
			return;
		}

		// 通常床ではランダムエンカウントを発生させる
		// 宝箱・階段・出口・ボス・イベントアクション中は除外
        if ((tile === 'T' || tile === 'G' || tile === 'M' || tile === Dungeon.floodedTile) && !App.pendingAction) {
			const occurred = App.tryRandomEncounter();

			if (!occurred) {
				if (App.data.walkCount === undefined) App.data.walkCount = 0;
				App.data.walkCount++;
			}

			return;
		}
    },
	
    /* dungeon.js: Dungeon.openChest 関数 */
    openChest: async (x, y, type) => {
        const isFixed = Field.currentMapData && Field.currentMapData.isFixed;
        const areaKey = Field.getCurrentAreaKey();

        // --- 1. 固定マップ（試練の洞窟など）の処理 ---
        if (isFixed) {
            const posKey = `${x},${y}`;
            const progressKey = Dungeon.getFixedProgressKey(areaKey);
            if (!App.data.progress.openedChests) App.data.progress.openedChests = {};
            if (!App.data.progress.openedChests[progressKey]) App.data.progress.openedChests[progressKey] = [];

            const mapDef = Field.currentMapData
                || Dungeon.getFixedFloorDef(areaKey, App.data.progress.floor || 1)
                || (typeof FIXED_MAPS !== 'undefined' ? FIXED_MAPS[areaKey] : null)
                || (typeof FIXED_DUNGEON_MAPS !== 'undefined' ? FIXED_DUNGEON_MAPS[areaKey] : null);
            const chestDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedChest)
                ? MapRegistry.findFixedChest(mapDef, x, y)
                : (mapDef?.chests ? mapDef.chests.find(c => Number(c.x) === Number(x) && Number(c.y) === Number(y)) : null);
            const container = Dungeon.getContainerPresentation(chestDef);
            const markOpened = () => Dungeon.markFixedChestOpened(progressKey, posKey, x, y, chestDef, mapDef);
            
            if (App.data.progress.openedChests[progressKey].includes(posKey)) {
                App.log(container.empty);
                return;
            }
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('chest_open');

            if (chestDef) {
                if (chestDef.trapMonsterId !== undefined && chestDef.trapMonsterId !== null) {
                    markOpened();
                    if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save: false });
                    App.save();
                    Field.render();
                    await Dungeon.startChestTrapBattle(chestDef.trapMonsterId, {
                        floor: chestDef.trapFloor || mapDef?.encounterRank || mapDef?.rank,
                        fixedChestTrap: { progressKey, posKey }
                    });
                    return;
                }
                if (chestDef.keyColor) {
                    markOpened();
                    if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save: false });
                    Dungeon.grantDungeonKey(chestDef.keyColor, 'chest');
                    App.save();
                    Field.render();
                    return;
                }

                const hasItemReward = chestDef.itemId !== undefined && chestDef.itemId !== null;
                if (hasItemReward) {
                    const item = Dungeon.grantContainerItem(chestDef.itemId, chestDef.count || 1);
                    if (!item) {
                        // 中身の定義が解決できない場合は開封済みにしない。
                        // 旧処理では先に開封済み座標を保存していたため、取得失敗後も永久に空箱になっていた。
                        console.error('[FixedContainer] item definition not found', {
                            areaKey, progressKey, x, y, itemId: chestDef.itemId, chestDef
                        });
                        App.log('中身を取得できなかった。宝箱はまだ開いていない。');
                        Field.render();
                        return;
                    }
                    markOpened();
                    if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save: false });
                    App.log(container.inspect);
                    App.log(`<span style="color:#ffd700;">${item.name}</span> を手に入れた！`);
                } else {
                    markOpened();
                    if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save: false });
                    App.log(container.empty);
                }
            } else {
                markOpened();
                if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save: false });
                App.log(container.empty);
            }
            App.save();
            Field.render(); 
            return;
        }

        // --- 2. ランダム生成ダンジョン（深淵の魔窟）の処理 ---
        if (Dungeon.isMemoryRealm() && Dungeon.openMemoryRewardChest(x, y)) return;
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('chest_open');
        const keyChest = Dungeon.findRandomKeyChest(x, y);
        if (keyChest) {
            keyChest.active = false;
            if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save: false });
            Dungeon.map[y][x] = 'T';
            Dungeon.grantDungeonKey(keyChest.color, 'chest');
            Dungeon.saveMapData();
            Field.render();
            return;
        }

        Dungeon.map[y][x] = 'T';
        // 開封状態を描画だけでなく探索正本へ即時反映する。
        // この後の擬態箱・種・空箱などの早期returnでも、再読込時に宝箱へ戻らない。
        Dungeon.saveMapData();
        Field.render();
        
        let msg = "";
        let hasRareDrop = false, hasUltraRareDrop = false;
        const displayFloor = Dungeon.floor;
        const floor = Dungeon.getCurrentRewardRank(displayFloor);
        if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save: false });

        // 深淵51階以降の通常宝箱のみ5%で擬態箱になる。赤宝箱・鍵宝箱は対象外。
        const mimicConfig = window.CHEST_MIMIC_DATA;
        const mimicChance = Math.max(0, Math.min(1, Number(mimicConfig?.normalChestChance ?? 0.05)));
        const mimicMinimumFloor = Math.max(1, Number(mimicConfig?.minimumAbyssFloor ?? 51));
        if (type === 'normal' && floor >= mimicMinimumFloor && Math.random() < mimicChance) {
            const mimic = Dungeon.getChestTrapMonsterForFloor(floor);
            Dungeon.saveMapData();
            App.save();
            if (mimic) {
                if (await Dungeon.startChestTrapBattle(mimic.id, { floor })) return;
            }
        }

        // ★追加: 特性「57:目利き」のパーティ合計値を算出
        // --- 特性計算対象を「現在のパーティメンバー」に限定 ---
        let bonusNormal = 0, bonusRare = 0, bonusPlus3 = 0;
        let checkMembers = [];
        if (typeof Battle !== 'undefined' && Battle.party && Battle.party.length > 0) {
            checkMembers = Battle.party.filter(p => !p.isDead);
        } else {
            checkMembers = (App.data.party || []).map(uid => App.getChar(uid)).filter(c => c && c.currentHp > 0);
        }

        checkMembers.forEach(char => {
            if (typeof PassiveSkill !== 'undefined') {
                bonusNormal += PassiveSkill.getSumValue(char, 'chest_drop_normal_pct');
                bonusRare   += PassiveSkill.getSumValue(char, 'chest_drop_rare_pct');
                bonusPlus3  += PassiveSkill.getSumValue(char, 'chest_equip_plus3_pct');
            }
        });

        if (type === 'rare') {
            // レア宝箱（赤）
            const ultraChance = 0.5 + (bonusRare / 10); // 0.5% + 特性
            if (Math.random() * 100 < ultraChance) {
                const eq = Dungeon.createEquipWithMinRarity(floor, 3, ['SSR', 'UR', 'EX'], '武器');
                // ... (改＋3の強化処理)
                App.data.inventory.push(eq);
                msg = `なんと <span style="color:#ff00ff; font-weight:bold;">${eq.name}</span>`;
                hasUltraRareDrop = true;
            } else {
                const eq = Dungeon.createEquipWithMinRarity(floor, 3, ['SR', 'SSR', 'UR', 'EX']);
                App.data.inventory.push(eq);
                msg = `なんと <span class="log-rare-drop">${eq.name}</span>`;
                hasRareDrop = true;
            }
        } else {
            // 通常宝箱（茶）
            
            // --- 【優先度1】実・種の判定（出たら終了） ---
            if (floor >= 100) {
                // 基本 1% + bonusRare%
                if (Math.random() * 100 < (10 + bonusRare)) {
                    let sid = 100 + Math.floor(Math.random() * 6); // 基本は種
                    const rr = Math.random() * 100;
                    if (rr < 5) sid = 107; 
                    else if (rr < 20) sid = 106; 
                    
                    const it = DB.ITEMS.find(i => i.id === sid);
                    App.log(`宝箱を開けた！<br>なんと <span style="color:#ffff00;"> ${it.name} </span>を手に入れた！`);
                    if (sid === 107) {
                        if (typeof App.lockFieldInput === 'function') App.lockFieldInput(950);
                        const uFlash = document.getElementById('drop-flash-ultra') || document.getElementById('drop-flash');
                        if(uFlash) {
                            uFlash.style.display = 'block';
                            uFlash.className = 'flash-ultra flash-ultra-active';
                            setTimeout(() => { uFlash.style.display = 'none'; }, 950);
                        }
                    }
                    App.save(); return; // 判定終了
                }
            }

            // --- 【優先度2】装備品の判定（出たら終了） ---
            // 基本 30% 固定。ここには bonusNormal は干渉させない
            if (Math.random() * 100 < 30) {
                // bonusPlus3 は装備の品質（+3か）にのみ適用
                let plusValue = (Math.random() * 100 < 20) ? 2 : 1;
                if (Math.random() * 100 < bonusPlus3) {
                    plusValue = 3;
                    hasRareDrop = true;
                }
                const eq = App.createEquipByFloor('chest', floor, plusValue);
                App.data.inventory.push(eq); 
                msg = `${eq.name}`;
            } 
            // --- 【優先度3】ID99（メダル）の判定（出たら終了） ---
            // bonusNormal をここで使用
            else if (Math.random() * 100 < (15 + bonusNormal)) {
                const item = Dungeon.grantContainerItem(99, 1);
                if (item) {
                    msg = `<span style="color:#ffd700;">${item.name}</span>`;
                }
            }
            // --- 【優先度4】アイテム or GOLD（並列/最終候補） ---
            else {
                if (Math.random() < 0.5) {
                    // アイテム
                    const item = window.PRISMA_ITEM_CATALOG?.pickAbyssChestItem
                        ? window.PRISMA_ITEM_CATALOG.pickAbyssChestItem(floor)
                        : DB.ITEMS.find(i => i.id !== 99 && Dungeon.isRandomChestRewardEligible(i) && i.rank <= floor);
                    if (!item) {
                        App.log('宝箱を開けた！<br>中身は空だった…。');
                        App.save();
                        return;
                    }
                    App.data.items[item.id] = (App.data.items[item.id]||0)+1; 
                    msg = `${item.name}`;
                } else {
                    // GOLD
                    const gold = Math.floor(Math.random() * (500 * floor)) + 100;
                    App.data.gold += gold; 
                    msg = `<span style="color:#ffff00;">${gold} Gold</span>`;
                }
            }
        }

        // 報酬ログは先に出す。
        // 以前はフラッシュ演出の待ち時間中に移動できるため、ログが出る前に消えることがあった。
        App.log(`宝箱を開けた！<br>${msg} を手に入れた！`);

        if (hasRareDrop || hasUltraRareDrop) {
            const lockMs = hasUltraRareDrop ? 950 : 650;
            if (typeof App.lockFieldInput === 'function') App.lockFieldInput(lockMs);

            // DOM固定レイヤーのフラッシュだけを短く走らせる。
            // Field.render() 依存にしないことで、演出がマップ再描画で消えるのを避ける。
            if (hasUltraRareDrop) {
                const uFlash = document.getElementById('drop-flash-ultra') || document.getElementById('drop-flash');
                if(uFlash) {
                    uFlash.style.display = 'block';
                    uFlash.className = 'flash-ultra flash-ultra-active';
                    setTimeout(() => { uFlash.style.display = 'none'; }, lockMs);
                }
            } else {
                const flash = document.getElementById('drop-flash');
                if(flash) {
                    flash.style.display = 'block';
                    flash.classList.remove('flash-active');
                    void flash.offsetWidth;
                    flash.classList.add('flash-active');
                    setTimeout(() => { flash.style.display = 'none'; }, lockMs);
                }
            }
        }
        App.save();
    },
	

    isAdventurerAt: (x, y) => {
        const adv = App.data?.dungeon?.adventurer;
        if (!adv || !adv.active) return false;
        if (Number(adv.floor) !== Number(Dungeon.floor)) return false;
        return Number(adv.x) === Number(x) && Number(adv.y) === Number(y);
    },

    getFixedHealSpringAt: (x, y) => {
        const springs = Field.currentMapData?.isFixed && Array.isArray(Field.currentMapData.healSprings)
            ? Field.currentMapData.healSprings
            : [];
        return springs.find(s => s && Number(s.x) === Number(x) && Number(s.y) === Number(y)) || null;
    },

    getRandomHealSpringAt: (x, y) => {
        const spring = App.data?.dungeon?.healSpring;
        if (!spring || !spring.active) return null;
        if (Number(spring.floor) !== Number(Dungeon.floor)) return null;
        return Number(spring.x) === Number(x) && Number(spring.y) === Number(y) ? spring : null;
    },

    getHealSpringAt: (x, y) => Dungeon.getFixedHealSpringAt(x, y) || Dungeon.getRandomHealSpringAt(x, y),

    isHealSpringAt: (x, y) => !!Dungeon.getHealSpringAt(x, y),

    prepareHealSpringActionAt: (x, y, options = {}) => {
        if (!Dungeon.isHealSpringAt(x, y)) return false;
        if (options.silent === false) App.log('<span style="color:#80ffb0;">清らかな泉が湧いている。</span>');
        App.setAction('泉で回復', () => Dungeon.useHealSpring(x, y));
        return true;
    },

    isAbyssRiftAt: (x, y) => {
        const rift = App.data?.dungeon?.abyssRift;
        if (!rift || !rift.active) return false;
        if (Number(rift.floor) !== Number(Dungeon.floor)) return false;
        return Number(rift.x) === Number(x) && Number(rift.y) === Number(y);
    },

    useHealSpring: (targetX = Field.x, targetY = Field.y) => {
        const fixedSpring = Dungeon.getFixedHealSpringAt(targetX, targetY);
        const spring = Dungeon.getRandomHealSpringAt(targetX, targetY);
        if (!fixedSpring && !spring) {
            if (typeof App.clearAction === 'function') App.clearAction();
            return;
        }
        if (!App.data || !Array.isArray(App.data.characters)) return;
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('heal_spring');
        App.data.characters.forEach(c => {
            const stats = (typeof App.calcStats === 'function') ? App.calcStats(c) : { maxHp: c.hp || 1, maxMp: c.mp || 0 };
            c.currentHp = stats.maxHp;
            c.currentMp = stats.maxMp;
        });

        // ランダムダンジョンの泉は使い切り。固定ダンジョンの常設泉は消さない。
        if (!fixedSpring && spring) {
            spring.active = false;
            App.data.dungeon.healSpring = null;
            if (typeof App.clearAction === 'function') App.clearAction();
        }

        App.log('<span style="color:#80ffb0;">清らかな泉の力で、HPとMPが全回復した！</span>');
        App.save();
        if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
        if (typeof Field !== 'undefined') {
            if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
            if (typeof Field.render === 'function') Field.render();
        }
    },

    flashLavaDamage: () => {
        const old = document.getElementById('lava-damage-flash');
        if (old) old.remove();

        const layer = document.createElement('div');
        layer.id = 'lava-damage-flash';
        layer.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.72);
            z-index: 2600; pointer-events: none;
            opacity: 0; transition: opacity 90ms ease-out;
        `;
        document.body.appendChild(layer);
        requestAnimationFrame(() => {
            layer.style.opacity = '1';
            setTimeout(() => {
                layer.style.opacity = '0';
                setTimeout(() => layer.remove(), 160);
            }, 85);
        });
    },

    stepOnLava: () => {
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('damage_floor');
        if (!App.data || !Array.isArray(App.data.party)) return;

        let damaged = false;
        const members = App.data.party
            .map(uid => App.getChar ? App.getChar(uid) : null)
            .filter(c => c);

        members.forEach(c => {
            const stats = (typeof App.calcStats === 'function') ? App.calcStats(c) : { maxHp: c.hp || c.currentHp || 1 };
            const maxHp = Math.max(1, Number(stats.maxHp || c.hp || c.currentHp || 1));
            const damage = Math.max(1, Math.floor(maxHp * 0.03));
            const current = Number(c.currentHp ?? c.hp ?? maxHp);

            // HP0の仲間は戦闘不能のまま維持する。
            // 「溶岩で死なない」処理は、生存者だけをHP1で踏みとどまらせる。
            if (current <= 0) {
                c.currentHp = 0;
                return;
            }

            c.currentHp = Math.max(1, current - damage);
            damaged = true;
        });

        if (damaged) {
            App.log('<span style="color:#ff8a5c;">溶岩の熱でダメージを受けた！</span>');
            Dungeon.flashLavaDamage();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            App.save();
        }
    },

    damagePartyByFloorEffect: (rate = 0.05, message = '毒沼でダメージを受けた！') => {
        if (!App.data || !Array.isArray(App.data.party)) return false;
        let damaged = false;
        App.data.party
            .map(uid => App.getChar ? App.getChar(uid) : null)
            .filter(Boolean)
            .forEach(c => {
                const stats = (typeof App.calcStats === 'function') ? App.calcStats(c) : { maxHp: c.hp || c.currentHp || 1 };
                const maxHp = Math.max(1, Number(stats.maxHp || c.hp || c.currentHp || 1));
                const current = Number(c.currentHp ?? c.hp ?? maxHp);
                if (current <= 0) {
                    c.currentHp = 0;
                    return;
                }
                const damage = Math.max(1, Math.floor(maxHp * Math.max(0.01, Number(rate) || 0.05)));
                c.currentHp = Math.max(1, current - damage);
                damaged = true;
            });
        if (damaged) {
            App.log(`<span style="color:#88ff66;">${message}</span>`);
            Dungeon.flashLavaDamage();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            App.save();
        }
        return damaged;
    },

    isFixedWalkableForEffect: (x, y) => {
        if (!Field.currentMapData?.isFixed) return false;
        if (x < 0 || y < 0 || x >= Field.currentMapData.width || y >= Field.currentMapData.height) return false;
        const areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data.location.area;
        const changeKey = Field.getCurrentMapChangeKey ? Field.getCurrentMapChangeKey(areaKey) : areaKey;
        let tile = (App.data.progress.mapChanges?.[changeKey]?.[`${x},${y}`] || App.data.progress.mapChanges?.[areaKey]?.[`${x},${y}`] || Field.currentMapData.tiles[y][x]).toUpperCase();
        if (tile === 'B') {
            const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
                ? MapRegistry.findFixedBoss(Field.currentMapData, x, y)
                : null;
            if (Field.isFixedBossDefeatedAt?.(bossDef, x, y, Field.getCurrentProgressMapKey())) tile = 'G';
        }
        const chestDef = Field.getFixedChestAt ? Field.getFixedChestAt(x, y) : null;
        const chestTile = Field.getFixedChestTileSign ? Field.getFixedChestTileSign(chestDef) : null;
        if (chestTile) tile = chestTile;
        return tile !== 'W' && tile !== 'C' && tile !== 'R' && !Dungeon.isLockedDoorTile(tile);
    },

    findShortestGridPath: (startX, startY, targetX, targetY, isWalkable, width, height, maxDistance = Infinity) => {
        const sx = Number(startX), sy = Number(startY), tx = Number(targetX), ty = Number(targetY);
        const w = Number(width), h = Number(height);
        if (![sx, sy, tx, ty, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || typeof isWalkable !== 'function') return null;
        if (sx === tx && sy === ty) return [];

        const startKey = `${sx},${sy}`;
        const targetKey = `${tx},${ty}`;
        const maxSteps = Number.isFinite(Number(maxDistance))
            ? Math.max(0, Math.floor(Number(maxDistance)))
            : w * h;
        const queue = [{ x: sx, y: sy, distance: 0 }];
        const parents = new Map([[startKey, null]]);

        for (let qi = 0; qi < queue.length; qi++) {
            const current = queue[qi];
            if (current.distance >= maxSteps) continue;
            // 同じ最短距離なら、目標へ近づく向きを優先して見た目の蛇行を抑える。
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort((a, b) => {
                const ad = Math.abs(tx - (current.x + a[0])) + Math.abs(ty - (current.y + a[1]));
                const bd = Math.abs(tx - (current.x + b[0])) + Math.abs(ty - (current.y + b[1]));
                return ad - bd;
            });
            for (const [dx, dy] of directions) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const nextKey = `${nx},${ny}`;
                if (parents.has(nextKey)) continue;
                if (!isWalkable(nx, ny, current.x, current.y)) continue;
                parents.set(nextKey, `${current.x},${current.y}`);
                if (nextKey === targetKey) {
                    const reversed = [{ x: nx, y: ny }];
                    let cursor = parents.get(nextKey);
                    while (cursor && cursor !== startKey) {
                        const [px, py] = cursor.split(',').map(Number);
                        reversed.push({ x: px, y: py });
                        cursor = parents.get(cursor);
                    }
                    return reversed.reverse();
                }
                queue.push({ x: nx, y: ny, distance: current.distance + 1 });
            }
        }
        return null;
    },

    isFixedHunterWalkable: (x, y, fromX, fromY, occupied = null) => {
        if (!Dungeon.isFixedWalkableForEffect(x, y)) return false;
        const map = Field.currentMapData;
        const areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data.location.area;
        const changeKey = Field.getCurrentMapChangeKey ? Field.getCurrentMapChangeKey(areaKey) : areaKey;
        let tile = String(App.data.progress.mapChanges?.[changeKey]?.[`${x},${y}`]
            || App.data.progress.mapChanges?.[areaKey]?.[`${x},${y}`]
            || map.tiles[y][x]).toUpperCase();

        // 固定ダンジョンの水面はプレイヤーも通常歩行できないため、追跡者も経路に使わない。
        if (tile === '~') return false;
        if (tile === 'B') {
            const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
                ? MapRegistry.findFixedBoss(map, x, y)
                : null;
            const defeated = Field.isFixedBossDefeatedAt?.(bossDef, x, y, Field.getCurrentProgressMapKey?.());
            const available = Field.isFixedBossAvailable ? Field.isFixedBossAvailable(bossDef) : true;
            if (!defeated && available) return false;
        }

        const mapAction = (typeof MapRegistry !== 'undefined' && MapRegistry.findMapAction)
            ? MapRegistry.findMapAction(map, x, y)
            : null;
        if (Field.isBlockingMapActor?.(mapAction)) return false;
        if (Field.getBlockingObjectAt?.(x, y)) return false;
        if (Dungeon.isAdventurerAt?.(x, y)) return false;
        if (Field.isBuildingMovementBlocked?.(fromX, fromY, x, y)) return false;
        if (occupied instanceof Set && occupied.has(`${x},${y}`) && !(Number(x) === Number(Field.x) && Number(y) === Number(Field.y))) return false;
        return true;
    },

    triggerFixedEffectBattle: (effect, options = {}) => {
        const ids = Array.isArray(effect.monsterIds) ? effect.monsterIds : [effect.monsterId].filter(Boolean);
        if (ids.length === 0) return false;

        const isHunter = effect.type === 'hunter';
        const hunterId = isHunter ? (effect.id || options.hunterId || null) : null;
        const hunterMapKey = isHunter
            ? (options.hunterMapKey
                || (Field.getCurrentProgressMapKey ? Field.getCurrentProgressMapKey() : `${Field.getCurrentAreaKey()}:F${App.data.progress.floor || 1}`))
            : null;

        App.data.battle = {
            active: false,
            isBossBattle: true,
            isSpecialBoss: !!effect.special,
            isEstark: !!effect.special,
            fixedBossId: ids,
            bossStatMultiplier: Number(effect.statMultiplier || options.statMultiplier || 1.6),
            trialEnemyBoost: effect.enemyBoost || options.enemyBoost || null,
            fixedStoryEventId: effect.storyEventId || null,
            fixedHunter: (hunterId && hunterMapKey) ? {
                id: hunterId,
                mapKey: hunterMapKey
            } : null,
            angelTrial: effect.type === 'angel' ? {
                id: effect.id || `${Field.getCurrentAreaKey()}:${Field.x},${Field.y}`,
                rewardCount: Number(effect.rewardCount || 1)
            } : null,
            enemies: []
        };
        App.save();
        App.changeScene('battle');
        return true;
    },

    getCurrentFixedHunterKey: () => {
        if (!Field.currentMapData?.isFixed) return null;
        return Field.getCurrentProgressMapKey
            ? Field.getCurrentProgressMapKey()
            : `${Field.getCurrentAreaKey()}:F${App.data.progress.floor || 1}`;
    },

    resetFixedHunterStateForCurrentMap: (key = null) => {
        const mapKey = key || Dungeon.getCurrentFixedHunterKey?.();
        if (!mapKey) return false;
        if (!App.data.progress) App.data.progress = {};
        if (App.data.progress.fixedHunters && typeof App.data.progress.fixedHunters === 'object') {
            delete App.data.progress.fixedHunters[mapKey];
        }
        if (App.data.dungeon) {
            if (!App.data.dungeon.defeatedFixedHunters || typeof App.data.dungeon.defeatedFixedHunters !== 'object') {
                App.data.dungeon.defeatedFixedHunters = {};
            }
            delete App.data.dungeon.defeatedFixedHunters[mapKey];
        }
        return true;
    },

    isFixedHunterDefeated: (id, key = null) => {
        if (!id) return false;
        const mapKey = key || Dungeon.getCurrentFixedHunterKey?.();
        return !!(mapKey && App.data?.dungeon?.defeatedFixedHunters?.[mapKey]?.[id]);
    },

    markFixedHunterDefeated: (id, key = null) => {
        if (!id) return false;
        const mapKey = key || Dungeon.getCurrentFixedHunterKey?.();
        if (!mapKey) return false;
        if (!App.data.dungeon) App.data.dungeon = {};
        if (!App.data.dungeon.defeatedFixedHunters || typeof App.data.dungeon.defeatedFixedHunters !== 'object') {
            App.data.dungeon.defeatedFixedHunters = {};
        }
        if (!App.data.dungeon.defeatedFixedHunters[mapKey]) App.data.dungeon.defeatedFixedHunters[mapKey] = {};
        App.data.dungeon.defeatedFixedHunters[mapKey][id] = true;

        // 位置情報はフロア内の追跡用に残しつつ、再入場時は resetFixedHunterStateForCurrentMap で初期位置へ戻す。
        const hunterState = App.data.progress?.fixedHunters?.[mapKey];
        if (hunterState?.[id]) hunterState[id].moveProgress = 0;
        return true;
    },

    getFixedHunterState: () => {
        if (!Field.currentMapData?.isFixed) return null;
        const key = Dungeon.getCurrentFixedHunterKey();
        if (!App.data.progress.fixedHunters || typeof App.data.progress.fixedHunters !== 'object') App.data.progress.fixedHunters = {};
        if (!App.data.progress.fixedHunters[key]) {
            App.data.progress.fixedHunters[key] = {};
            (Field.currentMapData.tileEffects || []).filter(e => e.type === 'hunter').forEach((e, index) => {
                const id = e.id || `hunter_${index}`;
                App.data.progress.fixedHunters[key][id] = { x: Number(e.x), y: Number(e.y), active: true, moveProgress: 0 };
            });
        }
        return App.data.progress.fixedHunters[key];
    },

    getFixedHunterAt: (x, y) => {
        if (!Field.currentMapData?.isFixed) return null;
        const key = Dungeon.getCurrentFixedHunterKey();
        const state = Dungeon.getFixedHunterState();
        const defs = (Field.currentMapData.tileEffects || []).filter(e => e.type === 'hunter');
        for (let i = 0; i < defs.length; i++) {
            const def = defs[i];
            const id = def.id || `hunter_${i}`;
            if (Dungeon.isFixedHunterDefeated(id, key)) continue;
            const pos = state?.[id];
            if (pos?.active && Number(pos.x) === Number(x) && Number(pos.y) === Number(y)) {
                return { ...def, id, x: pos.x, y: pos.y };
            }
        }
        return null;
    },

    stepFixedHunters: () => {
        if (!Field.currentMapData?.isFixed || !Array.isArray(Field.currentMapData.tileEffects)) return false;
        const key = Dungeon.getCurrentFixedHunterKey();
        const state = Dungeon.getFixedHunterState();
        const defs = Field.currentMapData.tileEffects.filter(e => e.type === 'hunter');
        const occupied = new Set();
        defs.forEach((def, index) => {
            const hunterId = def.id || `hunter_${index}`;
            const hunterPos = state?.[hunterId];
            if (hunterPos?.active && !Dungeon.isFixedHunterDefeated(hunterId, key)) {
                occupied.add(`${Number(hunterPos.x)},${Number(hunterPos.y)}`);
            }
        });
        for (let i = 0; i < defs.length; i++) {
            const def = defs[i];
            const id = def.id || `hunter_${i}`;
            if (Dungeon.isFixedHunterDefeated(id, key)) continue;
            const pos = state?.[id];
            if (!pos?.active) continue;
            const rawSpeed = Number.isFinite(Number(def.speed)) ? Number(def.speed) : 2;
            const speed = Math.max(0, rawSpeed);
            const range = Math.max(1, Number(def.range || 99));
            if (speed <= 0) continue;

            const originalKey = `${Number(pos.x)},${Number(pos.y)}`;
            occupied.delete(originalKey);
            const path = Dungeon.findShortestGridPath(
                pos.x,
                pos.y,
                Field.x,
                Field.y,
                (nx, ny, fromX, fromY) => Dungeon.isFixedHunterWalkable(nx, ny, fromX, fromY, occupied),
                Field.currentMapData.width,
                Field.currentMapData.height,
                range
            );
            if (Array.isArray(path) && path.length === 0) {
                App.log(def.message || '追跡する強敵に追いつかれた！');
                Dungeon.triggerFixedEffectBattle({ ...def, id }, { statMultiplier: Number(def.statMultiplier || 1.8), hunterMapKey: key });
                return true;
            }
            // range は直線距離ではなく、実際に歩く最短経路の長さで判定する。
            if (!path || path.length > range) {
                occupied.add(originalKey);
                continue;
            }

            pos.moveProgress = Number(pos.moveProgress || 0) + speed;
            const moveCount = Math.floor(pos.moveProgress);
            pos.moveProgress -= moveCount;
            if (moveCount <= 0) {
                occupied.add(originalKey);
                continue;
            }

            const actualMoveCount = Math.min(moveCount, path.length);
            for (let step = 0; step < actualMoveCount; step++) {
                pos.x = path[step].x;
                pos.y = path[step].y;
                if (Number(pos.x) === Number(Field.x) && Number(pos.y) === Number(Field.y)) {
                    App.log(def.message || '追跡する強敵に追いつかれた！');
                    Dungeon.triggerFixedEffectBattle({ ...def, id }, { statMultiplier: Number(def.statMultiplier || 1.8), hunterMapKey: key });
                    return true;
                }
            }
            occupied.add(`${Number(pos.x)},${Number(pos.y)}`);
        }
        App.save();
        return false;
    },

    startAngelTrial: async (effect) => {
        const ok = typeof App.showLimitBreakTrialChoice === 'function'
            ? await App.showLimitBreakTrialChoice('試練の天使が問う。\n挑戦しますか？')
            : true;
        if (!ok) {
            App.log('天使は静かに目を伏せた。');
            return false;
        }
        if (App.data?.dungeon?.trialAngel && App.data.dungeon.trialAngel.id === effect.id) {
            App.data.dungeon.trialAngel.active = false;
        }
        const master = Dungeon.getPhase2IMaster().angelTrial || {};
        const displayFloor = Math.max(1, Number(Dungeon.floor || App.data?.progress?.floor || 1) + Number(master.targetFloorOffset || 15));
        const targetFloor = Dungeon.getBalanceFloor(displayFloor);
        const elements = ['火', '水', '風', '雷', '光', '闇'];
        const resistElm = elements[Math.floor(Math.random() * elements.length)];
        const atkElm = elements[Math.floor(Math.random() * elements.length)];
        App.log('天使の羽が黒く染まった。');
        App.data.battle = {
            active:false,
            isBossBattle:false,
            isSpecialBoss:false,
            isEstark:false,
            fixedBossId:null,
            abyssMode:Dungeon.getAbyssMode(),
            abyssFloor:Number(Dungeon.floor || 1),
            abyssBalanceFloor:Dungeon.getBalanceFloor(),
            angelTrial:{
                id:effect.id || `trial-angel:${Dungeon.getAbyssMode()}:F${Number(Dungeon.floor || 1)}`,
                targetFloor,
                displayFloor,
                enemyCount:Math.max(1, Number(master.enemyCount || 3)),
                statMultiplier:Math.max(1, Number(master.statMultiplier || 1.35)),
                rewardCount:Math.max(1, Number(master.rewardCount || 3)),
                enemyBoost:{
                    nameSuffix:'・試練',
                    elmRes:{ [resistElm]:80 },
                    elmAtk:{ [atkElm]:30 },
                    resists:{ Poison:80, Shock:80, Fear:80, InstantDeath:100, Debuff:50 }
                }
            },
            enemies:[]
        };
        App.save();
        App.changeScene('battle');
        return true;
    },

    completeAngelTrialIfNeeded: () => {
        const trial = App.data?.battle?.angelTrial;
        if (!trial) return [];
        const members = (App.data.party || []).map(uid => App.getChar ? App.getChar(uid) : null).filter(Boolean);
        if (members.length === 0) return [];
        const statKeys = ['hp', 'mp', 'atk', 'def', 'mag', 'mdef', 'spd'];
        const logs = [];
        const count = Math.max(1, Number(trial.rewardCount || 1));
        for (let i = 0; i < count; i++) {
            const char = members[Math.floor(Math.random() * members.length)];
            const key = statKeys[Math.floor(Math.random() * statKeys.length)];
            const amount = key === 'hp' ? (3 + Math.floor(Math.random() * 5)) : (key === 'mp' ? (2 + Math.floor(Math.random() * 4)) : (1 + Math.floor(Math.random() * 3)));
            char[key] = Number(char[key] || 0) + amount;
            logs.push(`<span style="color:#fff3a6;">${char.name}の${key.toUpperCase()}が${amount}上がった！</span>`);
        }
        if (App.data.battle) {
            App.data.battle.angelTrialOutcome = {
                trialId:String(trial.id || ''),
                rewards:logs.map(text => String(text)),
                applied:true
            };
            App.data.battle.angelTrial = null;
        }
        return logs;
    },

    isFixedRevealLimitedFloor: (mapDef = null) => {
        const def = mapDef || (typeof Field !== 'undefined' ? Field.currentMapData : null);
        return !!(def?.isFixed && def?.isDungeon && def?.limitedMapReveal);
    },

    ensureFixedVisitedMap: (mapDef = null) => {
        const def = mapDef || (typeof Field !== 'undefined' ? Field.currentMapData : null);
        if (!Dungeon.isFixedRevealLimitedFloor(def) || !App.data?.progress) return null;
        const areaKey = (typeof Field !== 'undefined' && Field.getCurrentAreaKey) ? Field.getCurrentAreaKey() : (def.areaKey || App.data?.location?.area);
        const progressKey = (typeof Field !== 'undefined' && Field.getCurrentProgressMapKey)
            ? Field.getCurrentProgressMapKey()
            : (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonProgressKey
                ? MapRegistry.getFixedDungeonProgressKey(areaKey, def.floor || App.data?.progress?.floor || 1)
                : `${areaKey}:F${def.floor || App.data?.progress?.floor || 1}`);
        if (!App.data.progress.fixedDungeonVisitedMaps || typeof App.data.progress.fixedDungeonVisitedMaps !== 'object') {
            App.data.progress.fixedDungeonVisitedMaps = {};
        }
        if (!App.data.progress.fixedDungeonVisitedMaps[progressKey]) {
            App.data.progress.fixedDungeonVisitedMaps[progressKey] = { cells: {} };
        }
        return App.data.progress.fixedDungeonVisitedMaps[progressKey];
    },

    markFixedVisited: (x = null, y = null) => {
        const vm = Dungeon.ensureFixedVisitedMap();
        if (!vm) return false;
        const px = Number(x == null ? Field.x : x);
        const py = Number(y == null ? Field.y : y);
        vm.cells[`${px},${py}`] = true;
        return true;
    },

    markFixedVisibleArea: (x = null, y = null, radius = 3) => {
        const vm = Dungeon.ensureFixedVisitedMap();
        if (!vm || !Field.currentMapData) return false;
        const px = Number(x == null ? Field.x : x);
        const py = Number(y == null ? Field.y : y);
        const r = Math.max(0, Number(radius || 0));
        for (let yy = py - r; yy <= py + r; yy++) {
            for (let xx = px - r; xx <= px + r; xx++) {
                if (xx < 0 || yy < 0 || xx >= Field.currentMapData.width || yy >= Field.currentMapData.height) continue;
                if (Math.abs(xx - px) + Math.abs(yy - py) <= r + 1) vm.cells[`${xx},${yy}`] = true;
            }
        }
        return true;
    },

    isFixedVisitedForMap: (x, y) => {
        if (!Dungeon.isFixedRevealLimitedFloor()) return true;
        const vm = Dungeon.ensureFixedVisitedMap();
        return !!vm?.cells?.[`${Number(x)},${Number(y)}`];
    },

    handleFixedTileEffect: (effect, dx = 0, dy = 0) => {
        if (!effect || !Field.currentMapData?.isFixed) return false;
        if (effect.type === 'poison') {
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('damage_floor');
            Dungeon.damagePartyByFloorEffect(effect.damageRate || 0.06, effect.message || '毒沼でダメージを受けた！');
            return false;
        }
        if (effect.type === 'warp') {
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('warp');
            if (Number.isFinite(Number(effect.toX)) && Number.isFinite(Number(effect.toY))) {
                Field.x = Number(effect.toX);
                Field.y = Number(effect.toY);
                App.data.location.x = Field.x;
                App.data.location.y = Field.y;
                if (typeof Dungeon.markFixedVisibleArea === 'function') Dungeon.markFixedVisibleArea(Field.x, Field.y, Field.currentMapData?.revealRadius || 3);
                App.log(effect.message || '転移床が光った。');
                Field.refreshCurrentAction({ silent: false });
                return true;
            }
        }
        if (effect.type === 'ice') {
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('ice_slide');
            let sx = Field.x;
            let sy = Field.y;
            let moved = false;
            const maxSlide = Math.max(1, Number(effect.maxSlide || 20));
            for (let i = 0; i < maxSlide; i++) {
                const nx = sx + dx;
                const ny = sy + dy;
                if (!Dungeon.isFixedWalkableForEffect(nx, ny)) break;
                sx = nx;
                sy = ny;
                moved = true;
                const nextEffect = Field.getRuntimeTileEffectAt
                    ? Field.getRuntimeTileEffectAt(sx, sy)
                    : MapRegistry.findTileEffect(Field.currentMapData, sx, sy);
                // Stop on the first non-ice cell instead of sliding across ordinary floor
                // until a wall. This keeps stairs and event cells enterable.
                if (!nextEffect || nextEffect.type !== 'ice') break;
            }
            if (moved) {
                Field.x = sx;
                Field.y = sy;
                App.data.location.x = sx;
                App.data.location.y = sy;
                if (typeof Dungeon.markFixedVisibleArea === 'function') Dungeon.markFixedVisibleArea(Field.x, Field.y, Field.currentMapData?.revealRadius || 3);
                App.log(effect.message || '氷の床を滑った。');
                Field.refreshCurrentAction({ silent: false });
                return true;
            }
        }
        if (effect.type === 'hunter') {
            App.log(effect.message || '強敵に捕捉された！');
            const hunterMapKey = Dungeon.getCurrentFixedHunterKey ? Dungeon.getCurrentFixedHunterKey() : null;
            return Dungeon.triggerFixedEffectBattle(effect, { statMultiplier: 1.8, hunterId: effect.id || null, hunterMapKey });
        }
        if (effect.type === 'angel') {
            Dungeon.startAngelTrial(effect);
            return true;
        }
        return false;
    },

    canAdventurerMoveTo: (x, y) => {
        if (!Array.isArray(Dungeon.map) || y < 0 || y >= Dungeon.height || x < 0 || x >= Dungeon.width) return false;
        const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
        // NPCは床系だけを歩く。壁・宝箱・階段・ボス・泉位置には入れない。
        if (tile !== 'T' && tile !== 'G') return false;
        if (Dungeon.isHealSpringAt(x, y)) return false;
        if (Dungeon.isAbyssRiftAt(x, y)) return false;
        if (Number(x) === Number(Field.x) && Number(y) === Number(Field.y)) return false;
        return true;
    },

    tickAdventurerMovement: () => {
        const adv = App.data?.dungeon?.adventurer;
        if (!adv || !adv.active) return;
        if (Number(adv.floor) !== Number(Dungeon.floor)) return;

        // 会話可能距離ではその場に留まり、アクション表示中に歩き去らない。
        const playerDistance = Math.abs(Number(adv.x) - Number(Field.x)) + Math.abs(Number(adv.y) - Number(Field.y));
        if (playerDistance <= 1) return;

        adv.moveCounter = Number(adv.moveCounter || 0) + 1;
        if (adv.moveCounter < 4) return;
        adv.moveCounter = 0;

        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
        ].sort(() => Math.random() - 0.5);

        for (const d of dirs) {
            const nx = Number(adv.x) + d.dx;
            const ny = Number(adv.y) + d.dy;
            if (!Dungeon.canAdventurerMoveTo(nx, ny)) continue;
            adv.x = nx;
            adv.y = ny;
            adv.direction = d.dy > 0 ? 'down' : d.dy < 0 ? 'up' : d.dx < 0 ? 'left' : 'right';
            adv.step = Number(adv.step) === 2 ? 1 : 2;
            App.save();
            return;
        }
    },

    getAdventurerGraphicKey: (adventurer = App.data?.dungeon?.adventurer) => {
        const direction = ['down', 'left', 'right', 'up'].includes(adventurer?.direction)
            ? adventurer.direction
            : 'down';
        const frames = Dungeon.adventurerGraphicKeys[direction] || Dungeon.adventurerGraphicKeys.down;
        return frames[Number(adventurer?.step) === 2 ? 1 : 0];
    },

    isMazeFloor: () => Number(App.data?.dungeon?.genType) === 2,

    isBossFloor: () => {
        const floor = Number(Dungeon.floor || App.data?.progress?.floor || 0);
        if (floor <= 0) return false;
        const guildRun = Dungeon.getGuildQuestRun();
        if (guildRun) return floor >= Math.max(1, Number(guildRun.floorCount || 1));
        if (Dungeon.isMemoryRealm()) return floor === Dungeon.memoryRealmMaxFloor;
        return floor % 10 === 0;
    },

    ensureVisitedMap: () => {
        if (!App.data?.dungeon) return null;
        if (!Dungeon.isMazeFloor()) return null;

        const floor = Number(Dungeon.floor || App.data.progress?.floor || 0);
        const vm = App.data.dungeon.visitedMap;
        if (!vm || Number(vm.floor) !== floor || !vm.cells) {
            App.data.dungeon.visitedMap = { floor, cells: {} };
        }
        return App.data.dungeon.visitedMap;
    },

    markVisited: (x = null, y = null) => {
        if (!Dungeon.isMazeFloor()) return;
        const vm = Dungeon.ensureVisitedMap();
        if (!vm) return;
        const px = x == null ? Field.x : x;
        const py = y == null ? Field.y : y;
        vm.cells[`${Number(px)},${Number(py)}`] = true;
    },

    markVisibleArea: (x = null, y = null, radius = null) => {
        if (!Dungeon.isMazeFloor()) return;
        const vm = Dungeon.ensureVisitedMap();
        if (!vm) return;

        const px = Number(x == null ? Field.x : x);
        const py = Number(y == null ? Field.y : y);
        const r = Number(radius == null ? Dungeon.mazeMemorySightRadius : radius);
        if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(r)) return;

        for (let yy = py - r; yy <= py + r; yy++) {
            for (let xx = px - r; xx <= px + r; xx++) {
                if (xx < 0 || yy < 0 || xx >= Dungeon.width || yy >= Dungeon.height) continue;
                if (Math.abs(xx - px) > r || Math.abs(yy - py) > r) continue;
                vm.cells[`${xx},${yy}`] = true;
            }
        }
    },

    isVisited: (x, y) => {
        if (!Dungeon.isMazeFloor()) return true;
        const vm = Dungeon.ensureVisitedMap();
        if (!vm) return true;
        return !!vm.cells[`${Number(x)},${Number(y)}`];
    },

    getFloorArrivalMessage: () => {
        const floor = Number(Dungeon.floor || App.data?.progress?.floor || 0);
        const lines = [Dungeon.isMemoryRealm()
            ? `追憶の魔境 ${floor}階に到達した（Rank${Dungeon.getBalanceFloor(floor, 'memory')}相当）`
            : `地下 ${floor} 階に到達した`];

        if (Dungeon.isBossFloor()) {
            lines.push('通路の奥から強大な気配を感じる…');
        } else {
            if (App.data?.dungeon?.isTreasureRoom) {
                lines.push('なんと、宝物庫のようだ！');
            }
            if (Dungeon.isMazeFloor()) {
                lines.push('どうやら、迷路に入り込んでしまったようだ…！');
            }
            if (App.data?.dungeon?.isLavaFloor) {
                lines.push('灼熱の溶岩が湧き出ている…');
            }
            if (App.data?.dungeon?.isFloodedFloor) {
                lines.push('水没した回廊を、魔法の小舟で進むことになりそうだ…');
            }
        }

        return lines.join('<br>');
    },

    logFloorArrival: () => {
        App.log(Dungeon.getFloorArrivalMessage());
    },

    isSpecialObjectAt: (x, y, exceptKey = null) => {
        const dungeon = App.data?.dungeon || {};
        const objects = {
            adventurer: dungeon.adventurer,
            healSpring: dungeon.healSpring,
            abyssRift: dungeon.abyssRift,
            trialAngel: dungeon.trialAngel,
        };
        const directHit = Object.entries(objects).some(([key, obj]) => {
            if (key === exceptKey) return false;
            if (!obj || !obj.active) return false;
            if (Number(obj.floor) !== Number(Dungeon.floor)) return false;
            return Number(obj.x) === Number(x) && Number(obj.y) === Number(y);
        });
        if (directHit) return true;
        if (exceptKey === 'randomHunters') return false;
        return Dungeon.getRandomHunters().some(hunter => Number(hunter.x) === Number(x) && Number(hunter.y) === Number(y));
    },

    getSpecialSpawnCandidates: () => {
        const candidates = [];
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return candidates;
        const reachable = typeof Dungeon.getProgressionReachableCells === 'function'
            ? Dungeon.getProgressionReachableCells()
            : null;
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                if (reachable && !reachable.has(`${x},${y}`)) continue;
                if (Number(x) === Number(Field.x) && Number(y) === Number(Field.y)) continue;
                if (Dungeon.isSpecialObjectAt(x, y)) continue;

                // 階段・宝箱・ボスの近くに寄りすぎると見落としや進行阻害が起きやすい。
                // 迷路だけは狭いので距離条件をやや緩める。
                const distance = Math.abs(Number(x) - Number(Field.x)) + Math.abs(Number(y) - Number(Field.y));
                if (distance < (Dungeon.isMazeFloor() ? 2 : 3)) continue;
                if (!Dungeon.isAwayFromFeatures(Dungeon.map, { x, y }, Dungeon.isMazeFloor() ? 1 : 2)) continue;
                candidates.push({ x, y });
            }
        }
        return candidates;
    },

    pickSpecialSpawnPosition: () => {
        const candidates = Dungeon.getSpecialSpawnCandidates();
        if (!candidates.length) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    },

    getTrialAngelMonsterIds: (fixed = !!Field.currentMapData?.isFixed) => {
        if (fixed) {
            const ids = Array.isArray(Field.currentMapData.monsters) ? Field.currentMapData.monsters.map(Number).filter(Boolean) : [];
            if (ids.length) return Array.from({ length: 3 }, (_, i) => ids[i % ids.length]);
        }
        const floor = Dungeon.getBalanceFloor(Math.max(1, Number(Dungeon.floor || App.data?.progress?.floor || 1)));
        const band = window.MonsterData?.getMonsterBandForFloor?.(floor);
        const ids = Array.isArray(band?.monsters) ? band.monsters.map(m => Number(m?.id)).filter(Boolean) : [];
        if (ids.length) {
            return Array.from({ length: 3 }, () => ids[Math.floor(Math.random() * ids.length)]);
        }
        return [701, 702, 703];
    },

    getFixedTrialAngelSpawnCandidates: () => {
        const mapDef = Field.currentMapData;
        const candidates = [];
        if (!mapDef?.isFixed || !Array.isArray(mapDef.tiles)) return candidates;
        for (let y = 1; y < mapDef.height - 1; y++) {
            for (let x = 1; x < mapDef.width - 1; x++) {
                const tile = String(mapDef.tiles[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                if (Number(x) === Number(Field.x) && Number(y) === Number(Field.y)) continue;
                if (Dungeon.isSpecialObjectAt(x, y, 'trialAngel')) continue;
                if (MapRegistry.findFloorLink?.(mapDef, x, y)) continue;
                if (MapRegistry.findMapAction?.(mapDef, x, y)) continue;
                if (MapRegistry.findTileEffect?.(mapDef, x, y)) continue;
                if ((mapDef.bosses || []).some(b => Number(b.x) === x && Number(b.y) === y)) continue;
                if ((mapDef.chests || []).some(c => Number(c.x) === x && Number(c.y) === y)) continue;
                const distance = Math.abs(x - Number(Field.x)) + Math.abs(y - Number(Field.y));
                if (distance < 4) continue;
                candidates.push({ x, y });
            }
        }
        return candidates;
    },

    rollTrialAngelSpawn: (options = {}) => {
        if (!App.data?.dungeon) return null;
        App.data.dungeon.trialAngel = null;

        const fixed = options.fixed ?? !!Field.currentMapData?.isFixed;
        if (Dungeon.isBossFloor() || App.data.dungeon.isTreasureRoom) return null;
        if (fixed) {
            const rank = Number(Field.currentMapData?.encounterRank || Field.currentMapData?.rank || 0);
            if (rank < Dungeon.trialAngelMinEncounterRank) return null;
        } else {
            if (App.data.location.area !== 'ABYSS') return null;
            if (Dungeon.getBalanceFloor() < Dungeon.trialAngelMinFloor) return null;
        }
        if (Math.random() >= Dungeon.trialAngelSpawnRate) return null;

        const candidates = fixed ? Dungeon.getFixedTrialAngelSpawnCandidates() : Dungeon.getSpecialSpawnCandidates();
        if (!candidates.length) return null;
        const pos = candidates[Math.floor(Math.random() * candidates.length)];
        const rank = fixed
            ? Number(Field.currentMapData?.encounterRank || Field.currentMapData?.rank || 80)
            : Number(Dungeon.getBalanceFloor() || 80);
        const angel = {
            active: true,
            floor: Number(Dungeon.floor || App.data.progress?.floor || 1),
            x: pos.x,
            y: pos.y,
            type: 'angel',
            id: `trial-angel:${App.data.location.area}:F${Number(Dungeon.floor || 1)}:${Date.now()}`,
            rank,
            monsterIds: Dungeon.getTrialAngelMonsterIds(fixed),
            statMultiplier: rank >= 100 ? 2.5 : 2.2,
            rewardCount: rank >= 100 ? 2 : 1,
            image: Dungeon.trialAngelImagePath,
            label: '試練の天使と話す',
            log: '試練の天使が静かに待っている。'
        };
        App.data.dungeon.trialAngel = angel;
        return angel;
    },

    isTrialAngelAt: (x, y) => {
        const angel = App.data?.dungeon?.trialAngel;
        return !!(angel && angel.active
            && Number(angel.floor) === Number(Dungeon.floor)
            && Number(angel.x) === Number(x)
            && Number(angel.y) === Number(y));
    },

    rollAdventurerSpawn: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.adventurer = null;

        // 固定ダンジョンやボス階では出さない。通常のランダム生成フロア用。
        if (App.data.location.area !== 'ABYSS') return;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return;

        const force = Dungeon.isMazeFloor();
        if (!force && Math.random() >= Dungeon.adventurerSpawnRate) return;

        const pos = Dungeon.pickSpecialSpawnPosition();
        if (!pos) return;

        App.data.dungeon.adventurer = {
            active: true,
            floor: Dungeon.floor,
            x: pos.x,
            y: pos.y,
            moveCounter: 0,
            direction: 'down',
            step: 1
        };
    },

    rollHealSpringSpawn: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.healSpring = null;
        if (App.data.location.area !== 'ABYSS') return;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return;

        const force = Dungeon.isMazeFloor();
        if (!force && Math.random() >= Dungeon.healSpringSpawnRate) return;

        const pos = Dungeon.pickSpecialSpawnPosition();
        if (!pos) return;

        App.data.dungeon.healSpring = {
            active: true,
            floor: Dungeon.floor,
            x: pos.x,
            y: pos.y,
            image: Dungeon.healSpringImagePath,
        };
    },

    rollAbyssRiftSpawn: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.abyssRift = null;
        if (App.data.location.area !== 'ABYSS') return;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return;

        const force = Dungeon.isMazeFloor();
        if (!force && Math.random() >= Dungeon.abyssRiftSpawnRate) return;

        const pos = Dungeon.pickSpecialSpawnPosition();
        if (!pos) return;

        const rewardId = `rift:${Dungeon.getAbyssMode()}:${Number(Dungeon.floor)}:${Number(pos.x)},${Number(pos.y)}:${Date.now()}:${Math.floor(Math.random() * 1000000)}`;
        App.data.dungeon.abyssRift = {
            active: true,
            floor: Dungeon.floor,
            x: pos.x,
            y: pos.y,
            image: Dungeon.abyssRiftImagePath,
            rewardId,
        };
    },

    rollSpecialObjects: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;

        // 宝物庫フロアは報酬部屋として独立させる。
        // 冒険者/泉/裂け目まで重なると、宝物庫の見せ場が散るため出さない。
        if (App.data.dungeon.isTreasureRoom) return;

        // 追憶の魔境では地上ダンジョンの再現を優先し、深淵固有の冒険者・裂け目・試練天使は出さない。
        // 回復の泉だけは通常確率で配置できる。
        if (Dungeon.isMemoryRealm()) {
            Dungeon.rollHealSpringSpawn();
            return;
        }

        // 迷路フロアだけは、冒険者・泉・裂け目を例外的に100%出す。
        // 通常フロアは各SpawnRateに従う。
        Dungeon.rollAdventurerSpawn();
        Dungeon.rollHealSpringSpawn();
        Dungeon.rollAbyssRiftSpawn();
        Dungeon.rollTrialAngelSpawn({ fixed: false });
    },

    resolveAdventurerOutcome: (randomValue = Math.random()) => {
        const outcomes = Dungeon.getPhase2IMaster().adventurer?.outcomes || [];
        return Dungeon.rollWeightedMasterEntry(outcomes, randomValue)?.id || 'equipment';
    },

    showAdventurerLines: async (lines = []) => {
        const normalized = (Array.isArray(lines) ? lines : [lines]).filter(Boolean).map(text => ({
            charId:9998, hidePortrait:true, name:'冒険者', text:String(text)
        }));
        if (!normalized.length) return true;
        const key = '__DUNGEON_ADVENTURER_EVENT__';
        try {
            if (typeof StoryManager !== 'undefined' && StoryManager.scripts && typeof StoryManager.showConversation === 'function') {
                StoryManager.scripts[key] = normalized;
                StoryManager.active = true;
                const result = await Dungeon.showConversationReliably(key, 0);
                if (result?.status !== 'completed') throw new Error(`冒険者会話を完了できませんでした: ${result?.status || 'unknown'}`);
                StoryManager.endConversation?.();
            } else {
                normalized.forEach(line => App.log(line.text));
            }
            return true;
        } catch (error) {
            console.error('[Dungeon] adventurer conversation failed:', error);
            normalized.forEach(line => App.log(line.text));
            return false;
        } finally {
            if (typeof StoryManager !== 'undefined' && StoryManager.scripts) delete StoryManager.scripts[key];
        }
    },

    buildAdventurerShopConfig: (random = Math.random) => {
        const master = Dungeon.getPhase2IMaster().adventurer || {};
        const count = Math.max(1, Math.floor(Number(master.shopItemCount || 5)));
        const min = Math.max(0.01, Number(master.shopPriceMultiplierMin || 0.5));
        const max = Math.max(min, Number(master.shopPriceMultiplierMax || 3));
        const traitChance = Math.max(0, Math.min(1, Number(master.shopTraitBookChance || 0.05)));
        const regular = (DB.ITEMS || []).filter(item =>
            item && item.type !== '貴重品' && item.type !== '特性書' && item.shopAvailable !== false
            && item.medalOnly !== true && Number(item.price || 0) > 0
        );
        const traitBooks = (DB.ITEMS || []).filter(item => item?.type === '特性書' && Number(item.price || 0) > 0);
        const selected = [];
        const used = new Set();
        for (let slot = 0; slot < count; slot++) {
            const preferTrait = Number(random()) < traitChance && traitBooks.length > 0;
            let pool = (preferTrait ? traitBooks : regular).filter(item => !used.has(Number(item.id)));
            if (!pool.length) pool = [...regular, ...traitBooks].filter(item => !used.has(Number(item.id)));
            if (!pool.length) break;
            const item = pool[Math.floor(Number(random()) * pool.length)] || pool[0];
            used.add(Number(item.id));
            const multiplier = min + ((max - min) * Math.max(0, Math.min(0.999999999, Number(random()) || 0)));
            selected.push({ id:Number(item.id), price:Math.max(1, Math.floor(Number(item.price || 1) * multiplier)), multiplier });
        }
        return {
            shopType:'item',
            title:'深淵の旅商人',
            shopRank:Math.max(1, Dungeon.getBalanceFloor()),
            itemIds:selected.map(entry => entry.id),
            priceByItem:Object.fromEntries(selected.map(entry => [String(entry.id), entry.price])),
            entries:selected
        };
    },

    startAdventurerDuel: () => {
        const master = Dungeon.getPhase2IMaster().adventurer || {};
        const targetDisplayFloor = Math.max(1, Number(Dungeon.floor || 1) + Number(master.duelFloorOffset || 10));
        const targetFloor = Dungeon.getBalanceFloor(targetDisplayFloor);
        App.data.battle = {
            active:false,
            isBossBattle:true,
            isSpecialBoss:false,
            isEstark:false,
            fixedBossId:null,
            abyssMode:Dungeon.getAbyssMode(),
            abyssFloor:Number(Dungeon.floor || 1),
            abyssBalanceFloor:Dungeon.getBalanceFloor(),
            randomAdventurerDuel:{
                bossId:Number(master.duelBossId || 302001),
                targetFloor,
                displayFloor:targetDisplayFloor
            },
            enemies:[]
        };
        App.save();
        App.changeScene('battle');
        return true;
    },

    startRareMonsterAmbush: () => {
        const master = Dungeon.getPhase2IMaster().adventurer || {};
        App.data.battle = {
            active:false,
            isBossBattle:false,
            isSpecialBoss:false,
            isEstark:false,
            fixedBossId:null,
            abyssMode:Dungeon.getAbyssMode(),
            abyssFloor:Number(Dungeon.floor || 1),
            abyssBalanceFloor:Dungeon.getBalanceFloor(),
            randomRareAmbush:{
                targetFloor:Math.max(1, Dungeon.getBalanceFloor() + Number(master.rareFloorOffset || 0)),
                enemyCount:Math.max(1, Number(master.rareEnemyCount || 5))
            },
            isPreemptive:true,
            isAmbushed:false,
            forceAutoOff:true,
            enemies:[]
        };
        App.save();
        App.changeScene('battle');
        return true;
    },

    getRandomHunters: () => Array.isArray(App.data?.dungeon?.randomHunters)
        ? App.data.dungeon.randomHunters.filter(hunter => hunter?.active && Number(hunter.floor) === Number(Dungeon.floor))
        : [],

    getRandomHunterAt: (x, y) => Dungeon.getRandomHunters().find(hunter => Number(hunter.x) === Number(x) && Number(hunter.y) === Number(y)) || null,

    spawnRandomHunters: () => {
        const master = Dungeon.getPhase2IMaster().adventurer || {};
        const count = Math.max(1, Number(master.hunterCount || 5));
        const candidates = Dungeon.getSpecialSpawnCandidates();
        Dungeon.shuffle(candidates);
        const selected = candidates.slice(0, count);

        // 生成形態によって安全距離を満たす候補が5マス未満になる場合も、
        // プレイヤーから到達可能な通常床を段階的に緩和して補い、可能な限り必ず5体出す。
        if (selected.length < count && Array.isArray(Dungeon.map) && Dungeon.map.length) {
            const reachable = typeof Dungeon.getProgressionReachableCells === 'function'
                ? Dungeon.getProgressionReachableCells()
                : Dungeon.floodFill(Dungeon.map, Field.x, Field.y, tile => ['T','G','S','C'].includes(String(tile || '').toUpperCase()));
            const used = new Set(selected.map(pos => `${Number(pos.x)},${Number(pos.y)}`));
            const fallback = [];
            for (let y = 1; y < Dungeon.height - 1; y++) {
                for (let x = 1; x < Dungeon.width - 1; x++) {
                    const key = `${x},${y}`;
                    const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                    if (tile !== 'T' && tile !== 'G') continue;
                    if (reachable && !reachable.has(key)) continue;
                    if (used.has(key)) continue;
                    if (Number(x) === Number(Field.x) && Number(y) === Number(Field.y)) continue;
                    if (Dungeon.isSpecialObjectAt(x, y, 'randomHunters')) continue;
                    fallback.push({ x, y, distance:Math.abs(x - Number(Field.x)) + Math.abs(y - Number(Field.y)) });
                }
            }
            // 近接即戦闘を避けつつ、候補不足時は遠い床から優先する。
            fallback.sort((a,b) => b.distance - a.distance);
            for (const pos of fallback) {
                if (selected.length >= count) break;
                selected.push({ x:pos.x, y:pos.y });
            }
        }
        App.data.dungeon.randomHunters = selected.map((pos, index) => ({
            id:`random-hunter:${Dungeon.getAbyssMode()}:F${Number(Dungeon.floor)}:${Date.now()}:${index}`,
            active:true,
            floor:Number(Dungeon.floor),
            x:Number(pos.x), y:Number(pos.y),
            direction:'down', step:1,
            speed:Math.max(0.1, Number(master.hunterSpeed || 1.5)),
            moveProgress:0,
            targetFloor:Math.max(1, Dungeon.getBalanceFloor() + Number(master.hunterFloorOffset || 20)),
            enemyCount:Math.max(1, Number(master.hunterEnemyCount || 3))
        }));
        App.save();
        Field.render?.();
        return App.data.dungeon.randomHunters;
    },

    startRandomHunterBattle: (hunter) => {
        if (!hunter?.active) return false;
        App.data.battle = {
            active:false,
            isBossBattle:false,
            isSpecialBoss:false,
            isEstark:false,
            fixedBossId:null,
            abyssMode:Dungeon.getAbyssMode(),
            abyssFloor:Number(Dungeon.floor || 1),
            abyssBalanceFloor:Dungeon.getBalanceFloor(),
            randomHunter:{
                id:String(hunter.id),
                floor:Number(hunter.floor),
                targetFloor:Math.max(1, Number(hunter.targetFloor || Dungeon.getBalanceFloor() + 20)),
                enemyCount:Math.max(1, Number(hunter.enemyCount || 3))
            },
            enemies:[]
        };
        App.save();
        App.log('<span style="color:#ff8a72;">深淵のハンターに追いつかれた！</span>');
        App.changeScene('battle');
        return true;
    },

    completeRandomHunterBattle: (context = App.data?.battle?.randomHunter) => {
        if (!context?.id || !Array.isArray(App.data?.dungeon?.randomHunters)) return false;
        const hunter = App.data.dungeon.randomHunters.find(entry => String(entry?.id) === String(context.id));
        if (!hunter || hunter.active === false) return false;
        hunter.active = false;
        hunter.defeatedAt = Date.now();
        return true;
    },

    isRandomHunterWalkable: (x, y, occupied = null) => {
        if (!Array.isArray(Dungeon.map) || y < 0 || x < 0 || y >= Dungeon.height || x >= Dungeon.width) return false;
        const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
        if (!['T','G','M','~'].includes(tile)) return false;
        if (Dungeon.isSpecialObjectAt(x, y, 'randomHunters')) return false;
        if (occupied instanceof Set && occupied.has(`${x},${y}`) && !(Number(x) === Number(Field.x) && Number(y) === Number(Field.y))) return false;
        return true;
    },

    stepRandomHunters: () => {
        const hunters = Dungeon.getRandomHunters();
        if (!hunters.length || Field.currentMapData?.isFixed) return false;
        const occupied = new Set(hunters.map(hunter => `${Number(hunter.x)},${Number(hunter.y)}`));
        for (const hunter of hunters) {
            const oldKey = `${Number(hunter.x)},${Number(hunter.y)}`;
            occupied.delete(oldKey);
            const path = Dungeon.findShortestGridPath(
                hunter.x, hunter.y, Field.x, Field.y,
                (nx, ny) => Dungeon.isRandomHunterWalkable(nx, ny, occupied),
                Dungeon.width, Dungeon.height
            );
            if (Array.isArray(path) && path.length === 0) return Dungeon.startRandomHunterBattle(hunter);
            if (!path?.length) { occupied.add(oldKey); continue; }
            hunter.moveProgress = Number(hunter.moveProgress || 0) + Math.max(0.1, Number(hunter.speed || 1.5));
            const moveCount = Math.min(path.length, Math.floor(hunter.moveProgress));
            hunter.moveProgress -= moveCount;
            for (let step = 0; step < moveCount; step++) {
                const next = path[step];
                const dx = Number(next.x) - Number(hunter.x);
                const dy = Number(next.y) - Number(hunter.y);
                hunter.x = next.x; hunter.y = next.y;
                hunter.direction = dy > 0 ? 'down' : dy < 0 ? 'up' : dx < 0 ? 'left' : 'right';
                hunter.step = Number(hunter.step) === 2 ? 1 : 2;
                if (Number(hunter.x) === Number(Field.x) && Number(hunter.y) === Number(Field.y)) return Dungeon.startRandomHunterBattle(hunter);
            }
            occupied.add(`${Number(hunter.x)},${Number(hunter.y)}`);
        }
        App.save();
        return false;
    },

    encounterAdventurer: async (options = {}) => {
        const adv = App.data?.dungeon?.adventurer;
        if (!adv?.active) return;
        const distance = Math.abs(Number(adv.x) - Number(Field.x)) + Math.abs(Number(adv.y) - Number(Field.y));
        if (distance > 1 || Dungeon.adventurerPromptOpen) return;
        Dungeon.adventurerPromptOpen = true;
        App.clearAction();
        try {
            let accepted = false;
            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showChoice === 'function') {
                StoryManager.active = true;
                accepted = await StoryManager.showChoice('なんと、冒険者と遭遇した！\n話しかけてみますか？');
            } else if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
                accepted = await new Promise(resolve => Menu.confirm('なんと、冒険者と遭遇した！\n話しかけてみますか？', () => resolve(true), () => resolve(false)));
            }
            if (!accepted) {
                if (typeof StoryManager !== 'undefined') StoryManager.endConversation?.();
                return;
            }
            if (typeof StoryManager !== 'undefined') StoryManager.endConversation?.();
            const outcome = Dungeon.resolveAdventurerOutcome(options.randomValue);
            // 結果確定前にNPCを消し、戦闘・店から戻った時の再抽選を防ぐ。
            App.data.dungeon.adventurer = null;
            App.data.dungeon.lastAdventurerOutcome = { floor:Number(Dungeon.floor), outcome, decidedAt:Date.now() };

            if (outcome === 'equipment') {
                const master = Dungeon.getPhase2IMaster().adventurer || {};
                const rewardFloor = Math.max(1, Dungeon.getBalanceFloor() + Number(master.equipmentFloorOffset || 5));
                const eq = App.createEquipByFloor('adventurer', rewardFloor, Number(master.equipmentPlus || 3));
                App.data.inventory.push(eq);
                App.save();
                await Dungeon.showAdventurerLines([
                    'こんなところで会うなんて、これも何かの縁だ。俺には扱えない装備を譲ろう。',
                    `${eq.name}を手に入れた！`
                ]);
                App.log(`<span style="color:#ffd700;">${eq.name}を手に入れた！</span>`);
            } else if (outcome === 'duel') {
                await Dungeon.showAdventurerLines('腕試しといこう。深淵門将ガレオンを越えられるか？');
                Dungeon.startAdventurerDuel();
                return;
            } else if (outcome === 'shop') {
                const shop = Dungeon.buildAdventurerShopConfig();
                App.save();
                await Dungeon.showAdventurerLines('珍しい品を仕入れた。値段は運次第だが、見ていくか？');
                if (typeof Facilities !== 'undefined' && typeof Facilities.openShopFromField === 'function') {
                    Facilities.openShopFromField(shop);
                    return;
                }
            } else if (outcome === 'hunters') {
                const hunters = Dungeon.spawnRandomHunters();
                await Dungeon.showAdventurerLines(`面白い連中を呼んでおいた。深淵のハンター${hunters.length}体から逃げ切ってみろ！`);
                App.log('<span style="color:#ff8a72;">フロアに深淵のハンターが現れた！</span>');
            } else {
                App.save();
                await Dungeon.showAdventurerLines('希少種の群れを見つけた。先手は譲る、仕留めてみろ！');
                Dungeon.startRareMonsterAmbush();
                return;
            }
            App.save();
            Field.render?.();
        } finally {
            Dungeon.adventurerPromptOpen = false;
            Field.refreshCurrentAction?.({ silent:true });
        }
    },

    encounterAbyssRift: async (options = {}) => {
        const rift = App.data?.dungeon?.abyssRift;
        if (!rift || !rift.active) return;
        if (Dungeon.abyssRiftPromptOpen) return;
        Dungeon.abyssRiftPromptOpen = true;
        App.clearAction();

        try {
            let accepted = true;

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showConversation === 'function') {
                const talkKey = '__DUNGEON_ABYSS_RIFT_PROMPT__';
                StoryManager.scripts[talkKey] = [
                    { charId: 1000, name: 'システム', text: '闇がどこまでも続いているような亀裂を見つけた・・・' }
                ];
                StoryManager.active = true;
                try {
                    const result = await Dungeon.showConversationReliably(talkKey, 0);
                    if (result.status !== 'completed') throw new Error(`亀裂発見会話を完了できませんでした: ${result.status}`);
                } catch (error) {
                    console.error('[Dungeon] abyss rift prompt conversation failed:', error);
                    App.log('闇がどこまでも続いているような亀裂を見つけた・・・');
                } finally {
                    delete StoryManager.scripts[talkKey];
                }
            }

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showChoice === 'function') {
                StoryManager.active = true;
                accepted = await StoryManager.showChoice('このままだと危険かもしれない。\n亀裂の根源を断ちますか？\n（強敵との戦闘になります）');
            } else if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
                accepted = await new Promise(resolve => {
                    Menu.confirm('闇がどこまでも続いているような亀裂を見つけた・・・\n亀裂の根源を断ちますか？\n（強敵との戦闘になります）', () => resolve(true), () => resolve(false));
                });
            } else {
                accepted = false;
            }

            if (!accepted) {
                if (typeof StoryManager !== 'undefined' && typeof StoryManager.endConversation === 'function') {
                    StoryManager.endConversation();
                }
                Dungeon.abyssRiftPromptOpen = false;
                if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                    Field.refreshCurrentAction({ silent: true });
                }
                return;
            }

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.endConversation === 'function') {
                StoryManager.endConversation();
            }

            const riftMaster = Dungeon.getPhase2IMaster().abyssRift || {};
            const targetFloor = Math.max(1, Number(Dungeon.floor || App.data.progress.floor || 1) + Number(riftMaster.targetFloorOffset || 10));
            const targetBalanceFloor = Dungeon.getBalanceFloor(targetFloor);
            if (App.data?.dungeon?.abyssRift) {
                App.data.dungeon.abyssRift.targetFloor = targetFloor;
                App.data.dungeon.abyssRift.targetBalanceFloor = targetBalanceFloor;
                App.data.dungeon.abyssRift.abyssMode = Dungeon.getAbyssMode();
            }

            App.data.battle = {
                active: false,
                isBossBattle: true,
                isRiftBattle: true,
                isSpecialBoss: false,
                isEstark: false,
                fixedBossId: null,
                eventId: Dungeon.riftBattleEventId,
                abyssMode: Dungeon.getAbyssMode(),
                abyssFloor: Math.max(1, Number(Dungeon.floor || 1)),
                abyssBalanceFloor: Dungeon.getBalanceFloor(),
                riftFloor: targetBalanceFloor,
                riftDisplayFloor: targetFloor,
                riftRewardId: App.data?.dungeon?.abyssRift?.rewardId || null,
                riftEnemyCount: Math.max(1, Number(riftMaster.enemyCount || 3)),
                riftStatMultiplier: Math.max(1, Number(riftMaster.statMultiplier || 1.25)),
                riftRewardPlus: Math.max(0, Number(riftMaster.rewardPlus || 3)),
            };
            App.save();
            App.changeScene('battle');
        } finally {
            Dungeon.abyssRiftPromptOpen = false;
        }
    },

    pickRiftMonsterIds: (targetFloor, count = 3) => {
        // 互換用。現在の裂け目戦は battle.js 側で targetFloor を見て直接生成する。
        // ここで allowRare:true を使うと、201階以降で通常敵候補が null の時に
        // メタル系などのレアモンスターだけが選ばれる事故が起きるため、使用しないこと。
        const ids = [];
        let guard = count * 8;
        while (ids.length < count && guard-- > 0) {
            let base = null;
            if (window.MonsterData && typeof window.MonsterData.generateEnemyForFloor === 'function') {
                base = window.MonsterData.generateEnemyForFloor(targetFloor, { allowRare: false });
            }
            if (!base && Array.isArray(DB.MONSTERS) && DB.MONSTERS.length) {
                const candidates = DB.MONSTERS.filter(m => !m.isBoss && !m.isRare && !m.isSpecialBoss && !m.isEstark);
                base = candidates[Math.floor(Math.random() * candidates.length)] || null;
            }
            if (base && base.id) ids.push(Number(base.id));
        }
        return ids;
    },

    completeAbyssRift: () => {
        if (!App.data?.dungeon) return false;
        const rift = App.data.dungeon.abyssRift;
        const rewardId = String(App.data.battle?.riftRewardId || rift?.rewardId || '').trim()
            || `legacy-rift:${Dungeon.getAbyssMode()}:${Number(Dungeon.floor)}:${Number(rift?.x || 0)},${Number(rift?.y || 0)}`;
        const history = Array.isArray(App.data.dungeon.completedRiftRewardIds)
            ? App.data.dungeon.completedRiftRewardIds
            : [];
        if (history.includes(rewardId) || App.data.dungeon.pendingRiftReward?.rewardId === rewardId) {
            App.data.dungeon.abyssRift = null;
            return false;
        }

        const rewardDisplayFloor = Math.max(1, Number(rift?.targetFloor || App.data.battle?.riftDisplayFloor || Dungeon.floor + 10 || 1));
        const rewardFloor = Math.max(1, Number(rift?.targetBalanceFloor || App.data.battle?.riftFloor || Dungeon.getBalanceFloor(rewardDisplayFloor)));
        const rewardPlus = Math.max(0, Number(App.data.battle?.riftRewardPlus || Dungeon.getPhase2IMaster().abyssRift?.rewardPlus || 3));
        const eq = App.createEquipByFloor('rift', rewardFloor, rewardPlus);
        App.data.inventory.push(eq);

        history.push(rewardId);
        App.data.dungeon.completedRiftRewardIds = history.slice(-50);
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.pendingRiftReward = {
            active: true,
            rewardId,
            itemName: eq.name,
        };
        App.log('<span style="color:#c78cff;">亀裂の根源を打ち破った！</span>');
        App.save();
        return true;
    },

    resumePendingRiftReward: async () => {
        const pending = App.data?.dungeon?.pendingRiftReward;
        if (!pending || !pending.active) return false;

        const itemName = pending.itemName || '輝く装備+3';
        pending.status = 'running';
        pending.startedAt = pending.startedAt || Date.now();
        App.save();

        const lines = [
            { charId: 1000, name: 'システム', text: '亀裂の根源を打ち破った！' },
            { charId: 1000, name: 'システム', text: '根源が消滅し、その跡から輝く装備を見つけた！！' },
            { charId: 1000, name: 'システム', text: `${itemName}を手に入れた！` }
        ];
        const key = '__DUNGEON_ABYSS_RIFT_REWARD__';
        let shown = false;

        try {
            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showConversation === 'function') {
                StoryManager.scripts[key] = lines;
                StoryManager.active = true;
                const result = await Dungeon.showConversationReliably(key, 0);
                if (result.status !== 'completed') throw new Error(`亀裂報酬会話を完了できませんでした: ${result.status}`);
                StoryManager.endConversation();
                shown = true;
            }
        } catch (error) {
            // 報酬自体は勝利commit済み。会話UIの故障で同じ場所を永久に塞がない。
            console.error('[Dungeon] pending rift reward conversation failed:', error);
            pending.status = 'error';
            pending.error = String(error?.message || error);
            App.save();
        } finally {
            if (typeof StoryManager !== 'undefined' && StoryManager.scripts) delete StoryManager.scripts[key];
        }

        if (!shown) {
            App.log(`亀裂の根源を打ち破った！<br>根源が消滅し、その跡から輝く装備を見つけた！！<br>${itemName}を手に入れた！`);
        }
        App.log(`<span style="color:#ffd700;">${itemName}を手に入れた！</span>`);
        if (App.data?.dungeon?.pendingRiftReward === pending) {
            pending.status = 'completed';
            App.data.dungeon.pendingRiftReward = null;
            App.save();
        }

        if (typeof Field !== 'undefined') {
            if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
            if (typeof Field.render === 'function') Field.render();
        }
        return true;
    },

    isLavaFloorCandidate: () => {
        if (!App.data?.dungeon) return false;
        if (App.data.location.area !== 'ABYSS') return false;
        if (Dungeon.getBalanceFloor() < Dungeon.lavaFloorMinFloor) return false;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return false;
        if (App.data.dungeon.isTreasureRoom) return false;
        return true;
    },

    applyLavaFloorIfNeeded: (force = false) => {
        if (!App.data?.dungeon) return false;
        App.data.dungeon.isLavaFloor = false;
        App.data.dungeon.lava = null;

        if (!Dungeon.isLavaFloorCandidate()) return false;
        if (!force && Math.random() >= Dungeon.lavaFloorSpawnRate) return false;
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return false;

        // 通常宝箱/既存レア宝箱は一度床に戻し、溶岩フロアではレア宝箱2個だけにする。
        for (let y = 0; y < Dungeon.height; y++) {
            for (let x = 0; x < Dungeon.width; x++) {
                if (Dungeon.map[y][x] === 'C' || Dungeon.map[y][x] === 'R') Dungeon.map[y][x] = 'T';
            }
        }

        const shuffle = Dungeon.shuffle || ((items) => items.sort(() => Math.random() - 0.5));
        const playerKey = `${Field.x},${Field.y}`;
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0] || null;
        const protectedKeys = new Set([playerKey]);
        if (stairs) protectedKeys.add(`${stairs.x},${stairs.y}`);

        const floorCells = [];
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                if (protectedKeys.has(`${x},${y}`)) continue;
                floorCells.push({ x, y });
            }
        }

        if (floorCells.length < 8) return false;

        const lavaCount = Math.max(1, Math.floor(floorCells.length * 0.25));
        const lavaCells = shuffle(floorCells).slice(0, lavaCount);
        lavaCells.forEach(p => { Dungeon.map[p.y][p.x] = 'M'; });

        let chestCandidates = [];
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                if (protectedKeys.has(`${x},${y}`)) continue;
                const distFromPlayer = Math.abs(x - Field.x) + Math.abs(y - Field.y);
                if (distFromPlayer < 3) continue;
                chestCandidates.push({ x, y });
            }
        }
        if (chestCandidates.length < 2) {
            chestCandidates = floorCells.filter(p => Dungeon.map[p.y][p.x] !== 'M' && !protectedKeys.has(`${p.x},${p.y}`));
        }

        shuffle(chestCandidates).slice(0, 2).forEach(p => { Dungeon.map[p.y][p.x] = 'R'; });

        App.data.dungeon.isLavaFloor = true;
        App.data.dungeon.lava = { active: true, floor: Dungeon.floor, rate: 0.25 };
        return true;
    },

    applyFloodedFloorIfNeeded: (force = false) => {
        if (!App.data?.dungeon || !Array.isArray(Dungeon.map) || !Dungeon.map.length) return false;
        App.data.dungeon.isFloodedFloor = false;
        App.data.dungeon.flooded = null;

        if (Dungeon.isBossFloor() || App.data.dungeon.isTreasureRoom || Dungeon.isMazeFloor()) return false;
        if (Dungeon.getBalanceFloor() < Dungeon.floodedFloorMinFloor) return false;
        if (!force && Math.random() >= Dungeon.floodedFloorSpawnRate) return false;

        const waterCells = [];
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                Dungeon.map[y][x] = Dungeon.floodedTile;
                waterCells.push({ x, y });
            }
        }

        // 極端に小さい生成結果では特殊化せず、通常フロアとして安全に扱う。
        if (waterCells.length < 20) {
            waterCells.forEach(({ x, y }) => { Dungeon.map[y][x] = 'T'; });
            return false;
        }

        App.data.dungeon.isFloodedFloor = true;
        App.data.dungeon.flooded = {
            active: true,
            floor: Dungeon.floor,
            tile: Dungeon.floodedTile,
            cellCount: waterCells.length
        };
        return true;
    },

    createEquipWithMinRarity: (floor, plus, minRarityList, forcePart = null) => {
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
    },

    resetRandomFloorAttemptState: (keepVisited = false) => {
        Dungeon.map = [];
        if (App.data?.dungeon) {
            App.data.dungeon.isTreasureRoom = false;
            App.data.dungeon.isLavaFloor = false;
            App.data.dungeon.lava = null;
            App.data.dungeon.isFloodedFloor = false;
            App.data.dungeon.flooded = null;
            App.data.dungeon.keyChests = null;
            App.data.dungeon.floorKeys = null;
            App.data.dungeon.keyGuardian = null;
            App.data.dungeon.adventurer = null;
            App.data.dungeon.healSpring = null;
            App.data.dungeon.abyssRift = null;
            App.data.dungeon.trialAngel = null;
            App.data.dungeon.abyssBossEncounter = null;
            App.data.dungeon.memoryMonsterPool = null;
            if (!keepVisited) App.data.dungeon.visitedMap = null;
            App.data.dungeon.genType = null;
            App.data.dungeon.genVariant = null;
            App.data.dungeon.floorPlanType = null;
            App.data.dungeon.floorPlanThemeId = null;
            App.data.dungeon.visualThemeId = null;
            App.data.dungeon.visualThemeKey = null;
            App.data.dungeon.visualBattleBg = null;
        }
    },

    getRandomVisualThemeCandidates: (floor = Dungeon.floor || App.data?.progress?.floor || 1) => {
        const currentFloor = Dungeon.getBalanceFloor(floor);
        const themes = Array.isArray(Dungeon.randomVisualThemes) ? Dungeon.randomVisualThemes : [];
        const candidates = themes.filter(theme => {
            const minFloor = Math.max(1, Number(theme.minFloor || 1) || 1);
            const maxFloor = Number(theme.maxFloor || 0) || 0;
            return currentFloor >= minFloor && (!maxFloor || currentFloor <= maxFloor);
        });
        return candidates.length ? candidates : themes.filter(theme => theme.id === 'abyss');
    },

    getRandomVisualThemeBySavedData: () => {
        const dungeon = App.data?.dungeon;
        if (!dungeon) return null;
        return Dungeon.randomVisualThemes.find(theme => theme.id === dungeon.visualThemeId)
            || Dungeon.randomVisualThemes.find(theme => theme.themeKey === dungeon.visualThemeKey)
            || null;
    },

    getRandomVisualThemeTestOverride: (floor = Dungeon.floor || App.data?.progress?.floor || 1) => {
        const currentFloor = Math.max(1, Number(floor) || 1);
        if (!Dungeon.randomVisualThemeTestOverrideId || currentFloor % 10 === 0) return null;
        return Dungeon.randomVisualThemes.find(theme => theme.id === Dungeon.randomVisualThemeTestOverrideId) || null;
    },

    isRandomVisualThemeTestOverrideActive: (floor = Dungeon.floor || App.data?.progress?.floor || 1) => {
        return !!Dungeon.getRandomVisualThemeTestOverride(floor);
    },

    getForcedVisualThemeIdForFloorPlan: (planType = App.data?.dungeon?.floorPlanType) => {
        const guildRun = Dungeon.getGuildQuestRun();
        if (guildRun?.visualThemeId) return String(guildRun.visualThemeId);
        // 特殊フロアは地形の意味を優先し、外観抽選で別施設の壁・床へ変えない。
        return ['flooded', 'treasure', 'boss'].includes(String(planType || '')) ? 'abyss' : null;
    },

    ensureRandomVisualTheme: (floor = Dungeon.floor || App.data?.progress?.floor || 1) => {
        if (!App.data?.dungeon) return null;
        const currentFloor = Math.max(1, Number(floor) || 1);
        const balanceFloor = Dungeon.getBalanceFloor(currentFloor);
        const testOverride = Dungeon.getRandomVisualThemeTestOverride(currentFloor);
        if (testOverride) return Dungeon.setRandomVisualTheme(testOverride);
        const forcedThemeId = Dungeon.getForcedVisualThemeIdForFloorPlan();
        if (forcedThemeId) {
            const forcedTheme = Dungeon.randomVisualThemes.find(entry => entry.id === forcedThemeId) || Dungeon.randomVisualThemes[0];
            App.data.dungeon.floorPlanThemeId = forcedTheme?.id || 'abyss';
            return Dungeon.setRandomVisualTheme(forcedTheme);
        }
        // 森100%検証版で保存された階は、通常版へ戻した初回だけ現在階の外観も再抽選する。
        // 検証用のforest値を通常抽選結果として固定し続けない。
        if (App.data.dungeon.visualThemeAudit?.testOverrideId) {
            App.data.dungeon.visualThemeAudit = null;
            const restoredTheme = Dungeon.rollRandomVisualTheme(currentFloor);
            App.data.dungeon.floorPlanThemeId = restoredTheme?.id || 'abyss';
            return restoredTheme;
        }
        let theme = Dungeon.getRandomVisualThemeBySavedData();
        const plannedTheme = Dungeon.randomVisualThemes.find(entry => entry.id === App.data.dungeon.floorPlanThemeId) || null;
        // フロア抽選結果を正本とし、復元途中や別処理でDEFAULT/深淵へ戻されてもここで必ず修復する。
        if (plannedTheme && theme?.id !== plannedTheme.id) theme = Dungeon.setRandomVisualTheme(plannedTheme);
        const matchesPlan = !!(theme && plannedTheme && theme.id === plannedTheme.id);
        if (!theme || (balanceFloor < Number(theme.minFloor || 1) && !matchesPlan)) {
            theme = Dungeon.rollRandomVisualTheme(currentFloor);
        } else {
            // Repair legacy saves that stored only one half of the visual-theme pair.
            App.data.dungeon.visualThemeId = theme.id;
            App.data.dungeon.visualThemeKey = theme.themeKey;
            App.data.dungeon.visualBattleBg = theme.battleBg;
        }
        return theme;
    },

    getRandomFloorBattleBg: () => {
        const testOverride = Dungeon.getRandomVisualThemeTestOverride(Dungeon.floor);
        if (testOverride) return testOverride.battleBg;
        if (App.data?.dungeon?.isFloodedFloor) return Dungeon.floodedBattleBgKey;
        return App.data?.dungeon?.visualBattleBg || 'battle_bg_dungeon';
    },

    getMemoryRealmTheme: () => {
        const currentId = App.data?.dungeon?.memoryThemeId;
        return Dungeon.memoryRealmThemes.find(theme => theme.id === currentId) || Dungeon.memoryRealmThemes[0];
    },

    rollMemoryRealmTheme: () => {
        const themes = Dungeon.memoryRealmThemes;
        const theme = themes[Math.floor(Math.random() * themes.length)] || themes[0];
        App.data.dungeon.memoryThemeId = theme.id;
        Dungeon.setRandomVisualTheme({
            id: `memory-${theme.id}`,
            themeKey: theme.themeKey,
            battleBg: theme.battleBg,
            wallFaceImg: theme.wallFaceImg || null,
            wallFaceTorchImg: theme.wallFaceTorchImg || null
        });
        return theme;
    },

    getMemoryRealmMonsterPool: (theme = Dungeon.getMemoryRealmTheme()) => {
        const mapIds = new Set((theme?.sourceMapIds || []).map(String));
        const normal = Array.isArray(globalThis.MonsterData?.normalBases) ? globalThis.MonsterData.normalBases : [];
        const ids = normal.filter(monster => {
            const rank = Number(monster?.rank || monster?.minF || 0);
            if (rank < 1 || rank > 85 || monster?.isRare || monster?.isSpecialBoss || monster?.isEstark) return false;
            return (monster.habitats || []).some(habitat => mapIds.has(String(habitat?.mapId || '')));
        }).map(monster => Number(monster.id)).filter(Number.isFinite);
        const unique = [...new Set([...ids, ...Dungeon.memoryRealmGlobalMonsterIds])];
        // 生息地を持たないRank1～85のレアモンスターも、追憶として低確率で候補へ加える。
        // 通常の深淵レア抽選は使わず、強化後Rankへ正規化して出現させる。
        const rareCandidates = Array.isArray(globalThis.MonsterData?.rareMonsters)
            ? globalThis.MonsterData.rareMonsters.filter(monster => {
                const rank = Number(monster?.rank || monster?.minF || 0);
                return rank >= 1 && rank <= 85 && !monster?.isSpecialBoss && !monster?.isEstark;
            })
            : [];
        if (rareCandidates.length && Math.random() < 0.08) {
            unique.push(Number(rareCandidates[Math.floor(Math.random() * rareCandidates.length)]?.id));
        }
        // 指定された物語ボスは低確率で通常編成にも混ざる。戦闘生成時に通常敵相当へ正規化する。
        if (Math.random() < 0.18) unique.push(Dungeon.memoryRealmBossIds[Math.floor(Math.random() * Dungeon.memoryRealmBossIds.length)]);
        if (!unique.length) {
            return normal.filter(monster => Number(monster?.rank || 0) >= 1 && Number(monster?.rank || 0) <= 85)
                .map(monster => Number(monster.id)).filter(Number.isFinite);
        }
        return [...new Set(unique)];
    },

    getMemoryRealmMonsterPoolForCurrentFloor: (theme = Dungeon.getMemoryRealmTheme()) => {
        if (!App.data?.dungeon) return Dungeon.getMemoryRealmMonsterPool(theme);
        const floor = Math.max(1, Number(Dungeon.floor || App.data?.progress?.floor || 1));
        const stored = App.data.dungeon.memoryMonsterPool;
        if (stored && Number(stored.floor) === floor && stored.themeId === theme?.id && Array.isArray(stored.ids) && stored.ids.length) {
            const ids = [...new Set([
                ...stored.ids.map(Number).filter(id => Number.isFinite(id) && id !== 301100),
                ...Dungeon.memoryRealmGlobalMonsterIds
            ])];
            stored.ids = [...ids];
            return ids;
        }
        const ids = Dungeon.getMemoryRealmMonsterPool(theme);
        App.data.dungeon.memoryMonsterPool = { floor, themeId: theme?.id || null, ids:[...ids] };
        return ids;
    },

    getMemoryRealmMapActions: () => {
        if (!Dungeon.isMemoryRealm()) return [];
        const floor = Number(Dungeon.floor || 1);
        if (Dungeon.memoryRealmRestFloors.includes(floor)) {
            const rank = floor === 10 ? 100 : 110;
            const cost = floor === 10 ? 50000 : 100000;
            return [
                { x:3, y:4, type:'shop', shopType:'item', shopRank:rank, title:`追憶の道具屋 Rank${rank}`, label:'道具屋', imageKey:'overlay_field_shop', blocksMovement:true, interactFromAdjacent:true },
                { x:7, y:4, type:'shop', shopType:'weapon', shopRank:rank, title:`追憶の武器屋 Rank${rank}`, label:'武器屋', imageKey:'overlay_field_weapon', blocksMovement:true, interactFromAdjacent:true },
                { x:11, y:4, type:'shop', shopType:'armor', shopRank:rank, title:`追憶の防具屋 Rank${rank}`, label:'防具屋', imageKey:'overlay_field_weapon', blocksMovement:true, interactFromAdjacent:true },
                { x:15, y:4, type:'memoryInn', cost, label:`宿屋（${cost.toLocaleString()}G）`, imageKey:'overlay_field_inn', blocksMovement:true, interactFromAdjacent:true },
                { x:19, y:4, type:'blacksmith', label:'鍛冶屋', imageKey:'overlay_field_smith', blocksMovement:true, interactFromAdjacent:true },
                { x:21, y:10, type:'alchemy', label:'錬金屋', imageKey:'overlay_building_water_alchemy', blocksMovement:true, interactFromAdjacent:true }
            ];
        }
        if (floor === Dungeon.memoryRealmMaxFloor && App.data?.dungeon?.memoryBossCleared) {
            const layout = Dungeon.getAbyssBossRoomLayout();
            return [{ x:layout.exitGate.x, y:layout.exitGate.y, type:'memoryExit', label:'地上へ戻る', imageKey:'overlay_dungeon_portal', blocksMovement:true, interactFromAdjacent:true }];
        }
        return [];
    },

    generateMemoryRealmRestFloor: () => {
        const w = 25, h = 17;
        Dungeon.width = w; Dungeon.height = h;
        Dungeon.map = Array.from({length:h}, (_, y) => Array.from({length:w}, (_, x) => (x === 0 || y === 0 || x === w-1 || y === h-1) ? 'W' : 'T'));
        // 施設前の通路と上階への階段を必ず確保する。
        Dungeon.map[2][12] = 'S';
        Field.x = 12; Field.y = 14;
        App.data.dungeon.memoryRestFloor = true;
        App.data.dungeon.floorPlanType = 'memory-rest';
        Dungeon.rollMemoryRealmTheme();
    },

    useMemoryRealmInn: (cost = 50000) => {
        const amount = Math.max(1, Math.floor(Number(cost) || 50000));
        if (Number(App.data?.gold || 0) < amount) {
            Menu.msg(`宿泊には ${amount.toLocaleString()} Gold 必要です。`);
            return false;
        }
        Menu.confirm(`${amount.toLocaleString()} Goldで休み、HP・MPを全回復しますか？`, () => {
            App.data.gold -= amount;
            (App.data.characters || []).forEach(character => {
                const stats = App.calcStats(character);
                character.currentHp = stats.maxHp;
                character.currentMp = stats.maxMp;
            });
            App.save();
            Menu.msg('静かな休息により、体力が全回復した！');
            Field.refreshCurrentAction?.({ silent:true });
        });
        return true;
    },

    createMemoryRareEquipment: () => {
        const targetRarities = ['SSR', 'UR', 'EX'];
        const equip = Dungeon.createEquipWithMinRarity(120, 3, targetRarities);
        if (!equip || !Array.isArray(equip.opts) || !equip.opts.length) return equip;

        // createEquipWithMinRarity() は各オプションを高レアへ寄せるが、
        // 将来ルール側に低レア限定オプションが追加されても、宝箱の「レア装備」保証を失わないよう
        // 最低1枠をSSR以上へ確定補正する。
        if (!equip.opts.some(opt => targetRarities.includes(String(opt?.rarity || '')))) {
            const index = equip.opts.findIndex(opt => {
                const rule = (DB.OPT_RULES || []).find(entry => entry.key === opt?.key && (!opt?.elm || entry.elm === opt.elm));
                return rule && targetRarities.some(rarity => rule.allowed?.includes(rarity));
            });
            if (index >= 0) {
                const current = equip.opts[index];
                const rule = (DB.OPT_RULES || []).find(entry => entry.key === current?.key && (!current?.elm || entry.elm === current.elm));
                const rarity = [...targetRarities].reverse().find(candidate => rule?.allowed?.includes(candidate)) || 'SSR';
                const min = Number(rule?.min?.[rarity] || 1);
                const max = Math.max(min, Number(rule?.max?.[rarity] || min));
                equip.opts[index] = { ...current, rarity, val: Dungeon.randInt(min, max) };
            }
        }
        return equip;
    },

    openMemoryRewardChest: (x, y) => {
        const chests = Array.isArray(App.data?.dungeon?.memoryRewardChests) ? App.data.dungeon.memoryRewardChests : [];
        const chest = chests.find(entry => entry.active && Number(entry.x) === Number(x) && Number(entry.y) === Number(y));
        if (!chest) return false;
        chest.active = false;
        if (Dungeon.map?.[y]?.[x]) Dungeon.map[y][x] = 'T';
        let rewardName = '何も入っていなかった。';
        if (chest.type === 'equipment') {
            const equip = Dungeon.createMemoryRareEquipment();
            if (equip) {
                App.data.inventory.push(equip);
                rewardName = equip.name;
            }
        } else {
            const itemType = chest.type === 'traitBook' ? '特性書' : 'スキル書';
            const pool = (DB.ITEMS || []).filter(item => item?.type === itemType && Number(item.rank || 1) <= 120 && item.medalOnly !== true);
            const item = pool[Math.floor(Math.random() * pool.length)] || null;
            if (item) {
                App.data.items[item.id] = Number(App.data.items[item.id] || 0) + 1;
                rewardName = item.name;
            }
        }
        if (typeof App.incrementLifetimeStat === 'function') App.incrementLifetimeStat('totalChestsOpened', 1, { save:false });
        App.log(`<span style="color:#ffd700;">${rewardName}を手に入れた！</span>`);
        Dungeon.saveMapData();
        Field.render();
        return true;
    },

    createRandomFieldMapData: () => {
        const isMemory = Dungeon.isMemoryRealm();
        const memoryTheme = isMemory ? Dungeon.getMemoryRealmTheme() : null;
        const theme = isMemory
            ? Dungeon.setRandomVisualTheme({
                id: `memory-${memoryTheme.id}`,
                themeKey: memoryTheme.themeKey,
                battleBg: memoryTheme.battleBg,
                wallFaceImg: memoryTheme.wallFaceImg || null,
                wallFaceTorchImg: memoryTheme.wallFaceTorchImg || null
            })
            : Dungeon.ensureRandomVisualTheme(Dungeon.floor);
        const testOverride = Dungeon.getRandomVisualThemeTestOverride(Dungeon.floor);
        const battleBg = Dungeon.getRandomFloorBattleBg();
        const guildRun = Dungeon.getGuildQuestRun();
        const memoryFloor = Math.max(1, Number(Dungeon.floor || 1));
        const memoryRest = isMemory && Dungeon.memoryRealmRestFloors.includes(memoryFloor);
        const memoryBossFloor = isMemory && memoryFloor === Dungeon.memoryRealmMaxFloor;
        const mapData = {
            name: isMemory ? `${Dungeon.memoryRealmName}${memoryRest ? '・休憩所' : ''}` : (guildRun ? `${guildRun.themeLabel || '変異'}の依頼迷宮` : (testOverride ? `${STORY_DATA.areas['ABYSS'].name}【森固定検証】` : STORY_DATA.areas['ABYSS'].name)),
            width: Dungeon.width,
            height: Dungeon.height,
            tiles: Dungeon.map,
            isDungeon: true,
            mapId: isMemory ? (window.MAP_IDS?.MEMORY_REALM || 'MAP000065') : (window.MAP_IDS?.ABYSS || 'MAP000033'),
            floor: Math.max(1, Number(Dungeon.floor || 1)),
            floorId: (typeof MapRegistry !== 'undefined' && MapRegistry.formatFloorId)
                ? MapRegistry.formatFloorId(isMemory ? (window.MAP_IDS?.MEMORY_REALM || 'MAP000065') : (window.MAP_IDS?.ABYSS || 'MAP000033'), Dungeon.floor)
                : `${isMemory ? 'MAP000065' : 'MAP000033'}-${String(Math.max(1, Number(Dungeon.floor || 1))).padStart(2, '0')}`,
            abyssMode: Dungeon.getAbyssMode(),
            balanceFloor: Dungeon.getBalanceFloor(),
            useHabitatEncounters: !isMemory && !guildRun && Dungeon.isRandomAbyss(),
            isGuildQuestDungeon: !!guildRun,
            guildQuestId: guildRun?.questId || null,
            encounterRank: isMemory ? Dungeon.getBalanceFloor(memoryFloor, 'memory') : (guildRun ? Math.max(1, Number(guildRun.encounterRank || guildRun.power || 1)) : (Dungeon.isStoryAbyss() ? Dungeon.floor : null)),
            monsters: isMemory && !memoryRest && !memoryBossFloor ? Dungeon.getMemoryRealmMonsterPoolForCurrentFloor(memoryTheme) : (guildRun ? [...(guildRun.normalMonsterIds || [])] : null),
            // monstersは固定編成ではなく、そのフロアの抽選候補プール。
            exactMonsters: false,
            memoryRealm: isMemory,
            memoryElements: memoryTheme?.elements ? [...memoryTheme.elements] : [],
            randomEncounterDisabled: memoryRest || memoryBossFloor,
            mapActions: isMemory ? Dungeon.getMemoryRealmMapActions() : [],
            enemyBoost: guildRun ? JSON.parse(JSON.stringify(guildRun.enemyBoost || {})) : null,
            allyAilments: guildRun ? [...(guildRun.allyAilments || [])] : [],
            themeKey: memoryTheme?.themeKey || theme?.themeKey || App.data?.dungeon?.visualThemeKey || 'ABYSS',
            visualThemeId: memoryTheme ? `memory-${memoryTheme.id}` : (theme?.id || App.data?.dungeon?.visualThemeId || 'abyss'),
            battleBg,
            visualTestOverride: !!testOverride,
            wallFaceImg: memoryTheme?.wallFaceImg || theme?.wallFaceImg || null,
            wallFaceTorchImg: memoryTheme?.wallFaceTorchImg || theme?.wallFaceTorchImg || null,
            randomDungeonModifier: App.data?.dungeon?.floorModifier ? JSON.parse(JSON.stringify(App.data.dungeon.floorModifier)) : null,
            randomEncounterRateMultiplier: Math.max(0, Number(App.data?.dungeon?.floorModifier?.encounterRateMultiplier || 1)),
            rareEncounterRateMultiplier: Math.max(0, Number(App.data?.dungeon?.floorModifier?.rareEncounterMultiplier || 1)),
            rareDropMultiplier: Math.max(0, Number(App.data?.dungeon?.floorModifier?.rareDropMultiplier || 1)),
            equipPlus3BonusPct: Math.max(0, Number(App.data?.dungeon?.floorModifier?.plus3BonusPct || 0))
        };
        App.data.dungeon.visualThemeAudit = {
            floor: Number(Dungeon.floor || 0),
            planType: App.data.dungeon.floorPlanType || null,
            plannedThemeId: App.data.dungeon.floorPlanThemeId || null,
            appliedThemeId: mapData.visualThemeId,
            themeKey: mapData.themeKey,
            battleBg
        };
        App.data.dungeon.visualThemeAudit.testOverrideId = testOverride?.id || null;
        return mapData;
    },

    setRandomVisualTheme: (theme) => {
        if (!App.data?.dungeon || !theme) return null;
        App.data.dungeon.visualThemeId = theme.id;
        App.data.dungeon.visualThemeKey = theme.themeKey;
        App.data.dungeon.visualBattleBg = theme.battleBg;
        return theme;
    },

    rollRandomVisualTheme: (floor = Dungeon.floor || App.data?.progress?.floor || 1) => {
        if (!App.data?.dungeon || !Array.isArray(Dungeon.randomVisualThemes) || !Dungeon.randomVisualThemes.length) return null;
        const candidates = Dungeon.getRandomVisualThemeCandidates(floor);
        const theme = candidates[Dungeon.randInt(0, candidates.length - 1)] || Dungeon.randomVisualThemes[0];
        return Dungeon.setRandomVisualTheme(theme);
    },

    rollRandomFloorPlan: (floor = Dungeon.floor || App.data?.progress?.floor || 1, randomValue = null, options = {}) => {
        const currentFloor = Math.max(1, Number(floor) || 1);
        const balanceFloor = Dungeon.getBalanceFloor(currentFloor);
        const guildRun = Dungeon.getGuildQuestRun();
        if (Dungeon.isMemoryRealm()) {
            const theme = Dungeon.getMemoryRealmTheme();
            return Object.freeze({ floor:currentFloor, category:'random', floorPlanType:'memory-surface', themeId:`memory-${theme.id}`, memoryRealm:true });
        }
        if (guildRun) {
            return Object.freeze({ floor: currentFloor, category: 'random', themeId: String(guildRun.visualThemeId || 'abyss'), guildQuest: true });
        }
        const testOverride = options.ignoreTestOverride ? null : Dungeon.getRandomVisualThemeTestOverride(currentFloor);
        if (testOverride) {
            return Object.freeze({ floor: currentFloor, category: 'random', themeId: testOverride.id, testOverride: true });
        }
        const roll = randomValue === null
            ? Math.random()
            : Math.max(0, Math.min(0.999999999, Number(randomValue) || 0));
        const reusedRate = Math.max(0, Math.min(0.40, Number(Dungeon.getPhase2IMaster().reusedMap?.rate || 0.10)));
        const reusedStart = 0.50;
        const reusedEnd = Math.min(0.90, reusedStart + reusedRate);
        let category;
        if (roll < 0.10) category = balanceFloor >= Dungeon.lavaFloorMinFloor ? 'lava' : 'abyss';
        else if (roll < 0.20) category = balanceFloor >= Dungeon.floodedFloorMinFloor ? 'flooded' : 'abyss';
        else if (roll < 0.23) category = 'maze';
        else if (roll < 0.25) category = 'treasure';
        else if (roll < reusedStart) category = 'abyss';
        else if (roll < reusedEnd) category = 'reused';
        else category = 'random';

        const byId = id => Dungeon.randomVisualThemes.find(theme => theme.id === id) || null;
        let theme = null;
        let reusedSource = null;
        if (category === 'lava') theme = byId('ignis-volcano');
        else if (category === 'flooded') theme = byId('abyss');
        else if (category === 'reused') {
            const sources = Dungeon.getPhase2IMaster().reusedMap?.sources || [];
            const valid = sources.filter(source => {
                const def = typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonFloor
                    ? MapRegistry.getFixedDungeonFloor(source.areaKey, source.floor || 1)
                    : null;
                return !!(def?.tiles && def.width && def.height);
            });
            reusedSource = valid[Dungeon.randInt(0, Math.max(0, valid.length - 1))] || null;
            theme = byId(reusedSource?.themeId) || byId('abyss');
            if (!reusedSource) category = 'random';
        }
        if (category === 'random') {
            const candidates = Dungeon.getRandomVisualThemeCandidates(currentFloor);
            theme = candidates[Dungeon.randInt(0, candidates.length - 1)] || byId('abyss');
        } else if (!theme) {
            theme = byId('abyss');
        }

        return Object.freeze({ floor: currentFloor, category, themeId: theme?.id || 'abyss', reusedSource });
    },

    applyRandomFloorPlan: (plan) => {
        if (!App.data?.dungeon || !plan) return null;
        if (plan.memoryRealm) {
            const memoryTheme = Dungeon.getMemoryRealmTheme();
            App.data.dungeon.floorPlanType = 'memory-surface';
            App.data.dungeon.floorPlanThemeId = `memory-${memoryTheme.id}`;
            Dungeon.setRandomVisualTheme({ id:`memory-${memoryTheme.id}`, themeKey:memoryTheme.themeKey, battleBg:memoryTheme.battleBg, wallFaceImg:memoryTheme.wallFaceImg || null, wallFaceTorchImg:memoryTheme.wallFaceTorchImg || null });
            return memoryTheme;
        }
        const theme = Dungeon.randomVisualThemes.find(entry => entry.id === plan.themeId)
            || Dungeon.randomVisualThemes.find(entry => entry.id === 'abyss')
            || Dungeon.randomVisualThemes[0];
        App.data.dungeon.floorPlanType = plan.category;
        App.data.dungeon.floorPlanThemeId = theme?.id || null;
        App.data.dungeon.reusedMapSource = plan.reusedSource ? JSON.parse(JSON.stringify(plan.reusedSource)) : null;
        Dungeon.setRandomVisualTheme(theme);
        return theme;
    },

    pickRandomFloorType: () => {
        const r = Math.random();
        if (r < 0.30) return 0; // 部屋
        if (r < 0.80) return 1; // 洞窟
        return 3; // 遺跡回廊
    },

    removeIsolatedWallTiles: (map = Dungeon.map) => {
        if (!Array.isArray(map) || map.length < 3 || !Array.isArray(map[0])) return 0;
        const height = map.length;
        const width = map[0].length;
        const isolated = [];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (String(map[y]?.[x] || '').toUpperCase() !== 'W') continue;

                let connectedWall = false;
                for (let dy = -1; dy <= 1 && !connectedWall; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (String(map[y + dy]?.[x + dx] || '').toUpperCase() === 'W') {
                            connectedWall = true;
                            break;
                        }
                    }
                }
                if (!connectedWall) isolated.push({ x, y });
            }
        }

        isolated.forEach(({ x, y }) => {
            map[y][x] = 'T';
        });
        return isolated.length;
    },

    countIsolatedWallTiles: (map = Dungeon.map) => {
        if (!Array.isArray(map) || map.length < 3 || !Array.isArray(map[0])) return 0;
        let count = 0;
        for (let y = 1; y < map.length - 1; y++) {
            for (let x = 1; x < map[0].length - 1; x++) {
                if (String(map[y]?.[x] || '').toUpperCase() !== 'W') continue;
                let connectedWall = false;
                for (let dy = -1; dy <= 1 && !connectedWall; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (String(map[y + dy]?.[x + dx] || '').toUpperCase() === 'W') {
                            connectedWall = true;
                            break;
                        }
                    }
                }
                if (!connectedWall) count++;
            }
        }
        return count;
    },

    generateReusedMapFloor: (plan = {}) => {
        const source = plan.reusedSource || App.data?.dungeon?.reusedMapSource;
        const def = source && typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonFloor
            ? MapRegistry.getFixedDungeonFloor(source.areaKey, source.floor || 1)
            : null;
        if (!def?.tiles || !Number(def.width) || !Number(def.height)) return false;

        Dungeon.width = Number(def.width);
        Dungeon.height = Number(def.height);
        Dungeon.map = Array.from({ length:Dungeon.height }, (_, y) => Array.from({ length:Dungeon.width }, (_, x) => {
            const raw = String(def.tiles?.[y]?.[x] || 'W').toUpperCase();
            // 既存マップの外形・通路を流用しつつ、固定イベント・宝箱・ボス・出入口は
            // ランダム深淵へ持ち込まず通常床へ正規化する。固定マップの境界出口は
            // ランダム階では行き止まり外周になるため、境界そのものを壁へ閉じる。
            if (x === 0 || y === 0 || x === Dungeon.width - 1 || y === Dungeon.height - 1) return 'W';
            return raw === 'W' || raw === 'F' ? 'W' : 'T';
        }));
        const cells = [];
        for (let y = 1; y < Dungeon.height - 1; y++) for (let x = 1; x < Dungeon.width - 1; x++) {
            if (Dungeon.map[y][x] === 'T') cells.push({ x, y });
        }
        if (cells.length < 12) return false;
        const start = cells[Dungeon.randInt(0, cells.length - 1)];
        Field.x = start.x;
        Field.y = start.y;
        const reachable = Dungeon.floodFill(Dungeon.map, start.x, start.y, tile => tile !== 'W');
        const far = [...reachable].map(key => {
            const [x,y] = key.split(',').map(Number);
            return { x, y, distance:Math.abs(x-start.x)+Math.abs(y-start.y) };
        }).sort((a,b) => b.distance-a.distance);
        const stairs = far[0] || cells[cells.length - 1];
        Dungeon.map[stairs.y][stairs.x] = 'S';
        Dungeon.pruneUnreachableFromPlayer();

        // 固定マップ由来の1マス通路へ宝箱を置くと、その先の階段・床を塞ぐことがある。
        // 宝箱を障害物として再到達判定し、進行可能領域を分断しない座標だけ採用する。
        const chestCells = far.slice(4).filter(pos => pos.distance >= 5 && Dungeon.map[pos.y]?.[pos.x] === 'T');
        Dungeon.shuffle(chestCells);
        let placedChests = 0;
        for (const pos of chestCells) {
            if (placedChests >= 3) break;
            Dungeon.map[pos.y][pos.x] = 'C';
            const reachableAfterChest = Dungeon.floodFill(Dungeon.map, Field.x, Field.y, tile => {
                const normalized = String(tile || 'W').toUpperCase();
                return normalized !== 'W' && normalized !== 'C';
            });
            let blocksProgression = false;
            for (let y = 0; y < Dungeon.height && !blocksProgression; y++) {
                for (let x = 0; x < Dungeon.width; x++) {
                    const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                    if (['T','G','S'].includes(tile) && !reachableAfterChest.has(`${x},${y}`)) {
                        blocksProgression = true;
                        break;
                    }
                }
            }
            if (blocksProgression) Dungeon.map[pos.y][pos.x] = 'T';
            else placedChests++;
        }
        if (App.data?.dungeon) {
            App.data.dungeon.genType = 4;
            App.data.dungeon.genVariant = `reused:${source.areaKey}:F${Number(source.floor || 1)}`;
        }
        return true;
    },

    buildRandomFloorLayout: (plan = Dungeon.rollRandomFloorPlan()) => {
        Dungeon.applyRandomFloorPlan(plan);
        if (plan.category === 'treasure') {
            Dungeon.generateTreasureRoom();
            if (App.data?.dungeon) App.data.dungeon.isTreasureRoom = true;
            return;
        }
        if (plan.category === 'reused' && Dungeon.generateReusedMapFloor(plan)) return;

        Dungeon.lastGenVariant = null;
        const type = plan.category === 'maze' ? 2 : Dungeon.pickRandomFloorType();

        if (type === 0) Dungeon.generateRoomMap();
        else if (type === 1) Dungeon.generateCaveMap();
        else if (type === 2) Dungeon.generateMazeMap();
        else Dungeon.generateRuinsMap();

        // 柱として意図された壁でも、1マスだけ孤立すると描画上は不自然な壁片に見える。
        // 周囲8方向の壁と一切つながっていないWだけを床へ戻す。
        Dungeon.removeIsolatedWallTiles();
        Dungeon.setPlayerRandomSpawn();
        App.data.dungeon.genType = type;
        App.data.dungeon.genVariant = Dungeon.lastGenVariant || null;
        Dungeon.pruneUnreachableFromPlayer();
    },

    finalizeRandomFloorFeatures: (plan = null) => {
        const category = plan?.category || App.data?.dungeon?.floorPlanType || 'abyss';
        // 浸水フロアは全面を船で進む独立した特殊形態。
        // 溶岩・鍵扉・歩行NPCを同居させると意味や経路が破綻するため排他的にする。
        if (category === 'flooded') {
            Dungeon.applyFloodedFloorIfNeeded(true);
            return;
        }

        // 50階以降の単一抽選表で選ばれた場合だけ溶岩フロア化する。
        // 通常宝箱を消し、床の25%を溶岩にしてレア宝箱2個だけを配置する。
        if (category === 'lava') Dungeon.applyLavaFloorIfNeeded(true);

        Dungeon.applyKeyDoorPuzzleIfNeeded();

        // フロア生成完了後に特殊オブジェクトを配置する。
        // 冒険者・泉・裂け目はいずれも別管理にして、既存タイル文字を壊さない。
        // 特殊オブジェクト候補はT/Gのみなので、溶岩マス上には出現しない。
        Dungeon.rollSpecialObjects();
    },

    generateFallbackRandomFloor: (plan = null) => {
        const category = plan?.category || App.data?.dungeon?.floorPlanType || 'abyss';
        Dungeon.width = 15;
        Dungeon.height = 15;
        Dungeon.map = Dungeon.makeMap(Dungeon.width, Dungeon.height, 'W');

        if (category === 'maze') {
            // 生成試行が尽きても破綻しない決定的な蛇行迷路。単一路なので階段到達性を数学的に保証できる。
            let connectorX = 1;
            for (let y = Dungeon.height - 2; y >= 1; y -= 2) {
                for (let x = 1; x < Dungeon.width - 1; x++) Dungeon.map[y][x] = 'T';
                if (y > 1) Dungeon.map[y - 1][connectorX] = 'T';
                connectorX = connectorX === 1 ? Dungeon.width - 2 : 1;
            }
            Field.x = 1;
            Field.y = Dungeon.height - 2;
            Dungeon.map[1][1] = 'S';
            if (App.data?.dungeon) {
                App.data.dungeon.genType = 2;
                App.data.dungeon.genVariant = 'fallback-safe-maze';
            }
            return;
        }

        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                Dungeon.map[y][x] = 'T';
            }
        }
        Field.x = 7;
        Field.y = 12;
        Dungeon.map[2][7] = 'S';
        Dungeon.map[5][4] = 'C';
        Dungeon.map[5][10] = 'C';
        Dungeon.map[9][7] = 'C';
        if (App.data?.dungeon) {
            App.data.dungeon.genType = 0;
            App.data.dungeon.genVariant = 'fallback-safe-room';
            if (category === 'treasure') App.data.dungeon.isTreasureRoom = true;
        }
    },

    getActiveKeyColorsOnFloor: () => {
        const colors = new Set();
        if (!Array.isArray(Dungeon.map)) return colors;
        Dungeon.map.forEach(row => row.forEach(tile => {
            const color = Dungeon.getKeyItemColor(tile);
            if (color) colors.add(color);
        }));
        (App.data?.dungeon?.keyChests || []).forEach(k => {
            if (k && k.active && Number(k.floor) === Number(Dungeon.floor) && k.color) colors.add(k.color);
        });
        (App.data?.dungeon?.floorKeys || []).forEach(k => {
            if (k && k.active && Number(k.floor) === Number(Dungeon.floor) && k.color) colors.add(k.color);
        });
        const guardian = App.data?.dungeon?.keyGuardian;
        if (guardian && guardian.active && Number(guardian.floor) === Number(Dungeon.floor) && guardian.color) colors.add(guardian.color);
        return colors;
    },

    // 宝箱を障害物、鍵扉を所持鍵依存として扱い、実際の進行条件で到達できる座標を返す。
    // 単純な W 判定だけでは「地形上は接続しているが宝箱や鍵扉で特殊物へ行けない」配置を見逃す。
    getProgressionReachableCells: () => {
        const reachable = new Set();
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return reachable;
        const start = { x: Number(Field.x), y: Number(Field.y) };
        if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) return reachable;

        const keyAt = new Map();
        (App.data?.dungeon?.keyChests || []).forEach(key => {
            if (key?.active && key.color) keyAt.set(`${Number(key.x)},${Number(key.y)}`, key.color);
        });
        (App.data?.dungeon?.floorKeys || []).forEach(key => {
            if (key?.active && key.color) keyAt.set(`${Number(key.x)},${Number(key.y)}`, key.color);
        });
        const guardian = App.data?.dungeon?.keyGuardian;
        if (guardian?.active && guardian.color) keyAt.set(`${Number(guardian.x)},${Number(guardian.y)}`, guardian.color);

        const colorBit = { red: 1, blue: 2, gold: 4 };
        const queue = [{ ...start, mask: 0 }];
        const seen = new Set([`${start.x},${start.y},0`]);
        for (let index = 0; index < queue.length; index++) {
            const current = queue[index];
            reachable.add(`${current.x},${current.y}`);
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const x = current.x + dx;
                const y = current.y + dy;
                if (x < 0 || y < 0 || x >= Dungeon.width || y >= Dungeon.height) continue;
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile === 'W' || tile === 'C' || tile === 'R' || tile === 'B') continue;
                const doorColor = Dungeon.getDoorColor(tile);
                if (doorColor && !(current.mask & colorBit[doorColor])) continue;
                let mask = current.mask;
                const tileColor = Dungeon.getKeyItemColor(tile);
                if (tileColor && colorBit[tileColor]) mask |= colorBit[tileColor];
                const objectColor = keyAt.get(`${x},${y}`);
                if (objectColor && colorBit[objectColor]) mask |= colorBit[objectColor];
                const stateKey = `${x},${y},${mask}`;
                if (seen.has(stateKey)) continue;
                seen.add(stateKey);
                queue.push({ x, y, mask });
            }
        }
        return reachable;
    },

    getActiveRandomFloorObjects: () => {
        const dungeon = App.data?.dungeon || {};
        const direct = ['adventurer', 'healSpring', 'abyssRift', 'trialAngel', 'keyGuardian']
            .map(name => ({ name, object: dungeon[name] }))
            .filter(entry => entry.object?.active && Number(entry.object.floor) === Number(Dungeon.floor));
        const arrays = [
            ['keyChest', dungeon.keyChests],
            ['floorKey', dungeon.floorKeys],
            ['randomHunter', dungeon.randomHunters]
        ].flatMap(([name, entries]) => (Array.isArray(entries) ? entries : [])
            .filter(object => object?.active && Number(object.floor) === Number(Dungeon.floor))
            .map((object, index) => ({ name: `${name}[${index}]`, object })));
        return direct.concat(arrays);
    },

    clearRandomFloorGateFeatures: () => {
        if (Array.isArray(Dungeon.map)) {
            Dungeon.map = Dungeon.map.map(row => row.map(tile => (
                Dungeon.isLockedDoorTile(tile) || Dungeon.isKeyItemTile(tile)
            ) ? 'T' : tile));
        }
        if (App.data?.dungeon) {
            App.data.dungeon.keyChests = null;
            App.data.dungeon.floorKeys = null;
            App.data.dungeon.keyGuardian = null;
        }
    },

    clearRandomFloorSpecialObjects: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.randomHunters = null;
    },

    collectGeneratedKeyDoorPairs: () => {
        const doors = [];
        const keysByCoordinate = new Map();
        if (Array.isArray(Dungeon.map)) {
            Dungeon.map.forEach((row, y) => row.forEach((tile, x) => {
                const doorColor = Dungeon.getDoorColor(tile);
                if (doorColor) doors.push({ x, y, color: doorColor });
                const keyColor = Dungeon.getKeyItemColor(tile);
                if (keyColor) keysByCoordinate.set(`${x},${y}`, { x, y, color: keyColor });
            }));
        }
        const addObjectKey = (key) => {
            if (!key?.active || Number(key.floor) !== Number(Dungeon.floor) || !key.color) return;
            const x = Number(key.x), y = Number(key.y);
            keysByCoordinate.set(`${x},${y}`, { x, y, color: key.color });
        };
        (App.data?.dungeon?.keyChests || []).forEach(addObjectKey);
        (App.data?.dungeon?.floorKeys || []).forEach(addObjectKey);
        addObjectKey(App.data?.dungeon?.keyGuardian);
        return { doors, keys: [...keysByCoordinate.values()] };
    },

    getUnreachableTraversableFloorTiles: (reachable = Dungeon.getProgressionReachableCells()) => {
        const unreachable = [];
        const traversable = new Set(['T', 'G', 'S', 'M', '~', 'Q', 'N', 'O', 'X', 'Y', 'Z']);
        if (!Array.isArray(Dungeon.map)) return unreachable;
        Dungeon.map.forEach((row, y) => row.forEach((tile, x) => {
            const normalized = String(tile || 'W').toUpperCase();
            if (traversable.has(normalized) && !reachable.has(`${x},${y}`)) unreachable.push({ x, y, tile: normalized });
        }));
        return unreachable;
    },

    validateGeneratedFloor: () => {
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return { ok: false, reason: 'map missing' };
        const actualHeight = Dungeon.map.length;
        const actualWidth = Array.isArray(Dungeon.map[0]) ? Dungeon.map[0].length : 0;
        if (!actualWidth || Dungeon.map.some(row => !Array.isArray(row) || row.length !== actualWidth)) {
            return { ok: false, reason: 'map rows are not rectangular' };
        }
        if (actualWidth !== Number(Dungeon.width) || actualHeight !== Number(Dungeon.height)) {
            return { ok: false, reason: `map dimensions mismatch ${actualWidth}x${actualHeight} != ${Dungeon.width}x${Dungeon.height}` };
        }
        const start = { x: Number(Field.x), y: Number(Field.y) };
        const startTile = String(Dungeon.map[start.y]?.[start.x] || 'W').toUpperCase();
        if (startTile === 'W') return { ok: false, reason: `player starts in wall ${start.x},${start.y}` };

        if (Dungeon.isBossFloor()) {
            const bosses = Dungeon.collectTiles(Dungeon.map, ['B']);
            return bosses.length ? { ok: true } : { ok: false, reason: 'boss missing' };
        }

        const stairTiles = Dungeon.collectTiles(Dungeon.map, ['S']);
        if (stairTiles.length !== 1) return { ok: false, reason: `stairs count must be 1: ${stairTiles.length}` };
        const stairs = stairTiles[0];

        const dist = Dungeon.distanceMap(Dungeon.map, start);
        if (dist[stairs.y]?.[stairs.x] < 0) return { ok: false, reason: 'stairs unreachable' };
        let disconnected = 0;
        Dungeon.map.forEach((row, y) => row.forEach((tile, x) => {
            if (String(tile || 'W').toUpperCase() !== 'W' && dist[y]?.[x] < 0) disconnected++;
        }));
        if (disconnected > 0) return { ok: false, reason: `${disconnected} disconnected walkable tiles remain` };

        const { doors, keys } = Dungeon.collectGeneratedKeyDoorPairs();
        const doorCounts = new Map();
        const keyCounts = new Map();
        doors.forEach(door => doorCounts.set(door.color, (doorCounts.get(door.color) || 0) + 1));
        keys.forEach(key => keyCounts.set(key.color, (keyCounts.get(key.color) || 0) + 1));
        for (const color of ['red', 'blue', 'gold']) {
            const doorCount = doorCounts.get(color) || 0;
            const keyCount = keyCounts.get(color) || 0;
            if (doorCount !== keyCount) return { ok: false, reason: `${color} door/key count mismatch ${doorCount}/${keyCount}` };
            if (doorCount > 1) return { ok: false, reason: `${color} has duplicate doors` };
        }

        const isolatedWalls = Dungeon.countIsolatedWallTiles();
        if (isolatedWalls > 0) return { ok: false, reason: `${isolatedWalls} isolated wall tiles remain` };

        const chestBlocked = new Set(Dungeon.collectTiles(Dungeon.map, ['C', 'R']).map(p => `${p.x},${p.y}`));
        const chestBlockedDist = Dungeon.distanceMapWithBlocked(Dungeon.map, start, chestBlocked);
        if (chestBlockedDist[stairs.y]?.[stairs.x] < 0) return { ok: false, reason: 'chests block the route to stairs' };

        if (!Dungeon.validateKeyDoorPuzzle()) return { ok: false, reason: 'key-door route invalid' };
        const progressionReachable = Dungeon.getProgressionReachableCells();
        if (!progressionReachable.has(`${stairs.x},${stairs.y}`)) return { ok: false, reason: 'stairs unreachable under actual blockers' };
        const unreachableFloor = Dungeon.getUnreachableTraversableFloorTiles(progressionReachable);
        if (unreachableFloor.length) {
            const sample = unreachableFloor.slice(0, 3).map(cell => `${cell.x},${cell.y}`).join(' / ');
            return { ok: false, reason: `${unreachableFloor.length} unreachable floor tiles remain (${sample})` };
        }
        const occupied = new Map();
        for (const { name, object } of Dungeon.getActiveRandomFloorObjects()) {
            const x = Number(object.x);
            const y = Number(object.y);
            const key = `${x},${y}`;
            if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= Dungeon.width || y >= Dungeon.height) {
                return { ok: false, reason: `${name} is outside map: ${key}` };
            }
            if (!progressionReachable.has(key)) return { ok: false, reason: `${name} unreachable: ${key}` };
            if (occupied.has(key)) return { ok: false, reason: `${name} overlaps ${occupied.get(key)} at ${key}` };
            occupied.set(key, name);
        }

        const planType = App.data?.dungeon?.floorPlanType;
        if (planType === 'lava' && !App.data.dungeon.isLavaFloor) return { ok: false, reason: 'lava plan was not applied' };
        if (planType === 'flooded' && !App.data.dungeon.isFloodedFloor) return { ok: false, reason: 'flooded plan was not applied' };
        if (planType === 'maze' && !Dungeon.isMazeFloor()) return { ok: false, reason: 'maze plan was not applied' };
        if (planType === 'treasure' && !App.data.dungeon.isTreasureRoom) return { ok: false, reason: 'treasure plan was not applied' };
        if (App.data?.dungeon?.floorPlanThemeId && App.data.dungeon.floorPlanThemeId !== App.data.dungeon.visualThemeId) {
            return { ok: false, reason: 'visual theme was overwritten after floor-plan selection' };
        }
        return { ok: true };
    },

    generateFloor: () => {
        Dungeon.resetRandomFloorAttemptState(false);
        if (Dungeon.isMemoryRealm()) {
            App.data.dungeon.memoryBossCleared = false;
            App.data.dungeon.memoryRewardChests = null;
            App.data.dungeon.memoryRestFloor = false;
            if (Dungeon.memoryRealmRestFloors.includes(Number(Dungeon.floor))) {
                Dungeon.generateMemoryRealmRestFloor();
                Field.currentMapData = Dungeon.createRandomFieldMapData();
                App.data.location.x = Field.x;
                App.data.location.y = Field.y;
                return;
            }
            if (!Dungeon.isBossFloor()) Dungeon.rollMemoryRealmTheme();
        }
        
        if (Dungeon.isBossFloor()) {
            const guildRun = Dungeon.getGuildQuestRun();
            const memoryTheme = Dungeon.isMemoryRealm() ? Dungeon.rollMemoryRealmTheme() : null;
            const bossThemeId = memoryTheme ? `memory-${memoryTheme.id}` : (guildRun?.visualThemeId || 'abyss');
            if (!memoryTheme) Dungeon.setRandomVisualTheme(Dungeon.randomVisualThemes.find(theme => theme.id === bossThemeId) || Dungeon.randomVisualThemes.find(theme => theme.id === 'abyss'));
            App.data.dungeon.floorPlanType = 'boss';
            App.data.dungeon.floorPlanThemeId = bossThemeId;
            Dungeon.generateAbyssBossRoom();
        } else {
            // フロア形態・外観は階層につき一度だけ抽選し、生成再試行では固定する。
            // 再試行ごとに引き直すと、検証に通りにくい形態の実効確率が下がるため。
            const floorPlan = Dungeon.rollRandomFloorPlan(Dungeon.floor);
            let valid = false;
            let lastValidation = null;
            const maxAttempts = 12;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                Dungeon.resetRandomFloorAttemptState(attempt > 0);
                Dungeon.buildRandomFloorLayout(floorPlan);
                Dungeon.finalizeRandomFloorFeatures(floorPlan);
                lastValidation = Dungeon.validateGeneratedFloor();
                if (lastValidation.ok) {
                    valid = true;
                    break;
                }
            }

            if (!valid) {
                Dungeon.resetRandomFloorAttemptState(true);
                Dungeon.applyRandomFloorPlan(floorPlan);
                Dungeon.generateFallbackRandomFloor(floorPlan);
                Dungeon.finalizeRandomFloorFeatures(floorPlan);
                let fallbackValidation = Dungeon.validateGeneratedFloor();

                if (!fallbackValidation.ok) {
                    // 任意ギミックの配置だけが原因なら除去し、地形と特殊フロア種別は維持する。
                    Dungeon.clearRandomFloorGateFeatures();
                    Dungeon.clearRandomFloorSpecialObjects();
                    fallbackValidation = Dungeon.validateGeneratedFloor();
                }

                if (!fallbackValidation.ok) {
                    // 最後は広い一室の決定的地形を作り直す。検証を通らない生成物は絶対に採用しない。
                    Dungeon.resetRandomFloorAttemptState(true);
                    Dungeon.applyRandomFloorPlan(floorPlan);
                    Dungeon.generateFallbackRandomFloor({ ...floorPlan, category: floorPlan.category === 'maze' ? 'maze' : floorPlan.category });
                    Dungeon.clearRandomFloorGateFeatures();
                    Dungeon.clearRandomFloorSpecialObjects();
                    if (floorPlan.category === 'lava') Dungeon.applyLavaFloorIfNeeded(true);
                    if (floorPlan.category === 'flooded') Dungeon.applyFloodedFloorIfNeeded(true);
                    fallbackValidation = Dungeon.validateGeneratedFloor();
                }

                if (!fallbackValidation.ok) {
                    throw new Error(`安全なランダム迷宮を生成できませんでした: ${fallbackValidation.reason} / ${lastValidation?.reason || 'unknown'}`);
                }
            }
		}
        
        Field.currentMapData = Dungeon.createRandomFieldMapData();
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
    },

    generateAbyssBossRoom: (options = {}) => {
        const layout = Dungeon.getAbyssBossRoomLayout();
        const w = layout.width;
        const h = layout.height;
        const cx = layout.centerX;
        Dungeon.map = [];
        Dungeon.width = w;
        Dungeon.height = h;
        for (let y = 0; y < h; y++) {
            const row = [];
            for (let x = 0; x < w; x++) row.push('W');
            Dungeon.map.push(row);
        }

        for (let y = 2; y <= layout.entry.y; y++) {
            const minX = Dungeon.isMemoryRealm() && y <= 9 ? 2 : cx - 1;
            const maxX = Dungeon.isMemoryRealm() && y <= 9 ? layout.width - 3 : cx + 1;
            for (let x = minX; x <= maxX; x++) {
                Dungeon.map[y][x] = 'T';
            }
        }
        Dungeon.map[layout.stair.y][layout.stair.x] = 'T';
        Dungeon.map[layout.boss.y][cx - 1] = 'T';
        Dungeon.map[layout.boss.y][cx + 1] = 'T';
        Dungeon.map[layout.boss.y][layout.boss.x] = 'B';

        Field.x = layout.entry.x;
        Field.y = layout.entry.y;

        const preserved = options.preserveEncounter;
        if (preserved && Number(preserved.floor) === Number(Dungeon.floor) && Array.isArray(preserved.monsterIds) && preserved.monsterIds.length) {
            App.data.dungeon.abyssBossEncounter = Dungeon.normalizeAbyssBossEncounter({
                ...preserved,
                active: true,
                floor: Dungeon.floor,
                x: layout.boss.x,
                y: layout.boss.y,
            });
        } else {
            Dungeon.ensureAbyssBossEncounter({ floor: Dungeon.floor, force: true });
        }
        App.data.dungeon.bossRoomLayout = layout.id;
    },

    generateBossRoom: () => {
        // ボスフロアはひし形にする。外周を長方形床に戻すと、
        // ボス撃破後の「上に階段・左下に泉・右下に宝箱」という配置が崩れるため注意。
        const w = 11, h = 11;
        const cx = 5, cy = 5, radius = 4;
        Dungeon.width = w;
        Dungeon.height = h;
        for (let y = 0; y < h; y++) {
            const row = [];
            for (let x = 0; x < w; x++) {
                row.push((Math.abs(x - cx) + Math.abs(y - cy) <= radius) ? 'T' : 'W');
            }
            Dungeon.map.push(row);
        }

        // ひし形の中心にボス、下端にプレイヤーを置く。
        Dungeon.map[cy][cx] = 'B';
        Field.x = cx;
        Field.y = cy + radius;
        Dungeon.ensureAbyssBossEncounter({ floor: Dungeon.floor, force: true });
    },
	
    generateTreasureRoom: () => {
        const w = 11, h = 11; 
        Dungeon.width = w; Dungeon.height = h;
        for(let y=0; y<h; y++) {
            let row = [];
            for(let x=0; x<w; x++) { 
                if(x===0||x===w-1||y===0||y===h-1) row.push('W'); 
                else row.push('T'); 
            }
            Dungeon.map.push(row);
        }
        Dungeon.map[2][5] = 'S'; 
        Dungeon.map[4][3] = 'R'; Dungeon.map[4][7] = 'R';
        Dungeon.map[5][5] = 'R';
        Dungeon.map[6][3] = 'R'; Dungeon.map[6][7] = 'R';

        Field.x = 5; Field.y = 8; 
        App.data.dungeon.genType = 0; 
    },

    randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

    chance: (rate) => Math.random() < rate,

    makeMap: (w, h, tile = 'W') => Array.from({ length: h }, () => Array(w).fill(tile)),

    shuffle: (items) => {
        const arr = items.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    inBounds: (map, x, y, margin = 1) => {
        const h = map.length;
        const w = h ? map[0].length : 0;
        return x >= margin && x < w - margin && y >= margin && y < h - margin;
    },

    carveBrush: (map, cx, cy, rx = 1, ry = rx) => {
        let carved = 0;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                if (!Dungeon.inBounds(map, x, y, 1)) continue;
                const nx = (x - cx) / Math.max(1, rx);
                const ny = (y - cy) / Math.max(1, ry);
                if ((nx * nx) + (ny * ny) <= 1.15) {
                    if (map[y][x] === 'W') carved++;
                    map[y][x] = 'T';
                }
            }
        }
        return carved;
    },

    carveLine: (map, from, to, width = 1, wiggle = 0.18) => {
        let x = from.x;
        let y = from.y;
        Dungeon.carveBrush(map, x, y, width);
        let guard = map.length * map[0].length;
        while ((x !== to.x || y !== to.y) && guard-- > 0) {
            const horizontal = x !== to.x && (y === to.y || Math.random() < 0.5);
            if (horizontal) x += x < to.x ? 1 : -1;
            else if (y !== to.y) y += y < to.y ? 1 : -1;

            if (Math.random() < wiggle) {
                const dirs = Dungeon.shuffle([[1,0],[-1,0],[0,1],[0,-1]]);
                const d = dirs.find(([dx, dy]) => Dungeon.inBounds(map, x + dx, y + dy, 1));
                if (d) { x += d[0]; y += d[1]; }
            }
            Dungeon.carveBrush(map, x, y, width);
        }
    },

    collectTiles: (map, accepted = ['T']) => {
        const set = new Set(accepted);
        const cells = [];
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                if (set.has(map[y][x])) cells.push({ x, y });
            }
        }
        return cells;
    },

    floorNeighbors: (map, x, y, diagonal = false) => {
        const dirs = diagonal
            ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
            : [[1,0],[-1,0],[0,1],[0,-1]];
        let count = 0;
        dirs.forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length && map[ny][nx] !== 'W') count++;
        });
        return count;
    },

    findRegions: (map) => {
        const h = map.length, w = map[0].length;
        const seen = Array.from({ length: h }, () => Array(w).fill(false));
        const regions = [];
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                if (seen[y][x] || map[y][x] === 'W') continue;
                const region = [];
                const queue = [{ x, y }];
                seen[y][x] = true;
                for (let qi = 0; qi < queue.length; qi++) {
                    const p = queue[qi];
                    region.push(p);
                    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
                        const nx = p.x + dx, ny = p.y + dy;
                        if (nx <= 0 || nx >= w - 1 || ny <= 0 || ny >= h - 1) return;
                        if (seen[ny][nx] || map[ny][nx] === 'W') return;
                        seen[ny][nx] = true;
                        queue.push({ x: nx, y: ny });
                    });
                }
                regions.push(region);
            }
        }
        return regions;
    },

    keepLargestRegion: (map) => {
        const regions = Dungeon.findRegions(map);
        if (!regions.length) return 0;
        regions.sort((a, b) => b.length - a.length);
        const keep = new Set(regions[0].map(p => `${p.x},${p.y}`));
        for (let y = 1; y < map.length - 1; y++) {
            for (let x = 1; x < map[0].length - 1; x++) {
                if (map[y][x] !== 'W' && !keep.has(`${x},${y}`)) map[y][x] = 'W';
            }
        }
        return regions[0].length;
    },

    pruneUnreachableFromPlayer: () => {
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return 0;
        const start = { x: Number(Field.x), y: Number(Field.y) };
        const dist = Dungeon.distanceMap(Dungeon.map, start);
        let removed = 0;
        for (let y = 1; y < Dungeon.map.length - 1; y++) {
            for (let x = 1; x < Dungeon.map[0].length - 1; x++) {
                if (Dungeon.map[y][x] !== 'W' && dist[y][x] < 0) {
                    Dungeon.map[y][x] = 'W';
                    removed++;
                }
            }
        }
        return removed;
    },

    distanceMap: (map, start) => {
        const h = map.length, w = map[0].length;
        const dist = Array.from({ length: h }, () => Array(w).fill(-1));
        if (!start || map[start.y]?.[start.x] === 'W') return dist;
        const queue = [start];
        dist[start.y][start.x] = 0;
        for (let qi = 0; qi < queue.length; qi++) {
            const p = queue[qi];
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
                const nx = p.x + dx, ny = p.y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
                if (dist[ny][nx] >= 0 || map[ny][nx] === 'W') return;
                dist[ny][nx] = dist[p.y][p.x] + 1;
                queue.push({ x: nx, y: ny });
            });
        }
        return dist;
    },

    distanceMapWithBlocked: (map, start, blocked = new Set()) => {
        const h = map.length, w = map[0].length;
        const dist = Array.from({ length: h }, () => Array(w).fill(-1));
        const isBlocked = (x, y) => blocked.has(`${x},${y}`) || map[y]?.[x] === 'W';
        if (!start || isBlocked(start.x, start.y)) return dist;
        const queue = [start];
        dist[start.y][start.x] = 0;
        for (let qi = 0; qi < queue.length; qi++) {
            const p = queue[qi];
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
                const nx = p.x + dx, ny = p.y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
                if (dist[ny][nx] >= 0 || isBlocked(nx, ny)) return;
                dist[ny][nx] = dist[p.y][p.x] + 1;
                queue.push({ x: nx, y: ny });
            });
        }
        return dist;
    },

    findPathWithBlocked: (map, start, goal, blocked = new Set()) => {
        const h = map.length, w = map[0].length;
        const seen = Array.from({ length: h }, () => Array(w).fill(false));
        const prev = Array.from({ length: h }, () => Array(w).fill(null));
        const isBlocked = (x, y) => blocked.has(`${x},${y}`) || map[y]?.[x] === 'W';
        if (!start || !goal || isBlocked(start.x, start.y) || isBlocked(goal.x, goal.y)) return [];
        const queue = [start];
        seen[start.y][start.x] = true;
        for (let qi = 0; qi < queue.length; qi++) {
            const p = queue[qi];
            if (p.x === goal.x && p.y === goal.y) break;
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
                const nx = p.x + dx, ny = p.y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
                if (seen[ny][nx] || isBlocked(nx, ny)) return;
                seen[ny][nx] = true;
                prev[ny][nx] = p;
                queue.push({ x: nx, y: ny });
            });
        }
        if (!seen[goal.y]?.[goal.x]) return [];
        const path = [];
        let cur = goal;
        while (cur) {
            path.push(cur);
            if (cur.x === start.x && cur.y === start.y) break;
            cur = prev[cur.y][cur.x];
        }
        return path.reverse();
    },

    weightedPick: (items, weightFn) => {
        if (!items.length) return null;
        const weights = items.map((item) => Math.max(0.01, weightFn(item)));
        const total = weights.reduce((sum, val) => sum + val, 0);
        let roll = Math.random() * total;
        for (let i = 0; i < items.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return items[i];
        }
        return items[items.length - 1];
    },

    isAwayFromFeatures: (map, cell, minDist = 3) => {
        for (let y = Math.max(0, cell.y - minDist); y <= Math.min(map.length - 1, cell.y + minDist); y++) {
            for (let x = Math.max(0, cell.x - minDist); x <= Math.min(map[0].length - 1, cell.x + minDist); x++) {
                if (Math.abs(x - cell.x) + Math.abs(y - cell.y) > minDist) continue;
                if (map[y][x] === 'S' || map[y][x] === 'C' || map[y][x] === 'R') return false;
            }
        }
        return true;
    },

    finishCaveMap: (map) => {
        const h = map.length, w = map[0].length;
        for (let i = 0; i < 2; i++) {
            const next = map.map(row => row.slice());
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const floors = Dungeon.floorNeighbors(map, x, y, true);
                    if (map[y][x] === 'W' && floors >= 6) next[y][x] = 'T';
                    if (map[y][x] !== 'W' && floors <= 1) next[y][x] = 'W';
                }
            }
            map = next;
        }
        const largest = Dungeon.keepLargestRegion(map);
        if (largest < 120) return null;
        return map;
    },


    generateRuinsMap: () => {
        Dungeon.lastGenVariant = 'ruins-crossroads';
        Dungeon.width = Dungeon.randInt(38, 44);
        Dungeon.height = Dungeon.randInt(38, 44);
        const w = Dungeon.width, h = Dungeon.height;
        const map = Dungeon.makeMap(w, h, 'W');

        const centers = [];
        const count = Dungeon.randInt(7, 11);
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : i / (count - 1);
            centers.push({
                x: Math.max(4, Math.min(w - 5, Math.floor(4 + t * (w - 9) + Dungeon.randInt(-4, 4)))),
                y: Math.max(4, Math.min(h - 5, Math.floor(h - 5 - t * (h - 9) + Dungeon.randInt(-4, 4))))
            });
        }

        centers.forEach((c, i) => {
            const rx = Dungeon.randInt(2, i % 3 === 0 ? 5 : 4);
            const ry = Dungeon.randInt(2, i % 2 === 0 ? 4 : 5);
            Dungeon.carveBrush(map, c.x, c.y, rx, ry);
            if (Math.random() < 0.55) {
                Dungeon.carveLine(map, c, { x: Dungeon.randInt(3, w - 4), y: c.y }, 1, 0.05);
            }
            if (Math.random() < 0.45) {
                Dungeon.carveLine(map, c, { x: c.x, y: Dungeon.randInt(3, h - 4) }, 1, 0.05);
            }
        });

        for (let i = 0; i < centers.length - 1; i++) {
            Dungeon.carveLine(map, centers[i], centers[i + 1], Math.random() < 0.35 ? 2 : 1, 0.06);
        }

        // 柱や崩落壁を置き、単なる小部屋連結にならないようにする。
        for (let i = 0; i < Dungeon.randInt(18, 30); i++) {
            const floors = Dungeon.collectTiles(map, ['T']);
            if (!floors.length) break;
            const p = floors[Dungeon.randInt(0, floors.length - 1)];
            if (Dungeon.floorNeighbors(map, p.x, p.y, false) >= 3 && Dungeon.inBounds(map, p.x, p.y, 2)) {
                map[p.y][p.x] = Math.random() < 0.5 ? 'G' : 'W';
            }
        }

        Dungeon.keepLargestRegion(map);
        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    generateRoomMap: () => {
        Dungeon.width = 38; Dungeon.height = 38;
        const w = Dungeon.width, h = Dungeon.height;
        let map = Array(h).fill(0).map(() => Array(w).fill('W'));
        const rooms = [];
        const roomCount = 7 + Math.min(6, Math.floor(Dungeon.getBalanceFloor()/8));
        
        for (let i = 0; i < roomCount; i++) {
            const rw = Math.floor(Math.random() * 7) + 4;
            const rh = Math.floor(Math.random() * 7) + 4;
            const rx = Math.floor(Math.random() * (w - rw - 2)) + 1;
            const ry = Math.floor(Math.random() * (h - rh - 2)) + 1;
            
            let overlap = false;
            for(let r of rooms) {
                if(rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y) {
                    overlap = true; break;
                }
            }
            if(overlap) continue;

            for (let y = ry; y < ry + rh; y++) {
                for (let x = rx; x < rx + rw; x++) { map[y][x] = 'T'; }
            }
            const cx = Math.floor(rx + rw / 2);
            const cy = Math.floor(ry + rh / 2);
            if (Math.random() < 0.55) {
                const bulges = Dungeon.randInt(1, 3);
                for (let b = 0; b < bulges; b++) {
                    const bx = Dungeon.randInt(rx + 1, rx + rw - 2);
                    const by = Dungeon.randInt(ry + 1, ry + rh - 2);
                    Dungeon.carveBrush(map, bx + Dungeon.randInt(-2, 2), by + Dungeon.randInt(-2, 2), Dungeon.randInt(1, 3), Dungeon.randInt(1, 2));
                }
                if (Math.random() < 0.35) {
                    const notchX = Math.random() < 0.5 ? rx : rx + rw - 1;
                    const notchY = Dungeon.randInt(ry + 1, ry + rh - 2);
                    if (Dungeon.inBounds(map, notchX, notchY, 1)) map[notchY][notchX] = 'W';
                }
            }
            rooms.push({x:rx, y:ry, w:rw, h:rh, cx, cy});
        }
        
        for(let i=0; i<rooms.length-1; i++) {
            if (Math.random() < 0.18) Dungeon.carveLine(map, rooms[i], rooms[i+1], 1, 0.08);
            else Dungeon.connectRooms(map, rooms[i], rooms[i+1]);
        }
        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    generateAdvancedCaveMap: () => {
        const variants = ['worms', 'cellular', 'chambers', 'ravine'];
        const variant = variants[Dungeon.randInt(0, variants.length - 1)];
        Dungeon.lastGenVariant = `cave-${variant}`;

        let map = null;
        if (variant === 'cellular') map = Dungeon.generateCellularCave();
        else if (variant === 'chambers') map = Dungeon.generateChamberCave();
        else if (variant === 'ravine') map = Dungeon.generateRavineCave();
        else map = Dungeon.generateWormCave();

        map = Dungeon.finishCaveMap(map) || Dungeon.generateChamberCave();
        Dungeon.width = map[0].length;
        Dungeon.height = map.length;
        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    generateWormCave: () => {
        const w = Dungeon.randInt(34, 42), h = Dungeon.randInt(34, 42);
        const map = Dungeon.makeMap(w, h, 'W');
        const start = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
        let carved = Dungeon.carveBrush(map, start.x, start.y, 2);
        const target = Dungeon.randInt(280, 430);
        const miners = [{ x: start.x, y: start.y, dx: 1, dy: 0, life: target }];
        let guard = target * 12;

        while (carved < target && guard-- > 0 && miners.length) {
            const idx = Dungeon.randInt(0, miners.length - 1);
            const m = miners[idx];
            if (Math.random() > 0.62 || (m.dx === 0 && m.dy === 0)) {
                const d = Dungeon.shuffle([[1,0],[-1,0],[0,1],[0,-1]])[0];
                m.dx = d[0]; m.dy = d[1];
            }

            const steps = Dungeon.randInt(1, 3);
            for (let i = 0; i < steps; i++) {
                const nx = m.x + m.dx, ny = m.y + m.dy;
                if (!Dungeon.inBounds(map, nx, ny, 2)) {
                    m.dx *= -1; m.dy *= -1;
                    break;
                }

                m.x = nx; m.y = ny; m.life--;
                carved += Dungeon.carveBrush(map, m.x, m.y, Math.random() < 0.16 ? 2 : 1);
                if (Math.random() < 0.035 && miners.length < 10) {
                    miners.push({ x: m.x, y: m.y, dx: -m.dy, dy: m.dx, life: Dungeon.randInt(40, 120) });
                }
            }
            if (m.life <= 0 && miners.length > 1) miners.splice(idx, 1);
        }

        for (let i = 0; i < 10; i++) {
            const floors = Dungeon.collectTiles(map);
            if (!floors.length) break;
            const p = floors[Dungeon.randInt(0, floors.length - 1)];
            Dungeon.carveBrush(map, p.x, p.y, Dungeon.randInt(2, 4), Dungeon.randInt(2, 4));
        }
        return map;
    },

    generateCellularCave: () => {
        const w = Dungeon.randInt(36, 44), h = Dungeon.randInt(36, 44);
        let map = Dungeon.makeMap(w, h, 'W');
        const openRate = 0.46 + Math.random() * 0.08;
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                map[y][x] = Math.random() < openRate ? 'T' : 'W';
            }
        }

        const passes = Dungeon.randInt(4, 6);
        for (let i = 0; i < passes; i++) {
            const next = Dungeon.makeMap(w, h, 'W');
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const floors = Dungeon.floorNeighbors(map, x, y, true);
                    next[y][x] = floors >= 5 ? 'T' : 'W';
                }
            }
            map = next;
        }

        Dungeon.keepLargestRegion(map);
        const floors = Dungeon.collectTiles(map);
        for (let i = 0; i < 6 && floors.length; i++) {
            const p = floors[Dungeon.randInt(0, floors.length - 1)];
            Dungeon.carveBrush(map, p.x, p.y, Dungeon.randInt(1, 3));
        }
        return map;
    },

    generateChamberCave: () => {
        const w = Dungeon.randInt(34, 42), h = Dungeon.randInt(34, 42);
        const map = Dungeon.makeMap(w, h, 'W');
        const centers = [{ x: Math.floor(w / 2), y: Math.floor(h / 2) }];
        const chamberCount = Dungeon.randInt(9, 16);
        for (let i = 1; i < chamberCount; i++) {
            centers.push({ x: Dungeon.randInt(4, w - 5), y: Dungeon.randInt(4, h - 5) });
        }

        centers.forEach((c) => {
            Dungeon.carveBrush(map, c.x, c.y, Dungeon.randInt(2, 5), Dungeon.randInt(2, 4));
        });

        for (let i = 1; i < centers.length; i++) {
            const current = centers[i];
            const previous = centers.slice(0, i).sort((a, b) =>
                Math.abs(a.x - current.x) + Math.abs(a.y - current.y) -
                (Math.abs(b.x - current.x) + Math.abs(b.y - current.y))
            )[0];
            Dungeon.carveLine(map, previous, current, Math.random() < 0.25 ? 2 : 1, 0.10);
        }
        return map;
    },

    generateRavineCave: () => {
        const w = Dungeon.randInt(34, 42), h = Dungeon.randInt(34, 42);
        const map = Dungeon.makeMap(w, h, 'W');
        const horizontal = Math.random() < 0.5;
        let x = horizontal ? 2 : Dungeon.randInt(5, w - 6);
        let y = horizontal ? Dungeon.randInt(5, h - 6) : 2;
        const end = horizontal ? w - 3 : h - 3;
        let guard = w * h;

        while ((horizontal ? x < end : y < end) && guard-- > 0) {
            Dungeon.carveBrush(map, x, y, Dungeon.randInt(1, 3), Dungeon.randInt(1, 3));
            if (Math.random() < 0.18) {
                const branchEnd = {
                    x: Math.max(2, Math.min(w - 3, x + Dungeon.randInt(-8, 8))),
                    y: Math.max(2, Math.min(h - 3, y + Dungeon.randInt(-8, 8)))
                };
                Dungeon.carveLine(map, { x, y }, branchEnd, 1, 0.28);
                if (Math.random() < 0.45) Dungeon.carveBrush(map, branchEnd.x, branchEnd.y, Dungeon.randInt(2, 4), Dungeon.randInt(2, 4));
            }

            if (horizontal) {
                x++;
                y += Dungeon.randInt(-1, 1);
                y = Math.max(3, Math.min(h - 4, y));
            } else {
                y++;
                x += Dungeon.randInt(-1, 1);
                x = Math.max(3, Math.min(w - 4, x));
            }
        }
        return map;
    },

    generateCaveMap: () => {
        Dungeon.generateAdvancedCaveMap();
    },

    generateMazeMap: () => {
        Dungeon.width = 35; Dungeon.height = 35;
        const w = Dungeon.width, h = Dungeon.height;
        let map = Array(h).fill(0).map(() => Array(w).fill('W'));

        const startX = 1, startY = 1;
        const stack = [{x:startX, y:startY}];
        map[startY][startX] = 'T';

        while(stack.length > 0) {
            const current = stack[stack.length - 1];
            const dirs = [[0,-2], [0,2], [-2,0], [2,0]];
            for(let i=dirs.length-1; i>0; i--){
                const r = Math.floor(Math.random()*(i+1));
                [dirs[i], dirs[r]] = [dirs[r], dirs[i]];
            }
            
            let dug = false;
            for(let d of dirs) {
                const nx = current.x + d[0];
                const ny = current.y + d[1];
                if(nx>0 && nx<w && ny>0 && ny<h && map[ny][nx] === 'W') {
                    map[ny][nx] = 'T'; 
                    map[current.y + d[1]/2][current.x + d[0]/2] = 'T';
                    stack.push({x:nx, y:ny});
                    dug = true;
                    break;
                }
            }
            if(!dug) stack.pop();
        }
        
        for(let i=0; i<18; i++) { 
            const rx = Math.floor(Math.random()*(w-2))+1;
            const ry = Math.floor(Math.random()*(h-2))+1;
            if(map[ry][rx] === 'W') map[ry][rx] = 'T';
        }

        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    connectRooms: (map, r1, r2) => {
        let x = r1.cx, y = r1.cy;
        while(x !== r2.cx) {
            if(map[y][x] === 'W') map[y][x] = 'T';
            x += (x < r2.cx) ? 1 : -1;
        }
        while(y !== r2.cy) {
            if(map[y][x] === 'W') map[y][x] = 'T';
            y += (y < r2.cy) ? 1 : -1;
        }
        map[y][x] = 'T';
    },

    placeAdvancedFeatures: () => {
        Dungeon.keepLargestRegion(Dungeon.map);
        let floors = Dungeon.collectTiles(Dungeon.map, ['T']);
        if (!floors.length) return;

        const center = floors.reduce((best, cell) => {
            const score = Math.abs(cell.x - Dungeon.width / 2) + Math.abs(cell.y - Dungeon.height / 2);
            return !best || score < best.score ? { ...cell, score } : best;
        }, null);
        const centerDist = Dungeon.distanceMap(Dungeon.map, center);
        const maxCenterDist = Math.max(...floors.map(p => centerDist[p.y][p.x]));
        const stairPool = floors.filter(p => centerDist[p.y][p.x] >= maxCenterDist * 0.55);
        const sPos = Dungeon.weightedPick(stairPool.length ? stairPool : floors, (p) => {
            const deadEnd = Dungeon.floorNeighbors(Dungeon.map, p.x, p.y, false) <= 1 ? 8 : 1;
            return (centerDist[p.y][p.x] + 1) * deadEnd;
        });
        Dungeon.map[sPos.y][sPos.x] = 'S';
        floors = floors.filter(p => p.x !== sPos.x || p.y !== sPos.y);

        let chests = Dungeon.randInt(3, 7) + Math.min(3, Math.floor(Dungeon.getBalanceFloor() / 60));
        const stairDist = Dungeon.distanceMap(Dungeon.map, sPos);

        for(let i=0; i<chests; i++) {
            if(!floors.length) break;
            const candidates = floors.filter(p => Dungeon.isAwayFromFeatures(Dungeon.map, p, 3) && stairDist[p.y][p.x] >= 4);
            const pool = candidates.length ? candidates : floors;
            const cPos = Dungeon.weightedPick(pool, (p) => {
                const deadEnd = Dungeon.floorNeighbors(Dungeon.map, p.x, p.y, false) <= 1 ? 6 : 1;
                return (stairDist[p.y][p.x] + 2) * deadEnd;
            });
            Dungeon.map[cPos.y][cPos.x] = 'C';
            floors = floors.filter(p => p.x !== cPos.x || p.y !== cPos.y);
        }

        if (Math.random() < 0.01 && floors.length > 0) {
            const candidates = floors.filter(p => Dungeon.isAwayFromFeatures(Dungeon.map, p, 4));
            const pool = candidates.length ? candidates : floors;
            const rPos = Dungeon.weightedPick(pool, (p) => stairDist[p.y][p.x] + 1);
            Dungeon.map[rPos.y][rPos.x] = 'R';
        }
    },

    canPlaceKeyFeatureAt: (cell, protectedKeys = new Set()) => {
        if (!cell) return false;
        if (protectedKeys.has(`${cell.x},${cell.y}`)) return false;
        const tile = String(Dungeon.map[cell.y]?.[cell.x] || 'W').toUpperCase();
        if (tile !== 'T' && tile !== 'G') return false;
        return Dungeon.isAwayFromFeatures(Dungeon.map, cell, 2);
    },

    applyKeyDoorPuzzleIfNeeded: () => {
        if (!App.data?.dungeon || !Array.isArray(Dungeon.map) || !Dungeon.map.length) return false;
        Dungeon.clearRandomFloorGateFeatures();

        if (App.data.dungeon.isTreasureRoom || Dungeon.isBossFloor()) return false;
        if (Dungeon.getBalanceFloor() < 3) return false;
        const genType = Number(App.data.dungeon.genType);
        if (genType !== 0 && genType !== 2) return false;

        const start = { x: Number(Field.x), y: Number(Field.y) };
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
        if (!stairs) return false;
        const path = Dungeon.findPathWithBlocked(Dungeon.map, start, stairs);
        if (path.length < 10) return false;

        const balanceFloor = Dungeon.getBalanceFloor();
        const roll = Math.random();
        const desiredCount = balanceFloor >= 80
            ? (roll < 0.18 ? 3 : (roll < 0.62 ? 2 : 1))
            : (balanceFloor >= 25 ? (roll < 0.40 ? 2 : 1) : 1);

        // 扉候補は、その1マスだけを閉じた時に階段への全経路を遮断する関節点に限定する。
        const articulationCandidates = [];
        // 長い迷路で経路上の全マスごとに幅優先探索すると生成が極端に重くなるため、
        // 経路全体から最大48点を均等抽出して関節点を検査する。候補がなければ鍵扉を置かない。
        const firstIndex = 3;
        const lastIndex = path.length - 4;
        const checkCount = Math.min(48, Math.max(0, lastIndex - firstIndex + 1));
        const candidateIndices = new Set();
        for (let slot = 0; slot < checkCount; slot++) {
            const ratio = checkCount <= 1 ? 0.5 : slot / (checkCount - 1);
            candidateIndices.add(Math.round(firstIndex + (lastIndex - firstIndex) * ratio));
        }
        for (const index of candidateIndices) {
            const p = path[index];
            const tile = String(Dungeon.map[p.y]?.[p.x] || 'W').toUpperCase();
            if (tile !== 'T' && tile !== 'G') continue;
            const blocked = new Set([`${p.x},${p.y}`]);
            const blockedDist = Dungeon.distanceMapWithBlocked(Dungeon.map, start, blocked);
            if (blockedDist[stairs.y]?.[stairs.x] >= 0) continue;
            articulationCandidates.push({ ...p, pathIndex: index });
        }
        if (!articulationCandidates.length) return false;

        const selectedDoors = [];
        const count = Math.min(desiredCount, articulationCandidates.length, 3);
        for (let slot = 1; slot <= count; slot++) {
            const targetIndex = path.length * slot / (count + 1);
            const available = articulationCandidates.filter(candidate => selectedDoors.every(existing => Math.abs(existing.pathIndex - candidate.pathIndex) >= 4));
            if (!available.length) break;
            available.sort((a, b) => Math.abs(a.pathIndex - targetIndex) - Math.abs(b.pathIndex - targetIndex));
            selectedDoors.push(available[0]);
        }
        selectedDoors.sort((a, b) => a.pathIndex - b.pathIndex);
        if (!selectedDoors.length) return false;

        const colors = Dungeon.shuffle(['red', 'blue', 'gold']).slice(0, selectedDoors.length);
        selectedDoors.forEach((door, index) => {
            door.color = colors[index];
            Dungeon.map[door.y][door.x] = Dungeon.keyDoorSymbols[door.color];
        });

        const protectedKeys = new Set([
            `${start.x},${start.y}`,
            `${stairs.x},${stairs.y}`,
            ...selectedDoors.map(door => `${door.x},${door.y}`)
        ]);
        const floorKeys = [];

        for (let index = 0; index < selectedDoors.length; index++) {
            const door = selectedDoors[index];
            // 現在および後続の扉を閉じ、既に通過済みの扉だけ開いた状態で鍵候補を探す。
            const blocked = new Set(selectedDoors.slice(index).map(entry => `${entry.x},${entry.y}`));
            const beforeDist = Dungeon.distanceMapWithBlocked(Dungeon.map, start, blocked);
            const candidates = Dungeon.collectTiles(Dungeon.map, ['T', 'G'])
                .filter(cell => beforeDist[cell.y]?.[cell.x] >= 4)
                .filter(cell => !protectedKeys.has(`${cell.x},${cell.y}`))
                .filter(cell => Dungeon.isAwayFromFeatures(Dungeon.map, cell, 2));
            if (!candidates.length) {
                Dungeon.clearRandomFloorGateFeatures();
                return false;
            }
            const keyPos = Dungeon.weightedPick(candidates, cell => {
                const deadEnd = Dungeon.floorNeighbors(Dungeon.map, cell.x, cell.y, false) <= 1 ? 5 : 1;
                return (beforeDist[cell.y][cell.x] + 1) * deadEnd;
            });
            if (!keyPos) {
                Dungeon.clearRandomFloorGateFeatures();
                return false;
            }
            Dungeon.map[keyPos.y][keyPos.x] = Dungeon.keyItemSymbols[door.color];
            protectedKeys.add(`${keyPos.x},${keyPos.y}`);
            floorKeys.push({ active: true, floor: Dungeon.floor, x: keyPos.x, y: keyPos.y, color: door.color });
        }

        App.data.dungeon.floorKeys = floorKeys;
        if (!Dungeon.validateKeyDoorPuzzle()) {
            Dungeon.clearRandomFloorGateFeatures();
            return false;
        }
        return true;
    },

    validateKeyDoorPuzzle: () => {
        const start = { x: Number(Field.x), y: Number(Field.y) };
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
        if (!stairs) return Dungeon.isBossFloor();

        const { doors, keys } = Dungeon.collectGeneratedKeyDoorPairs();
        const doorByColor = new Map();
        const keyByColor = new Map();
        for (const door of doors) {
            if (doorByColor.has(door.color)) return false;
            doorByColor.set(door.color, door);
        }
        for (const key of keys) {
            if (keyByColor.has(key.color)) return false;
            keyByColor.set(key.color, key);
        }
        for (const color of new Set([...doorByColor.keys(), ...keyByColor.keys()])) {
            if (!doorByColor.has(color) || !keyByColor.has(color)) return false;
            const door = doorByColor.get(color);
            const key = keyByColor.get(color);
            const blocked = new Set([`${door.x},${door.y}`]);
            const dist = Dungeon.distanceMapWithBlocked(Dungeon.map, start, blocked);
            if (dist[stairs.y]?.[stairs.x] >= 0) return false;
            if (dist[key.y]?.[key.x] < 0) return false;
        }

        const keyAt = new Map(keys.map(key => [`${key.x},${key.y}`, key.color]));
        const colors = ['red', 'blue', 'gold'];
        const colorBit = { red: 1, blue: 2, gold: 4 };
        const queue = [{ x: start.x, y: start.y, mask: 0 }];
        const seen = new Set([`${start.x},${start.y},0`]);

        for (let qi = 0; qi < queue.length; qi++) {
            const p = queue[qi];
            if (p.x === stairs.x && p.y === stairs.y) return true;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = p.x + dx, ny = p.y + dy;
                if (nx < 0 || nx >= Dungeon.width || ny < 0 || ny >= Dungeon.height) continue;
                const tile = String(Dungeon.map[ny]?.[nx] || 'W').toUpperCase();
                if (tile === 'W' || tile === 'C' || tile === 'R' || tile === 'B') continue;
                const doorColor = Dungeon.getDoorColor(tile);
                if (doorColor && !(p.mask & colorBit[doorColor])) continue;
                let nextMask = p.mask;
                const tilePickup = Dungeon.getKeyItemColor(tile);
                if (tilePickup && colors.includes(tilePickup)) nextMask |= colorBit[tilePickup];
                const pickup = keyAt.get(`${nx},${ny}`);
                if (pickup && colors.includes(pickup)) nextMask |= colorBit[pickup];
                const stateKey = `${nx},${ny},${nextMask}`;
                if (seen.has(stateKey)) continue;
                seen.add(stateKey);
                queue.push({ x: nx, y: ny, mask: nextMask });
            }
        }
        return false;
    },

    placeStairsAndChests: () => {
        Dungeon.placeAdvancedFeatures();
        return;
        let floors = [];
        for(let y=0; y<Dungeon.height; y++) {
            for(let x=0; x<Dungeon.width; x++) {
                if(Dungeon.map[y][x] === 'T') floors.push({x,y});
            }
        }
        
        if(floors.length === 0) return;

        // 階段
        const sIdx = Math.floor(Math.random() * floors.length);
        const sPos = floors[sIdx];
        Dungeon.map[sPos.y][sPos.x] = 'S';
        floors.splice(sIdx, 1);

        // 宝箱の数 (3〜8個)
        let chests = Math.floor(Math.random() * 6) + 3;

        for(let i=0; i<chests; i++) {
            if(floors.length === 0) break;
            const cIdx = Math.floor(Math.random() * floors.length);
            const cPos = floors[cIdx];
            Dungeon.map[cPos.y][cPos.x] = 'C'; // 通常宝箱
            floors.splice(cIdx, 1);
        }

        // 1%の確率で赤宝箱(+3確定)を配置
        if (Math.random() < 0.01 && floors.length > 0) {
            const rIdx = Math.floor(Math.random() * floors.length);
            const rPos = floors[rIdx];
            Dungeon.map[rPos.y][rPos.x] = 'R'; // 赤宝箱
            floors.splice(rIdx, 1);
        }
    },
    
    setPlayerRandomSpawn: () => {
        const floors = Dungeon.collectTiles(Dungeon.map, ['T']);
        if (!floors.length) return;
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
        let spawn = null;
        if (stairs) {
            const dist = Dungeon.distanceMap(Dungeon.map, stairs);
            const reachable = floors.filter(p => dist[p.y][p.x] >= 0);
            const poolBase = reachable.length ? reachable : floors;
            const maxDist = Math.max(...poolBase.map(p => dist[p.y][p.x]));
            const candidates = poolBase.filter(p => dist[p.y][p.x] >= maxDist * 0.65);
            spawn = Dungeon.weightedPick(candidates.length ? candidates : poolBase, (p) => dist[p.y][p.x] + 1);
        } else {
            spawn = floors[Math.floor(Math.random() * floors.length)];
        }
        Field.x = spawn.x; Field.y = spawn.y;
        App.data.location.x = spawn.x; App.data.location.y = spawn.y;
        return;

        for(let i=0; i<1000; i++) { 
            const rx = Math.floor(Math.random() * Dungeon.width);
            const ry = Math.floor(Math.random() * Dungeon.height);
            if(Dungeon.map[ry][rx] === 'T') { 
                Field.x = rx; Field.y = ry;
                App.data.location.x = rx; App.data.location.y = ry;
                return; 
            }
        }
    },

    /* dungeon.js 390行目付近 */
	onBossDefeated: () => {
		// ★修正: ログ出力を状況に合わせて変更
		const isAbyss = (App.data.location.area === 'ABYSS');
		const isFixed = (Field.currentMapData && Field.currentMapData.isFixed);
        const isRiftBattle = !!(App.data.battle && (
            App.data.battle.isRiftBattle === true
            || App.data.battle.eventId === Dungeon.riftBattleEventId
        ));

        if (isRiftBattle) {
            Dungeon.completeAbyssRift();
            App.clearAction();
            if (typeof Field !== 'undefined') Field.render();
            if (App.data.battle) {
                App.data.battle.isBossBattle = false;
                App.data.battle.isSpecialBoss = false;
                App.data.battle.isEstark = false;
                App.data.battle.fixedBossId = null;
                App.data.battle.eventId = null;
                App.data.battle.isRiftBattle = false;
                App.data.battle.riftRewardId = null;
            }
            return;
        }

        const guildRun = Dungeon.getGuildQuestRun();
        if (guildRun && App.data.battle?.guildQuestChallengeId === guildRun.questId) {
            guildRun.completed = true;
            guildRun.completedAt = Date.now();
            if (typeof Guild !== 'undefined' && typeof Guild.markChallengeBossDefeated === 'function') {
                Guild.markChallengeBossDefeated(guildRun.questId);
            }
            App.log('<span style="color:#80ffb0;">依頼迷宮の討伐目標を達成した！</span>');
        }

        // 10～100階のイベント戦闘は、各階の最終戦を初めて討伐した時だけ実行する。
        // 100階の第1戦（phase1→phase2）はここでは完了扱いにしない。
        if (isAbyss) {
            const definition = Dungeon.getAbyssBossStoryDefinition(Dungeon.floor);
            const winEventId = App.data.battle?.storyWinEventId || null;
            if (definition && winEventId === definition.clearEventId) {
                Dungeon.markAbyssBossStoryDefeated(Dungeon.floor);
            }
        }

		if (isAbyss) {
			App.log(`地下 ${Dungeon.floor} 階ボス撃破！ボスの気配が消えた...`);
		}

		// 1. 固定マップ（試練の洞窟など）の場合
		if (isFixed) {
            const fixedHunter = App.data.battle?.fixedHunter;
            if (fixedHunter?.id) {
                const hunterMapKey = fixedHunter.mapKey || Dungeon.getCurrentFixedHunterKey?.();
                if (typeof Dungeon.markFixedHunterDefeated === 'function') {
                    Dungeon.markFixedHunterDefeated(fixedHunter.id, hunterMapKey);
                }
                const fixedStoryEventId = App.data.battle?.fixedStoryEventId;
                if (fixedStoryEventId) {
                    if (typeof StoryManager !== 'undefined' && typeof StoryManager.queueEvent === 'function') {
                        StoryManager.queueEvent(fixedStoryEventId, 'actions', {
                            save: false,
                            dedupeKey: `fixed-battle:${App.data.battle?.battleId || App.data.battle?.battleChainId || 'unknown'}:${fixedStoryEventId}`,
                            meta: { battleChainId: App.data.battle?.battleChainId || null }
                        });
                    } else {
                        if (!App.data.progress) App.data.progress = {};
                        App.data.progress.pendingEventId = fixedStoryEventId;
                    }
                }
                App.clearAction();
                App.save();
                if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
                return;
            }
            if (App.data.battle?.suppressFixedBossDefeat) {
                // 精霊試練の加護・結晶片・六属性完了報酬は、ドロップ表示と同じ
                // Battle.completeAbyssElementalTrial が唯一の正本。ここでは通常の
                // 固定ボス撃破マス処理だけを抑止し、報酬を重複加算しない。
                return;
            }
                const areaKey = Field.getCurrentAreaKey();
                const candidateFixedBossContext = App.data.progress?.activeFixedBossContext || null;
                const currentMapId = Field.currentMapData
                    ? (Field.currentMapData.id || Field.currentMapData.key || Field.currentMapData.areaKey || areaKey)
                    : areaKey;
                const currentChainId = App.data.battle?.battleChainId || null;
                const contextChainId = candidateFixedBossContext?.battleChainId || null;
                const battlePosition = App.data.battle?.fixedBossPosition || null;
                const legacyPositionMatches = candidateFixedBossContext && !contextChainId &&
                    String(candidateFixedBossContext.areaKey || '') === String(areaKey || '') &&
                    String(candidateFixedBossContext.mapId || candidateFixedBossContext.areaKey || '') === String(currentMapId || '') &&
                    Number(candidateFixedBossContext.fixedBossPosition?.x) === Number(battlePosition?.x) &&
                    Number(candidateFixedBossContext.fixedBossPosition?.y) === Number(battlePosition?.y);
                const activeFixedBossContext = candidateFixedBossContext &&
                    ((currentChainId && contextChainId && String(currentChainId) === String(contextChainId)) || legacyPositionMatches)
                    ? candidateFixedBossContext
                    : null;
                if (candidateFixedBossContext && !activeFixedBossContext) delete App.data.progress.activeFixedBossContext;
                const progressKey = App.data.battle?.fixedBossProgressKey || activeFixedBossContext?.progressKey || Dungeon.getFixedProgressKey(areaKey);
                const fixedBossPosition = App.data.battle?.fixedBossPosition || activeFixedBossContext?.fixedBossPosition;
                const bossX = Number.isFinite(Number(fixedBossPosition?.x)) ? Number(fixedBossPosition.x) : Field.x;
                const bossY = Number.isFinite(Number(fixedBossPosition?.y)) ? Number(fixedBossPosition.y) : Field.y;
                const posKey = `${bossX},${bossY}`;
                if (!App.data.progress) App.data.progress = {};
                App.data.progress.lastFixedBossEvent = {
                    areaKey,
                    progressKey,
                    position: { x: bossX, y: bossY },
                    monsterId: App.data.battle?.fixedBossId || null,
                    storyEventId: App.data.battle?.fixedStoryEventId || null,
                    eventId: App.data.battle?.storyWinEventId || App.data.battle?.fixedStoryEventId || App.data.battle?.eventId || null,
                    phase: (App.data.battle?.storyWinEventId || App.data.battle?.fixedStoryEventId) ? 'actions' : 'win'
                };
			
			if (!App.data.progress.defeatedBosses) App.data.progress.defeatedBosses = {};
			if (!App.data.progress.defeatedBosses[progressKey]) App.data.progress.defeatedBosses[progressKey] = [];
			
                const groupPositions = Array.isArray(App.data.battle?.fixedBossDefeatGroupPositions)
                    ? App.data.battle.fixedBossDefeatGroupPositions
                    : (Array.isArray(activeFixedBossContext?.defeatGroupPositions)
                        ? activeFixedBossContext.defeatGroupPositions
                        : [{ x: bossX, y: bossY }]);
                groupPositions.forEach(position => {
                    const groupPosKey = `${Number(position.x)},${Number(position.y)}`;
                    if (!App.data.progress.defeatedBosses[progressKey].includes(groupPosKey)) {
                        App.data.progress.defeatedBosses[progressKey].push(groupPosKey);
                    }
                });
                const clearedFlags = Array.isArray(App.data.battle?.fixedBossClearedFlags)
                    ? App.data.battle.fixedBossClearedFlags
                    : (Array.isArray(activeFixedBossContext?.clearedFlags) ? activeFixedBossContext.clearedFlags : []);
                clearedFlags.filter(Boolean).forEach(flag => {
                    App.data.progress.flags[flag] = true;
                });
            const fixedKeyReward = App.data.battle?.fixedKeyReward;
            const fixedKeyRewardColors = Array.isArray(fixedKeyReward?.colors)
                ? fixedKeyReward.colors
                : (fixedKeyReward?.color ? [fixedKeyReward.color] : []);
            fixedKeyRewardColors.filter(Boolean).forEach(color => {
                Dungeon.grantDungeonKey(color, 'fixedBoss', fixedKeyReward.scopeKey);
            });
            const fixedStoryEventId = App.data.battle?.fixedStoryEventId;
            if (fixedStoryEventId) {
                if (typeof StoryManager !== 'undefined' && typeof StoryManager.queueEvent === 'function') {
                    StoryManager.queueEvent(fixedStoryEventId, 'actions', {
                        save: false,
                        dedupeKey: `fixed-battle:${App.data.battle?.battleId || App.data.battle?.battleChainId || 'unknown'}:${fixedStoryEventId}`,
                        meta: { battleChainId: App.data.battle?.battleChainId || null }
                    });
                } else {
                    if (!App.data.progress) App.data.progress = {};
                    App.data.progress.pendingEventId = fixedStoryEventId;
                }
            }
            const fixedQuestId = App.data.battle?.fixedQuestId;
            if (fixedQuestId && typeof App.markQuestBossDefeated === 'function') {
                App.markQuestBossDefeated(fixedQuestId, { save: false });
            }
            if (activeFixedBossContext && App.data.progress?.activeFixedBossContext === activeFixedBossContext) {
                delete App.data.progress.activeFixedBossContext;
            }
			App.clearAction();
		} 
		// 2. ランダムダンジョン（ABYSS）の場合
		else if (isAbyss) {
            if (Dungeon.isMemoryRealm()) {
                const layout = Dungeon.getAbyssBossRoomLayout();
                const bossPos = App.data.battle?.abyssBossPosition || App.data.dungeon.abyssBossEncounter || layout.boss;
                if (Dungeon.map?.[bossPos.y]?.[bossPos.x]) Dungeon.map[bossPos.y][bossPos.x] = 'T';
                (layout.rewardChests || []).forEach(chest => {
                    if (Dungeon.map?.[chest.y]?.[chest.x]) Dungeon.map[chest.y][chest.x] = 'R';
                });
                Dungeon.map[layout.exitGate.y][layout.exitGate.x] = 'T';
                App.data.dungeon.memoryRewardChests = (layout.rewardChests || []).map(chest => ({ ...chest, floor:Dungeon.floor, active:true }));
                App.data.dungeon.memoryBossCleared = true;
                App.data.dungeon.healSpring = { active:true, floor:Dungeon.floor, x:layout.spring.x, y:layout.spring.y, image:Dungeon.healSpringImagePath };
                if (App.data.dungeon.abyssBossEncounter) App.data.dungeon.abyssBossEncounter.active = false;
                App.data.progress.flags.memoryRealmCleared = true;
                if (typeof AchievementManager !== 'undefined' && AchievementManager.checkProgress) AchievementManager.checkProgress({ save:false });
                App.log('<span style="color:#80ffb0;">追憶の魔境を踏破した！ 宝箱と帰還ゲートが現れた。</span>');
                Dungeon.saveMapData();
                Field.currentMapData = Dungeon.createRandomFieldMapData();
                App.clearAction();
            } else {
			// ボス撃破後の報酬配置。ボスの奥に階段・泉・レア宝箱を開放する。
			// 配置座標は getAbyssBossRoomLayout() と対応している。
			const layout = Dungeon.getAbyssBossRoomLayout ? Dungeon.getAbyssBossRoomLayout() : {
				centerX: 5,
				boss: { x: 5, y: 5 },
				stair: { x: 5, y: 1 },
				spring: { x: 4, y: 2 },
				rareChest: { x: 6, y: 2 }
			};
			const stair = layout.stair;
			const spring = layout.spring;
			const rareChest = layout.rareChest;
			const bossPos = App.data.battle?.abyssBossPosition || App.data.dungeon.abyssBossEncounter || layout.boss;
            const isStoryTerminalFloor = Dungeon.isStoryAbyss() && Number(Dungeon.floor || 1) >= 100;

			if (Dungeon.map?.[bossPos.y]?.[bossPos.x]) Dungeon.map[bossPos.y][bossPos.x] = 'T';
			if (Dungeon.map?.[layout.boss.y]?.[layout.centerX - 1]) Dungeon.map[layout.boss.y][layout.centerX - 1] = 'T';
			if (Dungeon.map?.[layout.boss.y]?.[layout.centerX + 1]) Dungeon.map[layout.boss.y][layout.centerX + 1] = 'T';
            if (!isStoryTerminalFloor && Dungeon.map?.[stair.y]?.[stair.x]) Dungeon.map[stair.y][stair.x] = 'S';
			if (Dungeon.map?.[rareChest.y]?.[rareChest.x]) Dungeon.map[rareChest.y][rareChest.x] = 'R';

			App.data.dungeon.healSpring = {
				active: true,
				floor: Dungeon.floor,
				x: spring.x,
				y: spring.y,
				image: Dungeon.healSpringImagePath,
			};
            if (App.data.dungeon.abyssBossEncounter && Number(App.data.dungeon.abyssBossEncounter.floor) === Number(Dungeon.floor)) {
                App.data.dungeon.abyssBossEncounter.active = false;
            }

            if (isStoryTerminalFloor) {
                App.log('<span style="color:#80ffb0;">物語深淵を踏破した！ ランダム深淵が解放されます。</span>');
            } else {
                App.log('<span style="color:#80ffb0;">階段が現れた！</span>');
            }
			Dungeon.saveMapData();

			// ボス撃破直後は足元にアクションを出さず、部屋上部の階段まで歩かせる。
			App.clearAction();
            }
		}
		// 3. それ以外（村でのイベントボスなど）
		else {
			// マップタイルの変更は行わず、アクションボタンだけクリアする
			App.clearAction();
		}
		
		if (typeof Field !== 'undefined') Field.render();
		
		// 戦闘データのクリーンアップ
		if (App.data.battle) {
			App.data.battle.isBossBattle = false;
			App.data.battle.isSpecialBoss = false;
			App.data.battle.isEstark = false;
			App.data.battle.fixedBossId = null; 
			App.data.battle.abyssBossEncounter = null;
			App.data.battle.abyssBossPosition = null;
		}
	}

};
