/* dungeon.js (完全統合版: 赤宝箱・出現ロジック・101階対応) */

const Dungeon = {
    floor: 0, width: 30, height: 30, map: [], pendingAction: null,

    // ランダム生成ダンジョン内の特殊オブジェクト設定。
    // タイル文字を増やすと既存の宝箱/階段/エンカウント処理に影響しやすいため、
    // 冒険者・回復の泉・深淵の裂け目は App.data.dungeon.* で別管理する。
    // 迷路マップ(genType === 2)だけは検証・メリハリ用に全特殊オブジェクトを100%出現させる。
    adventurerSpawnRate: 0.10,
    adventurerImagePath: 'assets/map/overlays/overlay_dungeon_adventurer_v001.png',
    adventurerPromptOpen: false,

    // 回復の泉: 通常フロアでは5%、迷路では100%。
    // 触れただけでは回復せず、アクションボタン押下で初めて回復する。
    healSpringSpawnRate: 0.05,
    healSpringImagePath: 'assets/effect/fx-buff-ai.png',

    // 深淵の裂け目: 通常フロアでは10%、迷路では100%。
    // 勝利後報酬のため、戦闘時の eventId はこの定数に統一する。
    abyssRiftSpawnRate: 0.10,
    abyssRiftImagePath: 'assets/effect/fx-abyss-vortex-ai.png',
    abyssRiftPromptOpen: false,
    riftBattleEventId: '__DUNGEON_ABYSS_RIFT__',
    mazeFloorSpawnRate: 0.05,
    mazeMemorySightRadius: 4,
    trialAngelSpawnRate: 0.05,
    trialAngelMinFloor: 50,
    trialAngelMinEncounterRank: 50,
    trialAngelImagePath: 'assets/map/overlays/overlay_dungeon_trial_angel_v001.png',

    // 溶岩フロア: 50階以降の通常マップで30%発生。
    // 発生時は通常宝箱を消し、床の25%を溶岩(M)にしてレア宝箱を2つだけ配置する。
    // Mは通行可能だが、踏むたびに最大HPの3%ダメージを受ける。
    lavaFloorMinFloor: 50,
    lavaFloorSpawnRate: 0.30,
    lavaTileImagePath: 'assets/map/objects/magma.png',
    lavaBattleBgKey: 'battle_bg_fire',

    keyDoorTiles: { X: 'red', Y: 'blue', Z: 'gold' },
    keyDoorSymbols: { red: 'X', blue: 'Y', gold: 'Z' },
    keyItemTiles: { Q: 'red', N: 'blue', O: 'gold' },
    keyItemSymbols: { red: 'Q', blue: 'N', gold: 'O' },
    keyColorLabels: { red: '赤', blue: '青', gold: '金' },
    keyGuardianImagePath: 'assets/map/overlays/overlay_monster_guardian_v001.png',
    randomVisualThemes: [
        { id: 'forest', themeKey: 'WIND_VILLAGE', battleBg: 'battle_bg_forest' },
        { id: 'tower', themeKey: 'BIG_TOWER', battleBg: 'battle_bg_big_tower' },
        { id: 'thunder', themeKey: 'THUNDER_FORT', battleBg: 'battle_bg_thunder_fort' },
        { id: 'light', themeKey: 'LIGHT_PALACE', battleBg: 'battle_bg_light_palace' },
        { id: 'dark', themeKey: 'DARK_CASTLE', battleBg: 'battle_bg_dark_castle' },
        { id: 'crena', themeKey: 'CRENA_CAVE', battleBg: 'battle_bg_crena' },
        { id: 'seabed', themeKey: 'SEABED_TEMPLE', battleBg: 'battle_bg_seabed' },
        { id: 'darkShrine', themeKey: 'DARK_SHRINE_RUINS', battleBg: 'battle_bg_dark_shrine' },
        { id: 'grezelia', themeKey: 'GREZELIA_CAVE', battleBg: 'battle_bg_grezelia' }
    ],

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

        return {
            type: 'fixedBoss',
            startEventId: bossDef.startEventId || null,
            areaKey,
            progressKey,
            mapId: currentMapDef?.id || currentMapDef?.key || currentMapDef?.areaKey || areaKey || null,
            fixedBossPosition: { x: fx, y: fy },
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
    
	getEntryChoices: () => {
		const maxF = App.data.dungeon.maxFloor || 0;

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

		const maxF = App.data.dungeon?.maxFloor || 0;
		const tryCount = App.data.dungeon?.tryCount || 0;
		const areaKey = App.data?.location?.area;
		const isFixedDungeonArea = !!(areaKey && typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]);
		const isInDungeon = !!(Field.currentMapData?.isDungeon || areaKey === 'ABYSS' || isFixedDungeonArea);
		const isBossFloor = isInDungeon && Dungeon.floor > 0 && Dungeon.floor % 10 === 0;
		const isOnBossTile = isInDungeon && Dungeon.map?.[Field.y]?.[Field.x] === 'B';
		const cannotExit = isBossFloor && isOnBossTile;

		if (isInDungeon) {
			content.innerHTML = `
				<div style="max-width:420px; margin:0 auto; display:flex; flex-direction:column; gap:14px;">
					<div style="font-size:22px; color:#ffd700; text-align:center; margin-bottom:4px;">探索中のダンジョン</div>

					<div style="border:1px solid rgba(244,201,93,0.48); border-radius:8px; padding:14px; background:rgba(255,255,255,0.04); line-height:1.6;">
						<div style="font-size:12px; color:#aaa;">現在地</div>
						<div style="font-size:20px; color:#fff; font-weight:bold;">地下 ${Dungeon.floor || App.data.progress.floor || 1} 階</div>
						<div style="font-size:11px; color:#aaa; margin-top:8px;">
							ダンジョン探索中です。脱出すると地上へ戻ります。
						</div>
					</div>

					<button class="menu-btn"
						style="width:100%; min-height:52px; ${cannotExit ? 'opacity:0.45;' : ''}"
						${cannotExit ? 'disabled' : ''}
						onclick="Dungeon.exitFromMenu()">
						${cannotExit ? '今は脱出できない' : 'ダンジョンから脱出する'}
					</button>

					${cannotExit ? `<div style="font-size:11px; color:#f88; text-align:center;">ボスを倒すまで脱出できません。</div>` : ''}
				</div>
			`;
			return;
		}

		const choices = Dungeon.getEntryChoices();

		const choiceHtml = choices.map(c => `
			<button class="menu-btn dungeon-entry-card"
				style="width:100%; min-height:58px; display:flex; flex-direction:column; align-items:flex-start; text-align:left;"
				onclick="Dungeon.startFromMenu(${c.floor})">
				<div style="font-size:16px; font-weight:bold; color:#fff;">${c.label}</div>
				<div style="font-size:10px; color:#aaa; margin-top:3px;">
					${c.floor === 1 ? '最初から挑戦します' : `地下 ${c.floor} 階から再開します`}
				</div>
			</button>
		`).join('');

		content.innerHTML = `
			<div style="max-width:420px; margin:0 auto; display:flex; flex-direction:column; gap:14px;">
				<div style="font-size:22px; color:#ffd700; text-align:center; margin-bottom:4px;">ダンジョンへ挑む</div>

				<div style="border:1px solid rgba(244,201,93,0.48); border-radius:8px; padding:14px; background:rgba(255,255,255,0.04);">
					<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
						<span style="font-size:12px; color:#aaa;">最高到達階層</span>
						<span style="font-size:16px; color:#ffd700; font-weight:bold;">${maxF} 階</span>
					</div>
					<div style="display:flex; justify-content:space-between; padding:6px 0;">
						<span style="font-size:12px; color:#aaa;">挑戦回数</span>
						<span style="font-size:14px; color:#fff;">${tryCount} 回</span>
					</div>
				</div>

				<div style="display:flex; flex-direction:column; gap:10px;">
					${choiceHtml}
				</div>
			</div>
		`;
	},

	startFromMenu: (startFloor) => {
		if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('abyss')) return;
		if (typeof Menu !== 'undefined') Menu.closeAll();
		Dungeon.start(startFloor);
	},

	exitFromMenu: () => {
		Menu.confirm("ダンジョンから脱出しますか？", () => {
			if (typeof Menu !== 'undefined') Menu.closeAll();
			Dungeon.exit(false);
		});
	},
	
	enter: () => {
		if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('abyss')) return;
		if (typeof App !== 'undefined' && typeof App.unlockFeature === 'function') App.unlockFeature('dungeonMenu');
		if (typeof Menu !== 'undefined' && typeof Menu.openSubScreen === 'function') {
			Menu.openSubScreen('dungeon');
			return;
		}

		Dungeon.start(1);
	},
	
    // --- ダンジョン突入・進行 ---
    start: (startFloor) => {
		if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('abyss')) return;
		if (typeof App !== 'undefined' && typeof App.unlockFeature === 'function') App.unlockFeature('dungeonMenu');
		if (!App.data.dungeon.returnPoint) {
			App.data.dungeon.returnPoint = {
				x: App.data.location.x,
				y: App.data.location.y,
				areaKey: typeof Field.getCurrentAreaKey === 'function' ? Field.getCurrentAreaKey() : 'WORLD',
                mapData: Field.currentMapData ? JSON.parse(JSON.stringify(Field.currentMapData)) : null
			};
		}

        App.data.location.area = 'ABYSS';
        App.data.progress.floor = startFloor;
        App.data.dungeon.tryCount++;
        App.data.dungeon.map = null;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
        Dungeon.loadFloor();
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
            const fixedAreaKey = areaKey || (Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area);
            return `FIXED:${fixedAreaKey || Field.currentMapData?.areaKey || 'UNKNOWN'}`;
        }
        const key = areaKey || (typeof Field !== 'undefined' && Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area || 'ABYSS');
        if (key === 'ABYSS') return `ABYSS:F${Number(Dungeon.floor || App.data?.progress?.floor || 1)}`;
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
        if (Dungeon.map?.[y]?.[x]) Dungeon.map[y][x] = 'T';
        Dungeon.grantDungeonKey(color, 'floor');
        Dungeon.saveMapData();
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
            fixedEnemyIds: [Number(guardian.monsterId || 100010)],
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

    changeFixedFloor: (toFloor, targetX = null, targetY = null) => {
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
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;

        Field.currentMapData = nextDef;
        if (typeof Dungeon.resetFixedHunterStateForCurrentMap === 'function') Dungeon.resetFixedHunterStateForCurrentMap();
        Field.x = targetX !== null && targetX !== undefined ? Number(targetX) : (nextDef.entryPoint?.x || 1);
        Field.y = targetY !== null && targetY !== undefined ? Number(targetY) : (nextDef.entryPoint?.y || 1);
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
        Dungeon.rollTrialAngelSpawn({ fixed: true });

        App.save();
        App.changeScene('field');
        App.log(`${nextDef.displayName || nextDef.name}へ移動した。`);
    },

    followFixedFloorLink: (link, mapDef = null) => {
        if (!link || !Field.currentMapData?.isFixed) return false;
        if (link.to === 'EXIT') {
            const forced = link.exitPoint ? {
                x: Number(link.exitPoint.x),
                y: Number(link.exitPoint.y),
                areaKey: link.exitPoint.areaKey || link.exitPoint.area || 'WORLD',
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
            Dungeon.changeFixedFloor(link.toFloor, link.targetX, link.targetY);
            return true;
        }
        return false;
    },

    tryFixedAutoFloorLink: (tile, x, y) => {
        if (!Field.currentMapData?.isFixed || !Field.currentMapData?.isDungeon) return false;
        const upper = String(tile || '').toUpperCase();
        if (!['S', 'D', 'U'].includes(upper)) return false;
        const link = (typeof MapRegistry !== 'undefined' && MapRegistry.findFloorLink)
            ? MapRegistry.findFloorLink(Field.currentMapData, x, y)
            : null;
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

            if (tile === 'S') {
                logIfNeeded('外への出口がある。');
                App.setAction('外に出る', () => Dungeon.exit(false));
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

            if (defeated) {
                App.clearAction();
                return true;
            }
            if (typeof Field !== 'undefined' && typeof Field.isFixedBossAvailable === 'function' && !Field.isFixedBossAvailable(bossDef)) {
                App.clearAction();
                return false;
            }
            if (bossDef?.requiredFlag && !flags[bossDef.requiredFlag]) {
                // ストーリー進行前の固定ボスは、存在しない床として扱う。
                // 例: 大灯台は入れるが、雷の要塞クリア前は結界炉・頂上ボスが出現しない。
                App.clearAction();
                return false;
            }
            if (bossDef?.questId) {
                if (!App.isQuestUnlocked(bossDef.questId)) {
                    App.clearAction();
                    return false;
                }
                if (App.getQuestState(bossDef.questId).state !== 'accepted') {
                    App.clearAction();
                    return false;
                }
            }

            logIfNeeded(bossDef?.inspectLog || 'ただならぬ気配が立ちはだかっている。');

            const actionLabel = (isIgnisGladRetryTile && flags.fireVolcanoSoldiersCleared)
                ? 'グラドに挑む'
                : (bossDef?.actionLabel || null);

            if (bossDef?.startEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                App.setAction(actionLabel || '対峙する', () => {
                    const fixedBossContext = Dungeon.buildFixedBossBattleContext(bossDef, x, y, mapDef);
                    if (fixedBossContext) {
                        if (!App.data.progress) App.data.progress = {};
                        App.data.progress.activeFixedBossContext = fixedBossContext;
                        if (typeof App.save === 'function') App.save();
                    }
                    StoryManager.executeEvent(bossDef.startEventId);
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
        if (!Field.isFixedBossAvailable?.(bossDef)) return false;
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
        if (typeof StoryManager !== 'undefined' && typeof StoryManager.prepareBattleTransitionUI === 'function') {
            StoryManager.prepareBattleTransitionUI();
        }
        Dungeon.startFixedBoss(x, y);
        return true;
    },

    startFixedBoss: (x, y) => {
        if (typeof StoryManager !== 'undefined' && typeof StoryManager.prepareBattleTransitionUI === 'function') {
            StoryManager.prepareBattleTransitionUI();
        }
        const mapDef = Field.currentMapData;
        const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
            ? MapRegistry.findFixedBoss(mapDef, x, y)
            : null;
        const fixedBossId = bossDef?.monsterId || null;
        const fixedBossIds = Array.isArray(fixedBossId) ? fixedBossId : [fixedBossId].filter(id => id !== null);
        const isSpecialBoss = fixedBossIds.some(id => {
            const numericId = Number(id);
            const base = window.MonsterData?.getMonsterById?.(numericId);
            return !!(base?.isSpecialBoss || base?.isEstark || numericId === 902000);
        });
        const fixedBossContext = Dungeon.buildFixedBossBattleContext(bossDef, x, y, mapDef);

        App.data.battle = {
            active: false,
            isBossBattle: true,
            isSpecialBoss,
            isEstark: isSpecialBoss,
            fixedBossId,
            fixedBossPosition: fixedBossContext?.fixedBossPosition || { x: Number(x), y: Number(y) },
            fixedBossProgressKey: fixedBossContext?.progressKey || null,
            fixedQuestId: fixedBossContext?.fixedQuestId || bossDef?.questId || null,
            bossStatMultiplier: fixedBossContext?.bossStatMultiplier || Math.max(1, Number(bossDef?.bossStatMultiplier || 1) || 1),
            fixedKeyReward: fixedBossContext?.fixedKeyReward || null,
            fixedStoryEventId: bossDef?.storyEventId || null,
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
    },

	
    // --- 固定ダンジョン（試練の洞窟など）への進入 ---
    canEnterFixedDungeon: (mapKey) => {
        const progress = App.data?.progress || {};
        const flags = progress.flags || {};
        const step = Number(progress.storyStep || 0);
        const sub = Number(progress.subStep || 0);
        const atLeast = (targetStep, targetSub = 0) => step > targetStep || (step === targetStep && sub >= targetSub);
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
            case 'DARK_CASTLE':
                return (flags.lightPalaceCleared || atLeast(8, 0))
                    ? ok()
                    : block('黒い城の気配は重い。今踏み込むには、まだ確かめるべきことが残っている。', 'locked_dark_castle');
            default:
                return ok();
        }
    },

    startFixed: (mapKey, options = {}) => {
        const gate = Dungeon.canEnterFixedDungeon(mapKey);
        if (!gate.ok) {
            if (gate.eventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                StoryManager.executeEvent(gate.eventId);
                return false;
            }
            if (gate.message) App.log(gate.message);
            return false;
        }
        const areaDef = Dungeon.getFixedFloorDef(mapKey, 1);
        if (!areaDef) return false;

        // 帰還地点の保存。
        // 固定ダンジョン内から別の固定ダンジョンへ入る場合は、元の帰還地点をスタックへ退避する。
        const makeReturnPoint = () => ({
            x: App.data.location.x,
            y: App.data.location.y,
            areaKey: App.data.location.area || 'WORLD',
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
        App.data.dungeon.map = null;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;

        Field.currentMapData = areaDef;
        if (typeof Dungeon.resetFixedHunterStateForCurrentMap === 'function') Dungeon.resetFixedHunterStateForCurrentMap();

        const selectedEntry = (options.entryKey && areaDef.entryPoints && areaDef.entryPoints[options.entryKey])
            ? areaDef.entryPoints[options.entryKey]
            : areaDef.entryPoint;
        Field.x = selectedEntry ? selectedEntry.x : 1;
        Field.y = selectedEntry ? selectedEntry.y : 1;
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
        Dungeon.rollTrialAngelSpawn({ fixed: true });

        if (typeof App.discoverFixedMap === 'function') App.discoverFixedMap(mapKey, { save: false });

        App.save();
        App.changeScene('field');
        App.log(`${areaDef.displayName || areaDef.name}に入った。`);
        return true;
    },

    nextFloor: () => {
        if (Field.currentMapData?.isFixed) {
            Dungeon.changeFixedFloor((App.data.progress.floor || 1) + 1);
            return;
        }
        App.data.progress.floor++;
        App.data.dungeon.map = null; 
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
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
        
        if (App.data.dungeon.map) {
            Dungeon.map = App.data.dungeon.map;
            Dungeon.width = App.data.dungeon.width;
            Dungeon.height = App.data.dungeon.height;
            if (!App.data.dungeon.visualThemeKey) Dungeon.rollRandomVisualTheme();
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
            App.log(`地下 ${Dungeon.floor} 階の冒険を再開します。`);
        } else {
            if(Dungeon.floor > App.data.dungeon.maxFloor) {
				App.data.dungeon.maxFloor = Dungeon.floor;
				
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
        
        Field.currentMapData = { 
            name: STORY_DATA.areas['ABYSS'].name,
			width: Dungeon.width, 
			height: Dungeon.height, 
			tiles: Dungeon.map, 
			isDungeon: true,
            themeKey: App.data.dungeon.visualThemeKey || 'DEFAULT',
            battleBg: App.data.dungeon.visualBattleBg || 'battle_bg_dungeon'
        };

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

    // --- 脱出処理 (安全装置付き) ---
    // 引数 isWipedOut が true の場合は強制的にデフォルトへ
    exit: (isWipedOut = false, forcedReturnPoint = null) => {
        const returnPoint = forcedReturnPoint || App.data.dungeon.returnPoint;
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
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        Dungeon.clearRandomKeyState();
        App.data.dungeon.keyGuardian = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
        App.data.progress.floor = 0;
        
        // 保存していた帰還ポイントを一度抽出してからクリア
        App.data.dungeon.returnPoint = null;
        if (forcedReturnPoint || isWipedOut) App.data.dungeon.returnStack = null;

        // デフォルトの帰還先 (ワールドマップの安全圏)
        let targetX = 58;
        let targetY = 65;
        let targetArea = 'WORLD';
        let targetMapData = null; 

        // 1. 全滅しておらず、かつ帰還データがある場合は一旦その場所を仮セット
        if (!isWipedOut && returnPoint) {
            targetX = returnPoint.x;
            targetY = returnPoint.y;
            targetArea = returnPoint.areaKey;
            targetMapData = returnPoint.mapData;
        }

        // 2. ★安全装置: 帰還先のタイルが「進行不可能」でないかチェック
        let isSafe = true;
        try {
            if (!targetMapData || targetArea === 'WORLD') {
                // ワールドマップの場合: W(海) または M(岩山) なら危険
                const tile = MAP_DATA[targetY][targetX].toUpperCase();
                if (tile === 'W' || tile === 'M') isSafe = false;
            } else {
                // 街や村（固定マップ）の場合: W(壁) なら危険
                const tile = targetMapData.tiles[targetY][targetX].toUpperCase();
                if (tile === 'W') isSafe = false;
            }
        } catch (e) {
            isSafe = false;
        }

        if (!isSafe) {
            App.log("<span style='color:#f88;'>帰還先が不安定だったため、安全な場所へ移動しました。</span>");
            targetX = 58;
            targetY = 65;
            targetArea = 'WORLD';
            targetMapData = null;
        }

        // アプリケーションデータへの反映
        App.data.location.area = targetArea;
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
        
        App.save();
        App.changeScene('field');
        
        if (isWipedOut) {
            App.log("命からがら逃げ出した……");
        } else {
            App.log("ダンジョンから脱出した");
        }
        App.clearAction();
    },
	
    // --- 移動・イベント処理 (全文) ---
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

        // ランダム生成ダンジョン内の冒険者NPC。
        // 接触時はその場で会話選択を出す。移動・エンカウント・宝箱処理とは独立管理。
        if (Dungeon.isAdventurerAt(x, y)) {
            Dungeon.encounterAdventurer({ auto: true });
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
        if (Dungeon.isHealSpringAt(x, y)) {
            App.log('<span style="color:#80ffb0;">清らかな泉が湧いている。</span>');
            App.setAction('泉で回復', () => Dungeon.useHealSpring());
            return;
        }

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
            App.log(Dungeon.isFixedChestOpenedAt(x, y) ? '開いたままの空箱がある。' : '宝箱がある。');
            App.setAction('調べる', () => Dungeon.openChest(x, y, 'normal'));
            return; 
        }
        if(tile === 'R') { 
            App.log(Dungeon.isFixedChestOpenedAt(x, y) ? '開いたままの空箱がある。' : '赤い宝箱がある。');
            App.setAction('調べる', () => Dungeon.openChest(x, y, 'rare'));
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
                if (Dungeon.prepareFixedTileAction(tile, x, y, { silent: false })) return;
            }

            App.log("ボスの気配が…");
            App.setAction("ボスと戦う", () => {
                if (Field.currentMapData.isFixed) {
                    Dungeon.startFixedBoss(x, y);
                    return;
                }
                if (App.data.battle) {
                    App.data.battle.isBossBattle = true;
                    //App.data.battle.isSpecialBoss = Dungeon.floor >= 300;
                    //App.data.battle.isEstark = Dungeon.floor >= 300;
                    //App.data.battle.fixedBossId = Dungeon.floor >= 300 ? 902000 : null;
                }
                App.changeScene('battle');
            });
        } 
		
		// 10n階のボスフロアでは通常床でもランダムエンカウントを発生させない。
		// ボス撃破後の階段・泉・レア宝箱へ向かう余韻を邪魔しないため。
		if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) {
			return;
		}

		// 通常床ではランダムエンカウントを発生させる
		// 宝箱・階段・出口・ボス・イベントアクション中は除外
		if ((tile === 'T' || tile === 'G' || tile === 'M') && !App.pendingAction) {
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
            
            if (App.data.progress.openedChests[progressKey].includes(posKey)) {
                App.log('空箱だ。中には何も残っていない。');
                return;
            }

            const mapDef = Dungeon.getFixedFloorDef(areaKey, App.data.progress.floor || 1) || FIXED_DUNGEON_MAPS[areaKey];
            const chestDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedChest)
                ? MapRegistry.findFixedChest(mapDef, x, y)
                : (mapDef.chests ? mapDef.chests.find(c => c.x === x && c.y === y) : null);

            if (chestDef) {
                App.data.progress.openedChests[progressKey].push(posKey);
                if (chestDef.keyColor) {
                    Dungeon.grantDungeonKey(chestDef.keyColor, 'chest');
                    App.save();
                    Field.render();
                    return;
                }
                const item = DB.ITEMS.find(i => i.id === chestDef.itemId);
                if (item) {
                    App.data.items[item.id] = (App.data.items[item.id] || 0) + 1;
                    App.log(`宝箱を開けた！`);
                    App.log(`<span style="color:#ffd700;">${item.name}</span> を手に入れた！`);
                } else {
                    App.log("宝箱は空だった…");
                }
            } else {
                App.data.progress.openedChests[progressKey].push(posKey);
                App.log("宝箱は空だった…");
            }
            App.save();
            Field.render(); 
            return;
        }

        // --- 2. ランダム生成ダンジョン（深淵の魔窟）の処理 ---
        const keyChest = Dungeon.findRandomKeyChest(x, y);
        if (keyChest) {
            keyChest.active = false;
            Dungeon.map[y][x] = 'T';
            Dungeon.grantDungeonKey(keyChest.color, 'chest');
            Dungeon.saveMapData();
            Field.render();
            return;
        }

        Dungeon.map[y][x] = 'T'; 
        Field.render();
        
        let msg = "";
        let hasRareDrop = false, hasUltraRareDrop = false;
        const floor = Dungeon.floor;

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
            if (Dungeon.floor >= 100) {
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
                const item = DB.ITEMS.find(i => i.id === 99);
                if(item) { 
                    App.data.items[item.id] = (App.data.items[item.id]||0)+1; 
					
					// ★累計獲得メダル（消費しても減らない）
					if (!App.data.stats) App.data.stats = {};
					App.data.stats.totalMedals = (App.data.stats.totalMedals || 0) + 1;
					
                    msg = `<span style="color:#ffd700;">${item.name}</span>`; 
                }
            }
            // --- 【優先度4】アイテム or GOLD（並列/最終候補） ---
            else {
                if (Math.random() < 0.5) {
                    // アイテム
                    const candidates = DB.ITEMS.filter(i => i.id !== 99 && i.type !== '貴重品' && i.rank <= floor);
                    const item = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : DB.ITEMS[0];
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

    isHealSpringAt: (x, y) => {
        if (Dungeon.getFixedHealSpringAt(x, y)) return true;
        const spring = App.data?.dungeon?.healSpring;
        if (!spring || !spring.active) return false;
        if (Number(spring.floor) !== Number(Dungeon.floor)) return false;
        return Number(spring.x) === Number(x) && Number(spring.y) === Number(y);
    },

    isAbyssRiftAt: (x, y) => {
        const rift = App.data?.dungeon?.abyssRift;
        if (!rift || !rift.active) return false;
        if (Number(rift.floor) !== Number(Dungeon.floor)) return false;
        return Number(rift.x) === Number(x) && Number(rift.y) === Number(y);
    },

    useHealSpring: () => {
        const fixedSpring = Dungeon.getFixedHealSpringAt(Field.x, Field.y);
        const spring = App.data?.dungeon?.healSpring;
        if (!fixedSpring && (!spring || !spring.active)) {
            if (typeof App.clearAction === 'function') App.clearAction();
            return;
        }
        if (!App.data || !Array.isArray(App.data.characters)) return;
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
        if (tile === 'B' && App.data.progress.defeatedBosses?.[Field.getCurrentProgressMapKey()]?.includes(`${x},${y}`)) tile = 'G';
        return tile !== 'W' && tile !== 'C' && tile !== 'R' && !Dungeon.isLockedDoorTile(tile);
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
        for (let i = 0; i < defs.length; i++) {
            const def = defs[i];
            const id = def.id || `hunter_${i}`;
            if (Dungeon.isFixedHunterDefeated(id, key)) continue;
            const pos = state?.[id];
            if (!pos?.active) continue;
            const rawSpeed = Number.isFinite(Number(def.speed)) ? Number(def.speed) : 2;
            const speed = Math.max(0, rawSpeed);
            const range = Math.max(1, Number(def.range || 99));
            const dist = Math.abs(Number(pos.x) - Field.x) + Math.abs(Number(pos.y) - Field.y);
            if (dist > range || speed <= 0) continue;

            pos.moveProgress = Number(pos.moveProgress || 0) + speed;
            const moveCount = Math.floor(pos.moveProgress);
            pos.moveProgress -= moveCount;
            if (moveCount <= 0) continue;

            for (let step = 0; step < moveCount; step++) {
                const dx = Field.x === pos.x ? 0 : (Field.x > pos.x ? 1 : -1);
                const dy = Field.y === pos.y ? 0 : (Field.y > pos.y ? 1 : -1);
                const horizontalFirst = Math.abs(Field.x - pos.x) >= Math.abs(Field.y - pos.y);
                const attempts = horizontalFirst ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
                let moved = false;
                for (const [mx, my] of attempts) {
                    if (!mx && !my) continue;
                    const nx = Number(pos.x) + mx;
                    const ny = Number(pos.y) + my;
                    if (!Dungeon.isFixedWalkableForEffect(nx, ny)) continue;
                    pos.x = nx;
                    pos.y = ny;
                    moved = true;
                    break;
                }
                if (!moved) break;
                if (Number(pos.x) === Number(Field.x) && Number(pos.y) === Number(Field.y)) {
                    App.log(def.message || '追跡する強敵に追いつかれた！');
                    Dungeon.triggerFixedEffectBattle({ ...def, id }, { statMultiplier: Number(def.statMultiplier || 1.8), hunterMapKey: key });
                    return true;
                }
            }
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
        const rank = Number(effect.rank || Field.currentMapData?.encounterRank || 80);
        const ids = Array.isArray(effect.monsterIds) && effect.monsterIds.length
            ? effect.monsterIds
            : [100064, 100065, 100066];
        const elements = ['火', '水', '風', '雷', '光', '闇'];
        const resistElm = elements[Math.floor(Math.random() * elements.length)];
        const atkElm = elements[Math.floor(Math.random() * elements.length)];
        App.log('天使の羽が黒く染まった。');
        return Dungeon.triggerFixedEffectBattle({
            ...effect,
            monsterIds: ids,
            statMultiplier: Number(effect.statMultiplier || 2.2),
            enemyBoost: {
                nameSuffix: '・試練',
                statMultiplier: 1,
                elmRes: { [resistElm]: 80 },
                elmAtk: { [atkElm]: 30 },
                resists: { Poison: 80, Shock: 80, Fear: 80, InstantDeath: 100, Debuff: 50 }
            }
        });
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
        if (App.data.battle) App.data.battle.angelTrial = null;
        return logs;
    },

    handleFixedTileEffect: (effect, dx = 0, dy = 0) => {
        if (!effect || !Field.currentMapData?.isFixed) return false;
        if (effect.type === 'poison') {
            Dungeon.damagePartyByFloorEffect(effect.damageRate || 0.06, effect.message || '毒沼でダメージを受けた！');
            return false;
        }
        if (effect.type === 'warp') {
            if (Number.isFinite(Number(effect.toX)) && Number.isFinite(Number(effect.toY))) {
                Field.x = Number(effect.toX);
                Field.y = Number(effect.toY);
                App.data.location.x = Field.x;
                App.data.location.y = Field.y;
                App.log(effect.message || '転移床が光った。');
                Field.refreshCurrentAction({ silent: false });
                return true;
            }
        }
        if (effect.type === 'ice') {
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
                const nextEffect = MapRegistry.findTileEffect(Field.currentMapData, sx, sy);
                if (nextEffect && nextEffect.type !== 'ice') break;
            }
            if (moved) {
                Field.x = sx;
                Field.y = sy;
                App.data.location.x = sx;
                App.data.location.y = sy;
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
            App.save();
            return;
        }
    },

    isMazeFloor: () => Number(App.data?.dungeon?.genType) === 2,

    isBossFloor: () => Number(Dungeon.floor || App.data?.progress?.floor || 0) > 0 && Number(Dungeon.floor || App.data?.progress?.floor || 0) % 10 === 0,

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
        const lines = [`地下 ${floor} 階に到達した`];

        if (Dungeon.isBossFloor()) {
            lines.push('部屋の中央から強大な気配を感じる…');
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
        return Object.entries(objects).some(([key, obj]) => {
            if (key === exceptKey) return false;
            if (!obj || !obj.active) return false;
            if (Number(obj.floor) !== Number(Dungeon.floor)) return false;
            return Number(obj.x) === Number(x) && Number(obj.y) === Number(y);
        });
    },

    getSpecialSpawnCandidates: () => {
        const candidates = [];
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return candidates;
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
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
        const floor = Math.max(1, Number(Dungeon.floor || App.data?.progress?.floor || 1));
        const band = window.MonsterData?.getMonsterBandForFloor?.(floor);
        const ids = Array.isArray(band?.monsters) ? band.monsters.map(m => Number(m?.id)).filter(Boolean) : [];
        if (ids.length) {
            return Array.from({ length: 3 }, () => ids[Math.floor(Math.random() * ids.length)]);
        }
        return [100064, 100065, 100066];
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
            if (Number(Dungeon.floor || 0) < Dungeon.trialAngelMinFloor) return null;
        }
        if (Math.random() >= Dungeon.trialAngelSpawnRate) return null;

        const candidates = fixed ? Dungeon.getFixedTrialAngelSpawnCandidates() : Dungeon.getSpecialSpawnCandidates();
        if (!candidates.length) return null;
        const pos = candidates[Math.floor(Math.random() * candidates.length)];
        const rank = fixed
            ? Number(Field.currentMapData?.encounterRank || Field.currentMapData?.rank || 80)
            : Number(Dungeon.floor || 80);
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
            image: Dungeon.adventurerImagePath
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

        App.data.dungeon.abyssRift = {
            active: true,
            floor: Dungeon.floor,
            x: pos.x,
            y: pos.y,
            image: Dungeon.abyssRiftImagePath,
        };
    },

    rollSpecialObjects: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.trialAngel = null;

        // 宝物庫フロアは報酬部屋として独立させる。
        // 冒険者/泉/裂け目まで重なると、宝物庫の見せ場が散るため出さない。
        if (App.data.dungeon.isTreasureRoom) return;

        // 迷路フロアだけは、冒険者・泉・裂け目を例外的に100%出す。
        // 通常フロアは各SpawnRateに従う。
        Dungeon.rollAdventurerSpawn();
        Dungeon.rollHealSpringSpawn();
        Dungeon.rollAbyssRiftSpawn();
        Dungeon.rollTrialAngelSpawn({ fixed: false });
    },

    encounterAdventurer: async (options = {}) => {
        const adv = App.data?.dungeon?.adventurer;
        if (!adv || !adv.active) return;
        if (Dungeon.adventurerPromptOpen) return;
        Dungeon.adventurerPromptOpen = true;
        App.clearAction();

        try {
            let accepted = true;

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showChoice === 'function') {
                StoryManager.active = true;
                accepted = await StoryManager.showChoice('なんと、冒険者と遭遇した！\n話しかけてみますか？');
            } else if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
                accepted = await new Promise(resolve => {
                    Menu.confirm('なんと、冒険者と遭遇した！\n話しかけてみますか？', () => resolve(true), () => resolve(false));
                });
            } else {
                accepted = false;
            }

            if (!accepted) {
                if (typeof StoryManager !== 'undefined' && typeof StoryManager.endConversation === 'function') {
                    StoryManager.endConversation();
                }
                Dungeon.adventurerPromptOpen = false;
                if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                    Field.refreshCurrentAction({ silent: true });
                }
                return;
            }

            const rewardFloor = Math.max(1, Number(Dungeon.floor || App.data.progress.floor || 1) + 5);
            const eq = App.createEquipByFloor('adventurer', rewardFloor, 3);
            App.data.inventory.push(eq);

            // 受け取り後は冒険者を消す。同じ階で再取得できないよう必ず保存する。
            App.data.dungeon.adventurer = null;
            App.save();
            if (typeof Field !== 'undefined') Field.render();

            const rewardText = `${eq.name}を手に入れた！`;

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showConversation === 'function') {
                const key = '__DUNGEON_ADVENTURER_REWARD__';
                StoryManager.scripts[key] = [
                    {
                        charId: 9998,
                        name: '冒険者',
                        text: 'こんなところで会うなんて、これも何かの縁だ。\nさっき手に入れた装備だが俺には使えないみたいだから、あんたにやるよ'
                    },
                    {
                        charId: 1000,
                        name: 'システム',
                        text: rewardText
                    }
                ];
                StoryManager.active = true;
                await StoryManager.showConversation(key, 0);
                StoryManager.endConversation();
                delete StoryManager.scripts[key];
            } else {
                App.log(`こんなところで会うなんて、これも何かの縁だ。<br>${rewardText}`);
            }
            App.log(`<span style="color:#ffd700;">${rewardText}</span>`);
			
        } finally {
            Dungeon.adventurerPromptOpen = false;
            if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                Field.refreshCurrentAction({ silent: true });
            }
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
                await StoryManager.showConversation(talkKey, 0);
                delete StoryManager.scripts[talkKey];
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

            const targetFloor = Math.max(1, Number(Dungeon.floor || App.data.progress.floor || 1) + 10);
            if (App.data?.dungeon?.abyssRift) App.data.dungeon.abyssRift.targetFloor = targetFloor;

            App.data.battle = {
                active: false,
                isBossBattle: true,
                isRiftBattle: true,
                isSpecialBoss: false,
                isEstark: false,
                fixedBossId: null,
                eventId: Dungeon.riftBattleEventId,
                riftFloor: targetFloor,
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
        if (!App.data?.dungeon) return;
        const rift = App.data.dungeon.abyssRift;
        const rewardFloor = Math.max(1, Number(rift?.targetFloor || App.data.battle?.riftFloor || Dungeon.floor + 10 || 1));
        const eq = App.createEquipByFloor('rift', rewardFloor, 3);
        App.data.inventory.push(eq);

        App.data.dungeon.abyssRift = null;
        App.data.dungeon.pendingRiftReward = {
            active: true,
            itemName: eq.name,
        };
        if (App.data.progress) delete App.data.progress.pendingBattleWinEventId;
        App.log('<span style="color:#c78cff;">亀裂の根源を打ち破った！</span>');
        App.save();
    },

    resumePendingRiftReward: async () => {
        const pending = App.data?.dungeon?.pendingRiftReward;
        if (!pending || !pending.active) return false;

        const itemName = pending.itemName || '輝く装備+3';
        App.data.dungeon.pendingRiftReward = null;
        App.save();

        const lines = [
            { charId: 1000, name: 'システム', text: '亀裂の根源を打ち破った！' },
            { charId: 1000, name: 'システム', text: '根源が消滅し、その跡から輝く装備を見つけた！！' },
            { charId: 1000, name: 'システム', text: `${itemName}を手に入れた！` }
        ];

        if (typeof StoryManager !== 'undefined' && typeof StoryManager.showConversation === 'function') {
            const key = '__DUNGEON_ABYSS_RIFT_REWARD__';
            StoryManager.scripts[key] = lines;
            StoryManager.active = true;
            await StoryManager.showConversation(key, 0);
            StoryManager.endConversation();
            delete StoryManager.scripts[key];
        } else {
            App.log(`亀裂の根源を打ち破った！<br>根源が消滅し、その跡から輝く装備を見つけた！！<br>${itemName}を手に入れた！`);
        }

        App.log(`<span style="color:#ffd700;">${itemName}を手に入れた！</span>`);

        if (typeof Field !== 'undefined') {
            if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
            if (typeof Field.render === 'function') Field.render();
        }
        return true;
    },

    isLavaFloorCandidate: () => {
        if (!App.data?.dungeon) return false;
        if (App.data.location.area !== 'ABYSS') return false;
        if (Dungeon.floor < Dungeon.lavaFloorMinFloor) return false;
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
            App.data.dungeon.keyChests = null;
            App.data.dungeon.floorKeys = null;
            App.data.dungeon.keyGuardian = null;
            App.data.dungeon.adventurer = null;
            App.data.dungeon.healSpring = null;
            App.data.dungeon.abyssRift = null;
            if (!keepVisited) App.data.dungeon.visitedMap = null;
            App.data.dungeon.genType = null;
            App.data.dungeon.genVariant = null;
            App.data.dungeon.visualThemeId = null;
            App.data.dungeon.visualThemeKey = null;
            App.data.dungeon.visualBattleBg = null;
        }
    },

    rollRandomVisualTheme: () => {
        if (!App.data?.dungeon || !Array.isArray(Dungeon.randomVisualThemes) || !Dungeon.randomVisualThemes.length) return null;
        const theme = Dungeon.randomVisualThemes[Dungeon.randInt(0, Dungeon.randomVisualThemes.length - 1)];
        App.data.dungeon.visualThemeId = theme.id;
        App.data.dungeon.visualThemeKey = theme.themeKey;
        App.data.dungeon.visualBattleBg = theme.battleBg;
        return theme;
    },

    pickRandomFloorType: () => {
        const r = Math.random();
        if (r < Dungeon.mazeFloorSpawnRate) return 2; // 迷路
        if (r < 0.32) return 0; // 部屋
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

    buildRandomFloorLayout: () => {
        Dungeon.rollRandomVisualTheme();
        if (Math.random() < 0.02) {
            Dungeon.generateTreasureRoom();
            if (App.data?.dungeon) App.data.dungeon.isTreasureRoom = true;
            return;
        }

        Dungeon.lastGenVariant = null;
        const type = Dungeon.pickRandomFloorType();

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

    finalizeRandomFloorFeatures: () => {
        // 50階以降の通常マップでは、30%で溶岩フロア化する。
        // 通常宝箱を消し、床の25%を溶岩にしてレア宝箱2個だけを配置する。
        // 迷路フロアでも通常どおり判定する。
        Dungeon.applyLavaFloorIfNeeded();

        Dungeon.applyKeyDoorPuzzleIfNeeded();

        // フロア生成完了後に特殊オブジェクトを配置する。
        // 冒険者・泉・裂け目はいずれも別管理にして、既存タイル文字を壊さない。
        // 特殊オブジェクト候補はT/Gのみなので、溶岩マス上には出現しない。
        Dungeon.rollSpecialObjects();
    },

    generateFallbackRandomFloor: () => {
        Dungeon.width = 15;
        Dungeon.height = 15;
        Dungeon.map = Dungeon.makeMap(Dungeon.width, Dungeon.height, 'W');
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

    validateGeneratedFloor: () => {
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return { ok: false, reason: 'map missing' };
        const start = { x: Number(Field.x), y: Number(Field.y) };
        const startTile = String(Dungeon.map[start.y]?.[start.x] || 'W').toUpperCase();
        if (startTile === 'W') return { ok: false, reason: `player starts in wall ${start.x},${start.y}` };

        if (Dungeon.isBossFloor()) {
            const bosses = Dungeon.collectTiles(Dungeon.map, ['B']);
            return bosses.length ? { ok: true } : { ok: false, reason: 'boss missing' };
        }

        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
        if (!stairs) return { ok: false, reason: 'stairs missing' };

        const dist = Dungeon.distanceMap(Dungeon.map, start);
        if (dist[stairs.y]?.[stairs.x] < 0) return { ok: false, reason: 'stairs unreachable' };

        const doors = [];
        Dungeon.map.forEach((row, y) => row.forEach((tile, x) => {
            const color = Dungeon.getDoorColor(tile);
            if (color) doors.push({ x, y, color });
        }));
        if (doors.length) {
            const keyColors = Dungeon.getActiveKeyColorsOnFloor();
            const missing = doors.find(door => !keyColors.has(door.color));
            if (missing) return { ok: false, reason: `${missing.color} key missing for door ${missing.x},${missing.y}` };
        }

        const isolatedWalls = Dungeon.countIsolatedWallTiles();
        if (isolatedWalls > 0) return { ok: false, reason: `${isolatedWalls} isolated wall tiles remain` };

        const chestBlocked = new Set(Dungeon.collectTiles(Dungeon.map, ['C', 'R']).map(p => `${p.x},${p.y}`));
        const chestBlockedDist = Dungeon.distanceMapWithBlocked(Dungeon.map, start, chestBlocked);
        if (chestBlockedDist[stairs.y]?.[stairs.x] < 0) return { ok: false, reason: 'chests block the route to stairs' };

        if (!Dungeon.validateKeyDoorPuzzle()) return { ok: false, reason: 'key-door route invalid' };
        return { ok: true };
    },

    generateFloor: () => {
        Dungeon.resetRandomFloorAttemptState(false);
        
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) {
            Dungeon.rollRandomVisualTheme();
            Dungeon.generateBossRoom();
        } else {
            let valid = false;
            let lastValidation = null;
            const maxAttempts = 12;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                Dungeon.resetRandomFloorAttemptState(attempt > 0);
                Dungeon.buildRandomFloorLayout();
                Dungeon.finalizeRandomFloorFeatures();
                lastValidation = Dungeon.validateGeneratedFloor();
                if (lastValidation.ok) {
                    valid = true;
                    break;
                }
            }

            if (!valid) {
                Dungeon.resetRandomFloorAttemptState(true);
                Dungeon.generateFallbackRandomFloor();
                Dungeon.finalizeRandomFloorFeatures();
                const fallbackValidation = Dungeon.validateGeneratedFloor();
                if (!fallbackValidation.ok && typeof console !== 'undefined' && console.warn) {
                    console.warn('Fallback random floor validation failed:', fallbackValidation.reason, lastValidation?.reason);
                }
            }
		}
        
        Field.currentMapData = { 
			name: STORY_DATA.areas['ABYSS'].name,
            width: Dungeon.width, 
            height: Dungeon.height, 
            tiles: Dungeon.map, 
            isDungeon: true,
            themeKey: App.data.dungeon.visualThemeKey || 'DEFAULT',
            battleBg: App.data.dungeon.visualBattleBg || 'battle_bg_dungeon'
        };
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
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
        const roomCount = 7 + Math.min(6, Math.floor(Dungeon.floor/8));
        
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

        let chests = Dungeon.randInt(3, 7) + Math.min(3, Math.floor(Dungeon.floor / 60));
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
        App.data.dungeon.keyChests = null;
        App.data.dungeon.floorKeys = null;
        App.data.dungeon.keyGuardian = null;

        if (App.data.dungeon.isTreasureRoom || Dungeon.isBossFloor()) return false;
        if (Dungeon.floor < 3) return false;
        const genType = Number(App.data.dungeon.genType);
        if (genType !== 0 && genType !== 2) return false;
        const roll = Math.random();
        const doorCount = Dungeon.floor >= 80
            ? (roll < 0.18 ? 3 : (roll < 0.62 ? 2 : 1))
            : (Dungeon.floor >= 25 ? (roll < 0.40 ? 2 : 1) : 1);
        if (doorCount <= 0) return false;

        const start = { x: Number(Field.x), y: Number(Field.y) };
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
        if (!stairs) return false;

        const colors = Dungeon.shuffle(['red', 'blue', 'gold']).slice(0, Math.min(3, doorCount));
        const protectedKeys = new Set([`${start.x},${start.y}`, `${stairs.x},${stairs.y}`]);
        const floorKeys = [];
        let placed = 0;

        for (const color of colors) {
            const path = Dungeon.findPathWithBlocked(Dungeon.map, start, stairs);
            if (path.length < 10) break;

            const from = Math.max(3, Math.floor(path.length * 0.32));
            const to = Math.min(path.length - 4, Math.floor(path.length * 0.78));
            const candidates = [];
            for (let i = from; i <= to; i++) {
                const p = path[i];
                if (!p || protectedKeys.has(`${p.x},${p.y}`)) continue;
                const tile = String(Dungeon.map[p.y]?.[p.x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                const blocked = new Set([`${p.x},${p.y}`]);
                const blockedDist = Dungeon.distanceMapWithBlocked(Dungeon.map, start, blocked);
                if (blockedDist[stairs.y][stairs.x] >= 0) continue;
                candidates.push(p);
            }
            if (!candidates.length) break;

            const door = Dungeon.weightedPick(candidates, (p) => {
                const idx = path.findIndex(q => q.x === p.x && q.y === p.y);
                return Math.max(1, idx);
            });
            if (!door) break;

            const blocked = new Set([`${door.x},${door.y}`]);
            const beforeDist = Dungeon.distanceMapWithBlocked(Dungeon.map, start, blocked);
            if (beforeDist[stairs.y][stairs.x] >= 0) break;
            const beforeCells = Dungeon.collectTiles(Dungeon.map, ['T', 'G'])
                .filter(p => beforeDist[p.y][p.x] >= 4 && Dungeon.canPlaceKeyFeatureAt(p, protectedKeys));
            if (!beforeCells.length) break;

            const keyPos = Dungeon.weightedPick(beforeCells, (p) => {
                const deadEnd = Dungeon.floorNeighbors(Dungeon.map, p.x, p.y, false) <= 1 ? 7 : 1;
                return (beforeDist[p.y][p.x] + 1) * deadEnd;
            });
            if (!keyPos) break;

            const symbol = Dungeon.keyDoorSymbols[color];
            Dungeon.map[door.y][door.x] = symbol;
            protectedKeys.add(`${door.x},${door.y}`);
            protectedKeys.add(`${keyPos.x},${keyPos.y}`);

            Dungeon.map[keyPos.y][keyPos.x] = Dungeon.keyItemSymbols[color] || 'Q';
            floorKeys.push({ active: true, floor: Dungeon.floor, x: keyPos.x, y: keyPos.y, color });
            placed++;
        }

        if (floorKeys.length) App.data.dungeon.floorKeys = floorKeys;
        if (!placed || !Dungeon.validateKeyDoorPuzzle()) {
            Dungeon.map = Dungeon.map.map(row => row.map(tile => (Dungeon.isLockedDoorTile(tile) || Dungeon.isKeyItemTile(tile)) ? 'T' : tile));
            App.data.dungeon.keyChests = null;
            App.data.dungeon.floorKeys = null;
            App.data.dungeon.keyGuardian = null;
            return false;
        }
        return true;
    },

    validateKeyDoorPuzzle: () => {
        const start = { x: Number(Field.x), y: Number(Field.y) };
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
        if (!stairs) return Dungeon.isBossFloor();

        const keyAt = new Map();
        (App.data.dungeon.keyChests || []).forEach(k => {
            if (k && k.active) keyAt.set(`${k.x},${k.y}`, k.color);
        });
        (App.data.dungeon.floorKeys || []).forEach(k => {
            if (k && k.active) keyAt.set(`${k.x},${k.y}`, k.color);
        });
        const guardian = App.data.dungeon.keyGuardian;
        if (guardian && guardian.active) keyAt.set(`${guardian.x},${guardian.y}`, guardian.color);

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
                if (tile === 'W') continue;
                const doorColor = Dungeon.getDoorColor(tile);
                if (doorColor && !(p.mask & colorBit[doorColor])) continue;
                let nextMask = p.mask;
                const tilePickup = Dungeon.getKeyItemColor(tile);
                if (tilePickup && colors.includes(tilePickup)) nextMask |= colorBit[tilePickup];
                const pickup = keyAt.get(`${nx},${ny}`);
                if (pickup && colors.includes(pickup)) nextMask |= colorBit[pickup];
                const key = `${nx},${ny},${nextMask}`;
                if (seen.has(key)) continue;
                seen.add(key);
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
        const isRiftBattle = App.data.battle && App.data.battle.eventId === Dungeon.riftBattleEventId;

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
            }
            return;
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
                    if (!App.data.progress) App.data.progress = {};
                    App.data.progress.pendingEventId = fixedStoryEventId;
                }
                App.clearAction();
                App.save();
                if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
                return;
            }
            if (App.data.battle?.suppressFixedBossDefeat) {
                return;
            }
                const areaKey = Field.getCurrentAreaKey();
                const activeFixedBossContext = App.data.progress?.activeFixedBossContext || null;
                const progressKey = App.data.battle?.fixedBossProgressKey || activeFixedBossContext?.progressKey || Dungeon.getFixedProgressKey(areaKey);
                const fixedBossPosition = App.data.battle?.fixedBossPosition || activeFixedBossContext?.fixedBossPosition;
                const bossX = Number.isFinite(Number(fixedBossPosition?.x)) ? Number(fixedBossPosition.x) : Field.x;
                const bossY = Number.isFinite(Number(fixedBossPosition?.y)) ? Number(fixedBossPosition.y) : Field.y;
                const posKey = `${bossX},${bossY}`;
			
			if (!App.data.progress.defeatedBosses) App.data.progress.defeatedBosses = {};
			if (!App.data.progress.defeatedBosses[progressKey]) App.data.progress.defeatedBosses[progressKey] = [];
			
			if (!App.data.progress.defeatedBosses[progressKey].includes(posKey)) {
				App.data.progress.defeatedBosses[progressKey].push(posKey);
			}
            const fixedKeyReward = App.data.battle?.fixedKeyReward;
            const fixedKeyRewardColors = Array.isArray(fixedKeyReward?.colors)
                ? fixedKeyReward.colors
                : (fixedKeyReward?.color ? [fixedKeyReward.color] : []);
            fixedKeyRewardColors.filter(Boolean).forEach(color => {
                Dungeon.grantDungeonKey(color, 'fixedBoss', fixedKeyReward.scopeKey);
            });
            const fixedStoryEventId = App.data.battle?.fixedStoryEventId;
            if (fixedStoryEventId) {
                if (!App.data.progress) App.data.progress = {};
                App.data.progress.pendingEventId = fixedStoryEventId;
            }
            const fixedQuestId = App.data.battle?.fixedQuestId;
            if (fixedQuestId && typeof App.markQuestBossDefeated === 'function') {
                App.markQuestBossDefeated(fixedQuestId);
            }
            if (App.data.progress?.activeFixedBossContext) {
                delete App.data.progress.activeFixedBossContext;
            }
			App.clearAction();
		} 
		// 2. ランダムダンジョン（ABYSS）の場合
		else if (isAbyss) {
			// ボス撃破後の報酬配置。足元を階段にする旧仕様ではなく、
			// ひし形ボス部屋の上端に階段、左下に全回復の泉、右下にレア宝箱を出す。
			// 配置座標は generateBossRoom() の 11x11 / 中心(5,5) / 半径4 と対応している。
			const stair = { x: 5, y: 1 };
			const spring = { x: 4, y: 2 };
			const rareChest = { x: 6, y: 2 };

			if (Dungeon.map?.[Field.y]?.[Field.x]) Dungeon.map[Field.y][Field.x] = 'T';
			if (Dungeon.map?.[stair.y]?.[stair.x]) Dungeon.map[stair.y][stair.x] = 'S';
			if (Dungeon.map?.[rareChest.y]?.[rareChest.x]) Dungeon.map[rareChest.y][rareChest.x] = 'R';

			App.data.dungeon.healSpring = {
				active: true,
				floor: Dungeon.floor,
				x: spring.x,
				y: spring.y,
				image: Dungeon.healSpringImagePath,
			};

			App.log('<span style="color:#80ffb0;">階段が現れた！</span>');
			Dungeon.saveMapData();

			// ボス撃破直後は足元にアクションを出さず、部屋上部の階段まで歩かせる。
			App.clearAction();
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
		}
	}

};
